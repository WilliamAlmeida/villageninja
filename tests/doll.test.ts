import { describe, expect, test } from 'bun:test';
import { anbuMask, dollParts } from '../src/render/doll';

const look = { hair: '#000000', cloth: '#2d4a9a', skin: '#f1c79a' };
const names = (w: Parameters<typeof dollParts>[0]) => dollParts(w)!.map((p) => p.name);

describe('ninja em camadas', () => {
  test('ANBU: uniforme, tantō e máscara do melhor atributo no lugar da bandana', () => {
    const p = names({ style: 'short', rank: 'chunin', anbu: true, stats: { ninjutsu: 3, genjutsu: 7 }, look });
    expect(p).toEqual(['ninja-body', 'layer-outfit-anbu', 'layer-sword-tanto', 'layer-hair-short', 'layer-mask-crow']);
    expect(anbuMask({ forca: 9, ninjutsu: 2 })).toBe('boar');
  });

  test('a lâmina equipada aparece no sprite (ANBU com lâmina deixa o tantō)', () => {
    expect(names({ style: 'long', rank: 'jounin', sword: 'asuma', look })).toEqual([
      'ninja-body', 'layer-outfit-genin', 'layer-vest-jounin', 'layer-sword-asuma', 'layer-hair-long', 'layer-headband',
    ]);
    expect(names({ style: 'spiky', rank: 'jounin', anbu: true, sword: 'kiba', look })).toContain('layer-sword-kiba');
    expect(names({ style: 'spiky', rank: 'genin', look })).not.toContain('layer-sword-tanto');
  });
});
