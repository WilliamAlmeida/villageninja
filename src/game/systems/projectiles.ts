import { areaDamage, applyDamage, markTarget } from '../combat';
import { wearOut } from '../wear';
import { canHit } from '../factions';
import { fx } from '../fx';
import type { Game } from '../game';
import type { Projectile, Unit } from '../types';
import { wallHit } from '../walls';
import { dragonPoint } from '../dragonFlight';

export function projectileSystem(g: Game, dt: number) {
  for (const p of g.state.projectiles) {
    if (p.dead) continue;
    p.life -= dt;
    let step = Math.hypot(p.vx, p.vy) * dt;
    let canStrike = true;
    if (p.dragon) {
      const f = p.dragon;
      f.elapsed = Math.min(f.duration, f.elapsed + dt);
      const progress = f.elapsed / f.duration;
      const next = dragonPoint(f, progress);
      step = Math.hypot(next.x - p.x, next.y - p.y);
      p.x = next.x; p.y = next.y;
      p.vx = next.vx / f.duration; p.vy = next.vy / f.duration;
      // A cabeça só acerta unidades ao descer: não explode em quem está perto da fonte enquanto sobe.
      canStrike = progress >= 0.55 && next.z <= 14;
    } else {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    let hit: Unit | null = null;
    const hr = p.size + 9;
    for (const u of g.state.units) {
      if (!canStrike) break;
      if (u.dead || u.hidden || !canHit(p.faction, p.side, u)) continue;
      if (Math.abs(u.x - p.x) < hr && Math.abs(u.y - 6 - p.y) < hr) {
        hit = u;
        break;
      }
    }
    // bateu numa muralha de terra (Doryuuheki) do alvo: para ali, sem ferir ninguém
    const wall = wallHit(g, p);
    if (wall) {
      p.dead = true;
      fx(g, 'burst', p.x, p.y, { r: 12, color: '#a87b45', life: 0.35, vfx: 'earth' });
      fx(g, 'chips', p.x, p.y, { color: '#8a6238', life: 0.5 });
      continue;
    }
    const reached = p.dragon ? p.dragon.elapsed >= p.dragon.duration : Math.hypot(p.tx - p.x, p.ty - p.y) <= step;
    if (hit || (p.radius > 0 && reached) || p.life <= 0) {
      explode(g, p, hit);
    }
  }
}

function explode(g: Game, p: Projectile, hit: Unit | null) {
  p.dead = true;
  const owner = g.unit(p.ownerId) ?? null;
  if (p.radius > 0) {
    fx(g, 'burst', p.x, p.y, { r: p.radius, color: p.color, life: 0.45, vfx: p.vfx, fx: p.fx });
    areaDamage(g, owner, p.faction, p.x, p.y, p.radius, p.damage, p.nature, 0, p.stun, p.side);
  } else if (hit) {
    fx(g, 'burst', p.x, p.y, { r: p.kind === 'kunai' ? 8 : 14, color: p.color, life: 0.25, vfx: p.vfx, fx: p.fx });
    applyDamage(g, owner, hit, p.damage, p.nature, { stun: p.stun });
    if (p.kind === 'kunai' && !p.radius) wearOut(g, owner, 'weapon', 1); // kunai que acerta gasta a arma
    if (p.mark != null && !hit.dead) markTarget(g, hit, p.mark);
  }
}
