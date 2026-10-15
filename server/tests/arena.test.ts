// Servidor de duelos de ponta a ponta: sobe numa porta livre contra o banco de TESTE (TEST_DATABASE_URL em server/.env,
// esvaziado a cada rodada). Sem banco, os testes são pulados com aviso.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { config } from '../src/config';
import { createNewGame } from '../../src/game/newGame';
import { createNinja } from '../../src/game/entities';
import { encodeSnapshot, snapshotOf } from '../../src/game/snapshot';
import { SYSTEMS } from '../../src/game/systems';

const testUrl = config.testDatabaseUrl;
let dbOk = false;
let server: ReturnType<typeof import('../src/index').createServer> | undefined;
let base = '';
let db: typeof import('../src/db') | undefined;

if (testUrl) {
  Bun.env.ARENA_DATABASE_URL = testUrl; // antes de abrir a conexão
  db = await import('../src/db');
  dbOk = await db.testConnection();
  if (!dbOk) console.warn('Banco de teste indisponível (TEST_DATABASE_URL): testes do servidor pulados.');
} else console.warn('Sem TEST_DATABASE_URL em server/.env: testes do servidor pulados.');

/** Chamada à API como um jogador (token) ou anônima. */
async function api(method: string, path: string, body?: unknown, token?: string, extra: Record<string, string> = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, data: (await res.json()) as Record<string, any> };
}

/** Retrato de um ninja novo (força pela patente/nível). */
function makeCode(rank: 'genin' | 'chunin' | 'jounin', level: number, seed: number) {
  const g = createNewGame(SYSTEMS, seed);
  const u = createNinja(g, 10, 10, rank, 1);
  u.ninja!.level = level;
  return encodeSnapshot(snapshotOf(g, u));
}

const guest = async () => (await api('POST', '/api/auth/guest')).data.token as string;

describe.skipIf(!dbOk)('servidor de duelos', () => {
  beforeAll(async () => {
    await db!.migrate();
    await db!.truncateAll();
    const { createServer } = await import('../src/index');
    server = createServer(0);
    base = `http://localhost:${server.port}`;
  });
  afterAll(async () => {
    server?.stop(true);
    await db?.closeDb();
  });

  test('saúde e convidado automático; rota protegida sem token dá 401', async () => {
    expect((await api('GET', '/api/health')).data.ok).toBe(true);
    const r = await api('POST', '/api/auth/guest');
    expect(r.status).toBe(200);
    expect(r.data.account.isGuest).toBe(true);
    expect(r.data.token.length).toBeGreaterThan(20);
    const me = await api('GET', '/api/me', undefined, r.data.token);
    expect(me.data.account.id).toBe(r.data.account.id);
    expect(me.data.stats.rating).toBe(1000);
    expect(me.data.snapshot).toBeNull();
    expect((await api('GET', '/api/me')).status).toBe(401);
    expect((await api('GET', '/api/me', undefined, 'token-inventado-que-nao-existe-x')).status).toBe(401);
  });

  test('cadastro vira conta (apelido + senha), login abre outra sessão, nome mostrado muda', async () => {
    const token = await guest();
    const bad = await api('POST', '/api/auth/register', { username: 'ab', password: '123456' }, token);
    expect(bad.data.error).toBe('INVALID_USERNAME');
    const ok = await api('POST', '/api/auth/register', { username: 'kenta_1', password: 'segredo1' }, token);
    expect(ok.status).toBe(200);
    expect(ok.data.account.isGuest).toBe(false);
    expect((await api('POST', '/api/auth/register', { username: 'outro', password: 'segredo1' }, token)).data.error).toBe('ALREADY_REGISTERED');
    const t2 = await guest();
    expect((await api('POST', '/api/auth/register', { username: 'KENTA_1', password: 'segredo1' }, t2)).data.error).toBe('USERNAME_TAKEN');
    const login = await api('POST', '/api/auth/login', { login: 'Kenta_1', password: 'segredo1' });
    expect(login.status).toBe(200);
    expect(login.data.account.username).toBe('kenta_1');
    expect((await api('POST', '/api/auth/login', { login: 'kenta_1', password: 'errada' })).status).toBe(401);
    const name = await api('POST', '/api/me/name', { name: 'Kenta da Folha' }, login.data.token);
    expect(name.data.name).toBe('Kenta da Folha');
    expect((await api('POST', '/api/me/name', { name: '<x>' }, login.data.token)).data.error).toBe('INVALID_NAME');
    await api('POST', '/api/auth/logout', {}, token);
    expect((await api('GET', '/api/me', undefined, token)).status).toBe(401);
    expect((await api('GET', '/api/me', undefined, login.data.token)).status).toBe(200);
  });

  test('publicar retrato: válido entra com força; inventado e grande demais são recusados', async () => {
    const token = await guest();
    const pub = await api('PUT', '/api/snapshot', { code: makeCode('chunin', 8, 31) }, token);
    expect(pub.status).toBe(200);
    expect(pub.data.power).toBeGreaterThan(0);
    expect(pub.data.ninja.rank).toBe('chunin');
    expect((await api('GET', '/api/me', undefined, token)).data.snapshot.power).toBe(pub.data.power);
    expect((await api('PUT', '/api/snapshot', { code: 'VN1.lixo' }, token)).data.error).toBe('INVALID_SNAPSHOT');
    expect((await api('PUT', '/api/snapshot', { code: 'VN1.' + 'A'.repeat(9000) }, token)).data.error).toBe('INVALID_SNAPSHOT');
  });

  test('adversário por força parecida, duelo com ELO nos dois lados, ranking, defesas e revanche', async () => {
    await db!.truncateAll();
    const a = await guest();
    const b = await guest();
    const c = await guest();
    await api('PUT', '/api/snapshot', { code: makeCode('genin', 3, 41) }, a); // fraco
    await api('PUT', '/api/snapshot', { code: makeCode('genin', 4, 42) }, b); // parecido com a
    await api('PUT', '/api/snapshot', { code: makeCode('jounin', 30, 43) }, c); // muito mais forte
    const idB = (await api('GET', '/api/me', undefined, b)).data.account.id;
    const idC = (await api('GET', '/api/me', undefined, c)).data.account.id;
    // a procura: de força parecida só b
    for (let i = 0; i < 5; i++) expect((await api('GET', '/api/duel/opponent', undefined, a)).data.opponent.opponentId).toBe(idB);
    // sem ninguém parecido, cai em qualquer um (c só tem b e a, bem mais fracos)
    const forC = (await api('GET', '/api/duel/opponent', undefined, c)).data.opponent;
    expect([idB, (await api('GET', '/api/me', undefined, a)).data.account.id]).toContain(forC.opponentId);
    // começa e termina vencendo
    const st = await api('POST', '/api/duel/start', { opponentId: idB }, a);
    expect(st.status).toBe(200);
    expect(st.data.code.startsWith('VN1.')).toBe(true);
    expect((await api('POST', '/api/duel/finish', { duelId: st.data.duelId, won: true, summary: { by: 'ko' } }, a)).data.delta).toBe(16);
    expect((await api('POST', '/api/duel/finish', { duelId: st.data.duelId, won: true }, a)).data.error).toBe('DUEL_ALREADY_FINISHED');
    expect((await api('GET', '/api/me', undefined, a)).data.stats).toMatchObject({ rating: 1016, wins: 1, losses: 0 });
    expect((await api('GET', '/api/me', undefined, b)).data.stats).toMatchObject({ rating: 992, defWins: 0, defLosses: 1 });
    // duelo largado conta como derrota ao abrir o próximo; cancelar apaga sem contar
    const open = await api('POST', '/api/duel/start', { opponentId: idC }, a);
    const next = await api('POST', '/api/duel/start', { opponentId: idC }, a);
    expect(next.status).toBe(200);
    expect((await api('GET', '/api/me', undefined, a)).data.stats.losses).toBe(1);
    expect((await api('POST', '/api/duel/finish', { duelId: open.data.duelId, won: true }, a)).data.error).toBe('DUEL_ALREADY_FINISHED');
    expect((await api('POST', '/api/duel/cancel', { duelId: next.data.duelId }, a)).data.ok).toBe(true);
    expect((await api('GET', '/api/me', undefined, a)).data.stats.losses).toBe(1);
    // ranking: quem jogou aparece ordenado (o duelo largado deu -17 para a e +8 para c)
    const rk = await api('GET', '/api/duel/ranking', undefined, b);
    expect(rk.data.top.map((r: any) => r.rating)).toEqual([1008, 999, 992]);
    expect(rk.data.me.position).toBe(3);
    // defesas de b: a venceu; revanche de b contra a
    const def = await api('GET', '/api/duel/defenses', undefined, b);
    expect(def.data.unseen).toBe(1);
    expect(def.data.defenses[0]).toMatchObject({ held: false, left: false, defDelta: -8, revenged: false });
    expect(def.data.defenses[0].attackerNinja.rank).toBe('genin');
    expect(def.data.defenses[0].attackerCode.startsWith('VN1.')).toBe(true);
    expect(def.data.defenses[0].attackerRating).toBe(999);
    await api('POST', '/api/duel/defenses/seen', {}, b);
    expect((await api('GET', '/api/duel/defenses', undefined, b)).data.unseen).toBe(0);
    const rev = await api('GET', `/api/duel/opponent/${def.data.defenses[0].attacker.id}`, undefined, b);
    expect(rev.data.opponent.ninja.rank).toBe('genin');
    const rs = await api('POST', '/api/duel/start', { opponentId: rev.data.opponent.opponentId }, b);
    await api('POST', '/api/duel/finish', { duelId: rs.data.duelId, won: false }, b);
    expect((await api('GET', '/api/duel/defenses', undefined, b)).data.defenses[0].revenged).toBe(true);
    expect((await api('GET', '/api/duel/history', undefined, b)).data.duels[0].won).toBe(false);
    expect((await api('POST', '/api/duel/start', { opponentId: idB }, b)).data.error).toBe('DUEL_SELF');
  });

  test('sinais de trapaça: resultado rápido demais e vitória do fraco ficam marcados; limite de duelos por hora', async () => {
    await db!.truncateAll();
    const weak = await guest();
    const strong = await guest();
    await api('PUT', '/api/snapshot', { code: makeCode('genin', 2, 51) }, weak);
    await api('PUT', '/api/snapshot', { code: makeCode('jounin', 30, 52) }, strong);
    const idStrong = (await api('GET', '/api/me', undefined, strong)).data.account.id;
    const st = await api('POST', '/api/duel/start', { opponentId: idStrong }, weak);
    const fin = await api('POST', '/api/duel/finish', { duelId: st.data.duelId, won: true }, weak);
    expect(fin.status).toBe(200); // o resultado vale, mas fica sinalizado
    expect(fin.data.flags).toEqual(['fast', 'weak-win']);
    if (config.devPassword) {
      const sus = await api('GET', '/api/admin/suspicious', undefined, undefined, { 'X-Dev-Key': config.devPassword });
      expect(sus.data.duels.length).toBe(1);
      expect(sus.data.duels[0].flags).toContain('weak-win');
      const ov = await api('GET', '/api/admin/overview', undefined, undefined, { 'X-Dev-Key': config.devPassword });
      expect(ov.data.duels.flagged7d).toBe(1);
    }
    // 30 duelos abertos na hora: o 31º é recusado
    const idWeak = (await api('GET', '/api/me', undefined, weak)).data.account.id;
    let last = { status: 0, data: {} as Record<string, any> };
    for (let i = 0; i < 31; i++) last = await api('POST', '/api/duel/start', { opponentId: idWeak }, strong);
    expect(last.status).toBe(429);
    expect(last.data.error).toBe('TOO_MANY_DUELS');
  });

  test('painel do dono só com a senha', async () => {
    expect((await api('GET', '/api/admin/overview')).status).toBe(403);
    if (!config.devPassword) return;
    const r = await api('GET', '/api/admin/overview', undefined, undefined, { 'X-Dev-Key': config.devPassword });
    expect(r.status).toBe(200);
    expect(r.data.users.total).toBeGreaterThan(0);
  });
});
