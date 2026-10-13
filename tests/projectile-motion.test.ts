import { expect, test } from 'bun:test';
import { DRAGON_ORIGIN_X, DRAGON_TARGET_X, suiryuudanPose } from '../src/render/projectileMotion';

const SPAN = DRAGON_TARGET_X - DRAGON_ORIGIN_X;

test('dragão mantém a origem fixa e percorre surgimento, arco e mergulho uma vez', () => {
  const initialLife = 1.225;
  for (let i = 0; i <= 8; i++) {
    const elapsed = (i + 0.5) * 0.1;
    // na horizontal: sem inclinação, a célula cobre a distância por inteiro
    const pose = suiryuudanPose({ x: 20 + 150 * elapsed, y: 40, vx: 150, vy: 0, tx: 140, ty: 40, life: initialLife - elapsed }, initialLife);
    expect(pose.x).toBeCloseTo(20);
    expect(pose.y).toBeCloseTo(40);
    expect(pose.frame).toBe(Math.min(7, i));
    expect(pose.size * SPAN).toBeCloseTo(120);
  }
});

test('escala igual nos dois eixos: longe demais, não estica, a fonte desliza até o alvo', () => {
  const life = 2;
  const half = suiryuudanPose({ x: 100, y: 0, vx: 200, vy: 0, tx: 400, ty: 0, life: life - 0.5 }, life, { maxSize: 128 });
  expect(half.size).toBe(128);
  // a cabeça (fonte + 128 × 0,5) chega no alvo quando o voo termina
  const end = suiryuudanPose({ x: 400, y: 0, vx: 200, vy: 0, tx: 400, ty: 0, life: 0 }, life, { maxSize: 128 });
  expect(end.x + end.size * SPAN).toBeCloseTo(400);
  expect(half.x).toBeGreaterThan(0);
  expect(half.x).toBeLessThan(end.x);
});

test('alvo bem abaixo: inclina até o limite e gira só o resto, e espelha para a esquerda', () => {
  const pose = suiryuudanPose({ x: 0, y: 0, vx: -10, vy: 100, tx: -10, ty: 100, life: 1 }, 1, { shear: 0.6 });
  expect(pose.side).toBe(-1);
  expect(pose.shear).toBeCloseTo(0.6);
  expect(Math.atan(pose.shear) + pose.turn).toBeCloseTo(Math.atan2(100, 10));
});

test('destino colado e tempo esgotado não geram valores inválidos nem reiniciam o ciclo', () => {
  const pose = suiryuudanPose({ x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, life: -1 }, 1);
  expect(pose.frame).toBe(7);
  expect(Number.isFinite(pose.size)).toBe(true);
  expect(Number.isFinite(pose.x)).toBe(true);
});
