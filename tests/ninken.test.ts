import { describe, expect, test } from 'bun:test';
import { SIM_DT } from '../src/config';
import { createNinja, createRogue } from '../src/game/entities';
import type { Game } from '../src/game/game';
import { createNewGame } from '../src/game/newGame';
import { adoptDog, dogOf } from '../src/game/ninken';
import { SYSTEMS } from '../src/game/systems';

const run = (g: Game, seconds: number) => {
  for (let t = 0; t < seconds; t += SIM_DT) {
    g.state.time = 30;
    g.step(SIM_DT);
  }
};

describe('ninken', () => {
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
