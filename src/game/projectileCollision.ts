// Contato do projétil em pixels de cena: usa a mesma projeção e transformações da arte.
import { dragonPoint } from './dragonFlight';
import { project } from '../core/iso';
import { FX, type SpriteFx } from '../data/jutsuFx';
import contacts from '../data/sprite-contacts.json';
import type { Projectile, Unit } from './types';
type Point = { x: number; y: number };
type Contact = { cols: number; rows: number; x: number; y: number; aspect: number };
const table = contacts as Record<string, Contact>;
// A arte humana tem base y+9 e altura30: o torso fica em y-6.
export const TARGET_BODY = { x: 7, y: 12, height: 6 };
/** Estado transitório do diagnóstico do laboratório; não faz parte do save. */
export const PROJECTILE_DEBUG = { enabled: false, hits: [] as { from: Point; to: Point; point: Point; target: Point; radius: number; projectile?: Projectile }[] };

export function spriteContact(s: SpriteFx) {
  const measured = table[s.sheet];
  const match = measured?.cols === s.cols && measured.rows === s.rows ? measured : undefined;
  return { x: s.hitX ?? match?.x ?? s.anchorX, y: s.hitY ?? match?.y ?? s.anchorY,
    radius: Math.max(0, s.hitRadius ?? 1.5), aspect: measured ? measured.aspect * s.cols / measured.cols * measured.rows / s.rows : 1 };
}
export function projectileContact(p: Projectile): Point & { radius: number; sprite: boolean } {
  const s = FX.jutsus[p.fx ?? p.kind]?.sprite;
  const xy = project(p.x, p.y);
  const dragon = p.dragon ? dragonPoint(p.dragon, p.dragon.elapsed / p.dragon.duration) : null;
  const z = dragon?.z ?? 8;
  let x = xy.x, y = xy.y - z;
  if (p.cannon) {
    const v=project(p.vx,p.vy),angle=Math.atan2(v.y,v.x),c=FX.jutsus.sekizo?.cannon;
    const front=(c?.width??28)*(1+p.cannon.index*.08)*.18;
    return {x:x+Math.cos(angle)*front,y:y+(c?.dy??-4)+Math.sin(angle)*front,radius:1.5,sprite:false};
  }
  if (!s) return { x, y, radius: Math.max(1,p.size*.5), sprite: false };
  const c = spriteContact(s), v = project(p.vx, p.vy);
  const angle = Math.atan2(v.y - (dragon && p.dragon ? dragon.vz / p.dragon.duration : 0), v.x), left = Math.cos(angle) < 0;
  const size = s.size * (p.dragon ? Math.min(1, p.dragon.elapsed / .2) : 1);
  let lx = (c.x - s.anchorX) * size, ly = (c.y - s.anchorY) * size * c.aspect;
  if (s.rotate || (s.contactRotate ?? !s.flip)) {
    if (s.flip && left) ly = -ly;
    x += Math.cos(angle) * lx - Math.sin(angle) * ly;
    y += Math.sin(angle) * lx + Math.cos(angle) * ly;
  } else { x += s.flip && left ? -lx : lx; y += ly; }
  x += (s.dx ?? 0) + Math.cos(angle) * (s.forward ?? 0) - Math.sin(angle) * (s.side ?? 0);
  y += s.dy + Math.sin(angle) * (s.forward ?? 0) + Math.cos(angle) * (s.side ?? 0);
  return { x, y, radius: c.radius, sprite: true };
}
/** Primeiro instante de contato do segmento com uma elipse; não atravessa alvos em passos grandes. */
export function segmentEllipseHit(a: Point, b: Point, center: Point, rx: number, ry: number): number | null {
  const x = (a.x - center.x) / rx, y = (a.y - center.y) / ry;
  const dx = (b.x - a.x) / rx, dy = (b.y - a.y) / ry, c = x*x+y*y-1;
  if (c <= 0) return 0;
  const aa = dx*dx+dy*dy;
  if (aa < 1e-12) return null;
  const bb = 2*(x*dx+y*dy), disc = bb*bb-4*aa*c;
  if (disc < 0) return null;
  const t = (-bb-Math.sqrt(disc))/(2*aa);
  return t >= 0 && t <= 1 ? t : null;
}
export function targetBody(u: Pick<Unit, 'x' | 'y'>) {
  const p = project(u.x, u.y);
  return { x: p.x, y: p.y - TARGET_BODY.height };
}
