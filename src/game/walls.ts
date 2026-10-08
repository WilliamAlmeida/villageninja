// Doryuuheki: muralha de terra que brota do chão entre o ninja e o inimigo e FICA ali (não anda com ele). Para os
// projéteis inimigos que batem nela e protege (dano reduzido, `Unit.shield`) só quem continua perto dela.
import { canHit } from './factions';
import { fx } from './fx';
import type { Game } from './game';
import type { Effect, Projectile, Unit } from './types';

export const WALL = {
  /** Meia largura da muralha (px de mundo) e a distância à frente do ninja onde ela brota. */
  half: 16,
  ahead: 14,
  /** Até onde o dono continua protegido por ela. */
  near: 30,
};

/** Levanta a muralha de `u` virada para o inimigo mais perto (ou para onde ele olha). Troca a anterior dele. */
export function raiseWall(g: Game, u: Unit, life: number, color: string) {
  const foe = g.nearestHostile(u, 260);
  const a = foe ? Math.atan2(foe.y - u.y, foe.x - u.x) : u.facing;
  for (const e of g.state.effects) if (e.kind === 'wall' && e.uid === u.id) e.life = Math.min(e.life, e.t + 0.3); // a velha desmorona
  let x = u.x + Math.cos(a) * WALL.ahead;
  let y = u.y + Math.sin(a) * WALL.ahead;
  if (!g.world.walkablePx(x, y)) [x, y] = [u.x, u.y];
  fx(g, 'wall', x, y, { life, color, facing: a, uid: u.id });
  fx(g, 'burst', x, y, { r: 18, color, life: 0.45, vfx: 'earth' });
}

/** A muralha de pé de `u`, se houver. */
export const wallOf = (g: Game, u: Unit): Effect | undefined => g.state.effects.find((e) => e.kind === 'wall' && e.uid === u.id && e.t < e.life);

/** Escudo de terra só vale perto da muralha: quem saiu de trás dela leva o dano normal. */
export function wallCovers(g: Game, u: Unit) {
  const w = wallOf(g, u);
  return !!w && Math.hypot(u.x - w.x, u.y - w.y) < WALL.near;
}

/** Pontas da muralha (px de mundo): perpendicular à direção em que foi levantada. */
export function wallEnds(e: Effect) {
  const a = (e.facing ?? 0) + Math.PI / 2;
  const dx = Math.cos(a) * WALL.half;
  const dy = Math.sin(a) * WALL.half;
  return [{ x: e.x - dx, y: e.y - dy }, { x: e.x + dx, y: e.y + dy }] as const;
}

/** Muralha que o projétil acabou de acertar (ele é de quem pode ferir o dono dela), ou null. */
export function wallHit(g: Game, p: Projectile): Effect | null {
  for (const e of g.state.effects) {
    if (e.kind !== 'wall' || e.t >= e.life) continue;
    const owner = g.unit(e.uid);
    if (!owner || !canHit(p.faction, p.side, owner)) continue;
    const [a, b] = wallEnds(e);
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const k = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / (vx * vx + vy * vy)));
    if (Math.hypot(p.x - (a.x + vx * k), p.y - (a.y + vy * k)) < p.size + 4) return e;
  }
  return null;
}
