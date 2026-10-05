import { describe, expect, test } from 'bun:test';
import { DAY_LENGTH, SIM_DT } from '../src/config';
import { natureMultiplier } from '../src/data/natures';
import { placeBuilding, recruitNinja, teachJutsu, jutsuOptions } from '../src/game/commands';
import { createAnimal, createRogue, refreshDerived } from '../src/game/entities';
import { createNewGame } from '../src/game/newGame';
import { findPath } from '../src/game/pathfinding';
import { SYSTEMS } from '../src/game/systems';
import { CENTER_TX, CENTER_TY, doorPos } from '../src/game/world';
import type { Game } from '../src/game/game';

const run = (g: Game, seconds: number) => {
  for (let t = 0; t < seconds; t += SIM_DT) g.step(SIM_DT);
};

describe('naturezas', () => {
  test('ciclo de vantagens', () => {
    expect(natureMultiplier('katon', 'fuuton')).toBe(1.5);
    expect(natureMultiplier('suiton', 'katon')).toBe(1.5);
    expect(natureMultiplier('katon', 'suiton')).toBe(0.75);
    expect(natureMultiplier('katon', null)).toBe(1);
  });
});

describe('simulação', () => {
  test('nova vila tem a estrutura inicial', () => {
    const g = createNewGame(SYSTEMS, 1234);
    expect(g.hokage()).toBeDefined();
    expect(g.population()).toBe(8);
    expect(g.popCap()).toBe(10);
    expect(g.state.units.filter((u) => u.kind === 'ninja').length).toBe(2);
  });

  test('pathfinding encontra caminho entre casas', () => {
    const g = createNewGame(SYSTEMS, 99);
    const p = findPath(g.world, CENTER_TX - 6, CENTER_TY + 2, CENTER_TX + 6, CENTER_TY + 2);
    expect(p).not.toBeNull();
    expect(p!.length).toBeGreaterThan(5);
  });

  test('construção, coleta e economia evoluem', () => {
    const g = createNewGame(SYSTEMS, 42);
    const r = placeBuilding(g, 'lumber', CENTER_TX + 6, CENTER_TY + 3);
    expect(r.ok).toBe(true);
    run(g, 60);
    const lumber = g.state.buildings.find((b) => b.type === 'lumber')!;
    expect(lumber.built).toBe(true);
    expect(g.state.res.food).toBeGreaterThan(0);
  });

  test('academia: recrutar e ensinar jutsu', () => {
    const g = createNewGame(SYSTEMS, 7);
    g.state.res = { wood: 999, stone: 999, food: 999, ryo: 9999, iron: 999, herbs: 999, paper: 999, crystal: 0, gold: 0, darksteel: 0 };
    g.state.timers.animal = g.state.timers.raid = 1e9; // sem bichos/invasões sorteados tirando o aluno da academia
    expect(placeBuilding(g, 'academy', CENTER_TX - 7, CENTER_TY + 3).ok).toBe(true);
    run(g, 60); // folga: bichos e clima sorteados às vezes atrasam a obra
    expect(g.findBuilt('academy')).toBeDefined();
    expect(recruitNinja(g).ok).toBe(true);
    const ninja = g.state.units.find((u) => u.kind === 'ninja' && u.ninja!.jutsu[0] === null && u.ninja!.jutsu[1] === null);
    if (ninja) {
      const stats = ninja.ninja!.stats;
      for (const k of Object.keys(stats) as (keyof typeof stats)[]) stats[k] = 5;
      const opt = jutsuOptions(ninja).find((o) => o.ok)!;
      expect(teachJutsu(g, ninja.id, opt.def.id, 0).ok).toBe(true);
      run(g, 150); // folga: um ataque no meio interrompe o estudo
      expect(ninja.ninja!.jutsu[0]).toBe(opt.def.id);
    }
  });

  test('ninjas engajam invasores dentro da vila', () => {
    const g = createNewGame(SYSTEMS, 5);
    const d = doorPos(g.hokage()!);
    const rogue = createRogue(g, d.x - 140, d.y + 40, 1);
    const ninjas = g.state.units.filter((u) => u.kind === 'ninja');
    // todos entram na luta em algum momento (um pode ter sido paralisado por genjutsu; a luta pode acabar rápido)
    const engaged = new Set<number>();
    for (let t = 0; t < 2; t += SIM_DT) {
      g.step(SIM_DT);
      for (const n of ninjas) if (n.state === 'fight' || n.stun > 0) engaged.add(n.id);
    }
    expect(engaged.size).toBe(ninjas.length);
    expect(rogue.dead || rogue.hp < rogue.maxHp).toBe(true);
  });

  test('ninjas fortes eliminam animais e renegados', () => {
    const g = createNewGame(SYSTEMS, 5);
    for (const n of g.state.units.filter((u) => u.kind === 'ninja')) {
      n.ninja!.rank = 'jounin';
      const stats = n.ninja!.stats;
      for (const k of Object.keys(stats) as (keyof typeof stats)[]) stats[k] = 8;
      refreshDerived(n);
      n.hp = n.maxHp;
    }
    const d = doorPos(g.hokage()!);
    const wolf = createAnimal(g, 'wolf', d.x + 120, d.y + 60);
    const rogue = createRogue(g, d.x - 140, d.y + 40, 1);
    run(g, 30);
    expect(wolf.dead).toBe(true);
    expect(rogue.dead).toBe(true);
    expect(g.state.stats.kills).toBeGreaterThanOrEqual(2);
  });

  test('roda vários dias sem erros e o estado é serializável', () => {
    const g = createNewGame(SYSTEMS, 2024);
    run(g, DAY_LENGTH * 4);
    expect(g.state.day).toBeGreaterThanOrEqual(4);
    const json = JSON.stringify(g.state);
    expect(JSON.parse(json).units.length).toBe(g.state.units.length);
  });
});
