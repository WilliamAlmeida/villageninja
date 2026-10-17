import { DAY_LENGTH } from '../../config';
import { rand, weightedPick } from '../../core/rng';
import { BIJUU_FREE_WEIGHT, BOSS_WARNING, BOSS_WEIGHTS, BOSSES } from '../../data/bosses';
import { bijuuFree } from '../bijuu';
import { spawnBoss } from '../bosses';
import type { Game } from '../game';
import { edgePoint } from './spawner';

/** Agenda ameaças chefes (a partir do nível Vila e do dia 5) com aviso prévio. */
export function bossSystem(g: Game, dt: number) {
  const s = g.state;
  if (s.pendingBoss) {
    s.pendingBoss.t -= dt;
    if (s.pendingBoss.t <= 0) {
      spawnBoss(g, s.pendingBoss.kind, s.pendingBoss.x, s.pendingBoss.y);
      s.pendingBoss = null;
    }
    return;
  }
  if (s.level < 1 || s.day < 5 || s.exam) return;
  s.bossTimer -= dt;
  if (s.bossTimer > 0) return;
  s.bossTimer = DAY_LENGTH * rand(4, 6);
  // ainda há fera solta: a Fera Colossal aparece um pouco mais (no nível 3, uma a cada ~30 dias)
  const free = bijuuFree(g).length > 0;
  const kind = weightedPick(BOSS_WEIGHTS[Math.min(3, s.level)]!, ([k, w]) => (k === 'titan' && free ? w + BIJUU_FREE_WEIGHT : w))![0];
  const p = edgePoint(g);
  s.pendingBoss = { kind, x: p.x, y: p.y, t: BOSS_WARNING };
  g.toast(`{bell} Batedores avistaram: ${BOSSES[kind].icon} ${BOSSES[kind].name}! Chega em ${BOSS_WARNING}s — prepare os ninjas.`, 'danger', p);
}
