import { describe, expect, test } from 'bun:test';
import { SIM_DT } from '../src/config';
import { killUnit } from '../src/game/combat';
import { createAnimal, createNinja, createRogue } from '../src/game/entities';
import type { Game } from '../src/game/game';
import { createNewGame } from '../src/game/newGame';
import { SYSTEMS } from '../src/game/systems';
import { bombBuilding } from '../src/game/systems/hostiles';
import { raidRoles } from '../src/game/systems/spawner';
import { buildingCenter, doorPos } from '../src/game/world';

const run = (g: Game, seconds: number, until?: () => boolean) => {
  for (let t = 0; t < seconds; t += SIM_DT) {
    g.state.time = 30; // de dia
    g.step(SIM_DT);
    if (until?.()) return;
  }
};
/** Tira os ninjas da vila de cena para o bicho/renegado agir sem ser abatido. */
const noDefenders = (g: Game) => {
  for (const u of g.state.units) if (u.kind === 'ninja') u.dead = true;
  g.state.buildings = g.state.buildings.filter((b) => b.type !== 'tower');
};

/** Um trecho reto e livre (sem prédio nem árvore) para testar corrida/bote: devolve o início em px. */
const openRow = (g: Game, len = 300) => {
  for (let y = 200; y < 1400; y += 32)
    for (let x = 100; x < 2000; x += 32) {
      let ok = true;
      for (let k = 0; k <= len && ok; k += 8) ok = g.world.walkablePx(x + k, y);
      if (ok) return { x, y };
    }
  throw new Error('sem espaço livre');
};

describe('inimigos novos', () => {
  test('corvos bicam a fazenda, levam comida e devolvem quando abatidos', () => {
    const g = createNewGame(SYSTEMS, 31);
    noDefenders(g);
    const farm = g.builtOf('farm')[0]!;
    const c = buildingCenter(farm);
    g.state.res.food = 100;
    const crow = createAnimal(g, 'crow', c.x, c.y);
    run(g, 30, () => (crow.loot?.food ?? 0) >= 4);
    expect(crow.loot?.food ?? 0).toBeGreaterThanOrEqual(4);
    const before = g.state.res.food;
    const taken = crow.loot!.food!;
    killUnit(g, crow, null);
    expect(g.state.res.food).toBeGreaterThanOrEqual(before + taken);
  });

  test('macaco rouba ryo da Residência e foge; abatido devolve o saque', () => {
    const g = createNewGame(SYSTEMS, 32);
    noDefenders(g);
    g.state.res.ryo = 500;
    const p = doorPos(g.hokage()!);
    const monkey = createAnimal(g, 'monkey', p.x + 60, p.y + 40);
    run(g, 40, () => !!monkey.loot);
    expect(monkey.loot?.ryo ?? 0).toBeGreaterThan(0);
    expect(monkey.state).toBe('escape');
    const ryo = g.state.res.ryo;
    const stolen = monkey.loot!.ryo!;
    killUnit(g, monkey, null);
    // devolve o saque (mais a recompensa do bicho)
    expect(g.state.res.ryo).toBeGreaterThanOrEqual(ryo + stolen);
    expect(monkey.loot).toBeUndefined();
  });

  test('bomba derruba o prédio pela metade e os moradores reconstroem', () => {
    const g = createNewGame(SYSTEMS, 33);
    const house = g.state.buildings.find((b) => b.type === 'house')!;
    bombBuilding(g, null, house);
    expect(house.built).toBe(false);
    expect(house.progress).toBeGreaterThan(0);
    run(g, 120, () => house.built);
    expect(house.built).toBe(true);
  });

  test('bombardeiro vai até um prédio e lança a bomba', () => {
    const g = createNewGame(SYSTEMS, 34);
    noDefenders(g);
    const house = g.state.buildings.find((b) => b.type === 'house')!;
    const c = buildingCenter(house);
    const b = createRogue(g, c.x + 160, c.y + 60, 6);
    b.role = 'bomber';
    run(g, 30, () => (b.bombs ?? 0) > 0);
    expect(b.bombs).toBe(1);
    expect(g.state.buildings.some((x) => !x.built)).toBe(true);
  });

  test('médico renegado cura o aliado ferido', () => {
    const g = createNewGame(SYSTEMS, 35);
    noDefenders(g);
    const ally = createRogue(g, 200, 200, 6);
    const medic = createRogue(g, 230, 200, 6);
    medic.role = 'medic';
    ally.hp = ally.maxHp * 0.3;
    const hp0 = ally.hp;
    run(g, 1);
    expect(ally.hp).toBeGreaterThan(hp0);
  });

  test('invasões trazem bombardeiro e médico conforme o tamanho e o dia', () => {
    expect(raidRoles(2, 3).filter(Boolean)).toEqual([]);
    expect(raidRoles(6, 2)).toEqual(['bomber', undefined]);
    expect(raidRoles(8, 4)).toEqual(['bomber', undefined, undefined, 'medic']);
  });

  test('aranha cospe teia que prende o ninja', () => {
    const g = createNewGame(SYSTEMS, 41);
    noDefenders(g);
    const o = openRow(g);
    const n = createNinja(g, o.x + 200, o.y, 'genin', 0);
    n.ninja!.order = 'train';
    const spider = createAnimal(g, 'spider', o.x + 110, o.y);
    spider.abilityCd = 0;
    let stunned = false;
    run(g, 6, () => (stunned = n.stun > 1));
    expect(stunned).toBe(true);
  });

  test('tigre das sombras dá bote e vai embora quando amanhece', () => {
    const g = createNewGame(SYSTEMS, 42);
    noDefenders(g);
    const o = openRow(g);
    const n = createNinja(g, o.x + 200, o.y, 'jounin', 0);
    const tiger = createAnimal(g, 'tiger', o.x + 100, o.y);
    tiger.abilityCd = 0;
    const hp0 = n.hp;
    g.state.time = 0; // noite
    g.step(1 / 60);
    expect(n.hp).toBeLessThan(hp0);
    expect(Math.hypot(tiger.x - n.x, tiger.y - n.y)).toBeLessThan(40);
    // de dia ele desiste
    n.dead = true;
    run(g, 1);
    expect(tiger.life).toBeLessThanOrEqual(0);
  });

  test('rinoceronte faz investida e atropela', () => {
    const g = createNewGame(SYSTEMS, 43);
    noDefenders(g);
    const o = openRow(g);
    const n = createNinja(g, o.x + 260, o.y, 'jounin', 0);
    const rhino = createAnimal(g, 'rhino', o.x + 100, o.y);
    rhino.abilityCd = 0;
    const hp0 = n.hp;
    run(g, 3, () => n.hp < hp0 && rhino.state !== 'charge');
    expect(n.hp).toBeLessThan(hp0);
  });
});
