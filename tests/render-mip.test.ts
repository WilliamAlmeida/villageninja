import { describe, expect, test } from 'bun:test';
import { mipFor } from '../src/render/art';

describe('cópias reduzidas das artes (zoom afastado)', () => {
  test('ampliando ou reduzindo até a metade: a arte original', () => {
    expect(mipFor(2)).toBe(0);
    expect(mipFor(1)).toBe(0);
    expect(mipFor(0.5)).toBe(0);
  });

  test('a cópia escolhida deixa a redução restante entre ½ e 1', () => {
    for (const scale of [0.49, 0.3, 0.25, 0.2, 0.13]) {
      const level = mipFor(scale);
      const rest = scale * 2 ** level; // escala da cópia até a tela
      expect(rest).toBeGreaterThan(0.5 - 1e-9);
      expect(rest).toBeLessThanOrEqual(1);
    }
  });

  test('no máximo ⅛ do tamanho; escala inválida não reduz', () => {
    expect(mipFor(0.01)).toBe(3);
    expect(mipFor(0)).toBe(0);
    expect(mipFor(Number.NaN)).toBe(0);
  });
});
