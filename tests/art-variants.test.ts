// Variantes de arte dos prédios repetidos (docs/gdd-escala-ilhas-pvp.md, seção 4; render/variants.ts).
import { describe, expect, test } from 'bun:test';
import { BUILDINGS, type BuildingType } from '../src/data/buildings';
import { createDemoGame } from '../src/game/demo';
import { SYSTEMS } from '../src/game/systems';
import { artUrl } from '../src/render/art';
import { VARIANTS, variantArt, variantNames, withLetter } from '../src/render/variants';

const all = () => true;
const none = () => false;

describe('variantes de arte por id do prédio', () => {
  test('determinística pelo id: casa em 3 desenhos, produção em 2, outros tipos só a base', () => {
    for (let id = 0; id < 30; id++) expect(variantArt('house', id, 'house', all)).toBe(variantArt('house', id, 'house', all));
    const casas = new Set(Array.from({ length: 9 }, (_, id) => variantArt('house', id, 'house', all)));
    expect([...casas].sort()).toEqual(['house', 'house-b', 'house-c']);
    expect(variantArt('house', 0, 'house', all)).toBe('house');
    expect(variantArt('house', 1, 'house', all)).toBe('house-b');
    expect(variantArt('house', 2, 'house', all)).toBe('house-c');
    expect(variantArt('house', 3, 'house', all)).toBe('house');
    for (const t of ['lumber', 'quarry', 'farm'] as const) {
      expect(variantArt(t, 0, t, all)).toBe(t);
      expect(variantArt(t, 1, t, all)).toBe(`${t}-b`);
      expect(variantArt(t, 2, t, all)).toBe(t);
    }
    expect(variantArt('academy', 1, 'academy-2', all)).toBe('academy-2');
    expect(variantArt('tower', 1, 'tower', all)).toBe('tower');
  });

  test('a letra entra antes do nível', () => {
    expect(withLetter('house', 'b')).toBe('house-b');
    expect(withLetter('house-2', 'c')).toBe('house-c-2');
    expect(variantArt('house', 4, 'house-3', all)).toBe('house-b-3');
    expect(variantArt('lumber', 1, 'lumber-2', all)).toBe('lumber-b-2');
  });

  test('sem a arte da variante, fica a base do nível', () => {
    expect(variantArt('house', 1, 'house', none)).toBe('house');
    expect(variantArt('house', 2, 'house-3', none)).toBe('house-3');
    expect(variantArt('farm', 1, 'farm-2', (n) => n === 'farm-b')).toBe('farm-2');
  });

  test('todas as variantes esperadas estão registradas em render/art.ts', () => {
    const types = Object.keys(VARIANTS) as BuildingType[];
    expect(types.length).toBe(4);
    for (const t of types) {
      const levels = ['', '-2', '-3'].filter((lv) => artUrl(`${t}${lv}`) !== null); // níveis com arte própria
      expect(levels.length).toBe(3);
      for (const name of variantNames(t, levels)) expect(artUrl(name), name).not.toBeNull();
    }
  });

  test('a vitrine mistura as variantes: ao menos uma casa de cada e as duas de cada produção', () => {
    const g = createDemoGame(SYSTEMS);
    const names = (t: BuildingType) => new Set(g.state.buildings.filter((b) => b.type === t).map((b) => variantArt(t, b.id, t, all)));
    expect(names('house').size).toBe(VARIANTS.house!.length);
    for (const t of ['farm', 'lumber', 'quarry'] as const) {
      expect(BUILDINGS[t].buildable).toBe(true);
      expect(names(t).size).toBe(2);
    }
  });
});
