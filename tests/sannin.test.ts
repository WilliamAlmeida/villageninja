import { describe, expect, test } from 'bun:test';
import { applyDamage } from '../src/game/combat';
import { createNinja, createRogue } from '../src/game/entities';
import type { Game } from '../src/game/game';
import { createNewGame } from '../src/game/newGame';
import { addStat } from '../src/game/progression';
import { nameSannin, sanninBlock, sanninTick } from '../src/game/sannin';
import { SYSTEMS } from '../src/game/systems';
import type { Unit } from '../src/game/types';

const setup = (seed: number) => {
  const g = createNewGame(SYSTEMS, seed);
  Object.assign(g.state.res, { ryo: 99999, food: 9999 });
  g.state.level = 2;
  return g;
};
const jounin = (g: Game, level = 22): Unit => {
  const u = createNinja(g, 600, 600, 'jounin', 0);
  u.ninja!.level = level;
  return u;
};

describe('os Três Sannin', () => {
  test('nomeação: Jounin nível 20+, um por caminho, no máximo três', () => {
    const g = setup(801);
    const weak = jounin(g, 12);
    expect(nameSannin(g, weak.id, 'toad').ok).toBe(false);
    const a = jounin(g);
    const b = jounin(g);
    expect(nameSannin(g, a.id, 'toad').ok).toBe(true);
    expect(a.ninja!.sannin).toBe('toad');
    expect(a.ninja!.contract).toBe('toad');
    expect(sanninBlock(g, b, 'toad')).toContain('Já existe');
    expect(nameSannin(g, b.id, 'snake').ok).toBe(true);
  });

  test('Sannin tem teto de atributo 10', () => {
    const g = setup(802);
    const a = jounin(g);
    a.ninja!.stats.forca = 9;
    addStat(a, 'forca', 5);
    expect(a.ninja!.stats.forca).toBe(9); // Jounin comum: teto 9
    nameSannin(g, a.id, 'toad');
    addStat(a, 'forca', 5);
    expect(a.ninja!.stats.forca).toBe(10);
  });

  test('Serpente: golpe fatal vira troca de pele (uma vez por recarga)', () => {
    const g = setup(803);
    const a = jounin(g);
    nameSannin(g, a.id, 'snake');
    const foe = createRogue(g, 620, 600, 30);
    a.kawaCd = 999;
    applyDamage(g, foe, a, 99999, null, {});
    expect(a.dead).toBe(false);
    expect(a.hp).toBe(a.maxHp);
    expect(a.sanninCd).toBeGreaterThan(0);
  });

  test('Sapo: Modo Sábio aumenta o dano; Lesma cura os aliados por perto', () => {
    const g = setup(804);
    const toad = jounin(g);
    nameSannin(g, toad.id, 'toad');
    const foe = createRogue(g, 620, 600, 1);
    foe.hp = foe.maxHp = 99999;
    foe.kawaCd = 999;
    const hit = () => {
      const before = foe.hp;
      applyDamage(g, toad, foe, 50, null, {});
      return before - foe.hp;
    };
    const normal = [1, 2, 3, 4, 5].map(hit).reduce((x, y) => x + y);
    toad.combatTimer = 5;
    sanninTick(g, toad);
    expect(toad.sage).toBeGreaterThan(0);
    const sage = [1, 2, 3, 4, 5].map(hit).reduce((x, y) => x + y);
    expect(sage).toBeGreaterThan(normal * 1.2);

    const slug = jounin(g);
    nameSannin(g, slug.id, 'slug');
    const friend = createNinja(g, slug.x + 40, slug.y, 'genin', 0);
    friend.hp = 1;
    slug.hp = slug.maxHp * 0.3;
    sanninTick(g, slug);
    expect(friend.hp).toBeGreaterThan(friend.maxHp * 0.4);
    expect(slug.hp).toBeGreaterThan(slug.maxHp * 0.7);
  });
});
