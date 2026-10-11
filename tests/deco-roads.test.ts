import { describe, expect, test } from 'bun:test';
import { SAVE_VERSION } from '../src/config';
import { BUILDINGS } from '../src/data/buildings';
import { placeBuilding } from '../src/game/commands';
import { decoMood, DECO_MOOD_MAX } from '../src/game/mood';
import { createNewGame } from '../src/game/newGame';
import { migrate } from '../src/game/save';
import { isRoad, pave, ROAD, roadCount, roadSpeed, unpave } from '../src/game/roads';
import { SYSTEMS } from '../src/game/systems';
import type { Game } from '../src/game/game';
import { createDemoGame } from '../src/game/demo';

/** Tile livre perto do centro da vila (calçável). */
function freeTile(g: Game): [number, number] {
  const hk = g.hokage()!;
  for (let r = 3; r < 12; r++)
    for (let dx = -r; dx <= r; dx++) {
      const tx = hk.tx + dx;
      const ty = hk.ty + r;
      if (pave(g, tx, ty).ok) {
        unpave(g, tx, ty);
        return [tx, ty];
      }
    }
  throw new Error('sem tile livre');
}

describe('ruas calçadas', () => {
  test('calçar custa pedra, acelera quem anda e sai quando um prédio é construído em cima', () => {
    const g = createNewGame(SYSTEMS, 91);
    g.state.res.stone = 100;
    const [tx, ty] = freeTile(g);
    const stone = g.state.res.stone;
    expect(pave(g, tx, ty).ok).toBe(true);
    expect(g.state.res.stone).toBe(stone - ROAD.cost.stone!);
    expect(isRoad(g.state, tx, ty)).toBe(true);
    expect(roadSpeed(g.state, tx * 32 + 16, ty * 32 + 16)).toBe(ROAD.speed);
    expect(pave(g, tx, ty).ok).toBe(false); // já é rua
    Object.assign(g.state.res, { wood: 500, stone: 500, ryo: 500 });
    expect(placeBuilding(g, 'lantern', tx, ty).ok).toBe(true);
    expect(isRoad(g.state, tx, ty)).toBe(false);
  });

  test('não calça água nem fora do território', () => {
    const g = createNewGame(SYSTEMS, 92);
    g.state.res.stone = 100;
    expect(pave(g, 0, 0).ok).toBe(false);
    expect(roadCount(g.state)).toBe(0);
  });

  test('migração 30 → 31 cria as ruas', () => {
    const s = migrate({ version: 30, units: [], scene: null })!;
    expect(s.version).toBe(SAVE_VERSION);
    expect(roadCount(s)).toBe(0);
  });
});

describe('decorações', () => {
  test('somam felicidade até o teto; a cerejeira dá mais na primavera', () => {
    const g = createNewGame(SYSTEMS, 93);
    const s = g.state;
    expect(decoMood(s)).toBe(0);
    const hk = g.hokage()!;
    s.buildings.push({ id: 9001, type: 'pagoda', tx: hk.tx + 8, ty: hk.ty, built: true, progress: 1, desired: 0, workers: [], cd: 0 });
    expect(decoMood(s)).toBe(BUILDINGS.pagoda.mood!);
    s.buildings.push({ id: 9002, type: 'cherry', tx: hk.tx + 8, ty: hk.ty + 3, built: true, progress: 1, desired: 0, workers: [], cd: 0 });
    s.day = 1; // primavera
    expect(decoMood(s)).toBe(BUILDINGS.pagoda.mood! + BUILDINGS.cherry.mood! + 1);
    for (let i = 0; i < 20; i++) s.buildings.push({ id: 9100 + i, type: 'fountain', tx: 0, ty: 0, built: true, progress: 1, desired: 0, workers: [], cd: 0 });
    expect(decoMood(s)).toBe(DECO_MOOD_MAX);
  });

  test('a vitrine tem decorações e uma cruz de ruas', () => {
    const g = createDemoGame(SYSTEMS);
    expect(g.state.buildings.some((b) => BUILDINGS[b.type].deco)).toBe(true);
    expect(roadCount(g.state)).toBeGreaterThan(8);
  });
});
