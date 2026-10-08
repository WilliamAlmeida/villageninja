import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { layout, setLayout } from '../src/data/layout';
import { SAVE_VERSION, SIM_DT } from '../src/config';
import { createAnimal, createNinja } from '../src/game/entities';
import { examStatus, setExamSize, startExam } from '../src/game/exam';
import { arenaRing, keepInRing } from '../src/game/arena';
import { push } from '../src/game/movement';
import type { Game } from '../src/game/game';
import { createNewGame } from '../src/game/newGame';
import { migrate } from '../src/game/save';
import { SYSTEMS } from '../src/game/systems';
import { CENTER_TX, CENTER_TY } from '../src/game/world';

const run = (g: Game, seconds: number) => {
  for (let t = 0; t < seconds; t += SIM_DT) g.step(SIM_DT);
};

function setup(seed: number, genins = 3) {
  const g = createNewGame(SYSTEMS, seed);
  g.state.level = 1;
  // como no jogo (não se constrói sobre rocha): nada de recurso dentro nem colado na arena
  const tx = CENTER_TX + 5;
  const ty = CENTER_TY + 3;
  g.state.nodes = g.state.nodes.filter((n) => n.tx < tx - 1 || n.tx > tx + 6 || n.ty < ty - 1 || n.ty > ty + 6);
  g.reindex();
  g.addBuilding({ id: g.newId(), type: 'arena', tx, ty, built: true, progress: 99, desired: 0, workers: [], cd: 0 });
  for (const u of g.state.units.filter((x) => x.kind === 'ninja')) u.ninja!.level = 2;
  for (let i = 2; i < genins; i++) createNinja(g, 1200, 800).ninja!.level = 3;
  return g;
}

/**
 * Terreno fixo da arena para os testes: muro em volta e portão de 2 tiles embaixo. Os testes conferem a MECÂNICA
 * (muro segura, portão deixa passar, ring-out); o terreno de verdade é ajustado no Editor de cenário e muda.
 */
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

describe('Exame Chunin', () => {
  test('arena redonda: os dois do duelo ficam dentro; empurrado para fora perde (ring-out)', () => {
    const g = setup(11, 2);
    startExam(g);
    const ex = g.state.exam!;
    const arena = g.state.buildings.find((b) => b.type === 'arena')!;
    const ring = arenaRing(arena);
    let guard = 0;
    while (ex.phase !== 'fight' && guard++ < 400) run(g, 0.1);
    expect(ex.phase).toBe('fight');
    const a = g.unit(ex.bracket[ex.match])!;
    const b = g.unit(ex.bracket[ex.match + 1])!;
    // Shunshin/Kawarimi pousam dentro
    const far = keepInRing(g, a, { x: ring.cx + 500, y: ring.cy });
    expect(Math.hypot(far.x - ring.cx, far.y - ring.cy)).toBeLessThan(ring.r);
    // andando para fora: volta para dentro
    a.x = ring.cx + ring.r + 30;
    a.y = ring.cy;
    a.knockT = 0;
    b.stun = 0.2; // sem um golpe de verdade empurrando `a` neste mesmo passo
    run(g, SIM_DT);
    expect(Math.hypot(a.x - ring.cx, a.y - ring.cy)).toBeLessThanOrEqual(ring.r);
    // o muro segura o empurrão (ninguém atravessa a parede)
    b.x = ring.cx + ring.r - 30;
    b.y = ring.cy;
    push(g, b, 80, 0);
    expect(g.world.walkablePx(b.x, b.y)).toBe(true);
    expect(Math.hypot(b.x - ring.cx, b.y - ring.cy)).toBeLessThan(ring.r);
    // empurrado para fora pelo portão: perde
    b.x = ring.cx;
    b.y = ring.cy + ring.r - 20;
    push(g, b, 0, 80);
    run(g, SIM_DT);
    expect(ex.entrants.find((e) => e.id === b.id)!.out).toBe(true);
  });

  test('arena é cercado: muro bloqueia, portão deixa passar', () => {
    const g = setup(13, 2);
    const a = g.state.buildings.find((b) => b.type === 'arena')!;
    g.world.rebuild();
    expect(g.world.walkable(a.tx, a.ty + 2)).toBe(false); // muro do lado
    expect(g.world.walkable(a.tx + 2, a.ty + 5)).toBe(true); // portão
    expect(g.world.walkable(a.tx + 2, a.ty + 2)).toBe(true); // chão
  });

  test('save 23: a arena que cresceu não fica em cima de outro prédio', () => {
    const g = setup(12, 2);
    const arena = g.state.buildings.find((b) => b.type === 'arena')!;
    const hk = g.state.buildings.find((b) => b.type === 'hokage')!;
    arena.tx = hk.tx + 5;
    arena.ty = hk.ty;
    const old = JSON.parse(JSON.stringify(g.state));
    old.version = 23;
    const s = migrate(old)!;
    const a2 = s.buildings.find((b) => b.type === 'arena')!;
    expect(a2.tx !== arena.tx || a2.ty !== arena.ty).toBe(true);
  });

  test('equipe no Exame não parte em expedição; save com alguém nos dois some do mapa e sai do Exame', async () => {
    const { teamBusy } = await import('../src/game/expeditions');
    const g = setup(12, 4);
    expect(startExam(g).ok).toBe(true);
    const ex = g.state.exam!;
    const team = g.state.teams.find((t) => t.memberIds.some((id) => ex.entrants.some((e) => e.id === id)))!;
    expect(teamBusy(g, team.id)).toContain('Exame');
    // save antigo: entrou na mina mesmo assim
    const u = g.unit(ex.entrants.find((e) => team.memberIds.includes(e.id))!.id)!;
    g.state.expeditions.push({ id: 777, kind: 'mine', teamId: team.id, unitIds: [u.id], floor: 0, timer: 1e9, status: 'going', log: [], loot: {}, day: 0 });
    u.away = 777;
    u.hidden = false;
    run(g, 1);
    expect(u.hidden).toBe(true);
    const x = u.x;
    run(g, 20);
    expect(u.x).toBe(x); // o Exame não o leva mais para lá e para cá
  });

  test('quem não luta assiste sentado na arquibancada; vagas 4 limitam os inscritos', () => {
    const g = setup(13, 6);
    expect(setExamSize(g, 4).ok).toBe(true);
    expect(startExam(g).ok).toBe(true);
    const ex = g.state.exam!;
    expect(ex.entrants.length).toBe(4);
    let guard = 0;
    while (ex.phase === 'gather' && guard++ < 300) run(g, 0.1);
    expect(ex.phase).not.toBe('gather');
    const a = g.unit(ex.bracket[ex.match])!;
    const b = g.unit(ex.bracket[ex.match + 1])!;
    expect(a.perch).toBeUndefined(); // desceu para lutar
    expect(b.perch).toBeUndefined();
    const watching = ex.entrants.map((e) => g.unit(e.id)!).filter((u) => u !== a && u !== b);
    expect(watching.every((u) => u.perch != null)).toBe(true);
    // fim do exame: todo mundo desce
    run(g, 400);
    expect(g.state.exam).toBeNull();
    expect(g.state.units.some((u) => !u.dead && u.perch != null)).toBe(false);
  });

  test('exige arena e genins de nível 2+', () => {
    const g = createNewGame(SYSTEMS, 1);
    expect(examStatus(g).ready).toBe(false);
    const g2 = setup(1);
    expect(examStatus(g2).ready).toBe(true);
    for (const u of g2.state.units.filter((x) => x.kind === 'ninja')) u.ninja!.level = 1;
    expect(examStatus(g2).ready).toBe(false);
  });

  test('completa vagas com convidados até 4 ou 8', () => {
    const g = setup(2, 3);
    expect(startExam(g).ok).toBe(true);
    const ex = g.state.exam!;
    expect(ex.entrants.length).toBe(4);
    expect(ex.entrants.filter((e) => !e.village).length).toBe(1);
    expect(g.state.units.filter((u) => u.faction === 'guest').length).toBe(1);
    // não pode convocar outro
    expect(startExam(g).ok).toBe(false);
  });

  test('o torneio termina, ninguém morre, convidados vão embora e há promoção', () => {
    const g = setup(3, 4);
    const ryo = g.state.res.ryo;
    const before = g.state.units.filter((u) => u.kind === 'ninja' && u.faction === 'village').length;
    startExam(g);
    let guard = 0;
    while (g.state.exam && guard++ < 600) run(g, 1);
    expect(g.state.exam).toBeNull();
    const result = g.state.lastExam!;
    expect(result.ranking.length).toBe(4);
    expect(result.champion.length).toBeGreaterThan(0);
    expect(g.state.units.filter((u) => u.kind === 'ninja' && u.faction === 'village').length).toBe(before);
    expect(g.state.units.some((u) => u.faction === 'guest')).toBe(false);
    expect(g.state.units.some((u) => u.arenaSide != null)).toBe(false);
    expect(g.state.res.ryo).toBeGreaterThan(ryo);
    // campeão da vila (se houver) é promovido
    const champ = result.ranking.find((r) => r.name === result.champion)!;
    if (champ.village) expect(champ.promoted).toBe(true);
    expect(g.state.examNextDay).toBeGreaterThan(g.state.day);
  });

  test('participantes não são atacados por animais nem atacam fora do duelo', () => {
    const g = setup(4, 2);
    startExam(g);
    const ids = g.state.exam!.entrants.map((e) => e.id);
    const wolf = createAnimal(g, 'wolf', g.unit(ids[0])!.x + 20, g.unit(ids[0])!.y);
    run(g, 5);
    expect(wolf.targetId == null || !ids.includes(wolf.targetId)).toBe(true);
    for (const id of ids) expect(g.unit(id)!.dead).toBe(false);
  });

  test('migra saves da versão 5', () => {
    const g = createNewGame(SYSTEMS, 5);
    const old = JSON.parse(JSON.stringify(g.state));
    old.version = 5;
    delete old.exam;
    delete old.examNextDay;
    delete old.lastExam;
    const s = migrate(old)!;
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.exam).toBeNull();
    expect(s.examNextDay).toBe(0);
  });
});
