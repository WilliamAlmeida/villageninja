import { describe, expect, test } from 'bun:test';
import { castJutsu } from '../src/game/combat';
import { createNinja, createRogue } from '../src/game/entities';
import { createNewGame } from '../src/game/newGame';
import { SYSTEMS } from '../src/game/systems';
import { effectSystem } from '../src/game/systems/effects';
import { CENTER_TX, CENTER_TY } from '../src/game/world';
import { jukaiFrame } from '../src/render/earthSandMotion';

function setup(id: string, dx: number) {
  const g = createNewGame(SYSTEMS, 4113);
  g.state.pace = 'fast';
  const x = (CENTER_TX + 6) * 32, y = (CENTER_TY + 6) * 32;
  const n = createNinja(g, x, y, 'jounin', 0), target = createRogue(g, x + dx, y, 1);
  const st = n.ninja!.stats;
  for (const key of Object.keys(st) as (keyof typeof st)[]) st[key] = 8;
  n.ninja!.jutsu = [id, null];
  n.chakra = n.maxChakra = 400;
  target.hp = target.maxHp = 3000;
  target.ninja!.stats.velocidade = 0;
  return { g, n, target };
}

describe('integração de Raiton e Mokuton', () => {
  test('Kirin usa uma única descarga com ciclo completo e fica no ponto atingido', () => {
    const { g, n, target } = setup('kirin', 150);
    const x = target.x, y = target.y;
    castJutsu(g, n, 0, target);
    const effects = g.state.effects.filter(e => e.fx === 'kirin');
    expect(effects.length).toBe(1);
    expect(effects[0]!.kind).toBe('thunder');
    expect(effects[0]!.life).toBeCloseTo(.8);
    expect(g.state.effects.some(e => e.kind === 'ring')).toBe(false);
    expect(target.hp).toBeLessThan(3000);
    target.x += 50;
    effectSystem(g, .2);
    expect(effects[0]!.x).toBe(x);
    expect(effects[0]!.y).toBe(y);
  });
  test('Nagashi acompanha o corpo e termina sem aplicar dano novamente', () => {
    const { g, n, target } = setup('chidorinagashi', 30);
    castJutsu(g, n, 0, target);
    const discharge = g.state.effects.find(e => e.fx === 'chidorinagashi')!;
    expect(discharge.uid).toBe(n.id);
    expect(discharge.life).toBeCloseTo(.8);
    expect(target.hp).toBeLessThan(3000);
    const hp = target.hp;
    n.x += 25; n.y += 10;
    effectSystem(g, .2);
    expect(discharge.x).toBe(n.x);
    expect(discharge.y).toBe(n.y);
    expect(target.hp).toBe(hp);
    effectSystem(g, .61);
    expect(g.state.effects.some(e => e.fx === 'chidorinagashi')).toBe(false);
  });
  test('descarga de Nagashi some se o lançador morrer', () => {
    const { g, n, target } = setup('chidorinagashi', 30);
    castJutsu(g, n, 0, target);
    n.dead = true;
    effectSystem(g, .01);
    expect(g.state.effects.some(e => e.fx === 'chidorinagashi')).toBe(false);
  });
  test('Jukai mantém a prisão e suas raízes só recuam no final', () => {
    const { g, n, target } = setup('jukai', 90);
    castJutsu(g, n, 0, target);
    expect(target.stunVfx).toBe('wood');
    expect(target.stun).toBe(2.5);
    expect(g.state.effects.some(e => e.kind === 'burst' && e.fx === 'jukai')).toBe(false);
    expect(jukaiFrame(2.5, 2.5)).toBe(0);
    expect(jukaiFrame(2.15, 2.5)).toBe(2);
    expect(jukaiFrame(1.5, 2.5)).toBe(4);
    expect(jukaiFrame(.7, 2.5)).toBe(4);
    expect(jukaiFrame(.4, 2.5)).toBe(5);
    expect(jukaiFrame(.2, 2.5)).toBe(6);
    expect(jukaiFrame(.05, 2.5)).toBe(7);
  });
});
