import { describe, expect, test } from 'bun:test';
import { SIM_DT } from '../src/config';
import { BUILDINGS, type BuildingType } from '../src/data/buildings';
import { createDemoGame } from '../src/game/demo';
import { SYSTEMS } from '../src/game/systems';

describe('vila de vitrine (?demo)', () => {
  test('tem todos os prédios, os títulos e gente ocupada', () => {
    const g = createDemoGame(SYSTEMS);
    const s = g.state;
    const missing = (Object.keys(BUILDINGS) as BuildingType[]).filter((t) => BUILDINGS[t].buildable && !s.buildings.some((b) => b.type === t));
    expect(missing).toEqual([]);
    expect(s.kageId).not.toBeNull();
    const ninjas = s.units.filter((u) => u.ninja && !u.dead);
    expect(ninjas.filter((u) => u.ninja!.sannin).length).toBe(3);
    expect(ninjas.filter((u) => u.ninja!.anbu).length).toBe(2);
    expect(s.teams.length).toBeGreaterThan(4);
    expect(s.missions.some((m) => m.status === 'active')).toBe(true);
    expect(s.expeditions.length).toBe(2);
    expect(s.blades.length).toBe(4);
    expect(s.clans.length).toBe(3);
  });

  test('roda um minuto sem quebrar', () => {
    const g = createDemoGame(SYSTEMS);
    for (let t = 0; t < 60; t += SIM_DT) g.step(SIM_DT);
    expect(g.state.units.filter((u) => u.ninja && u.dead).length).toBe(0);
  });
});
