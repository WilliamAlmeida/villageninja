import type { Game } from '../game';
import { regionDaily } from '../region';

/** Mapa da região: na virada do dia, tributos, postos avançados, vinganças e ninjas errantes. */
export function regionSystem(g: Game) {
  const s = g.state;
  if (s.day === s.regionDay) return;
  s.regionDay = s.day;
  regionDaily(g);
}
