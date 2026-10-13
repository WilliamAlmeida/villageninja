import { describe, expect, test } from 'bun:test';
import { SIM_DT } from '../src/config';
import { REGROW } from '../src/data/regrow';
import { CLEAR, markClear, regrowTime } from '../src/game/clearing';
import type { Game } from '../src/game/game';
import { createNewGame } from '../src/game/newGame';
import { SYSTEMS } from '../src/game/systems';
import { doorPos, nodeArt } from '../src/game/world';

const run = (g: Game, seconds: number, until?: () => boolean) => {
  for (let t = 0; t < seconds; t += SIM_DT) {
    g.state.time = 30; // sempre de dia (de noite os moradores vão dormir)
    g.step(SIM_DT);
    if (until?.()) return true;
  }
  return false;
};

/** A árvore mais perto da porta da Residência (os moradores chegam rápido). */
function nearTree(g: Game) {
  const d = doorPos(g.hokage()!);
  return g.state.nodes
    .filter((n) => n.type === 'tree' && n.amount > 0)
    .sort((a, b) => Math.hypot(a.tx * 32 - d.x, a.ty * 32 - d.y) - Math.hypot(b.tx * 32 - d.x, b.ty * 32 - d.y))[0]!;
}

describe('rebrota e limpar área', () => {
  test('a rebrota fica mais lenta conforme a vila cresce', () => {
    const g = createNewGame(SYSTEMS, 501);
    const t0 = regrowTime(g.state, 'tree');
    expect(t0).toBe(REGROW.tree!);
    g.state.level = 3;
    expect(regrowTime(g.state, 'tree')).toBe(REGROW.tree! * CLEAR.levelMult[3]!);
  });

  test('marcado, um morador sem obra arranca: rende o que sobrava, some do mapa e volta só depois da rebrota longa', () => {
    const g = createNewGame(SYSTEMS, 502);
    const tree = nearTree(g);
    const wood0 = g.state.res.wood;
    const left = tree.amount;
    expect(markClear(g, tree.tx, tree.ty, true, 0)).toBe(1);
    expect(run(g, 120, () => !!tree.cleared)).toBe(true);
    expect(g.state.res.wood).toBeGreaterThanOrEqual(wood0 + left - 5); // alguém pode ter cortado um pedaço antes
    expect(nodeArt(tree)).toBe('cleared');
    expect(tree.clear).toBeUndefined();
    // a natureza pode descontar até 1 s no mesmo passo em que ele arranca
    const long = regrowTime(g.state, 'tree') * CLEAR.regrowMult;
    expect(tree.regrow!).toBeGreaterThan(long - 2);
    expect(tree.regrow!).toBeLessThanOrEqual(long);
    // a rebrota longa termina: volta inteira
    tree.regrow = 0.5;
    run(g, 2);
    expect(tree.cleared).toBeUndefined();
    expect(tree.amount).toBe(tree.max);
  });

  test('desmarcar tira a marca; arrancado com prédio em cima não volta', () => {
    const g = createNewGame(SYSTEMS, 503);
    const tree = nearTree(g);
    markClear(g, tree.tx, tree.ty, true, 0);
    expect(markClear(g, tree.tx, tree.ty, false, 0)).toBe(1);
    expect(tree.clear).toBeUndefined();
    // arrancado e com uma lanterna construída em cima: na hora de voltar, sai do mapa de vez
    tree.cleared = true;
    tree.amount = 0;
    tree.regrow = 0.5;
    g.addBuilding({ id: g.newId(), type: 'lantern', tx: tree.tx, ty: tree.ty, built: true, progress: 99, desired: 0, workers: [], cd: 0 });
    g.world.rebuild();
    run(g, 2);
    expect(g.state.nodes.includes(tree)).toBe(false);
  });
});
