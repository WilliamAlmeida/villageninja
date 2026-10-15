import { describe, expect, test } from 'bun:test';
import { castJutsu } from '../src/game/combat';
import { createNinja, createRogue } from '../src/game/entities';
import { createNewGame } from '../src/game/newGame';
import { SYSTEMS } from '../src/game/systems';
import { effectSystem } from '../src/game/systems/effects';
import { projectileSystem } from '../src/game/systems/projectiles';
import { CENTER_TX, CENTER_TY } from '../src/game/world';
import { FX, formatFx } from '../src/data/jutsuFx';

function setup(id: string) {
  const g = createNewGame(SYSTEMS, 7128);
  g.state.pace = 'fast';
  const x = (CENTER_TX + 6) * 32, y = (CENTER_TY + 6) * 32;
  const n = createNinja(g, x, y, 'jounin', 0), target = createRogue(g, x + 75, y, 1);
  const st = n.ninja!.stats;
  for (const key of Object.keys(st) as (keyof typeof st)[]) st[key] = 8;
  n.ninja!.jutsu = [id, null];
  n.chakra = n.maxChakra = 400;
  target.hp = target.maxHp = 10000;
  return { g, n, target };
}

describe('integração de Lava e Vento', () => {
  test('Daitoppa desenha uma rajada completa e aplica dano uma vez', () => {
    const { g, n, target } = setup('daitoppa');
    castJutsu(g, n, 0, target);
    const gusts = g.state.effects.filter(e => e.kind === 'gust');
    expect(gusts).toHaveLength(1);
    expect(gusts[0]!.fx).toBe('daitoppa');
    expect(gusts[0]!.life).toBeCloseTo(.5);
    expect(g.state.effects.some(e => e.kind === 'burst' || e.kind === 'ring')).toBe(false);
    expect(target.hp).toBeLessThan(10000);
    const hp = target.hp;
    effectSystem(g, .51);
    expect(target.hp).toBe(hp);
    expect(g.state.effects.some(e => e.kind === 'gust')).toBe(false);
  });
  for (const [id, count, duration] of [['yokai', 1, .8]] as const) {
    test(id + ': impacto dura a sequência inteira e não repete o dano', () => {
      const { g, n, target } = setup(id);
      castJutsu(g, n, 0, target);
      expect(g.state.projectiles).toHaveLength(count);
      for (const p of g.state.projectiles) {
        p.x = target.x; p.y = target.y - 6; p.vx = p.vy = 0;
      }
      projectileSystem(g, 0);
      const impacts = g.state.effects.filter(e => e.kind === 'burst' && e.fx === id);
      expect(impacts).toHaveLength(count);
      for (const e of impacts) expect(e.life).toBeCloseTo(duration);
      expect(target.hp).toBeLessThan(10000);
      const hp = target.hp;
      effectSystem(g, duration - .01);
      expect(g.state.effects.filter(e => e.kind === 'burst' && e.fx === id)).toHaveLength(count);
      expect(target.hp).toBe(hp);
      effectSystem(g, .02);
      expect(g.state.effects.some(e => e.kind === 'burst' && e.fx === id)).toBe(false);
    });
  }
  test('laboratório conserva a rajada e distância visual; Shinkuu Ha mantém três projéteis', () => {
    const saved = JSON.parse(formatFx(FX));
    expect(saved.jutsus.daitoppa.gust).toEqual(FX.jutsus.daitoppa!.gust);
    expect(saved.jutsus.doryuudan.origin.forward).toBe(FX.jutsus.doryuudan!.origin!.forward);
    const { g, n, target } = setup('shinkuuha');
    castJutsu(g, n, 0, target);
    expect(g.state.projectiles).toHaveLength(3);
  });
});
