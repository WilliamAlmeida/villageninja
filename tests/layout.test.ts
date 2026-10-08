import { describe, expect, test } from 'bun:test';
import { decodeMask, encodeMask, layout, setLayout, tileOf } from '../src/data/layout';

describe('layout do Editor de cenário', () => {
  test('máscara comprime e volta igual', () => {
    const m = new Uint8Array(500);
    m.fill(2, 10, 200);
    m[300] = 5;
    expect(decodeMask(encodeMask(m), m.length)).toEqual(m);
  });

  test('tiles: muro, portão e livre; sem ajuste = undefined', () => {
    const saved = layout();
    setLayout({ arts: {}, types: { arena: { tiles: ['##', '#g'] } } });
    expect(tileOf('arena', 0, 0)).toBe('#');
    expect(tileOf('arena', 1, 1)).toBe('g');
    expect(tileOf('house', 0, 0)).toBeUndefined();
    setLayout(saved);
  });
});

describe('colisão dos objetos de cenário', () => {
  test('rocha bloqueia pelo terreno do layout; some, desbloqueia', async () => {
    const { createNewGame } = await import('../src/game/newGame');
    const { SYSTEMS } = await import('../src/game/systems');
    const g = createNewGame(SYSTEMS, 31);
    g.state.nodes = [];
    g.reindex();
    g.world.rebuild();
    let tx = 10;
    while (!g.world.walkable(tx, 10) || !g.world.walkable(tx + 1, 10)) tx++; // um tile livre (sem água nem prédio)
    const n = { id: g.newId(), type: 'rock' as const, tx, ty: 10, amount: 40, max: 40, variant: 0 };
    g.state.nodes.push(n);
    g.reindex();
    g.world.refreshNodes();
    expect(g.world.walkablePx(tx * 32 + 16, 10 * 32 + 16)).toBe(false);
    g.removeNode(n.id);
    g.world.refreshNodes();
    expect(g.world.walkablePx(tx * 32 + 16, 10 * 32 + 16)).toBe(true);
  });
});
