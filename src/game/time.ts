import { DAY_LENGTH } from '../config';
import type { GameState } from './types';

/** Hora do dia (0–24). O dia começa às 6h. */
export const hourOf = (s: GameState) => (6 + ((s.time % DAY_LENGTH) / DAY_LENGTH) * 24) % 24;
export const isNight = (s: GameState) => {
  const h = hourOf(s);
  return h >= 20 || h < 5;
};
/** Escuridão 0..1 para o render. */
export function darkness(s: GameState) {
  const h = hourOf(s);
  if (h >= 21 || h < 4) return 1;
  if (h >= 18) return (h - 18) / 3;
  if (h < 7) return 1 - (h - 4) / 3;
  return 0;
}
export function clockLabel(s: GameState) {
  const h = hourOf(s);
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 6) * 10;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
