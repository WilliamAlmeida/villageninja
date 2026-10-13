import { expect, test } from 'bun:test';
import { SAVE_VERSION, SIM_DT, TILE } from '../src/config';
import { createDragonFlight, dragonPoint } from '../src/game/dragonFlight';
import { castJutsu } from '../src/game/combat';
import { createNinja, createRogue } from '../src/game/entities';
import { createNewGame } from '../src/game/newGame';
import { migrate } from '../src/game/save';
import { projectileSystem } from '../src/game/systems/projectiles';
import { CENTER_TX, CENTER_TY } from '../src/game/world';

test('fonte nasce no tile de trás em oito direções, nunca no centro do ninja', () => {
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    const f = createDragonFlight(500, 500, 500 + Math.cos(angle) * 100, 500 + Math.sin(angle) * 100, angle, 200);
    expect(f.sx).toBe(500 - Math.round(Math.cos(angle)) * TILE);
    expect(f.sy).toBe(500 - Math.round(Math.sin(angle)) * TILE);
    expect(Math.hypot(f.sx - 500, f.sy - 500)).toBeGreaterThanOrEqual(TILE);
  }
});

test('alvo colado: sobe e mergulha no lugar, com duração mínima', () => {
  const f = createDragonFlight(0, 0, 8, 0, 0, 200);
  const middle = dragonPoint(f, 0.5), start = dragonPoint(f, 0), end = dragonPoint(f, 1);
  expect(f.duration).toBeGreaterThanOrEqual(1);
  expect(middle.z).toBeGreaterThan(30);
  expect(start.x).toBe(-TILE);
  expect(end.x).toBe(8);
  expect(end.y).toBe(0);
  expect(end.z).toBeCloseTo(0);
});

test('chega sempre de frente: nunca passa do alvo nem volta, com ou sem curva lateral', () => {
  for (const bend of [0, 60, -60])
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const tx = Math.cos(a) * 140, ty = Math.sin(a) * 140;
      const f = createDragonFlight(0, 0, tx, ty, a, 200, { lift: 42, bend });
      const ux = Math.cos(a), uy = Math.sin(a);
      let last = -Infinity;
      for (let k = 0; k <= 40; k++) {
        const p = dragonPoint(f, k / 40);
        // avanço na direção do alvo: só cresce e não passa dele
        const along = (p.x - f.sx) * ux + (p.y - f.sy) * uy;
        expect(along).toBeGreaterThanOrEqual(last - 1e-6);
        expect(along).toBeLessThanOrEqual((tx - f.sx) * ux + (ty - f.sy) * uy + 1e-6);
        last = along;
      }
      // no fim, a cabeça vai em direção ao alvo
      const end = dragonPoint(f, 1);
      expect(end.vx * ux + end.vy * uy).toBeGreaterThan(0);
      if (bend === 0) expect(Math.abs(end.vx * uy - end.vy * ux)).toBeLessThan(1e-6); // reto no chão
    }
});

test('a simulação segue a mesma cabeça da curva e só atinge o alvo próximo ao descer', () => {
  const g = createNewGame([], 731);
  const x = (CENTER_TX + 6) * TILE, y = (CENTER_TY + 6) * TILE;
  const n = createNinja(g, x, y, 'jounin', 0);
  const target = createRogue(g, x + 12, y, 1);
  g.state.units = [n, target];
  g.state.pace = 'fast';
  n.ninja!.jutsu = ['suiryuudan', null];
  n.chakra = n.maxChakra = 500;
  target.hp = target.maxHp = 5000;
  target.ninja!.stats.velocidade = 0;
  target.kawaCd = 100;
  castJutsu(g, n, 0, target);
  const p = g.state.projectiles[0]!, f = p.dragon!;
  expect(f).toBeDefined();
  expect(p.x).toBe(n.x - TILE);
  for (let t = 0; t < 0.6; t += SIM_DT) {
    projectileSystem(g, SIM_DT);
    const expected = dragonPoint(f, f.elapsed / f.duration);
    expect(p.x).toBeCloseTo(expected.x);
    expect(p.y).toBeCloseTo(expected.y);
    expect(p.dead).not.toBe(true);
    expect(target.hp).toBe(5000);
  }
  for (let t = 0; t < f.duration + 0.2; t += SIM_DT) projectileSystem(g, SIM_DT);
  expect(p.dead).toBe(true);
  expect(target.hp).toBeLessThan(5000);
  expect(f.elapsed).toBeGreaterThan(0.75);
});

test('save v42 migra e a curva opcional permanece JSON serializável', () => {
  const g = createNewGame([], 732);
  const s = JSON.parse(JSON.stringify(g.state));
  s.version = 42;
  expect(migrate(s)?.version).toBe(SAVE_VERSION);
  const f = createDragonFlight(30, 60, 100, 80, 0, 200);
  f.elapsed = 0.5;
  const restored = JSON.parse(JSON.stringify(f));
  expect(dragonPoint(restored, restored.elapsed / restored.duration)).toEqual(dragonPoint(f, f.elapsed / f.duration));
});
