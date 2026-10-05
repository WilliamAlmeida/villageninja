import { describe, expect, test } from 'bun:test';
import { SAVE_VERSION, SIM_DT } from '../src/config';
import { applyDamage, castJutsu, castTick, dashTick, engage } from '../src/game/combat';
import { createAnimal } from '../src/game/entities';
import type { Game } from '../src/game/game';
import { crownKage } from '../src/game/kage';
import { createNewGame } from '../src/game/newGame';
import { migrate } from '../src/game/save';
import { SYSTEMS } from '../src/game/systems';
import { projectileSystem } from '../src/game/systems/projectiles';
import { flickerStyle, landing } from '../src/game/techniques';
import type { Unit } from '../src/game/types';

const ninjaOf = (g: Game) => g.state.units.find((u) => u.kind === 'ninja' && !u.dead)!;

/** Ninja forte e um lobo imóvel e indestrutível a `dist` px dele (em chão andável). */
function duel(seed: number, dist: number) {
  const g = createNewGame(SYSTEMS, seed);
  const n = ninjaOf(g);
  n.ninja!.jutsu = [null, null];
  n.ninja!.nature = 'katon'; // Shunshin de folhas (água/terra mudam o visual)
  n.chakra = n.maxChakra = 200;
  const p = landing(g, n.x + dist, n.y)!;
  const wolf = createAnimal(g, 'wolf', p.x, p.y);
  wolf.hp = wolf.maxHp = 9999;
  wolf.stun = 999;
  return { g, n, wolf };
}
const dist = (a: Unit, b: Unit) => Math.hypot(a.x - b.x, a.y - b.y);

describe('técnicas ninja', () => {
  test('Shunshin: longe do alvo, aparece perto dele num redemoinho', () => {
    const { g, n, wolf } = duel(201, 200);
    const before = dist(n, wolf);
    expect(before).toBeGreaterThan(150);
    engage(g, n, wolf, SIM_DT);
    expect(dist(n, wolf)).toBeLessThan(40);
    expect(n.flickerCd).toBeGreaterThan(0);
    expect(n.chakra).toBeLessThan(200);
    expect(g.state.effects.some((e) => e.kind === 'flicker' && e.variant === 'leaf')).toBe(true);
    expect(g.state.effects.some((e) => e.kind === 'afterimage' && e.uid === n.id)).toBe(true);
    // em recarga: o próximo salto não acontece
    n.x -= 200;
    engage(g, n, wolf, SIM_DT);
    expect(dist(n, wolf)).toBeGreaterThan(150);
  });

  test('visual do Shunshin por vila e natureza', () => {
    const { n } = duel(202, 100);
    n.ninja!.nature = 'katon';
    expect(flickerStyle(n)).toBe('leaf');
    n.ninja!.nature = 'suiton';
    expect(flickerStyle(n)).toBe('water');
    n.ninja!.nature = 'doton';
    expect(flickerStyle(n)).toBe('sand');
    n.ninja!.nature = 'fuuton';
    n.faction = 'enemy';
    expect(flickerStyle(n)).toBe('mist');
  });

  test('Kawarimi: golpe forte às vezes vira um tronco e o ninja escapa ileso', () => {
    const { g, n, wolf } = duel(203, 30);
    n.ninja!.stats.velocidade = 20;
    n.ninja!.stats.inteligencia = 20;
    let escaped = 0;
    for (let i = 0; i < 60; i++) {
      n.hp = n.maxHp;
      n.kawaCd = 0;
      n.chakra = 200;
      applyDamage(g, wolf, n, n.maxHp * 0.6, null, {});
      if (n.hp === n.maxHp) escaped++;
    }
    expect(escaped).toBeGreaterThan(5);
    expect(escaped).toBeLessThan(60);
    expect(g.state.effects.some((e) => e.kind === 'log')).toBe(true);
    // golpe fraco nunca aciona
    n.kawaCd = 0;
    n.hp = n.maxHp;
    applyDamage(g, wolf, n, 1, null, {});
    expect(n.hp).toBeLessThan(n.maxHp);
  });

  test('ritmo tático: selos antes do jutsu; golpe forte interrompe', () => {
    const { g, n, wolf } = duel(204, 100);
    n.ninja!.jutsu = ['goukakyuu', null];
    n.kawaCd = 999; // sem Kawarimi neste teste
    // rápido: sai na hora
    castJutsu(g, n, 0, wolf);
    expect(n.cast).toBeUndefined();
    expect(g.state.projectiles.length).toBe(1);
    // tático: faz os selos e só depois solta
    g.state.pace = 'tactical';
    g.state.projectiles.length = 0;
    castJutsu(g, n, 0, wolf);
    expect(n.cast).toBeDefined();
    expect(g.state.projectiles.length).toBe(0);
    for (let i = 0; i < 200 && n.cast; i++) castTick(g, n, SIM_DT);
    expect(n.cast).toBeUndefined();
    expect(g.state.projectiles.length).toBe(1);
    // interrompido: o jutsu não sai
    g.state.projectiles.length = 0;
    castJutsu(g, n, 0, wolf);
    applyDamage(g, wolf, n, n.maxHp * 0.2, null, {});
    expect(n.cast).toBeUndefined();
    for (let i = 0; i < 100; i++) castTick(g, n, SIM_DT);
    expect(g.state.projectiles.length).toBe(0);
  });

  test('Chidori corre até o alvo (não teletransporta) e golpeia ao chegar', () => {
    const { g, n, wolf } = duel(205, 130);
    n.ninja!.jutsu = ['chidori', null];
    const d0 = dist(n, wolf);
    castJutsu(g, n, 0, wolf);
    expect(n.dash).toBeDefined();
    expect(dist(n, wolf)).toBeCloseTo(d0, 0);
    dashTick(g, n, SIM_DT);
    expect(dist(n, wolf)).toBeLessThan(d0);
    expect(dist(n, wolf)).toBeGreaterThan(20);
    for (let i = 0; i < 100 && n.dash; i++) dashTick(g, n, SIM_DT);
    expect(n.dash).toBeUndefined();
    expect(wolf.hp).toBeLessThan(9999);
  });

  test('Hiraishin: o Kage marca com a kunai e aparece no clarão junto do alvo', () => {
    const { g, n, wolf } = duel(206, 150);
    g.state.ceremony = { candidateId: n.id, timer: 0 };
    crownKage(g);
    expect(n.ninja!.kageArt).toBe('hiraishin');
    engage(g, n, wolf, SIM_DT);
    const kunai = g.state.projectiles.find((p) => p.mark === n.id);
    expect(kunai).toBeDefined();
    for (let i = 0; i < 200 && !kunai!.dead; i++) projectileSystem(g, SIM_DT);
    expect(wolf.mark?.by).toBe(n.id);
    const hp = wolf.hp;
    n.attackCd = 0;
    const far = dist(n, wolf);
    engage(g, n, wolf, SIM_DT);
    expect(far).toBeGreaterThan(100);
    expect(dist(n, wolf)).toBeLessThan(45); // apareceu colado (o golpe ainda empurra o alvo um pouco)
    expect(wolf.hp).toBeLessThan(hp);
    expect(n.artCd).toBeGreaterThan(0);
    expect(g.state.effects.some((e) => e.kind === 'flicker' && e.variant === 'flash')).toBe(true);
  });

  test('migra saves da versão 14 (ritmo do combate e arte do Kage)', () => {
    const g = createNewGame(SYSTEMS, 207);
    const n = ninjaOf(g);
    n.ninja!.rank = 'kage';
    g.state.kageId = n.id;
    const old = JSON.parse(JSON.stringify(g.state));
    old.version = 14;
    delete old.pace;
    const s = migrate(old)!;
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.pace).toBe('fast');
    expect(s.units.find((u) => u.id === n.id)!.ninja!.kageArt).toBe('hiraishin');
  });
});
