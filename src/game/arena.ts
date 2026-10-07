// Limites da arena do Exame Chunin (redonda): os dois do duelo lutam dentro do círculo. Shunshin e Kawarimi só
// pousam dentro, a distância de luta cabe nele e andar não tira ninguém de lá. Só um golpe que EMPURRA pode jogar
// alguém para fora — e quem sai assim perde (ring-out, `systems/exam.ts`).
import { TILE } from '../config';
import { BUILDINGS } from '../data/buildings';
import type { Game } from './game';
import type { Building, Unit } from './types';

/** Raio do chão de luta em relação ao lado da arena; margem de dentro para pousar. */
export const ARENA_RING = { radius: 0.5, margin: 12, /** além do raio: fora da arena */ out: 6, /** o chão do desenho fica um pouco acima do centro do terreno */ lift: 5 };

/** Círculo de luta da arena (mundo, px). */
export function arenaRing(b: Building) {
  const w = BUILDINGS.arena.w * TILE;
  return { cx: b.tx * TILE + w / 2 - ARENA_RING.lift, cy: b.ty * TILE + w / 2 - ARENA_RING.lift, r: w * ARENA_RING.radius };
}

/** Círculo que prende esta unidade (só os dois do duelo do Exame); null = livre. */
export function ringOf(g: Game, u: Unit) {
  if (u.arenaSide !== 1 && u.arenaSide !== 2) return null;
  const b = g.findBuilt('arena');
  return b ? arenaRing(b) : null;
}

/** Ponto trazido para dentro do círculo da unidade (com margem); fora do Exame, o próprio ponto. */
export function keepInRing(g: Game, u: Unit, p: { x: number; y: number }, margin = ARENA_RING.margin) {
  const ring = ringOf(g, u);
  if (!ring) return p;
  const dx = p.x - ring.cx;
  const dy = p.y - ring.cy;
  const d = Math.hypot(dx, dy);
  const max = ring.r - margin;
  if (d <= max) return p;
  return { x: ring.cx + (dx / d) * max, y: ring.cy + (dy / d) * max };
}

/** Distância de luta que cabe na arena (quem luta de longe não foge para fora). */
export function ringDesired(g: Game, u: Unit, desired: number) {
  const ring = ringOf(g, u);
  return ring ? Math.min(desired, ring.r * 0.6) : desired;
}
