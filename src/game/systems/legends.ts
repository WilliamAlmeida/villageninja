import type { Game } from '../game';
import { recoverBlades } from '../blades';
import { swordsmenTick } from '../swordsmen';

/** Espadachins da Névoa (invasões) e lâminas lendárias sem dono voltando ao estoque (a cada segundo). */
export function legendsSystem(g: Game, dt: number) {
  swordsmenTick(g);
  if (Math.floor(g.state.time) !== Math.floor(g.state.time - dt)) recoverBlades(g);
}
