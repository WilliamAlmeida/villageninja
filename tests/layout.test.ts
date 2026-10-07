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
