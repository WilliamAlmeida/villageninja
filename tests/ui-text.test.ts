import { expect, test } from 'bun:test';
import { plainTokens, TOKEN_RE } from '../src/core/tokens';
import { BOSSES } from '../src/data/bosses';
import { BUILDING_LIST } from '../src/data/buildings';
import { ITEM_LIST } from '../src/data/items';
import { costLabel, RES_INFO, RES_KEYS } from '../src/data/resources';
import { VILLAGE_LEVELS } from '../src/data/villageLevels';
import { occupantsOf } from '../src/game/interior';
import { createNewGame } from '../src/game/newGame';
import { doorPos } from '../src/game/world';
import { hasIcon } from '../src/ui/icons';

test('todo ícone dos dados existe no conjunto de SVGs', () => {
  const icons = [
    ...BUILDING_LIST.map((d) => d.icon),
    ...ITEM_LIST.map((d) => d.icon),
    ...Object.values(BOSSES).map((d) => d.icon),
    ...VILLAGE_LEVELS.map((d) => d.icon),
    ...RES_KEYS.map((k) => RES_INFO[k].icon),
  ];
  for (const token of icons) {
    const name = [...token.matchAll(TOKEN_RE)][0]?.[1];
    expect(name, `ícone "${token}" deve ser um token {nome}`).toBeDefined();
    expect(hasIcon(name!), `falta o SVG "${name}"`).toBe(true);
  }
});

test('tokens viram texto puro no canvas e em tooltips', () => {
  expect(costLabel({ wood: 30, stone: 10 })).toBe('30{wood} 10{stone}');
  expect(plainTokens('+3{ryo}')).toBe('+3 ryo');
  expect(plainTokens('{castle} Vila concluída!')).toBe('Vila concluída!');
});

test('occupantsOf lista quem está escondido dentro do prédio', () => {
  const g = createNewGame([]);
  const hk = g.hokage()!;
  const [a, b] = g.villagers();
  expect(occupantsOf(g, hk)).toHaveLength(0);
  const d = doorPos(hk);
  Object.assign(a!, { x: d.x, y: d.y, hidden: true, state: 'sleep' });
  Object.assign(b!, { x: d.x + 300, y: d.y, hidden: true, state: 'sleep' });
  expect(occupantsOf(g, hk).map((u) => u.id)).toEqual([a!.id]);
});
