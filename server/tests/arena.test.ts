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
  Bun.env.REDIS_PREFIX = 'vntest:'; // chaves próprias no Redis, apagadas a cada rodada
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
  // atributos fixos por patente: a força (atributos × (nível + 5)) fica previsível; sorteados, o "parecido" às vezes
  // saía dos ±30% e o teste da procura caía
  const stats = u.ninja!.stats as unknown as Record<string, number>;
  for (const k of Object.keys(stats)) stats[k] = rank === 'jounin' ? 40 : rank === 'chunin' ? 20 : 10;
  return encodeSnapshot(snapshotOf(g, u));
}

const guest = async () => (await api('POST', '/api/auth/guest')).data.token as string;

describe.skipIf(!dbOk)('servidor de duelos', () => {
  beforeAll(async () => {
    await db!.migrate();
    await db!.truncateAll();
    await (await import('../src/cache')).cache.clear();
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

  describe('login com Discord/Google e equipe', () => {
    /** Discord de mentira: troca de código e perfil pelo `code` que o teste manda. */
    const realFetch = globalThis.fetch;
    const saved = { discord: { ...config.discord }, google: { ...config.google }, admins: [...config.adminEmails] };
    const PROFILES: Record<string, Record<string, unknown>> = {
      dono: { id: '900', username: 'dono', global_name: 'Dono da Vila', email: 'dono@vila.test', verified: true, avatar: 'abc' },
      ana: { id: '901', username: 'ana', global_name: 'Ana', email: 'ana@vila.test', verified: true, avatar: null },
    };
    beforeAll(() => {
      config.discord.clientId = 'cid';
      config.discord.clientSecret = 'secret';
      config.google.clientId = config.google.clientSecret = '';
      config.adminEmails.length = 0;
      config.adminEmails.push('dono@vila.test');
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input instanceof Request ? input.url : input);
        if (url === 'https://discord.com/api/oauth2/token') {
          const form = new URLSearchParams(String(init?.body));
          expect(form.get('code_verifier')?.length).toBeGreaterThan(40);
          return Response.json({ access_token: `tok-${form.get('code')}` });
        }
        if (url === 'https://discord.com/api/users/@me') {
          const who = String(new Headers(init?.headers).get('authorization')).replace('Bearer tok-', '');
          return Response.json(PROFILES[who]);
        }
        return realFetch(input, init);
      }) as typeof fetch;
    });
    afterAll(() => {
      globalThis.fetch = realFetch;
      Object.assign(config.discord, saved.discord);
      Object.assign(config.google, saved.google);
      config.adminEmails.splice(0, config.adminEmails.length, ...saved.admins);
    });

    /** Faz a ida e a volta como o navegador: devolve o fragmento do endereço final. */
    async function social(code: string, query = 'return=/play', stateOverride?: string) {
      const start = await fetch(`${base}/api/auth/discord/start?${query}`, { redirect: 'manual' });
      expect(start.status).toBe(302);
      const to = new URL(start.headers.get('location')!);
      expect(to.origin + to.pathname).toBe('https://discord.com/oauth2/authorize');
      expect(to.searchParams.get('code_challenge_method')).toBe('S256');
      const state = stateOverride ?? to.searchParams.get('state')!;
      const back = await fetch(`${base}/api/auth/discord/callback?code=${code}&state=${state}`, { redirect: 'manual' });
      expect(back.status).toBe(302);
      const loc = new URL(back.headers.get('location')!);
      return { path: loc.pathname, hash: new URLSearchParams(loc.hash.slice(1)) };
    }

    test('provedor aparece configurado; convidado vincula o Discord e vira conta sem perder nada', async () => {
      expect((await api('GET', '/api/auth/providers')).data.providers).toEqual([{ id: 'discord', name: 'Discord' }]);
      const token = await guest();
      const before = (await api('GET', '/api/me', undefined, token)).data.account;
      const { ticket } = (await api('POST', '/api/auth/link-ticket', {}, token)).data;
      const r = await social('ana', `return=/play&ticket=${ticket}`);
      expect(r.path).toBe('/play');
      expect(r.hash.get('vn_linked')).toBe('1');
      const after = (await api('GET', '/api/me', undefined, r.hash.get('vn_token')!)).data.account;
      expect(after.id).toBe(before.id);
      expect(after.isGuest).toBe(false);
      expect(after.logins).toEqual(['discord']);
      expect(after.email).toBe('ana@vila.test');
      // entrar de novo (outro aparelho, sem bilhete) cai na mesma conta
      const again = await social('ana');
      expect((await api('GET', '/api/me', undefined, again.hash.get('vn_token')!)).data.account.id).toBe(before.id);
      // único jeito de entrar não sai
      expect((await api('POST', '/api/me/unlink', { provider: 'discord' }, token)).data.error).toBe('LAST_LOGIN');
    });

    test('estado inválido e retorno para fora do site são recusados', async () => {
      expect((await social('ana', 'return=/play', 'forjado')).hash.get('vn_error')).toBe('OAUTH_STATE');
      expect((await social('ana', 'return=//evil.example/x')).path).toBe('/play');
    });

    test('e-mail do dono vira admin; painel por papel, jogador comum barrado, troca de papel registrada', async () => {
      const owner = (await social('dono')).hash.get('vn_token')!;
      const who = await api('GET', '/api/admin/whoami', undefined, owner);
      expect(who.status).toBe(200);
      expect(who.data.actor.role).toBe('admin');
      const player = await guest();
      expect((await api('GET', '/api/admin/overview', undefined, player)).status).toBe(403);
      const target = (await api('GET', '/api/me', undefined, player)).data.account.id;
      const set = await api('POST', '/api/admin/role', { userId: target, role: 'mod' }, owner);
      expect(set.data.account.role).toBe('mod');
      expect((await api('GET', '/api/admin/overview', undefined, player)).status).toBe(200);
      // moderador não troca papéis; o dono não tira o próprio admin
      expect((await api('POST', '/api/admin/role', { userId: target, role: 'admin' }, player)).status).toBe(403);
      expect((await api('POST', '/api/admin/role', { userId: who.data.actor.id, role: 'player' }, owner)).data.error).toBe('OWN_ROLE');
      const log = (await api('GET', '/api/admin/log', undefined, owner)).data.actions as Array<{ action: string }>;
      expect(log.map((a) => a.action)).toEqual(expect.arrayContaining(['login', 'role']));
    });

    test('painel: quadros, jogadores e ações registradas; moderador não mexe em admin', async () => {
      const owner = (await social('dono')).hash.get('vn_token')!;
      const ownerId = (await api('GET', '/api/admin/whoami', undefined, owner)).data.actor.id;
      await (await import('../src/services/panel')).refreshDaily(3);
      const kpis = await api('GET', '/api/admin/kpis', undefined, owner);
      expect(kpis.data.total).toBeGreaterThan(0);
      const daily = await api('GET', '/api/admin/daily?days=7', undefined, owner);
      expect(daily.data.rows.length).toBeGreaterThan(0);
      expect(daily.data.rows.at(-1).newUsers).toBeGreaterThan(0);
      expect((await api('GET', '/api/admin/audience', undefined, owner)).data.logins.length).toBeGreaterThan(0);
      expect((await api('GET', '/api/admin/health', undefined, owner)).data.dbMs).toBeGreaterThanOrEqual(0);

      const victim = await guest();
      const vid = (await api('GET', '/api/me', undefined, victim)).data.account.id;
      const found = await api('GET', `/api/admin/players?q=${vid}`, undefined, owner);
      expect(found.data.players.map((p: { id: string }) => p.id)).toEqual([vid]);
      const act = (a: string, b: unknown, tok = owner) => api('POST', `/api/admin/players/${vid}/${a}`, b, tok);
      expect((await act('rename', { name: 'Nome Feio Trocado' })).data.player.name).toBe('Nome Feio Trocado');
      expect((await act('ban', {})).data.error).toBe('REASON_REQUIRED');
      expect((await act('ban', { reason: 'trapaça' })).data.player.banReason).toBe('trapaça');
      expect((await api('GET', '/api/me', undefined, victim)).status).not.toBe(200); // sessão apagada: vira outro convidado
      expect((await act('unban', {})).data.player.bannedAt).toBeNull();
      expect((await act('delete', { confirm: 'outro nome' })).data.error).toBe('CONFIRM_NAME');
      const detail = await api('GET', `/api/admin/players/${vid}`, undefined, owner);
      expect(detail.data.log.map((l: { action: string }) => l.action)).toEqual(expect.arrayContaining(['rename', 'ban', 'unban']));

      // moderador: age em jogador comum, não em conta da equipe
      const mod = await guest();
      const modId = (await api('GET', '/api/me', undefined, mod)).data.account.id;
      await api('POST', '/api/admin/role', { userId: modId, role: 'mod' }, owner);
      expect((await act('note', { note: 'visto' }, mod)).status).toBe(200);
      expect((await api('POST', `/api/admin/players/${ownerId}/ban`, { reason: 'x' }, mod)).status).toBe(403);
      expect((await act('delete', { confirm: 'Nome Feio Trocado' }, mod)).status).toBe(403);
      expect((await act('delete', { confirm: 'Nome Feio Trocado' })).data.deleted).toBe(true);
    });

    test('novidades: rascunho fica fora, publicada aparece em pt/en com texto escapado; perfil e origem', async () => {
      const owner = (await social('dono')).hash.get('vn_token')!;
      const page = async (p: string) => {
        const r = await fetch(base + p);
        return { status: r.status, text: await r.text() };
      };
      const draft = await api('POST', '/api/admin/news', { titlePt: 'Rascunho secreto', bodyPt: 'x' }, owner);
      expect(draft.status).toBe(200);
      expect((await page('/novidades/rascunho-secreto')).status).toBe(404);
      const pub = await api('POST', '/api/admin/news', {
        titlePt: 'Temporada 1 começou', summaryPt: 'Ranking zerado', titleEn: 'Season 1 is live',
        bodyPt: '## Novo\n\n- item **forte**\n- [ranking](/ranking)\n\n<script>alert(1)</script>', published: true,
      }, owner);
      expect(pub.status).toBe(200);
      expect((await api('POST', '/api/admin/news', { titlePt: 'Temporada 1 começou' }, owner)).data.error).toBe('SLUG_TAKEN');
      const pt = await page('/novidades/temporada-1-comecou');
      expect(pt.status).toBe(200);
      expect(pt.text).toContain('<h2>Novo</h2>');
      expect(pt.text).toContain('<b>forte</b>');
      expect(pt.text).toContain('<a href="/ranking">ranking</a>');
      expect(pt.text).not.toContain('<script>alert');
      expect((await page('/en/news/temporada-1-comecou')).text).toContain('Season 1 is live');
      expect((await page('/en/news')).status).toBe(200);

      // origem do convidado e perfil público
      const g = await api('POST', '/api/auth/guest', { ref: 'TikTok', refHost: 'www.m.facebook.com' });
      const id = g.data.account.id;
      const detail = await api('GET', `/api/admin/players/${id}`, undefined, owner);
      expect(detail.data.player.ref).toBe('tiktok');
      expect(detail.data.player.refHost).toBe('facebook.com');
      await (await import('../src/cache')).cache.del('panel:audience');
      const aud = await api('GET', '/api/admin/audience', undefined, owner);
      expect(aud.data.sources.map((x: { source: string }) => x.source)).toContain('?ref=tiktok');
      const prof = await page(`/jogador/${id}`);
      expect(prof.status).toBe(200);
      expect(prof.text).toContain(g.data.account.displayName);
      expect((await page(`/en/player/${id}`)).text).toContain('No champion published yet.');
      expect((await page('/jogador/00000000-0000-0000-0000-000000000000')).status).toBe(404);
    });

    test('avisos: jogador recebe, lido conta no painel; manutenção trava o duelo', async () => {
      const owner = (await social('dono')).hash.get('vn_token')!;
      const now = Date.now();
      const created = await api('POST', '/api/admin/notices', {
        kind: 'live', tone: 'warn', titlePt: 'Manutenção', textPt: 'Volta já', audience: 'all',
        startsAt: new Date(now - 60_000).toISOString(), endsAt: new Date(now + 600_000).toISOString(), blockFrom: new Date(now - 30_000).toISOString(),
      }, owner);
      expect(created.status).toBe(200);
      const p = await guest();
      const got = await api('GET', '/api/notices', undefined, p);
      expect(got.data.notices.map((n: { titlePt: string }) => n.titlePt)).toContain('Manutenção');
      expect(got.data.maintenance).not.toBeNull();
      await api('POST', `/api/notices/${created.data.id}/read`, {}, p);
      const start = await api('POST', '/api/duel/start', { opponentId: crypto.randomUUID() }, p);
      expect(start.status).toBe(423);
      expect(start.data.error).toBe('MAINTENANCE');
      const list = (await api('GET', '/api/admin/notices', undefined, owner)).data.notices as Array<{ id: number; delivered: number; readCount: number }>;
      const n = list.find((x) => x.id === created.data.id)!;
      expect(n.delivered).toBeGreaterThanOrEqual(1);
      expect(n.readCount).toBe(1);
      expect((await api('POST', '/api/admin/notices', { titlePt: '' }, owner)).data.error).toBe('TITLE_REQUIRED');
      expect((await api('DELETE', `/api/admin/notices/${created.data.id}`, undefined, owner)).status).toBe(200);
      await (await import('../src/cache')).cache.del('notices:maint');
    });
  });

  test('site: início e ranking em pt e en, arquivos com versão, 404 e nada fora da pasta', async () => {
    const get = async (p: string) => {
      const r = await fetch(base + p);
      return { status: r.status, type: r.headers.get('content-type') ?? '', cc: r.headers.get('cache-control') ?? '', text: await r.text() };
    };
    const home = await get('/');
    expect(home.status).toBe(200);
    expect(home.text).toContain('<html lang="pt-BR">');
    expect(home.text).toContain('href="/play"');
    expect(home.text).toContain('hreflang="en"');
    const en = await get('/en');
    expect(en.text).toContain('<html lang="en">');
    expect(en.text).toContain('Ninja Cursed Fight');
    expect(en.text).toContain('href="/en/login"');
    const old = await fetch(base + '/entrar?next=/play', { redirect: 'manual' });
    expect(old.status).toBe(301);
    expect(old.headers.get('location')).toBe('/login?next=/play');
    expect((await get('/privacidade')).text).toContain('Política de privacidade');
    expect((await get('/en/privacy')).text).toContain('Privacy policy');
    expect((await get('/en/terms')).text).toContain('Terms of use');
    expect((await get('/termos')).text).toContain('hreflang="en" href="http://localhost:3010/en/terms"');
    expect((await get('/en/ranking')).text).toContain('Duel leaderboard');
    const rk = await get('/ranking');
    expect(rk.text).toContain('Ranking de duelos');
    expect(rk.text).toContain('rank-wrap locked'); // trancado para quem não entrou com conta (site.js destranca)
    expect(rk.text).toContain('badge-ranks.png');
    expect((await get('/site/ui/badge-ranks.png')).type).toContain('image/png');
    expect((await get('/site/ui/..%2Fart%2Fx.png')).status).toBe(404);
    const css = home.text.match(/href="(\/site\/site\.css\?v=[0-9a-f]+)"/)![1]!;
    const asset = await get(css);
    expect(asset.status).toBe(200);
    expect(asset.cc).toContain('immutable');
    expect((await get('/site/art/scene-village.png')).type).toContain('image/png');
    expect((await get('/site/img/hero.webp')).status).toBe(200);
    expect((await get('/nada-aqui')).status).toBe(404);
    expect((await get('/site/..%2F..%2F.env')).status).toBe(404);
    expect((await get('/site/art/..%2F..%2F..%2F..%2Fserver%2F.env')).status).toBe(404);
  });
});
