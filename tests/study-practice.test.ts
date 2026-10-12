import { describe, expect, test } from 'bun:test';
import { SIM_DT } from '../src/config';
import { JUTSUS } from '../src/data/jutsus';
import { placeBuilding, recruitNinja, teachJutsu } from '../src/game/commands';
import { createNewGame } from '../src/game/newGame';
import { SYSTEMS } from '../src/game/systems';
import { PRACTICE_FROM } from '../src/game/systems/ninjas';
import { CENTER_TX, CENTER_TY } from '../src/game/world';
import type { Game } from '../src/game/game';
import type { Unit } from '../src/game/types';

const setup = (seed: number, jutsuId: string) => {
  const g = createNewGame(SYSTEMS, seed);
  g.state.res = { wood: 999, stone: 999, food: 999, ryo: 9999, iron: 999, herbs: 999, paper: 999, crystal: 0, gold: 0, darksteel: 0 };
  g.state.timers.animal = g.state.timers.raid = 1e9;
  for (const x of g.state.units) if (x.faction !== 'village') x.dead = true; // bicho do mapa ferindo o aluno o manda descansar antes
  expect(placeBuilding(g, 'academy', CENTER_TX - 7, CENTER_TY + 3).ok).toBe(true);
  for (let t = 0; t < 60; t += SIM_DT) g.step(SIM_DT);
  expect(recruitNinja(g).ok).toBe(true);
  const u = g.state.units.filter((x) => x.kind === 'ninja' && x.faction === 'village').at(-1)!;
  const n = u.ninja!;
  for (const k of Object.keys(n.stats) as (keyof typeof n.stats)[]) n.stats[k] = 5;
  n.nature = JUTSUS[jutsuId]!.nature ?? n.nature;
  expect(teachJutsu(g, u.id, jutsuId, 0).ok).toBe(true);
  return { g, u };
};

/** Roda até a condição (ou o limite) e devolve se aconteceu. */
const until = (g: Game, s: number, ok: () => boolean) => {
  for (let t = 0; t < s; t += SIM_DT) {
    g.step(SIM_DT);
    if (ok()) return true;
  }
  return false;
};

describe('estudo de jutsu: lê na Academia, pratica no campo', () => {
  test('1ª metade escondido na Academia; depois sai, pratica à vista e aprende', () => {
    const { g, u } = setup(7, 'mizurappa');
    const L = () => u.ninja!.learning;
    expect(until(g, 60, () => u.state === 'learn')).toBe(true);
    expect(u.hidden).toBe(true);
    expect(L()!.progress).toBeLessThan(L()!.total * PRACTICE_FROM);
    expect(until(g, 120, () => u.state === 'practice')).toBe(true);
    expect(u.hidden).toBe(false);
    expect(L()!.progress).toBeGreaterThanOrEqual(L()!.total * PRACTICE_FROM);
    // ninjutsu: ensaia os selos
    expect(until(g, 6, () => u.animKind === 'seals')).toBe(true);
    expect(until(g, 200, () => u.ninja!.jutsu[0] === 'mizurappa')).toBe(true);
    expect(u.state).not.toBe('practice');
  });

  test('taijutsu com coreografia ensaia os passos dela, sem dano em ninguém', () => {
    const { g, u } = setup(502, 'senpuu');
    expect(until(g, 200, () => u.state === 'practice')).toBe(true);
    const hp = new Map(g.state.units.map((x: Unit) => [x.id, x.hp]));
    expect(until(g, 6, () => u.animKind === 'moves' && u.moveJutsu === 'senpuu')).toBe(true);
    for (const x of g.state.units) if (x.faction === 'village') expect(x.hp).toBeGreaterThanOrEqual(hp.get(x.id) ?? 0);
  });
});

describe('estudo de jutsu: saindo de casa', () => {
  test('quem dormia em casa sai visível para a Academia', () => {
    const { g, u } = setup(7, 'mizurappa');
    // volta o estado como se estivesse dormindo em casa quando a ordem chegou
    u.ninja!.learning = null;
    u.state = 'sleep';
    u.hidden = true;
    expect(teachJutsu(g, u.id, 'mizurappa', 1).ok).toBe(true);
    expect(until(g, 3, () => u.state === 'toLearn')).toBe(true);
    expect(u.hidden).toBe(false);
  });
});
