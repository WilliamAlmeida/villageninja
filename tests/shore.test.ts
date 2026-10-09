import { expect, test } from 'bun:test';
import { MAP_W, SUB } from '../src/config';
import { BUILDINGS } from '../src/data/buildings';
import { tileOf } from '../src/data/layout';
import { placeBuilding, shoreSpot } from '../src/game/commands';
import { createNewGame } from '../src/game/newGame';
import { canFlip, doorTile, T } from '../src/game/world';

/**
 * Vila só com a Residência e um trecho de margem ao lado: terra de um lado da linha, água do outro. `side` = 'y' põe a
 * água embaixo (y maior: o Porto como foi desenhado); 'x' põe a água à direita (x maior: só cabe espelhado).
 */
function shoreGame(side: 'x' | 'y') {
  const g = createNewGame([]);
  const s = g.state;
  const hk = g.hokage()!;
  s.buildings = [hk];
  s.level = 1;
  Object.assign(s.res, { wood: 9999, stone: 9999, ryo: 9999 });
  const x0 = hk.tx + 6;
  const y0 = hk.ty - 2;
  s.nodes = s.nodes.filter((n) => n.tx < x0 - 3 || n.tx > x0 + 10 || n.ty < y0 - 3 || n.ty > y0 + 10);
  for (let y = y0 - 3; y <= y0 + 10; y++)
    for (let x = x0 - 3; x <= x0 + 10; x++) {
      const wet = side === 'y' ? y >= y0 + 2 : x >= x0 + 2;
      s.tiles[y * MAP_W + x] = wet ? T.WATER : T.GRASS;
    }
  g.world.rebuild();
  return { g, x0, y0 };
}

test('Porto: só na beira da água, com o píer em cima da água e a porta em terra', () => {
  const { g, x0, y0 } = shoreGame('y');
  // longe da água (toda em terra) não pode
  expect(g.world.canPlace('port', x0 - 2, y0 - 6)).toBe(false);
  const spot = shoreSpot(g, 'port', x0, y0)!;
  expect(spot).not.toBeNull();
  expect(spot.flip).toBe(false);
  expect(placeBuilding(g, 'port', spot.tx, spot.ty, spot.flip).ok).toBe(true);
  const b = g.state.buildings.find((o) => o.type === 'port')!;
  const door = doorTile(b);
  expect(g.state.tiles[door.ty * MAP_W + door.tx]).not.toBe(T.WATER);
  // as células de água ficam sobre tiles de água
  const d = BUILDINGS.port;
  for (let fy = 0; fy < d.h * SUB; fy++)
    for (let fx = 0; fx < d.w * SUB; fx++)
      if (tileOf('port', fx, fy) === '~' && fy % SUB === 0 && fx % SUB === 0 && tileOf('port', fx, fy + 1) === '~')
        expect(g.state.tiles[(b.ty + Math.floor(fy / SUB)) * MAP_W + b.tx + Math.floor(fx / SUB)]).toBe(T.WATER);
});

test('Porto: com a água do outro lado, o jogo espelha (troca x por y no terreno)', () => {
  expect(canFlip('port')).toBe(true);
  const { g, x0, y0 } = shoreGame('x');
  const spot = shoreSpot(g, 'port', x0, y0)!;
  expect(spot).not.toBeNull();
  expect(spot.flip).toBe(true);
  expect(g.world.canPlace('port', spot.tx, spot.ty, false)).toBe(false);
  expect(placeBuilding(g, 'port', spot.tx, spot.ty, true).ok).toBe(true);
  const b = g.state.buildings.find((o) => o.type === 'port')!;
  expect(b.flip).toBe(true);
  // a célula de muro (terra) e a de água trocam de eixo no espelhado
  expect(tileOf('port', 0, 5, true)).toBe(tileOf('port', 5, 0));
});
