import type { Game } from '../game';
import { orgTick } from '../org';

/** Ordem do Eclipse: agenda e manda as duplas (só na vila). */
export function orgSystem(g: Game) {
  orgTick(g);
}
