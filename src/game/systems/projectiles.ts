import { areaDamage, applyDamage, markTarget } from '../combat';
import { canHit } from '../factions';
import { fx } from '../fx';
import type { Game } from '../game';
import type { Projectile, Unit } from '../types';

export function projectileSystem(g: Game, dt: number) {
  for (const p of g.state.projectiles) {
    if (p.dead) continue;
    p.life -= dt;
    const step = Math.hypot(p.vx, p.vy) * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    let hit: Unit | null = null;
    const hr = p.size + 9;
    for (const u of g.state.units) {
      if (u.dead || u.hidden || !canHit(p.faction, p.side, u)) continue;
      if (Math.abs(u.x - p.x) < hr && Math.abs(u.y - 6 - p.y) < hr) {
        hit = u;
        break;
      }
    }
    const reached = Math.hypot(p.tx - p.x, p.ty - p.y) <= step;
    if (hit || (p.radius > 0 && reached) || p.life <= 0) {
      explode(g, p, hit);
    }
  }
}

function explode(g: Game, p: Projectile, hit: Unit | null) {
  p.dead = true;
  const owner = g.unit(p.ownerId) ?? null;
  if (p.radius > 0) {
    fx(g, 'burst', p.x, p.y, { r: p.radius, color: p.color, life: 0.45 });
    areaDamage(g, owner, p.faction, p.x, p.y, p.radius, p.damage, p.nature, 0, p.stun, p.side);
  } else if (hit) {
    fx(g, 'burst', p.x, p.y, { r: p.kind === 'kunai' ? 6 : 14, color: p.color, life: 0.25 });
    applyDamage(g, owner, hit, p.damage, p.nature, { stun: p.stun });
    if (p.mark != null && !hit.dead) markTarget(g, hit, p.mark);
  }
}
