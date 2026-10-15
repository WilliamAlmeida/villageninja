// Cinco socos sucessivos: canhões de ar dirigidos ao alvo, com intervalos decrescentes.
import { keepInRing } from './arena';
import { fx } from './fx';
import { JUTSUS } from '../data/jutsus';
import { spawnProjectile } from './combat';
import { canHit } from './factions';
import type { Game } from './game';
import type { Unit } from './types';
export const SEKIZO_TIMES = [0, .30, .54, .72, .84] as const;
export function startSekizo(g: Game, u: Unit, target: Unit, power: number) {
  u.barrage = { targetId: target.id, elapsed: 0, next: 0, power,
    angle: Math.atan2(u.y-target.y,u.x-target.x), distance: Math.max(160,Math.min(180,Math.hypot(u.x-target.x,u.y-target.y))) };
  u.moving = false;
  sekizoTick(g, u, 0);
}
export function sekizoTick(g: Game, u: Unit, dt: number) {
  const b = u.barrage;
  if (!b) return;
  const target = g.unit(b.targetId), def = JUTSUS.sekizo!;
  if (u.dead || u.hidden || u.stun > 0 || !target || target.dead || target.hidden ||
      !canHit(u.faction, u.arenaSide, target) || Math.hypot(target.x-u.x,target.y-u.y) > Math.max(def.range * 1.25,(b.distance??def.range)*1.3)) {
    u.barrage = undefined; return;
  }
  u.moving = false;
  u.attackCd = Math.max(u.attackCd, .15);
  b.elapsed += dt;
  while (b.next < SEKIZO_TIMES.length && b.elapsed >= SEKIZO_TIMES[b.next]!) {
    const i = b.next++;
    if(i>0){
      const turn=[0,Math.PI/2,-Math.PI/2,Math.PI,0][i]!;
      const angle=(b.angle??Math.atan2(u.y-target.y,u.x-target.x))+turn;
      const radius=b.distance??75;
      const at=keepInRing(g,u,{x:target.x+Math.cos(angle)*radius,y:target.y+Math.sin(angle)*radius});
      if(g.world.walkablePx(at.x,at.y)){
        fx(g,'afterimage',u.x,u.y,{uid:u.id,facing:u.facing,life:.22});
        u.x=at.x;u.y=at.y;u.path=[];u.hasGoal=false;
      }
    }
    u.facing = Math.atan2(target.y-u.y,target.x-u.x);
    u.anim = .16; u.animKind = 'strike';
    const p = spawnProjectile(g,u,u.faction,u.x,u.y-4,target.x,target.y,{
      damage:b.power,radius:0,nature:def.nature,color:def.color,size:def.projSize??5,
      speed:(def.projSpeed??280)*(1+i*.15),kind:def.projKind??'jet',stun:def.stun??0,
      range:def.range,vfx:'wind',fx:'sekizo',
    });
    p.cannon = { sx:p.x, sy:p.y, index:i };
  }
  if (b.next >= SEKIZO_TIMES.length) u.barrage = undefined;
}
