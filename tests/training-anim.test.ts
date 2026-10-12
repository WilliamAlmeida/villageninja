import { describe, expect, test } from 'bun:test';
import { SIM_DT } from '../src/config';
import type { StatKey } from '../src/data/ninja';
import { createNinja } from '../src/game/entities';
import { createNewGame } from '../src/game/newGame';
import { setFocus } from '../src/game/commands';
import { focusCapped, trainTick } from '../src/game/progression';
import { CENTER_TX, CENTER_TY } from '../src/game/world';
import { SYSTEMS } from '../src/game/systems';
import type { Game } from '../src/game/game';
import type { Unit } from '../src/game/types';

/** Ninja mandado treinar com o foco dado; devolve quando chega no campo. */
const training = (seed: number, focus: StatKey) => {
  const g = createNewGame(SYSTEMS, seed);
  for (const u of g.state.units) if (u.kind !== 'villager') u.dead = true;
  g.state.timers.animal = g.state.timers.raid = 1e9;
  // campo num lugar livre perto do centro (em cima da Residência só sobraria um corredor para andar)
  let spot = { tx: 0, ty: 0 };
  for (let r = 4; r < 20 && !spot.tx; r++)
    for (let a = 0; a < 16 && !spot.tx; a++) {
      const tx = CENTER_TX + Math.round(Math.cos(a) * r);
      const ty = CENTER_TY + Math.round(Math.sin(a) * r);
      if (g.world.canPlace('training', tx, ty)) spot = { tx, ty };
    }
  expect(spot.tx).toBeGreaterThan(0);
  g.addBuilding({ id: g.newId(), type: 'training', ...spot, built: true, progress: 99, desired: 0, workers: [], cd: 0 });
  const n = createNinja(g, (spot.tx - 2) * 32, (spot.ty + 1) * 32, 'genin', 0);
  n.ninja!.order = 'train';
  n.ninja!.focus = focus;
  for (const k of Object.keys(n.ninja!.stats) as StatKey[]) n.ninja!.stats[k] = 1; // longe do teto: treina o foco mesmo
  for (let t = 0; t < 60 && n.state !== 'train'; t += SIM_DT) {
    g.state.time = 30;
    g.step(SIM_DT);
  }
  expect(n.state).toBe('train');
  expect(n.trainStat).toBe(focus);
  return { g, n };
};

/** O que aparece durante 3 s de treino. */
const watch = (g: Game, n: Unit) => {
  const seen = { moves: new Set<string>(), seals: false, moved: 0, still: 0 };
  let x = n.x;
  let y = n.y;
  for (let t = 0; t < 3 && n.state === 'train'; t += SIM_DT) {
    g.state.time = 30;
    g.step(SIM_DT);
    if (n.animKind === 'moves' && n.anim > 0 && n.moveJutsu) seen.moves.add(n.moveJutsu);
    if (n.animKind === 'seals' && n.anim > 0) seen.seals = true;
    seen.moved += Math.hypot(n.x - x, n.y - y);
    if (!n.moving && n.anim <= 0) seen.still++;
    x = n.x;
    y = n.y;
  }
  return seen;
};

describe('animação do treino pelo atributo', () => {
  test('Taijutsu soca e chuta; Força bate pesado', () => {
    let s = training(701, 'taijutsu');
    expect(watch(s.g, s.n).moves.has('train-tai')).toBe(true);
    s = training(702, 'forca');
    expect(watch(s.g, s.n).moves.has('train-forca')).toBe(true);
  });

  test('Velocidade corre em volta do campo mais rápido que a Stamina, que também salta', () => {
    const v = training(703, 'velocidade');
    const fast = watch(v.g, v.n).moved;
    const st = training(704, 'stamina');
    const s = (() => {
      const r = { moved: 0, jump: false };
      for (let i = 0; i < 3; i++) {
        const w = watch(st.g, st.n);
        r.moved += w.moved / 3;
        r.jump ||= w.moves.has('train-jump');
      }
      return r;
    })();
    expect(fast).toBeGreaterThan(150);
    expect(s.moved).toBeGreaterThan(40);
    expect(fast).toBeGreaterThan(s.moved);
    expect(s.jump).toBe(true);
  });

  test('Selos faz os selos em ciclo; Ninjutsu, Genjutsu e Inteligência ficam sentados parados', () => {
    const s = training(705, 'selos');
    expect(watch(s.g, s.n).seals).toBe(true);
    for (const k of ['ninjutsu', 'genjutsu', 'inteligencia'] as const) {
      const m = training(706, k);
      const w = watch(m.g, m.n);
      expect(w.moved).toBe(0);
      expect(w.moves.size).toBe(0);
      expect(w.still).toBeGreaterThan(0);
    }
  });

  test('o treino sobe o atributo que foi animado', () => {
    const { g, n } = training(707, 'velocidade');
    const before = n.ninja!.stats.velocidade;
    for (let t = 0; t < 10 && n.state === 'train'; t += SIM_DT) {
      g.state.time = 30;
      g.step(SIM_DT);
    }
    expect(n.state).not.toBe('train');
    expect(n.ninja!.stats.velocidade).toBeGreaterThan(before);
    expect(n.trainStat).toBeUndefined();
  });
});

describe('foco trocado no meio do treino', () => {
  test('sentado meditando, trocou para Taijutsu: levanta e já soca', () => {
    const { g, n } = training(708, 'ninjutsu');
    n.ninja!.focus = 'taijutsu';
    const w = watch(g, n);
    expect(n.trainStat).toBe('taijutsu');
    expect(w.moves.has('train-tai')).toBe(true);
  });
});

describe('foco num atributo já no teto', () => {
  test('não deixa escolher e diz por quê', () => {
    const g = createNewGame(SYSTEMS, 709);
    const n = createNinja(g, 1100, 800, 'genin', 0);
    n.ninja!.stats.taijutsu = 5;
    const r = setFocus(g, n.id, 'taijutsu');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain('Chunin');
    expect(focusCapped(n.ninja!, 'velocidade')).toBeNull();
    n.ninja!.rank = 'chunin';
    expect(setFocus(g, n.id, 'taijutsu').ok).toBe(true);
  });

  test('chegou ao teto treinando: o foco volta para Aleatório', () => {
    const g = createNewGame(SYSTEMS, 710);
    const n = createNinja(g, 1100, 800, 'genin', 0);
    n.ninja!.stats.forca = 4.99;
    n.ninja!.focus = 'forca';
    trainTick(g, n, null, undefined, 'forca');
    expect(n.ninja!.stats.forca).toBe(5);
    expect(n.ninja!.focus).toBeNull();
  });
});
