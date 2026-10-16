import { cropTick } from '../fields';
import type { Game } from '../game';

/** Campos cercados (game/fields.ts): os canteiros crescem, secam, murcham e congelam. */
export function cropSystem(g: Game, dt: number) {
  cropTick(g, dt);
}
