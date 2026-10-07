import { describe, expect, test } from 'bun:test';
import { anbuMask, dollParts, dollSword } from '../src/render/doll';

const look = { hair: '#000000', cloth: '#2d4a9a', skin: '#f1c79a' };
const names = (w: Parameters<typeof dollParts>[0]) => dollParts(w)!.map((p) => p.name);

describe('ninja em camadas', () => {
  test('espada: Kage = Raijin, Sannin da serpente = Kusanagi, Jounin pela natureza, Genin sem', () => {
    expect(dollSword({ style: 'spiky', rank: 'kage', look })).toBe('raijin');
    expect(dollSword({ style: 'spiky', rank: 'jounin', sannin: 'snake', nature: 'suiton', look })).toBe('kusanagi');
    expect(dollSword({ style: 'spiky', rank: 'jounin', nature: 'doton', look })).toBe('kabutowari');
    expect(dollSword({ style: 'spiky', rank: 'genin', nature: 'doton', look })).toBeNull();
    expect(dollSword({ style: 'spiky', rank: 'jounin', nature: 'doton', sword: null, look })).toBeNull();
  });

  test('ANBU: uniforme, tantō e máscara do melhor atributo no lugar da bandana', () => {
    const p = names({ style: 'short', rank: 'chunin', spec: 'spy', stats: { ninjutsu: 3, genjutsu: 7 }, look });
    expect(p).toEqual(['ninja-body', 'layer-outfit-anbu', 'layer-sword-tanto', 'layer-hair-short', 'layer-mask-crow']);
    expect(anbuMask({ forca: 9, ninjutsu: 2 })).toBe('boar');
  });

  test('Jounin comum: roupa, colete, espada, cabelo e bandana', () => {
    expect(names({ style: 'long', rank: 'jounin', nature: 'fuuton', look })).toEqual([
      'ninja-body', 'layer-outfit-genin', 'layer-vest-jounin', 'layer-sword-asuma', 'layer-hair-long', 'layer-headband',
    ]);
  });
});
