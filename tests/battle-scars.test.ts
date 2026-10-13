import { describe, expect, test } from 'bun:test';
import { SCARS, burnTick } from '../src/game/battleScars';
import { areaDamage } from '../src/game/combat';
import type { Game } from '../src/game/game';
import { createNewGame } from '../src/game/newGame';
import { SYSTEMS } from '../src/game/systems';
import type { ResourceNode } from '../src/game/types';

const at = (n: ResourceNode) => ({ x: n.tx * 32 + 16, y: n.ty * 32 + 16 });
const tree = (g: Game) => g.state.nodes.find((n) => n.type === 'tree' && n.amount === n.max)!;
const rock = (g: Game) => g.state.nodes.find((n) => n.type === 'rock' && n.amount === n.max)!;

describe('a luta marca o cenário', () => {
  test('golpe em área corta a árvore; esgotada vira toco', () => {
    const g = createNewGame(SYSTEMS, 901);
    const t = tree(g);
    const p = at(t);
    areaDamage(g, null, 'enemy', p.x, p.y, 40, 40, null);
    expect(t.amount).toBeLessThan(t.max);
    expect(t.burn).toBeUndefined();
    for (let i = 0; i < 6 && t.amount > 0; i++) areaDamage(g, null, 'enemy', p.x, p.y, 40, 40, null);
    expect(t.amount).toBe(0);
    expect(t.regrow).toBeGreaterThan(0);
  });

  test('golpe enorme arranca a árvore (some por um tempo)', () => {
    const g = createNewGame(SYSTEMS, 902);
    const t = tree(g);
    const p = at(t);
    areaDamage(g, null, 'enemy', p.x, p.y, 40, ((t.max * SCARS.blowAway) / SCARS.treeHit) * 1.1, null);
    expect(t.cleared).toBe(true);
  });

  test('fogo põe a árvore para queimar e sobra o toco; água apaga', () => {
    const g = createNewGame(SYSTEMS, 903);
    g.state.weather = 'clear';
    g.state.clouds = [];
    const t = tree(g);
    const p = at(t);
    areaDamage(g, null, 'enemy', p.x, p.y, 40, 20, 'katon');
    expect(t.burn).toBeGreaterThan(0);
    for (let i = 0; i < SCARS.burn + 1; i++) burnTick(g, 1);
    expect(t.burn).toBeUndefined();
    expect(t.amount).toBe(0);
    const t2 = tree(g);
    const p2 = at(t2);
    areaDamage(g, null, 'enemy', p2.x, p2.y, 40, 20, 'katon');
    expect(t2.burn).toBeGreaterThan(0);
    areaDamage(g, null, 'enemy', p2.x, p2.y, 40, 20, 'suiton');
    expect(t2.burn).toBeUndefined();
  });

  test('a rocha racha e quebra', () => {
    const g = createNewGame(SYSTEMS, 904);
    const r = rock(g);
    const p = at(r);
    for (let i = 0; i < 10 && r.amount > 0; i++) areaDamage(g, null, 'enemy', p.x, p.y, 40, 40, null);
    expect(r.amount).toBe(0);
    expect(r.regrow).toBeGreaterThan(0);
  });
});
