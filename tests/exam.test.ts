import { describe, expect, test } from 'bun:test';
import { SAVE_VERSION, SIM_DT } from '../src/config';
import { createAnimal, createNinja } from '../src/game/entities';
import { examStatus, startExam } from '../src/game/exam';
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
  g.addBuilding({ id: g.newId(), type: 'arena', tx: CENTER_TX + 5, ty: CENTER_TY + 3, built: true, progress: 99, desired: 0, workers: [], cd: 0 });
  for (const u of g.state.units.filter((x) => x.kind === 'ninja')) u.ninja!.level = 2;
  for (let i = 2; i < genins; i++) createNinja(g, 1200, 800).ninja!.level = 3;
  return g;
}

describe('Exame Chunin', () => {
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
