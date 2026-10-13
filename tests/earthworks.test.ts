import { describe, expect, test } from 'bun:test';
import { SAVE_VERSION, SIM_DT } from '../src/config';
import { EARTH, markEarth, unmarkEarth } from '../src/game/earthworks';
import type { Game } from '../src/game/game';
import { createNewGame } from '../src/game/newGame';
import { migrate } from '../src/game/save';
import { SYSTEMS } from '../src/game/systems';
import { inTerritory } from '../src/game/village';
import { doorPos, idx, T } from '../src/game/world';

const run = (g: Game, seconds: number, until?: () => boolean) => {
  for (let t = 0; t < seconds; t += SIM_DT) {
    g.state.time = 30; // sempre de dia
    g.step(SIM_DT);
    if (until?.()) return true;
  }
  return false;
};

/** Um tile do tipo pedido dentro do território, o mais perto da Residência, com um vizinho em terra firme. */
function spot(g: Game, want: (t: number) => boolean) {
  const s = g.state;
  const d = doorPos(g.hokage()!);
  let best: { tx: number; ty: number } | null = null;
  let bd = Infinity;
  for (let ty = 2; ty < s.mapH - 2; ty++)
    for (let tx = 2; tx < s.mapW - 2; tx++) {
      if (!want(s.tiles[idx(s, tx, ty)]!) || !inTerritory(s, tx, ty, 1, 1) || g.world.buildingIdAt(tx, ty)) continue;
      if (s.nodes.some((n) => n.tx === tx && n.ty === ty)) continue;
      if (![[0, 1], [1, 0], [-1, 0], [0, -1]].some(([dx, dy]) => g.world.walkable(tx + dx!, ty + dy!))) continue;
      const dist = Math.hypot(tx * 32 - d.x, ty * 32 - d.y);
      if (dist < bd) {
        bd = dist;
        best = { tx, ty };
      }
    }
  return best!;
}

describe('aterrar e cavar', () => {
  test('aterrar: paga a pedra ao marcar, um morador aterra e a água vira terra andável', () => {
    const g = createNewGame(SYSTEMS, 711);
    g.state.level = 3; // território = mapa todo (acha água por perto)
    g.state.res.stone = 100;
    const w = spot(g, (t) => t === T.WATER);
    expect(markEarth(g, w.tx, w.ty, 'fill').ok).toBe(true);
    expect(g.state.res.stone).toBe(100 - EARTH.fillCost.stone!);
    expect(run(g, 150, () => g.state.tiles[idx(g.state, w.tx, w.ty)] !== T.WATER)).toBe(true);
    expect(g.state.earthworks!.length).toBe(0);
    expect(g.world.walkable(w.tx, w.ty)).toBe(true);
    expect(g.terrainRev).toBeGreaterThan(0);
  });

  test('cavar: grátis, a terra vira água com areia em volta; desmarcar devolve a pedra do aterro', () => {
    const g = createNewGame(SYSTEMS, 712);
    g.state.res.stone = 50;
    const land = spot(g, (t) => t === T.GRASS || t === T.GRASS2);
    expect(markEarth(g, land.tx, land.ty, 'dig').ok).toBe(true);
    expect(g.state.res.stone).toBe(50);
    expect(run(g, 150, () => g.state.tiles[idx(g.state, land.tx, land.ty)] === T.WATER)).toBe(true);
    expect(g.world.walkable(land.tx, land.ty)).toBe(false);
    const around = [[0, 1], [1, 0], [-1, 0], [0, -1]].map(([dx, dy]) => g.state.tiles[idx(g.state, land.tx + dx!, land.ty + dy!)]);
    expect(around.some((t) => t === T.SAND)).toBe(true);
    // aterrar o mesmo tile e desmarcar antes de alguém fazer: a pedra volta
    expect(markEarth(g, land.tx, land.ty, 'fill').ok).toBe(true);
    expect(unmarkEarth(g, land.tx, land.ty)).toBe(true);
    expect(g.state.res.stone).toBe(50);
  });

  test('não marca fora do território nem cava onde há árvore', () => {
    const g = createNewGame(SYSTEMS, 713);
    expect(markEarth(g, 2, 2, 'dig').ok).toBe(false); // longe da Residência numa Aldeia
    const tree = g.state.nodes.find((n) => n.type === 'tree' && inTerritory(g.state, n.tx, n.ty, 1, 1));
    if (tree) expect(markEarth(g, tree.tx, tree.ty, 'dig').ok).toBe(false);
  });

  test('save v39 → v40 cria a lista de obras no terreno', () => {
    const g = createNewGame(SYSTEMS, 714);
    const s = JSON.parse(JSON.stringify(g.state));
    s.version = 39;
    delete s.earthworks;
    const m = migrate(s)!;
    expect(m.version).toBe(SAVE_VERSION);
    expect(m.earthworks).toEqual([]);
  });
});
