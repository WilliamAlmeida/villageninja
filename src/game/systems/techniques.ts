import { castTick, dashTick } from '../combat';
import type { Game } from '../game';

/** Selos em andamento (ritmo tático) e investidas (Chidori): seguem sozinhos, fora da IA de cada um. */
export function techniqueSystem(g: Game, dt: number) {
  for (const u of g.state.units) {
    if (u.dead) continue;
    if (u.dash) dashTick(g, u, dt);
    else if (u.cast) castTick(g, u, dt);
  }
}
