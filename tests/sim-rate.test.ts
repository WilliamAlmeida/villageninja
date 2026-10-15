import { describe, expect, test } from 'bun:test';
import { SIM_DT } from '../src/config';
import { placeBuilding } from '../src/game/commands';
import { createNinja, createRogue } from '../src/game/entities';
import type { Game } from '../src/game/game';
import { createNewGame } from '../src/game/newGame';
import { SYSTEMS } from '../src/game/systems';
import { CENTER_TX, CENTER_TY, doorPos } from '../src/game/world';

// Processamento Reduzido (Configurações): a simulação dá passos com o dobro do tempo (30 por segundo). O jogo tem que
// continuar funcionando igual: obra, coleta, caminho e luta.
const run = (g: Game, seconds: number, dt: number) => {
  for (let t = 0; t < seconds; t += dt) g.step(dt);
};

describe('processamento reduzido (passo de 1/30 s)', () => {
  for (const [name, dt] of [
    ['normal', SIM_DT],
    ['reduzido', SIM_DT * 2],
  ] as const)
    test(`${name}: obra sai e a vila coleta`, () => {
      const g = createNewGame(SYSTEMS, 42);
      g.state.timers.animal = g.state.timers.raid = 1e9;
      expect(placeBuilding(g, 'lumber', CENTER_TX + 6, CENTER_TY + 3).ok).toBe(true);
      const wood = g.state.res.wood;
      run(g, 90, dt);
      expect(g.state.buildings.find((b) => b.type === 'lumber')!.built).toBe(true);
      expect(g.state.res.wood).toBeGreaterThan(wood - 60); // a obra gasta, a coleta repõe
      expect(g.state.units.every((u) => Number.isFinite(u.x) && Number.isFinite(u.y))).toBe(true);
    });

  test('a luta decide do mesmo jeito: o ninja derruba o renegado fraco nos dois passos', () => {
    const fight = (dt: number, seed: number) => {
      const g = createNewGame(SYSTEMS, seed);
      g.state.timers.animal = g.state.timers.raid = 1e9;
      const d = doorPos(g.hokage()!);
      const ninja = createNinja(g, d.x + 40, d.y + 60, 'chunin', 0);
      const foe = createRogue(g, d.x + 90, d.y + 70, 1);
      run(g, 40, dt);
      return { foeDead: foe.dead, ninjaAlive: !ninja.dead, foeHp: foe.hp / foe.maxHp };
    };
    for (const seed of [11, 12, 13]) {
      const a = fight(SIM_DT, seed);
      const b = fight(SIM_DT * 2, seed);
      expect(a.foeDead).toBe(true);
      expect(b.foeDead).toBe(true);
      expect(b.ninjaAlive).toBe(a.ninjaAlive);
    }
  });
});
