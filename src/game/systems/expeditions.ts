import { tickExpeditions } from '../expeditions';
import type { Game } from '../game';

/** Expedições fora do mapa (minas): avançam no tempo mesmo sem ninguém olhando. */
export function expeditionSystem(g: Game, dt: number) {
  tickExpeditions(g, dt);
}
