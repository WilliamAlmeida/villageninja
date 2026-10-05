import { describe, expect, test } from 'bun:test';
import { SIM_DT } from '../src/config';
import { createNinja, createRogue } from '../src/game/entities';
import type { Game } from '../src/game/game';
import { createNewGame } from '../src/game/newGame';
import { adoptDog, dogOf, sniffRange } from '../src/game/ninken';
import { SYSTEMS } from '../src/game/systems';
import { occupantsOf } from '../src/game/interior';

const run = (g: Game, seconds: number) => {
  for (let t = 0; t < seconds; t += SIM_DT) {
    g.state.time = 30;
    g.step(SIM_DT);
  }
};

describe('ninken', () => {
  test('dono fora (em casa ou em expedição): o cão entra no Canil; dono volta: o cão sai e vai atrás', () => {
    const g = createNewGame(SYSTEMS, 125);
    Object.assign(g.state.res, { food: 999, ryo: 999 });
    for (const u of g.state.units) if (u.kind !== 'villager') u.dead = true; // sem distrações
    g.state.timers.animal = g.state.timers.raid = 1e9;
    const k = g.addBuilding({ id: g.newId(), type: 'kennel', tx: 30, ty: 20, built: true, progress: 99, desired: 0, workers: [], cd: 0 });
    const n = createNinja(g, 36 * 32, 24 * 32, 'genin', 0);
    expect(adoptDog(g, n.id).ok).toBe(true);
    const dog = dogOf(g, n)!;
    n.away = 999; // saiu numa expedição (a IA dele fica parada; em casa vale o mesmo: dono escondido)
    run(g, 20);
    expect(dog.hidden).toBe(true);
    expect(occupantsOf(g, k)).toContain(dog);
    n.away = undefined;
    run(g, 0.2);
    expect(dog.hidden).toBe(false);
  });

  test('raças: buldogue aguenta mais, pug fareja de mais longe', () => {
    const g = createNewGame(SYSTEMS, 124);
    Object.assign(g.state.res, { food: 999, ryo: 999 });
    g.addBuilding({ id: g.newId(), type: 'kennel', tx: 2, ty: 2, built: true, progress: 99, desired: 0, workers: [], cd: 0 });
    const a = createNinja(g, 700, 500, 'genin', 0);
    const b = createNinja(g, 760, 500, 'genin', 0);
    const c = createNinja(g, 820, 500, 'genin', 0);
    expect(adoptDog(g, a.id).ok).toBe(true);
    expect(adoptDog(g, b.id, 'bull').ok).toBe(true);
    expect(adoptDog(g, c.id, 'pug').ok).toBe(true);
    const shiba = dogOf(g, a)!;
    const bull = dogOf(g, b)!;
    const pug = dogOf(g, c)!;
    expect(shiba.breed).toBe('shiba');
    expect(bull.breed).toBe('bull');
    expect(bull.maxHp).toBeGreaterThan(shiba.maxHp * 1.5);
    expect(sniffRange(pug)).toBeGreaterThan(sniffRange(shiba));
  });

  test('adotar pede o Canil; o cão acompanha o dono e some se ele cair', () => {
    const g = createNewGame(SYSTEMS, 121);
    Object.assign(g.state.res, { food: 999, ryo: 999 });
    const n = createNinja(g, 700, 500, 'genin', 0);
    expect(adoptDog(g, n.id).ok).toBe(false);
    g.addBuilding({ id: g.newId(), type: 'kennel', tx: 2, ty: 2, built: true, progress: 99, desired: 0, workers: [], cd: 0 });
    expect(adoptDog(g, n.id).ok).toBe(true);
    expect(adoptDog(g, n.id).ok).toBe(false); // um por ninja
    const dog = dogOf(g, n)!;
    expect(dog.faction).toBe('village');
    n.dead = true;
    run(g, 0.2);
    expect(dog.dead).toBe(true);
  });

  test('o faro do cão descobre espião invisível', () => {
    const g = createNewGame(SYSTEMS, 122);
    Object.assign(g.state.res, { food: 999, ryo: 999 });
    g.addBuilding({ id: g.newId(), type: 'kennel', tx: 2, ty: 2, built: true, progress: 99, desired: 0, workers: [], cd: 0 });
    const n = createNinja(g, 600, 600, 'genin', 0);
    n.ninja!.stats.inteligencia = 1;
    adoptDog(g, n.id);
    const dog = dogOf(g, n)!;
    const foe = createRogue(g, dog.x + 100, dog.y, 9);
    foe.role = 'spy';
    foe.cloak = true;
    run(g, 0.3);
    expect(foe.cloak).toBe(false);
  });
});
