import { describe, expect, test } from 'bun:test';
import { SAVE_VERSION, SIM_DT } from '../src/config';
import { REGROW } from '../src/data/regrow';
import { placeBuilding, promote } from '../src/game/commands';
import { autoEquipAll, setAutoGear, stock } from '../src/game/gear';
import type { Game } from '../src/game/game';
import { createNewGame } from '../src/game/newGame';
import { migrate } from '../src/game/save';
import { SYSTEMS } from '../src/game/systems';
import { teamOf } from '../src/game/teams';

const run = (g: Game, seconds: number) => {
  for (let t = 0; t < seconds; t += SIM_DT) g.step(SIM_DT);
};

describe('qualidade de vida', () => {
  test('árvore esgotada vira toco e cresce de volta', () => {
    const g = createNewGame(SYSTEMS, 131);
    const tree = g.state.nodes.find((n) => n.type === 'tree')!;
    tree.amount = 0;
    tree.regrow = 2;
    run(g, 3);
    expect(tree.regrow).toBeUndefined();
    expect(tree.amount).toBe(tree.max);
    expect(REGROW.tree).toBeGreaterThan(0);
  });

  test('equipar todos distribui o estoque; o modo automático continua sozinho', () => {
    const g = createNewGame(SYSTEMS, 132);
    g.state.items = { kunai: 2, vest: 1 };
    const changed = autoEquipAll(g);
    expect(changed).toBeGreaterThan(0);
    expect(stock(g, 'kunai')).toBe(0);
    setAutoGear(g, true);
    g.state.items.soldierpill = 2;
    run(g, 5);
    expect(stock(g, 'soldierpill')).toBeLessThan(2);
  });

  test('genin promovido numa equipe sem sensei vira o sensei', () => {
    const g = createNewGame(SYSTEMS, 133);
    Object.assign(g.state.res, { ryo: 9999, wood: 999, stone: 999, food: 999 });
    const team = g.state.teams[0]!;
    const u = g.unit(team.memberIds[0])!;
    u.ninja!.level = 30;
    g.state.level = 3;
    expect(promote(g, u.id).ok).toBe(true);
    expect(team.senseiId).toBe(u.id);
    expect(team.memberIds).not.toContain(u.id);
    expect(teamOf(g, u)).toBe(team);
  });

  test('migra saves da versão 13 (vegetação perdida volta a crescer)', () => {
    const g = createNewGame(SYSTEMS, 134);
    const trees = g.state.nodes.filter((n) => n.type === 'tree').length;
    const old = JSON.parse(JSON.stringify(g.state));
    old.version = 13;
    old.nodes = old.nodes.filter((n: { type: string }) => n.type !== 'tree').concat(old.nodes.filter((n: { type: string }) => n.type === 'tree').slice(0, 5));
    const s = migrate(old)!;
    expect(s.version).toBe(SAVE_VERSION);
    const back = s.nodes.filter((n) => n.type === 'tree');
    expect(back.length).toBeGreaterThan(trees * 0.8);
    expect(back.some((n) => n.regrow != null && n.amount === 0)).toBe(true);
  });

  test('rocha esgotada não ocupa espaço: dá para construir em cima e ela some', () => {
    const g = createNewGame(SYSTEMS, 135);
    Object.assign(g.state.res, { wood: 999, stone: 999, ryo: 999 });
    g.state.level = 3; // território grande
    // acha uma rocha onde caberia uma torre (1×1) se ela não estivesse lá
    const rock = g.state.nodes.find((n) => n.type === 'rock' && !g.world.canPlace('tower', n.tx, n.ty) && (n.amount = 0, g.world.canPlace('tower', n.tx, n.ty)));
    expect(rock).toBeDefined();
    rock!.regrow = 999;
    expect(placeBuilding(g, 'tower', rock!.tx, rock!.ty).ok).toBe(true);
    expect(g.state.nodes.includes(rock!)).toBe(false);
  });
});
