import { TILE } from '../../config';
import { chance, pick, rand, randi } from '../../core/rng';
import { BUILDINGS } from '../../data/buildings';
import { JUTSUS } from '../../data/jutsus';
import { derive } from '../../data/ninja';
import { engage, trySupport } from '../combat';
import { canHit } from '../factions';
import { fx, fxText } from '../fx';
import type { Game } from '../game';
import { chase, followPath, setDestination } from '../movement';
import { trainTick } from '../progression';
import { academyLearnMult } from '../upgrade';
import { refillItem } from '../gear';
import { formationOffset, restPoint, senseiNear, teamLeader, teamOf, teamUnits } from '../teams';
import { isNight } from '../time';
import type { Unit } from '../types';
import { doorPos, tileCenter, toTile } from '../world';

const DEFEND_RADIUS = 240;

/** Ninjas da vila: defendem, estudam, treinam, patrulham e descansam. */
export function ninjaSystem(g: Game, dt: number) {
  const night = isNight(g.state);
  for (const u of g.state.units) {
    if (u.dead || u.kind !== 'ninja' || u.faction !== 'village' || u.arenaSide != null) continue; // no exame: controlado pela arena
    u.timer -= dt;
    if (u.stun > 0) {
      u.moving = false;
      continue;
    }
    if (!u.hidden) trySupport(g, u);
    // consumível gasto: pega outro do estoque ao passar pela vila
    if (u.ninja!.equip.item && !u.ninja!.equip.itemReady && g.world.inVillage(u.x, u.y)) refillItem(g, u);
    if (u.command && runCommand(g, u, dt)) continue;

    const threat = findThreat(g, u);
    const lowHp = u.hp < u.maxHp * 0.2;
    if (threat && !lowHp) {
      u.hidden = false;
      u.state = 'fight';
      engage(g, u, threat, dt);
      continue;
    }
    if (u.state === 'fight') {
      u.state = 'idle';
      u.targetId = null;
      u.hasGoal = false;
      if (lowHp) goRest(g, u);
    }
    if (u.state === 'ceremony') continue; // cerimônia do Kage
    run(g, u, dt, night);
  }
}

/** Executa a ordem do jogador. Retorna true se a ordem controlou a unidade neste tick. */
function runCommand(g: Game, u: Unit, dt: number): boolean {
  const c = u.command!;
  switch (c.kind) {
    case 'retreat': {
      // abrigado dentro do hospital / residência até se curar
      if (u.state === 'cmdRest') {
        if (u.hp >= u.maxHp * 0.95) {
          u.command = null;
          u.hidden = false;
          u.state = 'idle';
        }
        return true;
      }
      u.hidden = false;
      if (u.state !== 'cmdRetreat') {
        const p = restPoint(g);
        if (!p || !setDestination(g, u, p.x, p.y)) {
          u.command = null;
          return false;
        }
        u.state = 'cmdRetreat';
      }
      if (followPath(g, u, dt, 1.2)) {
        u.state = 'cmdRest';
        u.hidden = true;
        u.moving = false;
        u.targetId = null;
      }
      return true;
    }
    case 'attack': {
      const t = g.unit(c.targetId);
      if (!t || t.dead || t.hidden) {
        u.command = null;
        u.state = 'idle';
        return false;
      }
      u.state = 'fight';
      engage(g, u, t, dt);
      return true;
    }
    case 'move': {
      c.time -= dt;
      if (c.time <= 0) {
        u.command = null;
        u.state = 'idle';
        return false;
      }
      // defende o ponto: luta com quem chegar perto dele (ou de si)
      const threat = g.nearestHostileAt(u.faction, c.x, c.y, 170) ?? g.nearestHostile(u, 110);
      if (threat && u.hp >= u.maxHp * 0.2) {
        u.hidden = false;
        u.state = 'fight';
        engage(g, u, threat, dt);
        return true;
      }
      if (u.state === 'fight') {
        u.state = 'idle';
        u.targetId = null;
      }
      if (Math.hypot(c.x - u.x, c.y - u.y) > 8) {
        if (u.state !== 'cmdMove' || !u.hasGoal) {
          if (!setDestination(g, u, c.x, c.y)) {
            u.command = null;
            return false;
          }
          u.state = 'cmdMove';
        }
        followPath(g, u, dt, 1.1);
      } else {
        u.moving = false;
        u.state = 'guard';
      }
      return true;
    }
  }
}

function findThreat(g: Game, u: Unit): Unit | null {
  const current = g.unit(u.targetId);
  if (current && !current.dead && !current.hidden && Math.hypot(current.x - u.x, current.y - u.y) < DEFEND_RADIUS * 1.5) return current;
  // equipe foca o mesmo alvo
  const team = teamOf(g, u);
  if (team) {
    for (const m of teamUnits(g, team)) {
      if (m.id === u.id || m.state !== 'fight') continue;
      const t = g.unit(m.targetId);
      if (t && !t.dead && !t.hidden && canHit(u.faction, undefined, t) && Math.hypot(t.x - u.x, t.y - u.y) < DEFEND_RADIUS * 1.5) return t;
    }
  }
  let best: Unit | null = null;
  let bd = Infinity;
  for (const o of g.state.units) {
    if (o.dead || o.hidden || !canHit(u.faction, undefined, o)) continue;
    const d = Math.hypot(o.x - u.x, o.y - u.y);
    if ((d < DEFEND_RADIUS || g.world.inVillage(o.x, o.y)) && d < bd) {
      bd = d;
      best = o;
    }
  }
  return best;
}

function run(g: Game, u: Unit, dt: number, night: boolean) {
  const n = u.ninja!;
  switch (u.state) {
    case 'idle':
      u.moving = false;
      if (u.timer <= 0) decide(g, u, night);
      break;
    case 'toLearn':
      if (!n.learning) u.state = 'idle';
      else if (followPath(g, u, dt)) {
        u.hidden = true;
        u.state = 'learn';
      }
      break;
    case 'learn': {
      const L = n.learning;
      if (!L || !g.findBuilt('academy')) {
        u.hidden = false;
        u.state = 'idle';
        break;
      }
      L.progress += dt * derive(n.stats).learnMult * (g.findBuilt('library') ? 1.5 : 1) * academyLearnMult(g);
      if (L.progress >= L.total) {
        n.jutsu[L.slot] = L.jutsuId;
        n.cd[L.slot] = 0;
        n.learning = null;
        u.hidden = false;
        u.state = 'idle';
        const def = JUTSUS[L.jutsuId]!;
        fxText(g, u.x, u.y - 30, def.shout, def.color, true);
        g.toast(`{scroll} ${u.name} aprendeu ${def.name}!`, 'good', u);
      }
      break;
    }
    case 'toRest':
      if (followPath(g, u, dt)) u.state = 'rest';
      break;
    case 'rest':
      u.moving = false;
      if (u.hp >= u.maxHp * 0.95) u.state = 'idle';
      break;
    case 'toTrain':
      if (followPath(g, u, dt)) {
        u.state = 'train';
        u.timer = 7;
      }
      break;
    case 'train':
      u.moving = false;
      u.anim = 0.2;
      if (Math.random() < dt * 1.5) {
        u.facing = rand(0, Math.PI * 2);
        fx(g, 'slash', u.x + Math.cos(u.facing) * 12, u.y + Math.sin(u.facing) * 12, { r: 10, color: '#ffffff', life: 0.25 });
      }
      if (u.timer <= 0) {
        trainTick(g, u, senseiNear(g, u));
        u.state = 'idle';
      }
      break;
    case 'follow': {
      const t = teamOf(g, u);
      const leader = t ? teamLeader(g, t) : undefined;
      if (!t || !leader || leader === u || leader.hidden || u.timer <= 0) {
        u.state = 'idle';
        break;
      }
      const o = formationOffset(Math.max(0, t.memberIds.filter((id) => id !== leader.id).indexOf(u.id)));
      chase(g, u, leader.x + o.x, leader.y + o.y, dt, 6);
      break;
    }
    case 'patrol':
      if (followPath(g, u, dt, 0.8)) {
        u.state = 'idle';
        u.timer = rand(1, 3);
      }
      break;
    case 'goHome':
      if (!night) u.state = 'idle';
      else if (followPath(g, u, dt)) {
        u.hidden = true;
        u.state = 'sleep';
      }
      break;
    case 'sleep':
      if (!night || u.ninja!.order === 'patrol') {
        u.hidden = false;
        u.state = 'idle';
      }
      break;
    default:
      u.state = 'idle';
  }
}

function decide(g: Game, u: Unit, night: boolean) {
  const n = u.ninja!;
  if (n.learning) {
    const academy = g.findBuilt('academy');
    if (!academy) {
      n.learning = null;
    } else {
      const p = doorPos(academy);
      if (setDestination(g, u, p.x, p.y)) u.state = 'toLearn';
      return;
    }
  }
  if (u.hp < u.maxHp * 0.45) {
    goRest(g, u);
    return;
  }
  if (night && n.order !== 'patrol') {
    const home = g.building(u.homeId) ?? g.hokage();
    if (home) {
      const p = doorPos(home);
      if (setDestination(g, u, p.x, p.y)) {
        u.state = 'goHome';
        return;
      }
    }
  }
  if (n.order === 'auto' && followLeader(g, u)) return;
  const tg = g.builtOf('training');
  const wantsTrain = n.order === 'train' || (n.order === 'auto' && chance(0.65));
  if (tg.length && wantsTrain && !night) {
    const b = pick(tg);
    const def = BUILDINGS[b.type];
    const x = (b.tx + rand(0.3, def.w - 0.3)) * TILE;
    const y = (b.ty + rand(0.3, def.h - 0.3)) * TILE;
    if (setDestination(g, u, x, y)) {
      u.state = 'toTrain';
      return;
    }
  }
  patrol(g, u);
}

/** Membros de equipe acompanham o líder: treinam junto ou seguem em formação. */
function followLeader(g: Game, u: Unit): boolean {
  const t = teamOf(g, u);
  if (!t) return false;
  const leader = teamLeader(g, t);
  if (!leader || leader === u || leader.hidden || leader.command?.kind === 'retreat') return false;
  const i = Math.max(0, t.memberIds.filter((id) => id !== leader.id).indexOf(u.id));
  const o = formationOffset(i);
  if (leader.state === 'train' || leader.state === 'toTrain') {
    const x = (leader.hasGoal ? leader.goalX : leader.x) + o.x;
    const y = (leader.hasGoal ? leader.goalY : leader.y) + o.y;
    if (setDestination(g, u, x, y)) {
      u.state = 'toTrain';
      return true;
    }
  }
  u.state = 'follow';
  u.timer = rand(4, 7);
  return true;
}

function goRest(g: Game, u: Unit) {
  const b = g.findBuilt('hospital') ?? g.hokage();
  if (!b) return;
  const p = doorPos(b);
  if (setDestination(g, u, p.x + rand(-12, 12), p.y + rand(4, 14))) u.state = 'toRest';
}

function patrol(g: Game, u: Unit) {
  const bs = g.state.buildings;
  if (!bs.length) return;
  const b = pick(bs);
  const p = doorPos(b);
  const tx = toTile(p.x) + randi(-6, 6);
  const ty = toTile(p.y) + randi(-6, 6);
  if (setDestination(g, u, tileCenter(tx), tileCenter(ty))) u.state = 'patrol';
  else u.timer = 1;
}
