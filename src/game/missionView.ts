// Consultas de missão usadas pela UI e pelo render (sem efeitos colaterais).
import type { Game } from './game';
import type { Mission } from './types';
import { tileCenter } from './world';

/** Ponto de interesse atual da missão (mercador, alvo vivo mais próximo, erva ou local). */
export function missionFocus(g: Game, m: Mission): { x: number; y: number } {
  if (m.type === 'escort') {
    const merchant = g.unit(m.targetIds[0]);
    if (merchant && !merchant.dead) return merchant;
  }
  if (m.type === 'herbs') {
    const n = m.nodeIds.map((id) => g.node(id)).find((x) => !!x);
    if (n) return { x: tileCenter(n.tx), y: tileCenter(n.ty) };
  }
  const t = m.targetIds.map((id) => g.unit(id)).find((u) => u && !u.dead && u.faction !== 'village');
  return t ?? { x: m.x, y: m.y };
}
