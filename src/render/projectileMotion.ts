import type { Projectile } from '../game/types';

export const DRAGON_ORIGIN_X = 0.25;
export const DRAGON_TARGET_X = 0.75;
export const DRAGON_BASE_Y = 0.82;

/** Ajuste do bote (data/jutsu-fx.json, `motion: 'dragon'`): fonte e mergulho na largura da célula, tamanho e inclinação. */
export interface DragonOpts {
  originX?: number;
  targetX?: number;
  /** Largura da célula desenhada: mínima e máxima (escala igual nos dois eixos). */
  minSize?: number;
  maxSize?: number;
  /** Tangente máxima da inclinação em pé (cisalhamento); o que passar disso vira giro. 0 = só gira. */
  shear?: number;
  frames?: number;
}

/**
 * Ciclo único do dragão, preso ao ponto de lançamento e avançando até o destino. Sem estado extra no save.
 * A célula cresce por igual (sem esticar a pixel art) até cobrir a distância entre a fonte e o mergulho; se nem o
 * tamanho máximo alcança, a fonte desliza pelo chão até o alvo. Fica em pé: inclina por cisalhamento (até `shear`) e
 * só gira o resto; indo para a esquerda, espelha na horizontal.
 */
export function suiryuudanPose(p: Pick<Projectile, 'x' | 'y' | 'vx' | 'vy' | 'tx' | 'ty' | 'life'>, initialLife: number, o: DragonOpts = {}) {
  const originX = o.originX ?? DRAGON_ORIGIN_X;
  const span = Math.max(0.05, (o.targetX ?? DRAGON_TARGET_X) - originX);
  const frames = o.frames ?? 8;
  const elapsed = Math.max(0, initialLife - p.life);
  const x0 = p.x - p.vx * elapsed, y0 = p.y - p.vy * elapsed;
  const dx = p.tx - x0, dy = p.ty - y0;
  const distance = Math.hypot(dx, dy);
  const duration = distance / Math.max(0.001, Math.hypot(p.vx, p.vy));
  const progress = Math.min(1, elapsed / Math.max(0.001, duration));
  const side = dx < 0 ? -1 : 1;
  // ângulo em relação à horizontal (−90°…90°): parte em cisalhamento (o corpo segue em pé), o resto em giro
  const tilt = Math.atan2(dy, Math.abs(dx));
  const maxShear = Math.max(0, o.shear ?? 0.6);
  const shear = Math.max(-maxShear, Math.min(maxShear, Math.tan(tilt)));
  const turn = tilt - Math.atan(shear);
  const stretch = Math.hypot(1, shear); // o cisalhamento alonga o eixo da trajetória
  const want = Math.max(1, distance) / stretch / span;
  const size = Math.min(o.maxSize ?? Infinity, Math.max(o.minSize ?? 0, want));
  const slide = Math.max(0, distance - size * span * stretch) * progress;
  const ux = distance > 0 ? dx / distance : 0, uy = distance > 0 ? dy / distance : 0;
  return {
    x: x0 + ux * slide, y: y0 + uy * slide, size, side, turn, shear,
    frame: Math.min(frames - 1, Math.floor(progress * frames)), progress,
  };
}
