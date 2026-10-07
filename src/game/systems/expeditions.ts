import { activeExpeditions, tickExpeditions } from '../expeditions';
import type { Game } from '../game';

/** Expedições fora do mapa (minas): avançam no tempo mesmo sem ninguém olhando. */
export function expeditionSystem(g: Game, dt: number) {
  tickExpeditions(g, dt);
  keepAwayHidden(g);
}

/**
 * Quem está fora em expedição some do mapa (os sistemas o ignoram). Conserta saves em que alguém ficou visível e
 * congelado (estava no Exame quando a equipe partiu) e quem ficou marcado numa expedição que já acabou.
 */
function keepAwayHidden(g: Game) {
  if (g.isScene) return;
  let live: Set<number> | null = null;
  for (const u of g.state.units) {
    if (u.dead || u.away == null || u.away < 0) continue; // negativo: raptado pelo Som (sound.ts)
    live ??= new Set(activeExpeditions(g).map((e) => e.id));
    if (live.has(u.away)) {
      if (!u.hidden) {
        u.hidden = true;
        u.moving = false;
        u.hasGoal = false;
        u.command = null;
        u.state = 'away';
      }
    } else {
      u.away = undefined;
      u.hidden = false;
      u.state = 'idle';
    }
  }
}
