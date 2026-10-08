import { TILE } from '../config';
import { weatherSpeed } from './mood';
import { sageSpeed } from './sannin';
import { bladeMove } from './blades';
import type { Game } from './game';
import { findPathPx } from './pathfinding';
import type { Unit } from './types';
import { cellCenter, fidx, toCell } from './world';

/** Última busca que falhou por unidade (só memória): não repete a mesma busca sem saída a cada passo. */
const failed = new WeakMap<Unit, { cell: number; until: number }>();

/** Calcula rota até (x,y). Retorna false se não houver caminho. */
export function setDestination(g: Game, u: Unit, x: number, y: number): boolean {
  const goal = fidx(toCell(x), toCell(y));
  const f = failed.get(u);
  if (f && f.cell === goal && g.state.time < f.until) {
    u.hasGoal = false;
    u.path.length = 0;
    return false;
  }
  const p = findPathPx(g.world, u.x, u.y, x, y);
  if (!p) {
    failed.set(u, { cell: goal, until: g.state.time + 1.5 });
    u.hasGoal = false;
    u.path.length = 0;
    return false;
  }
  u.path = p;
  const last = p.length ? p[p.length - 1]! : fidx(toCell(u.x), toCell(u.y));
  if (last !== fidx(toCell(x), toCell(y))) {
    // destino bloqueado: vai até a célula livre mais próxima
    ({ x, y } = cellCenter(last));
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
    ({ x: tx, y: ty } = cellCenter(u.path[0]!));
  } else {
    tx = u.goalX;
    ty = u.goalY;
  }
  const dx = tx - u.x;
  const dy = ty - u.y;
  const d = Math.hypot(dx, dy);
  const step = u.speed * mult * weatherSpeed(g.state, u.x, u.y) * sageSpeed(u) * bladeMove(u) * dt;
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
    if (!g.world.clearPx(ax + (bx - ax) * t, ay + (by - ay) * t)) return false; // rocha no meio: contorna pelo A*
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
    const step = Math.min(u.speed * weatherSpeed(g.state, u.x, u.y) * sageSpeed(u) * bladeMove(u) * dt, d - stop);
    u.x += (dx / d) * step;
    u.y += (dy / d) * step;
    u.facing = Math.atan2(dy, dx);
    u.moving = true;
    u.hasGoal = false;
    return false;
  }
  u.repath -= dt;
  // o alvo quase não saiu do lugar desde a última rota: segue a mesma (seguir o líder parado, treinar junto)
  const moved = !u.hasGoal || Math.hypot(u.goalX - x, u.goalY - y) > 20;
  if (u.repath <= 0 || !u.hasGoal) {
    if (moved) setDestination(g, u, x, y);
    // longe da câmera: refaz a rota com menos frequência (ninguém está olhando de perto)
    const v = g.view;
    u.repath = v && Math.hypot(u.x - v.x, u.y - v.y) > v.r + 160 ? 2 : 0.8;
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
  u.knockT = 0.5; // foi empurrado agora (no Exame, sair da arena assim é derrota)
}
