import { MAP_H, MAP_W, TILE } from '../../config';
import { rand, randi } from '../../core/rng';
import { ANIMALS } from '../../data/animals';
import { engage, trySupport } from '../combat';
import { fx, fxText } from '../fx';
import type { Game } from '../game';
import { chase, followPath, setDestination } from '../movement';
import type { Unit } from '../types';
import { CENTER_TX, CENTER_TY, doorPos, tileCenter, toTile } from '../world';

/** Animais selvagens, ninjas renegados e clones das sombras. */
export function hostileSystem(g: Game, dt: number) {
  for (const u of g.state.units) {
    if (u.dead) continue;
    if (u.kind === 'animal') animal(g, u, dt);
    else if (u.kind === 'rogue') rogue(g, u, dt);
    else if (u.kind === 'clone') clone(g, u, dt);
  }
}

function validTarget(g: Game, u: Unit, maxDist: number) {
  const t = g.unit(u.targetId);
  if (!t || t.dead || t.hidden || Math.hypot(t.x - u.x, t.y - u.y) > maxDist) {
    u.targetId = null;
    return null;
  }
  return t;
}

function animal(g: Game, u: Unit, dt: number) {
  const def = ANIMALS[u.animal!];
  u.timer -= dt;
  u.life = (u.life ?? 0) - dt;
  if (u.stun > 0) {
    u.moving = false;
    return;
  }
  if (u.missionId != null) return guardHome(g, u, dt, def.aggro);
  const t = validTarget(g, u, def.aggro * 2.5) ?? g.nearestHostile(u, def.aggro);
  if (t) {
    engage(g, u, t, dt);
    return;
  }
  // depois de um tempo o animal volta para a floresta e some
  if (u.life <= 0) {
    if (u.state !== 'leave') {
      u.state = 'leave';
      const e = nearestEdge(u.x, u.y);
      setDestination(g, u, e.x, e.y);
    }
    if (followPath(g, u, dt, 0.8)) u.dead = true;
    return;
  }
  // vagueia, aos poucos se aproximando da vila
  if (!u.hasGoal || u.timer <= 0) {
    u.timer = rand(4, 8);
    const tx = toTile(u.x);
    const ty = toTile(u.y);
    const towardVillage = Math.random() < 0.3;
    const gx = towardVillage ? Math.round(tx + (CENTER_TX - tx) * 0.3) : tx + randi(-4, 4);
    const gy = towardVillage ? Math.round(ty + (CENTER_TY - ty) * 0.3) : ty + randi(-4, 4);
    setDestination(g, u, tileCenter(gx), tileCenter(gy));
  }
  followPath(g, u, dt, 0.5);
}

function rogue(g: Game, u: Unit, dt: number) {
  u.timer -= dt;
  if (u.stun > 0) {
    u.moving = false;
    return;
  }
  trySupport(g, u);
  if (u.missionId != null) return guardHome(g, u, dt, 220);
  if (u.state !== 'escape') {
    const t = validTarget(g, u, 320) ?? g.nearestHostile(u, 220);
    if (t) {
      engage(g, u, t, dt);
      return;
    }
  }
  const hk = g.hokage();
  if (u.state === 'escape') {
    if (followPath(g, u, dt, 1.1)) {
      u.dead = true; // fugiu do mapa
    }
    return;
  }
  if (!hk) return;
  const p = doorPos(hk);
  if (!u.hasGoal || u.timer <= 0) {
    u.timer = 3;
    // sem rota até a vila (ilhado): desiste da invasão
    if (!setDestination(g, u, p.x, p.y + 6)) {
      u.dead = true;
      return;
    }
  }
  if (followPath(g, u, dt) && Math.hypot(p.x - u.x, p.y - u.y) < 40) {
    const stolen = Math.min(g.state.res.ryo, 40 + g.state.day * 5);
    g.state.res.ryo -= stolen;
    fxText(g, u.x, u.y - 30, `-${stolen}💰`, '#ff5a5a', true);
    g.toast(`💰 ${u.name} roubou ${stolen} ryo da Residência do Hokage!`, 'danger', u);
    g.state.flags.raidStole = true;
    u.state = 'escape';
    const e = nearestEdge(u.x, u.y);
    setDestination(g, u, e.x, e.y);
  }
}

/**
 * Alvos de missão: defendem o próprio local (acampamento, covil, ninho).
 * Lutam com quem chega perto, mas não perseguem longe nem marcham até a vila.
 */
function guardHome(g: Game, u: Unit, dt: number, aggro: number) {
  const hx = u.homeX ?? u.x;
  const hy = u.homeY ?? u.y;
  const leash = aggro + 200;
  let t = validTarget(g, u, leash);
  if (t && Math.hypot(t.x - hx, t.y - hy) > leash) t = null;
  t ??= g.nearestHostile(u, aggro);
  if (t) {
    u.targetId = t.id;
    engage(g, u, t, dt);
    return;
  }
  u.targetId = null;
  if (Math.hypot(u.x - hx, u.y - hy) > 24) {
    if (!u.hasGoal || u.timer <= 0) {
      setDestination(g, u, hx, hy);
      u.timer = 2;
    }
    followPath(g, u, dt, 0.7);
  } else u.moving = false;
}

function nearestEdge(x: number, y: number) {
  const W = MAP_W * TILE;
  const H = MAP_H * TILE;
  const opts = [
    { d: x, x: TILE / 2, y },
    { d: W - x, x: W - TILE / 2, y },
    { d: y, x, y: TILE / 2 },
    { d: H - y, x, y: H - TILE / 2 },
  ];
  opts.sort((a, b) => a.d - b.d);
  return opts[0]!;
}

function clone(g: Game, u: Unit, dt: number) {
  u.life = (u.life ?? 0) - dt;
  if (u.life <= 0) {
    u.dead = true;
    fx(g, 'smoke', u.x, u.y, { r: 16, life: 0.6, color: '#e8e8e8' });
    return;
  }
  if (u.stun > 0) return;
  const t = validTarget(g, u, 300) ?? g.nearestHostile(u, 220);
  if (t) {
    engage(g, u, t, dt);
    return;
  }
  const owner = g.unit(u.ownerId);
  if (owner && !owner.dead && !owner.hidden) chase(g, u, owner.x + 14, owner.y + 6, dt, 18);
  else u.moving = false;
}
