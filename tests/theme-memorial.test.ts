import { describe, expect, test } from 'bun:test';
import { createNewGame } from '../src/game/newGame';
import { createVillageScene } from '../src/game/scene';
import { SYSTEMS } from '../src/game/systems';
import type { Expedition, GameState } from '../src/game/types';
import { MAP_H, MAP_W } from '../src/config';
import { killUnit } from '../src/game/combat';
import { createNinja } from '../src/game/entities';
import { T } from '../src/game/world';

const scene = (node: string): GameState => {
  const g = createNewGame(SYSTEMS, 301);
  g.state.level = 3;
  return createVillageScene(g, { id: 9999, kind: 'region', node, action: 'raid', teamId: -1 } as unknown as Expedition);
};
const share = (s: GameState, t: number) => s.tiles.filter((x) => x === t).length / s.tiles.length;

describe('mapas temáticos', () => {
  test('Vila dos Pescadores: mar ao sul, praia e porto', () => {
    const s = scene('pesca');
    expect(s.sceneInfo!.theme).toBe('fishing');
    expect(s.tiles[(MAP_H - 2) * MAP_W + 10]).toBe(T.WATER);
    expect(share(s, T.SAND)).toBeGreaterThan(0.02);
    expect(s.buildings.some((b) => b.type === 'market')).toBe(true);
    expect(s.buildings.some((b) => b.type === 'port')).toBe(true);
  });

  test('Cidade dos Mercadores: deserto sem árvores', () => {
    const s = scene('mercadores');
    expect(s.sceneInfo!.theme).toBe('desert');
    expect(share(s, T.SAND) + share(s, T.DIRT)).toBeGreaterThan(0.6);
    expect(s.nodes.some((n) => n.type === 'tree')).toBe(false);
  });

  test('outros vilarejos seguem o mapa comum', () => {
    expect(scene('arroz').sceneInfo!.theme).toBeUndefined();
  });
});

describe('Pedra Memorial', () => {
  test('o ninja que cai entra na lista da pedra', () => {
    const g = createNewGame(SYSTEMS, 302);
    const n = createNinja(g, 1100, 800, 'chunin', 0);
    n.name = 'Uzu Kaito';
    killUnit(g, n, null);
    expect(g.state.fallen[0]!.name).toBe('Uzu Kaito');
  });
});
