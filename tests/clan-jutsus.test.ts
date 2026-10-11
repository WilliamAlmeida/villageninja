import { describe, expect, test } from 'bun:test';
import { SAVE_VERSION, SIM_DT } from '../src/config';
import { JUTSUS } from '../src/data/jutsus';
import { castJutsu, engage, killUnit } from '../src/game/combat';
import { createNinja, createRogue } from '../src/game/entities';
import type { Game } from '../src/game/game';
import { createNewGame } from '../src/game/newGame';
import { migrate } from '../src/game/save';
import { statusSystem } from '../src/game/systems/status';
import { SYSTEMS } from '../src/game/systems';
import { CENTER_TX, CENTER_TY } from '../src/game/world';

const at = { x: (CENTER_TX + 6) * 32, y: (CENTER_TY + 6) * 32 };

function setup(seed: number, jutsu: string, foeDx = 90) {
  const g = createNewGame(SYSTEMS, seed);
  g.state.pace = 'fast';
  const n = createNinja(g, at.x, at.y, 'jounin', 0);
  const st = n.ninja!.stats;
  for (const k of Object.keys(st) as (keyof typeof st)[]) st[k] = 8;
  n.ninja!.jutsu = [jutsu, null];
  n.chakra = n.maxChakra = 400;
  const r = createRogue(g, at.x + foeDx, at.y, 1);
  r.hp = r.maxHp = 3000;
  r.ninja!.stats.velocidade = 0;
  return { g, n, r };
}
const tick = (g: Game, s: number) => {
  for (let t = 0; t < s; t += SIM_DT) statusSystem(g, SIM_DT);
};

describe('jutsus de clã do anime (Nara, Yamanaka, Gaara, raios, Rasengan, Edo Tensei)', () => {
  test('Kage Mane prende o alvo e o ninja fica parado segurando a sombra', () => {
    const { g, n, r } = setup(81, 'kagemane');
    castJutsu(g, n, 0, r);
    expect(r.stun).toBeGreaterThan(2);
    expect(r.stunVfx).toBe('shadow');
    expect(n.channel).toBeGreaterThan(2);
    expect(g.state.effects.some((e) => e.kind === 'tether' && e.uid === n.id && e.tid === r.id)).toBe(true);
    const x = n.x;
    engage(g, n, r, SIM_DT);
    expect(n.x).toBe(x);
  });

  test('Shintenshin: o renegado luta pelo outro lado e volta depois; chefe resiste', () => {
    const { g, n, r } = setup(82, 'shintenshin');
    castJutsu(g, n, 0, r);
    expect(r.faction).toBe('village');
    expect(r.charm?.faction).toBe('enemy');
    tick(g, JUTSUS.shintenshin!.duration! + 4);
    expect(r.faction).toBe('enemy');
    expect(r.charm).toBeUndefined();
    const boss = createRogue(g, at.x + 60, at.y, 1);
    boss.boss = true;
    n.ninja!.cd = [0, 0];
    castJutsu(g, n, 0, boss);
    expect(boss.faction).toBe('enemy');
  });

  test('Chidori Nagashi acerta e paralisa quem está em volta do próprio ninja', () => {
    const { g, n, r } = setup(83, 'chidorinagashi', 30);
    const r2 = createRogue(g, at.x - 30, at.y, 1);
    r2.hp = r2.maxHp = 3000;
    castJutsu(g, n, 0, r);
    expect(r.hp).toBeLessThan(3000);
    expect(r2.hp).toBeLessThan(3000);
    expect(r2.stun).toBeGreaterThan(0);
  });

  test('Kirin cai do céu e sai fraco sem nuvem de tempestade', () => {
    const { g, n, r } = setup(84, 'kirin', 150);
    g.state.weather = 'clear' as typeof g.state.weather;
    castJutsu(g, n, 0, r);
    expect(g.state.effects.some((e) => e.kind === 'thunder')).toBe(true);
    const clear = 3000 - r.hp;
    expect(clear).toBeGreaterThan(0);
    expect(clear).toBeLessThan(JUTSUS.kirin!.power * 1.6);
  });

  test('Sabaku Kyū prende na areia e Suna no Tate segura os golpes', () => {
    const { g, n, r } = setup(85, 'sabakukyu');
    castJutsu(g, n, 0, r);
    expect(r.stunVfx).toBe('sand');
    expect(r.hp).toBeLessThan(3000);
    n.ninja!.jutsu = ['sunanotate', null];
    n.ninja!.cd = [0, 0];
    castJutsu(g, n, 0, r);
    expect(n.shield).toBeGreaterThan(0);
    expect(n.shieldVfx).toBe('sand');
  });

  test('Edo Tensei traz o caído da vila por um tempo; ele se desfaz sem contar como perda', () => {
    const { g, n, r } = setup(86, 'edotensei');
    const hero = createNinja(g, at.x - 40, at.y, 'jounin', 0);
    hero.name = 'Sarutobi Hiro';
    hero.ninja!.level = 18;
    killUnit(g, hero, r);
    expect(g.state.fallen[0]?.name).toBe('Sarutobi Hiro');
    const lost = g.state.stats.lost;
    castJutsu(g, n, 0, r);
    const edo = g.state.units.find((u) => u.edo && !u.dead)!;
    expect(edo).toBeDefined();
    expect(edo.name).toContain('Sarutobi Hiro');
    expect(edo.faction).toBe('village');
    expect(edo.ninja!.level).toBe(18);
    killUnit(g, edo, r);
    expect(g.state.stats.lost).toBe(lost);
    expect(g.state.fallen.length).toBe(1);
  });

  test('Ōdama Rasengan pega todos em volta ao chegar', () => {
    expect(JUTSUS.odama!.dashRadius).toBeGreaterThan(0);
    expect(JUTSUS.odama!.orbSize).toBe(2);
  });

  test('migração 29 → 30 cria a lista dos caídos', () => {
    const s = migrate({ version: 29, units: [], scene: null })!;
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.fallen).toEqual([]);
  });
});
