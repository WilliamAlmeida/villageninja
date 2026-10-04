import { TILE } from '../config';
import type { Game } from './game';
import type { Building, Unit } from './types';
import { doorPos } from './world';

/**
 * Quem está dentro de um prédio. Unidades "escondidas" (dormindo, estudando, abrigadas…)
 * ficam paradas na porta do prédio em que entraram, então a posição diz onde estão.
 */
export function occupantsOf(g: Game, b: Building): Unit[] {
  const d = doorPos(b);
  return g.state.units.filter((u) => u.hidden && !u.dead && Math.hypot(u.x - d.x, u.y - d.y) < TILE * 0.6);
}
