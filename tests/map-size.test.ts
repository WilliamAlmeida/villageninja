import { describe, expect, test } from 'bun:test';
import { SAVE_VERSION, SCENE_H, SCENE_W, SUB, TILE, VILLAGE_H, VILLAGE_W } from '../src/config';
import { isExplored } from '../src/game/explore';
import { Game } from '../src/game/game';
import { baseState, createNewGame } from '../src/game/newGame';
import { isRoad } from '../src/game/roads';
import { migrate } from '../src/game/save';
import { createMineScene, createTrialScene } from '../src/game/scene';
import { SYSTEMS } from '../src/game/systems';
import type { Expedition } from '../src/game/types';
import { T } from '../src/game/world';

const exp = (node: string, action: string) => ({ id: 9990, kind: 'region', node, action, teamId: -1 }) as unknown as Expedition;

describe('tamanho do mapa (vila 102×68, missões 72×48)', () => {
  test('jogo novo: a vila é 102×68 e a colisão acompanha', () => {
    const g = createNewGame(SYSTEMS, 41);
    expect([g.state.mapW, g.state.mapH]).toEqual([VILLAGE_W, VILLAGE_H]);
    expect(g.state.tiles.length).toBe(VILLAGE_W * VILLAGE_H);
    expect(g.world.fine.length).toBe(VILLAGE_W * SUB * VILLAGE_H * SUB);
    expect(g.world.walkable(VILLAGE_W - 1, VILLAGE_H - 1) || g.world.blocked[g.world.idx(VILLAGE_W - 1, VILLAGE_H - 1)] === 1).toBe(true);
    expect(g.world.walkable(VILLAGE_W, 0)).toBe(false); // fora do mapa
  });

  test('mapas de missão continuam 72×48', () => {
    const home = createNewGame(SYSTEMS, 42);
    home.state.level = 3;
    for (const s of [createTrialScene(home, exp('sapos', 'contract')), createMineScene(home, exp('mina', 'mine'), 1)]) {
      expect([s.mapW, s.mapH]).toEqual([SCENE_W, SCENE_H]);
      expect(s.tiles.length).toBe(SCENE_W * SCENE_H);
      const g = new Game(s, []);
      expect(g.world.fineW).toBe(SCENE_W * SUB);
    }
  });

  test('save v34 → v35: a vila de 72×48 vai para o meio do mapa novo, com tudo no mesmo lugar em relação a ela', () => {
    // um "save antigo": mapa 72×48 sem o tamanho guardado, com prédio, unidade andando, rua e névoa revelada
    const s = baseState(43, true) as unknown as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    const g = new Game(s as never, []);
    const tx = 30;
    const ty = 20;
    s.tiles[ty * 72 + tx] = T.DIRT;
    s.buildings.push({ id: 900, type: 'house', tx, ty, built: true, progress: 99, desired: 0, workers: [], cd: 0, level: 1 });
    const cell = (ty * SUB + 1) * 72 * SUB + tx * SUB + 1;
    s.units.push({ id: 901, x: tx * TILE + 8, y: ty * TILE + 8, goalX: 100, goalY: 100, path: [cell], faction: 'village' });
    s.roads[(ty * 72 + tx) >> 5] |= 1 << ((ty * 72 + tx) & 31);
    s.explored[(ty * 72 + tx) >> 5] |= 1 << ((ty * 72 + tx) & 31);
    const before = g.world.cellCenter(cell);
    delete s.mapW;
    delete s.mapH;
    s.version = 34;
    const m = migrate(s)!;
    expect(m.version).toBe(SAVE_VERSION);
    expect([m.mapW, m.mapH]).toEqual([VILLAGE_W, VILLAGE_H]);
    expect(m.tiles.length).toBe(VILLAGE_W * VILLAGE_H);
    const ox = (VILLAGE_W - 72) / 2;
    const oy = (VILLAGE_H - 48) / 2;
    const b = m.buildings.find((o) => o.id === 900)!;
    expect([b.tx, b.ty]).toEqual([tx + ox, ty + oy]);
    expect(m.tiles[b.ty * VILLAGE_W + b.tx]).toBe(T.DIRT);
    const u = m.units.find((o) => o.id === 901)!;
    expect([u.x, u.y]).toEqual([tx * TILE + 8 + ox * TILE, ty * TILE + 8 + oy * TILE]);
    expect([u.goalX, u.goalY]).toEqual([100 + ox * TILE, 100 + oy * TILE]);
    // a rota aponta para a mesma célula, agora deslocada
    const after = new Game(m, []).world.cellCenter(u.path[0]!);
    expect([after.x, after.y]).toEqual([before.x + ox * TILE, before.y + oy * TILE]);
    expect(isRoad(m, b.tx, b.ty)).toBe(true);
    expect(isExplored(m, b.tx, b.ty)).toBe(true);
    expect(isExplored(m, 0, 0)).toBe(false); // o terreno novo começa na névoa
  });
});
