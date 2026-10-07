import type { Game } from '../game';
import { recoverBlades } from '../blades';
import { swordsmenTick } from '../swordsmen';
import { soundTick } from '../sound';

/** Espadachins da Névoa e Quinteto do Som (invasões) e lâminas lendárias sem dono voltando ao estoque (a cada segundo). */
export function legendsSystem(g: Game, dt: number) {
  swordsmenTick(g);
  soundTick(g, dt);
  if (Math.floor(g.state.time) !== Math.floor(g.state.time - dt)) recoverBlades(g);
}
