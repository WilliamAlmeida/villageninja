import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SAVE_VERSION } from '../src/config';
import { FX, formatFx, SHAPES, type Emitter, type SpriteFx } from '../src/data/jutsuFx';
import { JUTSU_BASE, JUTSUS } from '../src/data/jutsus';
import { createNewGame } from '../src/game/newGame';
import { migrate } from '../src/game/save';
import { SYSTEMS } from '../src/game/systems';
import type { Effect, Projectile } from '../src/game/types';
import { Particles } from '../src/render/particles';

const ROOT = join(import.meta.dir, '..');
const ART_TS = readFileSync(join(ROOT, 'src', 'render', 'art.ts'), 'utf8');
const range = (r: unknown) => Array.isArray(r) && r.length === 2 && r.every((v) => typeof v === 'number' && Number.isFinite(v)) && r[0] <= r[1];

function checkEmitter(e: Emitter, where: string) {
  expect(SHAPES, where).toContain(e.shape);
  expect(e.colors.length, where).toBeGreaterThan(0);
  for (const c of e.colors) expect(c === '$' || /^#[0-9a-f]{6}$/i.test(c), `${where}: cor ${c}`).toBe(true);
  expect(e.n, where).toBeGreaterThanOrEqual(0);
  for (const k of ['life', 'size', 'speed'] as const) expect(range(e[k]), `${where}.${k}`).toBe(true);
  for (const k of ['rise', 'jump'] as const) if (e[k] != null) expect(range(e[k]), `${where}.${k}`).toBe(true);
}

function checkSprite(s: SpriteFx, where: string) {
  // a folha existe em src/art/effects e está no registro do art.ts (senão o jogo nunca a carrega)
  expect(existsSync(join(ROOT, 'src', 'art', 'effects', `${s.sheet}.png`)), `${where}: ${s.sheet}.png`).toBe(true);
  expect(ART_TS.includes(`'${s.sheet}'`), `${where}: ${s.sheet} no art.ts`).toBe(true);
  expect(s.cols * s.rows, where).toBeGreaterThanOrEqual(s.frames);
  expect(s.size, where).toBeGreaterThan(0);
  if (s.parts) {
    for (const sheet of [s.parts.bodySheet, s.parts.originSheet]) {
      expect(existsSync(join(ROOT, 'src', 'art', 'effects', `${sheet}.png`)), `${where}: ${sheet}`).toBe(true);
      expect(ART_TS.includes(`'${sheet}'`)).toBe(true);
    }
    expect(s.parts.bodyWidth).toBeGreaterThan(0);
    expect(s.parts.spacing).toBeGreaterThan(0);
  }
}

describe('visual dos jutsus (jutsu-fx.json)', () => {
  test('emissores válidos em todo estilo e exceção', () => {
    expect(FX.styles.none, 'estilo "none" (sem estilo) existe').toBeDefined();
    for (const [k, s] of Object.entries(FX.styles)) {
      s.trail.forEach((e, i) => checkEmitter(e, `${k}.trail[${i}]`));
      s.burst.forEach((e, i) => checkEmitter(e, `${k}.burst[${i}]`));
    }
    for (const [k, j] of Object.entries(FX.jutsus)) {
      expect(JUTSUS[k], `jutsu ${k} existe`).toBeDefined();
      j.trail?.forEach((e, i) => checkEmitter(e, `${k}.trail[${i}]`));
      j.burst?.forEach((e, i) => checkEmitter(e, `${k}.burst[${i}]`));
      if (j.sprite) checkSprite(j.sprite, k);
      if (j.profile) checkSprite(j.profile, `${k}.profile`);
      if (j.oblique) checkSprite(j.oblique, `${k}.oblique`);
      if (j.origin) checkSprite(j.origin, `${k}.origin`);
      if (j.impact) checkSprite(j.impact, `${k}.impact`);
      if (j.crater) checkSprite(j.crater, `${k}.crater`);
      if (j.vfx) expect(FX.styles[j.vfx], `${k}: estilo ${j.vfx}`).toBeDefined();
    }
    for (const [k, s] of Object.entries(FX.status)) checkSprite(s, `status.${k}`);
  });

  test('emissor desligado (off) não solta nada, nem no rastro nem na explosão', () => {
    const on: Emitter = { shape: 'spark', colors: ['$'], n: 600, life: [1, 1], size: [1, 1], speed: [0, 0] };
    const style = FX.styles.none!;
    const saved = { trail: style.trail, burst: style.burst };
    const count = (off: boolean) => {
      style.trail = [{ ...on, off }];
      style.burst = [{ ...on, n: 20, off }];
      const pa = new Particles();
      pa.trail({ kind: 'jet', vx: 100, vy: 0, size: 4, color: '#123456', nature: null } as unknown as Projectile, 0, 0, 0.1);
      const e = { kind: 'burst', x: 0, y: 0, r: 10, color: '#123456', t: 0, life: 1 } as Effect;
      pa.effect(e, e);
      return (pa as unknown as { list: unknown[] }).list.length;
    };
    try {
      expect(count(false)).toBeGreaterThan(0);
      expect(count(true)).toBe(0);
    } finally {
      Object.assign(style, saved);
    }
  });

  test('o arquivo gravado volta igual (o laboratório grava pelo formatFx)', () => {
    expect(JSON.parse(formatFx(FX))).toEqual(JSON.parse(JSON.stringify(FX)));
  });

  test('números do projétil ajustados entram no jutsu; o original fica em JUTSU_BASE', () => {
    for (const [k, j] of Object.entries(FX.jutsus))
      for (const [p, v] of Object.entries(j.proj ?? {})) expect(JUTSUS[k]![p as 'projSpeed']).toBe(v);
    expect(JUTSU_BASE.goukakyuu).toBeDefined();
  });

  test('save v41 → v42 (projétil/efeito com o jutsu de origem, opcional)', () => {
    const s = JSON.parse(JSON.stringify(createNewGame(SYSTEMS, 42).state));
    s.version = 41;
    const m = migrate(s)!;
    expect(m.version).toBe(SAVE_VERSION);
  });
});
