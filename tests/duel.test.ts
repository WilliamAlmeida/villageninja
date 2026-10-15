// Retrato de ninja (game/snapshot.ts) e duelo por retrato na arena (game/duel.ts).
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { SAVE_VERSION, SIM_DT } from '../src/config';
import { layout, setLayout } from '../src/data/layout';
import { RANKS } from '../src/data/ninja';
import { duelBlock, duelCandidates, duelist, setDuelist, startDuel } from '../src/game/duel';
import { createNinja } from '../src/game/entities';
import { createTeam } from '../src/game/teams';
import { examStatus, startExam } from '../src/game/exam';
import type { Game } from '../src/game/game';
import { createNewGame } from '../src/game/newGame';
import { migrate } from '../src/game/save';
import { decodeSnapshot, encodeSnapshot, sanitize, snapshotOf, unitFromSnapshot } from '../src/game/snapshot';
import { SYSTEMS } from '../src/game/systems';
import { CENTER_TX, CENTER_TY } from '../src/game/world';

const run = (g: Game, seconds: number, until?: () => boolean) => {
  for (let t = 0; t < seconds; t += SIM_DT) {
    g.step(SIM_DT);
    if (until?.()) return;
  }
};

/** Vila com arena (terreno fixo abaixo), como em tests/exam.test.ts. */
function setup(seed: number) {
  const g = createNewGame(SYSTEMS, seed);
  g.state.level = 1;
  const tx = CENTER_TX + 5;
  const ty = CENTER_TY + 3;
  g.state.nodes = g.state.nodes.filter((n) => n.tx < tx - 1 || n.tx > tx + 6 || n.ty < ty - 1 || n.ty > ty + 6);
  g.reindex();
  g.addBuilding({ id: g.newId(), type: 'arena', tx, ty, built: true, progress: 99, desired: 0, workers: [], cd: 0 });
  return g;
}

const TEST_ARENA = {
  w: 6,
  h: 6,
  tiles: ['############', '############', '##........##', '##........##', '##........##', '##........##', '##........##', '##........##', '##........##', '##........##', '####gggg####', '####gggg####'],
};
let savedLayout: ReturnType<typeof layout>;
beforeAll(() => {
  savedLayout = layout();
  const L = JSON.parse(JSON.stringify(savedLayout));
  L.types.arena = { ...TEST_ARENA, points: {} };
  setLayout(L);
});
afterAll(() => setLayout(savedLayout));

describe('retrato de ninja', () => {
  test('codifica e decodifica igual; a unidade criada tem os mesmos atributos', () => {
    const g = createNewGame(SYSTEMS, 21);
    const u = createNinja(g, 100, 100, 'jounin', 2);
    u.name = 'Kenta Uzuki';
    u.ninja!.level = 17;
    u.ninja!.equip.weapon = 'ninjato';
    u.ninja!.kekkei = 'hyoton';
    const snap = snapshotOf(g, u);
    const text = encodeSnapshot(snap);
    expect(text.startsWith('VN1.')).toBe(true);
    expect(text).not.toMatch(/[+/=]/);
    const back = decodeSnapshot(text);
    expect(back).toEqual(snap);
    const v = unitFromSnapshot(g, back!, 50, 50);
    expect(v.faction).toBe('guest');
    expect(v.name).toBe('Kenta Uzuki (convidado)');
    expect(v.ninja!.level).toBe(17);
    expect(v.ninja!.stats).toEqual(snap.stats);
    expect(Math.abs(v.ninja!.stats.ninjutsu - u.ninja!.stats.ninjutsu)).toBeLessThan(0.01);
    expect(v.ninja!.jutsu).toEqual(u.ninja!.jutsu);
    expect(v.ninja!.equip.weapon).toBe('ninjato');
    expect(v.ninja!.kekkei).toBe('hyoton');
    expect(v.hp).toBe(v.maxHp);
  });

  test('retrato malicioso: atributos presos ao teto da patente, ids inventados caem, nome limpo, lixo dá null', () => {
    const bad = sanitize({
      v: 1, name: '<b>Zé</b> {ryo} "x"', rank: 'genin', nature: 'nada', level: 999,
      stats: { ninjutsu: 99, taijutsu: -5, forca: 'x' }, jutsu: ['chidori-inventado', 42],
      equip: { weapon: 'samehada', armor: 'kunai', item: 'ninjato' }, kekkei: 'rinnegan', bijuu: 99, look: { skin: 'red', hair: '#123456' },
    })!;
    expect(bad.name).toBe('bZéb ryo x');
    expect(bad.nature).toBe('katon');
    expect(bad.level).toBe(60);
    expect(bad.stats.ninjutsu).toBe(RANKS.genin.statCap);
    expect(bad.stats.taijutsu).toBe(0.3);
    expect(bad.stats.forca).toBe(1);
    expect(bad.jutsu).toEqual([null, null]);
    expect(bad.equip).toEqual({ weapon: 'samehada', armor: null, item: null }); // lâmina lendária vale no espaço da arma
    expect(bad.kekkei).toBeNull();
    expect(bad.bijuu).toBe(9);
    expect(bad.look.skin).toBe('#d9a97c');
    expect(bad.look.hair).toBe('#123456');
    expect(sanitize({ v: 2 })).toBeNull();
    expect(sanitize(null)).toBeNull();
    expect(decodeSnapshot('VN1.!!!')).toBeNull();
    expect(decodeSnapshot('qualquer coisa')).toBeNull();
  });
});

describe('duelo por retrato', () => {
  test('bloqueios: sem arena, com exame na arena, sem ninja', () => {
    const g = createNewGame(SYSTEMS, 22);
    expect(duelBlock(g)).toContain('Arena');
    const g2 = setup(23);
    expect(duelBlock(g2)).toBeNull();
    expect(duelist(g2)).toBeDefined();
    for (const u of g2.state.units.filter((x) => x.kind === 'ninja')) u.away = 1;
    expect(duelBlock(g2)).toContain('Nenhum ninja');
  });

  test('escolher o campeão; o retrato entra como convidado e o duelo vai até o fim sem promoção nem cooldown', () => {
    const g = setup(24);
    const s = g.state;
    const mine = duelCandidates(g)[1]!;
    expect(setDuelist(g, mine.id).ok).toBe(true);
    expect(duelist(g)!.id).toBe(mine.id);
    mine.ninja!.rank = 'genin';
    mine.ninja!.level = 5;
    // retrato de um ninja fraco: o nosso tende a vencer, mas o teste aceita os dois resultados
    const other = createNewGame(SYSTEMS, 25);
    const foe = createNinja(other, 10, 10, 'genin', 0);
    foe.name = 'Riku Hana';
    const snap = snapshotOf(other, foe);
    const nextDay = s.examNextDay;
    const r = startDuel(g, snap);
    expect(r.ok).toBe(true);
    expect(s.exam?.duel).toBe(true);
    expect(s.exam?.bracket.length).toBe(2);
    const guest = s.units.find((u) => u.faction === 'guest')!;
    expect(guest.name).toBe('Riku Hana (convidado)');
    expect(examStatus(g).reason).toContain('duelo');
    expect(startExam(g).ok).toBe(false);
    expect(startDuel(g, snap).ok).toBe(false);
    const xp0 = mine.ninja!.level * 1000 + mine.ninja!.xp;
    run(g, 240, () => !s.exam);
    expect(s.exam).toBeNull();
    expect(guest.dead).toBe(true);
    expect(mine.dead).toBe(false);
    expect(mine.ninja!.rank).toBe('genin');
    expect(mine.arenaSide).toBeUndefined();
    expect(mine.perch).toBeUndefined();
    expect(s.examNextDay).toBe(nextDay);
    expect(s.lastExam).toBeNull();
    expect(s.stats.duelsWon + s.stats.duelsLost).toBe(1);
    expect(s.lastDuel?.foe).toBe('Riku Hana');
    expect(s.lastDuel?.won).toBe(s.stats.duelsWon === 1);
    expect(mine.ninja!.level * 1000 + mine.ninja!.xp).toBeGreaterThan(xp0);
    expect(duelBlock(g)).toBeNull();
  });

  test('a equipe do campeão assiste da arquibancada e volta ao normal no fim', () => {
    const g = setup(26);
    const s = g.state;
    const [mine, a] = duelCandidates(g);
    const b = createNinja(g, mine!.x + 20, mine!.y, 'genin', 0);
    s.teams = [];
    createTeam(g).memberIds = [mine!.id, a!.id, b.id];
    const other = createNewGame(SYSTEMS, 27);
    const r = startDuel(g, snapshotOf(other, createNinja(other, 10, 10, 'genin', 0)), mine!.id);
    expect(r.ok).toBe(true);
    expect(s.exam?.watchers).toEqual([a!.id, b.id]);
    const guest = s.units.find((u) => u.faction === 'guest')!;
    expect(Math.sin(guest.facing)).toBeGreaterThan(0.5); // sentado olhando para a frente da tela
    run(g, 30, () => s.exam?.phase === 'fight');
    for (const w of [a!, b]) {
      expect(w.perch).toBeDefined();
      expect(w.arenaSide).toBe(0);
    }
    expect(mine!.arenaSide).toBe(1);
    run(g, 240, () => !s.exam);
    expect(s.exam).toBeNull();
    for (const w of [a!, b]) {
      expect(w.perch).toBeUndefined();
      expect(w.arenaSide).toBeUndefined();
      expect(w.state).not.toBe('exam');
    }
  });

  test('save v46 ganha o placar de duelos', () => {
    const g = createNewGame(SYSTEMS, 26);
    const old = JSON.parse(JSON.stringify(g.state));
    old.version = 46;
    delete old.stats.duelsWon;
    delete old.stats.duelsLost;
    delete old.lastDuel;
    const s = migrate(old)!;
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.stats.duelsWon).toBe(0);
    expect(s.stats.duelsLost).toBe(0);
  });
});
