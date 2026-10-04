import { describe, expect, test } from 'bun:test';
import { DAY_LENGTH, SAVE_VERSION, SIM_DT } from '../src/config';
import { spawnBoss } from '../src/game/bosses';
import { canBuild, promote } from '../src/game/commands';
import { createNinja, refreshDerived } from '../src/game/entities';
import type { Game } from '../src/game/game';
import { currentKage, electionStatus, electKage } from '../src/game/kage';
import { createNewGame } from '../src/game/newGame';
import { migrate } from '../src/game/save';
import { SYSTEMS } from '../src/game/systems';
import { doorPos } from '../src/game/world';

const run = (g: Game, seconds: number) => {
  for (let t = 0; t < seconds; t += SIM_DT) g.step(SIM_DT);
};
const rich = (g: Game) => Object.assign(g.state.res, { ryo: 9999, food: 999, wood: 999, stone: 999 });

function jounin(g: Game, level = 10) {
  const hk = doorPos(g.hokage()!);
  const u = createNinja(g, hk.x + 30, hk.y + 30, 'jounin', 0);
  u.ninja!.level = level;
  return u;
}
function strong(g: Game) {
  for (const n of g.state.units.filter((u) => u.kind === 'ninja')) {
    const info = n.ninja!;
    info.rank = 'jounin';
    for (const k of Object.keys(info.stats) as (keyof typeof info.stats)[]) info.stats[k] = 9;
    info.jutsu = ['senpuu', 'goukakyuu'];
    info.nature = 'katon';
    refreshDerived(n);
    n.hp = n.maxHp;
  }
}

describe('Kage', () => {
  test('eleição exige Vila Oculta e Jounin nível 10+', () => {
    const g = createNewGame(SYSTEMS, 1);
    rich(g);
    const j = jounin(g, 9);
    expect(electionStatus(g).ready).toBe(false);
    g.state.level = 2;
    expect(electionStatus(g).ready).toBe(false);
    j.ninja!.level = 10;
    expect(electionStatus(g).ready).toBe(true);
    // promoção comum não vale para Kage
    expect(promote(g, j.id).ok).toBe(false);
  });

  test('cerimônia reúne a vila e coroa o Kage', () => {
    const g = createNewGame(SYSTEMS, 2);
    rich(g);
    g.state.level = 2;
    const j = jounin(g);
    expect(canBuild(g, 'monument').ok).toBe(false);
    expect(electKage(g, j.id).ok).toBe(true);
    run(g, 3);
    expect(g.state.units.filter((u) => u.state === 'ceremony').length).toBeGreaterThan(3);
    run(g, 12);
    expect(g.state.ceremony).toBeNull();
    expect(j.ninja!.rank).toBe('kage');
    expect(currentKage(g)?.id).toBe(j.id);
    expect(g.state.units.some((u) => u.state === 'ceremony')).toBe(false);
    expect(canBuild(g, 'monument').ok).toBe(true);
    expect(electKage(g, j.id).ok).toBe(false); // já tem Kage
  });

  test('quando o Kage cai, a vila pode eleger outro', () => {
    const g = createNewGame(SYSTEMS, 3);
    rich(g);
    g.state.level = 2;
    const j = jounin(g);
    electKage(g, j.id);
    run(g, 14);
    j.dead = true;
    run(g, 0.1);
    expect(g.state.kageId).toBeNull();
    jounin(g, 11);
    expect(electionStatus(g).ready).toBe(true);
  });
});

describe('ameaças chefes', () => {
  test('aviso prévio e depois a chegada', () => {
    const g = createNewGame(SYSTEMS, 4);
    g.state.level = 1;
    g.state.time = DAY_LENGTH * 5;
    g.state.bossTimer = 0.01;
    run(g, 0.1);
    expect(g.state.pendingBoss).not.toBeNull();
    run(g, 31);
    expect(g.state.pendingBoss).toBeNull();
    expect(g.state.units.some((u) => u.boss)).toBe(true);
  });

  test('ninjas fortes derrotam a Fera Colossal e ganham a recompensa', () => {
    const g = createNewGame(SYSTEMS, 5);
    g.state.level = 1;
    strong(g);
    const hk = doorPos(g.hokage()!);
    const [titan] = spawnBoss(g, 'titan', hk.x + 200, hk.y + 80);
    titan!.hp = titan!.maxHp = 300;
    const ryo = g.state.res.ryo;
    run(g, 60);
    expect(titan!.dead).toBe(true);
    expect(g.state.stats.bossesDefeated).toBe(1);
    expect(g.state.res.ryo).toBeGreaterThan(ryo);
  });

  test('guerra entre vilas traz comandante e esquadrão', () => {
    const g = createNewGame(SYSTEMS, 6);
    g.state.level = 3;
    const units = spawnBoss(g, 'war', 100, 100);
    expect(units.length).toBe(7);
    expect(units.filter((u) => u.boss).length).toBe(1);
  });

  test('migra saves da versão 7', () => {
    const g = createNewGame(SYSTEMS, 7);
    const old = JSON.parse(JSON.stringify(g.state));
    old.version = 7;
    for (const k of ['kageId', 'kageHistory', 'ceremony', 'bossTimer', 'pendingBoss']) delete old[k];
    delete old.stats.bossesDefeated;
    const s = migrate(old)!;
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.kageId).toBeNull();
    expect(s.bossTimer).toBeGreaterThan(0);
    expect(s.stats.bossesDefeated).toBe(0);
  });
});
