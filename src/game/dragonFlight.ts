import { TILE } from '../config';
import type { FlightFx } from '../data/jutsuFx';
import type { DragonFlight } from './types';

/** Altura da ligação entre a fonte de água e o corpo (px de cena). */
export const DRAGON_SOURCE_HEIGHT = 18;
/** Forma do bote quando o jutsu-fx.json não diz (data/jutsuFx.ts → `flight`). */
export const DEFAULT_FLIGHT: FlightFx = { lift: 42, bend: 0 };

/**
 * Bote do dragão: a fonte nasce um tile atrás do ninja e a cabeça vai até o alvo numa curva cúbica no chão cujos dois
 * pontos de controle ficam ENTRE a fonte e o alvo (a um terço e a dois terços do caminho, desviados `bend` px para o
 * lado). Assim a cabeça sempre chega de frente, sem passar do alvo e voltar; o arco que se vê é a altura (`lift`),
 * subindo e mergulhando no alvo (`dragonPoint`).
 */
export function createDragonFlight(x: number, y: number, tx: number, ty: number, facing: number, speed: number, shape: FlightFx = DEFAULT_FLIGHT): DragonFlight {
  const angle = tx === x && ty === y ? facing : Math.atan2(ty - y, tx - x);
  const snapped = Math.round(angle / (Math.PI / 4)) * Math.PI / 4;
  const sx = x - Math.round(Math.cos(snapped)) * TILE;
  const sy = y - Math.round(Math.sin(snapped)) * TILE;
  const distance = Math.hypot(tx - sx, ty - sy);
  const ux = distance > 0 ? (tx - sx) / distance : Math.cos(angle);
  const uy = distance > 0 ? (ty - sy) / distance : Math.sin(angle);
  let nx = -uy, ny = ux;
  // desvio lateral (se houver) para o fundo do mapa, onde a projeção não esconde a cabeça
  if (nx + ny > 0) { nx = -nx; ny = -ny; }
  const third = distance / 3;
  const bend = shape.bend;
  const flight: DragonFlight = {
    sx, sy,
    c1x: sx + ux * third + nx * bend, c1y: sy + uy * third + ny * bend,
    c2x: tx - ux * third + nx * bend, c2y: ty - uy * third + ny * bend,
    tx, ty, elapsed: 0, duration: 1, lift: shape.lift,
  };
  let length = 0, prev = dragonPoint(flight, 0);
  for (let i = 1; i <= 24; i++) {
    const next = dragonPoint(flight, i / 24);
    length += Math.hypot(next.x - prev.x, next.y - prev.y);
    prev = next;
  }
  flight.duration = Math.max(1, length / Math.max(1, speed));
  return flight;
}

/** Cabeça e corpo usam a mesma curva cúbica. vx/vy são a derivada em relação ao progresso (0..1). */
export function dragonPoint(f: DragonFlight, progress: number) {
  const t = Math.max(0, Math.min(1, progress)), u = 1 - t;
  return {
    x: u * u * u * f.sx + 3 * u * u * t * f.c1x + 3 * u * t * t * f.c2x + t * t * t * f.tx,
    y: u * u * u * f.sy + 3 * u * u * t * f.c1y + 3 * u * t * t * f.c2y + t * t * t * f.ty,
    vx: 3 * u * u * (f.c1x - f.sx) + 6 * u * t * (f.c2x - f.c1x) + 3 * t * t * (f.tx - f.c2x),
    vy: 3 * u * u * (f.c1y - f.sy) + 6 * u * t * (f.c2y - f.c1y) + 3 * t * t * (f.ty - f.c2y),
    z: DRAGON_SOURCE_HEIGHT * u + Math.sin(Math.PI * t) * f.lift,
    vz: -DRAGON_SOURCE_HEIGHT + Math.cos(Math.PI * t) * Math.PI * f.lift,
  };
}
