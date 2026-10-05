import { MAP_W, TILE } from '../config';
import { weatherSpeed } from './mood';
import { sageSpeed } from './sannin';
import type { Game } from './game';
import { findPath } from './pathfinding';
import type { Unit } from './types';
import { idx, tileCenter, toTile } from './world';

/** Calcula rota até (x,y). Retorna false se não houver caminho. */
export function setDestination(g: Game, u: Unit, x: number, y: number): boolean {
  const sx = toTile(u.x);
  const sy = toTile(u.y);
  const p = findPath(g.world, sx, sy, toTile(x), toTile(y));
  if (!p) {
    u.hasGoal = false;
    u.path.length = 0;
    return false;
  }
  u.path = p;
  const last = p.length ? p[p.length - 1]! : idx(sx, sy);
  if (last !== idx(toTile(x), toTile(y))) {
    // destino bloqueado: vai até o tile livre mais próximo
    x = tileCenter(last % MAP_W);
    y = tileCenter(Math.floor(last / MAP_W));
  }
  u.goalX = x;
  u.goalY = y;
  u.hasGoal = true;
  return true;
}

/** Anda pela rota. Retorna true quando chegou (ou não tem destino). */
export function followPath(g: Game, u: Unit, dt: number, mult = 1): boolean {
  if (!u.hasGoal) {
    u.moving = false;
    return true;
  }
  let tx: number;
  let ty: number;
  if (u.path.length > 1) {
    const i = u.path[0]!;
    tx = tileCenter(i % MAP_W);
    ty = tileCenter(Math.floor(i / MAP_W));
  } else {
    tx = u.goalX;
    ty = u.goalY;
  }
  const dx = tx - u.x;
  const dy = ty - u.y;
  const d = Math.hypot(dx, dy);
  const step = u.speed * mult * weatherSpeed(g.state, u.x, u.y) * sageSpeed(u) * dt;
  if (d <= step) {
    u.x = tx;
    u.y = ty;
    if (u.path.length > 1) u.path.shift();
    else {
      u.path.length = 0;
      u.hasGoal = false;
      u.moving = false;
      return true;
    }
  } else {
    u.x += (dx / d) * step;
    u.y += (dy / d) * step;
    u.facing = Math.atan2(dy, dx);
  }
  u.moving = true;
  return false;
}

function clearLine(g: Game, ax: number, ay: number, bx: number, by: number) {
  const d = Math.hypot(bx - ax, by - ay);
  const n = Math.min(40, Math.ceil(d / (TILE * 0.4)));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    if (!g.world.walkablePx(ax + (bx - ax) * t, ay + (by - ay) * t)) return false;
  }
  return true;
}

/** Persegue um ponto móvel: linha reta quando livre, A* quando há obstáculos. */
export function chase(g: Game, u: Unit, x: number, y: number, dt: number, stop: number): boolean {
  const dx = x - u.x;
  const dy = y - u.y;
  const d = Math.hypot(dx, dy);
  if (d <= stop) {
    u.moving = false;
    return true;
  }
  if (clearLine(g, u.x, u.y, x, y)) {
    const step = Math.min(u.speed * weatherSpeed(g.state, u.x, u.y) * sageSpeed(u) * dt, d - stop);
    u.x += (dx / d) * step;
    u.y += (dy / d) * step;
    u.facing = Math.atan2(dy, dx);
    u.moving = true;
    u.hasGoal = false;
    return false;
  }
  u.repath -= dt;
  if (u.repath <= 0 || !u.hasGoal) {
    setDestination(g, u, x, y);
    u.repath = 0.8;
  }
  followPath(g, u, dt);
  return false;
}

/** Empurra a unidade respeitando colisão. */
export function push(g: Game, u: Unit, dx: number, dy: number) {
  const steps = Math.ceil(Math.hypot(dx, dy) / 6);
  for (let i = 0; i < steps; i++) {
    const nx = u.x + dx / steps;
    const ny = u.y + dy / steps;
    if (!g.world.walkablePx(nx, ny)) break;
    u.x = nx;
    u.y = ny;
  }
  u.hasGoal = false;
}
