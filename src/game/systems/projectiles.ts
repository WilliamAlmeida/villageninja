import { projectileContact, PROJECTILE_DEBUG, segmentEllipseHit, targetBody, TARGET_BODY } from '../projectileCollision';
import { areaDamage, applyDamage, markTarget } from '../combat';
import { wearOut } from '../wear';
import { canHit } from '../factions';
import { fx } from '../fx';
import type { Game } from '../game';
import type { Projectile, Unit } from '../types';
import { wallHit } from '../walls';
import { dragonPoint } from '../dragonFlight';
import { rasenganHitFx } from '../rasenganFx';
import { FX } from '../../data/jutsuFx';
import { advanceNatureProjectile } from '../natureProjectiles';

export function projectileSystem(g: Game, dt: number) {
  for (const p of g.state.projectiles) {
    if (p.dead) continue;
    const before = { x: p.x, y: p.y }, start = projectileContact(p);
    const dragonElapsed = p.dragon?.elapsed ?? 0;
    p.life -= dt;
    let canStrike = true;
    if (p.natureFlight) {
      if (!advanceNatureProjectile(g,p,dt)) continue;
    } else if (p.dragon) {
      const f = p.dragon;
      f.elapsed = Math.min(f.duration, f.elapsed + dt);
      const progress = f.elapsed / f.duration, next = dragonPoint(f, progress);
      p.x = next.x; p.y = next.y;
      p.vx = next.vx / f.duration; p.vy = next.vy / f.duration;
      canStrike = progress >= .55 && next.z <= 14; // O dragão só acerta no mergulho perto do chão.
    } else { p.x += p.vx * dt; p.y += p.vy * dt; }
    const end = projectileContact(p);
    let hit: Unit | null = null, contactTime = Infinity;
    for (const u of g.state.units) {
      if (!canStrike) break;
      if (u.dead || u.hidden || !canHit(p.faction, p.side, u)) continue;
      if (start.sprite || p.cannon) {
        const t = segmentEllipseHit(start, end, targetBody(u),
          TARGET_BODY.x + end.radius, TARGET_BODY.y + end.radius);
        if (t != null && t < contactTime) { hit = u; contactTime = t; }
      } else {
        const hr = p.size + 9;
        if (Math.abs(u.x-p.x) < hr && Math.abs(u.y-6-p.y) < hr) { hit = u; contactTime = 1; break; }
      }
    }
    const wall = wallHit(g, p);
    if (wall) {
      p.dead = true;
      fx(g, 'burst', p.x, p.y, { r:12, color:'#a87b45', life:.35, vfx:'earth' });
      fx(g, 'chips', p.x, p.y, { color:'#8a6238', life:.5 });
      continue;
    }
    if (hit) {
      if (PROJECTILE_DEBUG.enabled) {
        PROJECTILE_DEBUG.hits.push({ from:start, to:end,
          point:{ x:start.x+(end.x-start.x)*contactTime, y:start.y+(end.y-start.y)*contactTime },
          target:targetBody(hit), radius:end.radius });
        if (PROJECTILE_DEBUG.hits.length > 16) PROJECTILE_DEBUG.hits.shift();
      }
      if (p.dragon) {
        p.dragon.elapsed = dragonElapsed + (p.dragon.elapsed-dragonElapsed)*contactTime;
        const at = dragonPoint(p.dragon,p.dragon.elapsed/p.dragon.duration);
        p.x=at.x;p.y=at.y;
      } else { p.x=before.x+(p.x-before.x)*contactTime;p.y=before.y+(p.y-before.y)*contactTime; }
      if (PROJECTILE_DEBUG.enabled) PROJECTILE_DEBUG.hits.at(-1)!.projectile = { ...p, dragon: p.dragon ? { ...p.dragon } : undefined };
    }
    // Chegar é cruzar o destino, não estar a menos de OUTRO passo dele.
    const reached = p.natureFlight ? p.natureFlight.elapsed >= p.natureFlight.delay+p.natureFlight.duration : p.dragon ? p.dragon.elapsed >= p.dragon.duration :
      (p.vx !== 0 || p.vy !== 0) && (p.tx-p.x)*p.vx+(p.ty-p.y)*p.vy <= 0;
    if (hit || (p.radius > 0 && reached) || p.life <= 0) explode(g,p,hit);
  }
}

function explode(g: Game, p: Projectile, hit: Unit | null) {
  p.dead = true;
  const owner = g.unit(p.ownerId) ?? null;
  const impact = p.fx ? FX.jutsus[p.fx]?.impact : undefined;
  const impactLife = impact ? impact.frames / Math.max(1, impact.fps) : undefined;
  const x = impact?.layer === 'ground' && hit ? hit.x : p.x;
  const y = impact?.layer === 'ground' && hit ? hit.y : p.y;
  if (p.fx === 'reiza' && p.natureFlight?.launched) {
    fx(g,'beam',p.natureFlight.sx,p.natureFlight.sy,{fx:'reiza',life:.16,color:p.color,
      natureFlight:{...p.natureFlight,tx:p.x,ty:p.y,elapsed:p.natureFlight.delay+p.natureFlight.duration}});
  }
  if (p.cannon) fx(g,'pressure',p.cannon.sx,p.cannon.sy,{
    x2:p.x,y2:p.y,fx:'sekizo',color:p.color,life:.32,
  });
  if (p.radius > 0) {
    if (p.fx !== 'rasenshuriken' || !rasenganHitFx(g, p.fx, p.x, p.y)) {
      fx(g, 'burst', x, y, { r: p.radius, color: p.color, life: impactLife ?? 0.45, vfx: p.vfx, fx: p.fx });
    }
    areaDamage(g, owner, p.faction, p.x, p.y, p.radius, p.damage, p.nature, 0, p.stun, p.side);
  } else if (hit) {
    fx(g, 'burst', x, y, { r: p.kind === 'kunai' ? 8 : 14, color: p.color, life: impactLife ?? 0.25, vfx: p.vfx, fx: p.fx });
    applyDamage(g, owner, hit, p.damage, p.nature, { stun: p.stun });
    if (p.kind === 'kunai' && !p.radius) wearOut(g, owner, 'weapon', 1); // kunai que acerta gasta a arma
    if (p.mark != null && !hit.dead) markTarget(g, hit, p.mark);
  }
}
