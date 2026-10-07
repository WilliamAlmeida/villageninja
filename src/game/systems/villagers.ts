import { TILE } from '../../config';
import { pick, rand, randi } from '../../core/rng';
import { BUILDINGS } from '../../data/buildings';
import { fx, fxText } from '../fx';
import { farmYield, marketYield, needsBuilders, workUpgrade } from '../upgrade';
import { harvestMult, workMult } from '../mood';
import { levelOf } from '../upgrade';
import { REGROW } from '../../data/regrow';
import { marketSale } from '../specialize';
import { advanceCraft } from '../gear';
import { RES_INFO } from '../../data/resources';
import type { Game } from '../game';
import { followPath, setDestination } from '../movement';
import { isNight } from '../time';
import type { Building, ResKey, Unit } from '../types';
import { doorPos, tileCenter, toTile } from '../world';

const FLEE_RADIUS = 170;

/** O que cada tipo de recurso no mapa rende por viagem. */
const NODE_YIELD = {
  tree: { res: 'wood' as ResKey, amount: 5, chips: '#c8a26a' },
  rock: { res: 'stone' as ResKey, amount: 4, chips: '#bfbfbf' },
  ore: { res: 'iron' as ResKey, amount: 3, chips: '#c0622b' },
};
/** Produção dos campos (fazenda / horta). */
const FIELD_OUTPUT = {
  farmer: { res: 'food' as ResKey, amount: 2 },
  gardener: { res: 'herbs' as ResKey, amount: 1 },
};
/** Oficina de Selos ociosa: transforma madeira em papel. */
const PAPER = { wood: 4, time: 8, minWood: 30 };
/** Raio (tiles) em que lenhador, pedreira e mina procuram recursos; cresce com o nível do prédio. */
export const searchTiles = (b: Building) => 14 + (levelOf(b) - 1) * 4;

/** Pessoas comuns: trabalham, constroem, passeiam, dormem e fogem do perigo. */
export function villagerSystem(g: Game, dt: number) {
  const night = isNight(g.state);
  const workRate = workMult(g.state);
  for (const u of g.state.units) {
    if (u.dead || u.kind !== 'villager' || u.missionId != null) continue; // mercador de escolta: controlado pela missão
    u.timer -= dt * workRate; // felicidade acelera (ou atrasa) o trabalho
    if (u.stun > 0) {
      u.moving = false;
      continue;
    }
    if (u.state !== 'flee' && u.state !== 'shelter' && !u.hidden && dangerNear(g, u, FLEE_RADIUS)) {
      flee(g, u);
      continue;
    }
    if (u.state === 'ceremony') continue; // cerimônia do Kage: controlado pelo kageSystem
    switch (u.state) {
      case 'flee':
        if (followPath(g, u, dt, 1.3)) hide(u, 'shelter', 3);
        break;
      case 'shelter':
        if (u.timer <= 0) {
          if (!dangerNear(g, u, 200)) unhide(u);
          else u.timer = 2;
        }
        break;
      case 'sleep':
        if (!night) unhide(u);
        break;
      case 'goHome':
        if (!night) u.state = 'idle';
        else if (followPath(g, u, dt)) hide(u, 'sleep', 0);
        break;
      default:
        if (night) goHome(g, u);
        else work(g, u, dt);
    }
  }
}

function hide(u: Unit, state: string, timer: number) {
  u.hidden = true;
  u.moving = false;
  u.state = state;
  u.timer = timer;
}
function unhide(u: Unit) {
  u.hidden = false;
  u.state = 'idle';
  u.timer = rand(0, 1.5);
}

function shelterFor(g: Game, u: Unit): Building | undefined {
  let best: Building | undefined;
  let bd = Infinity;
  for (const b of g.state.buildings) {
    if (!b.built || !(BUILDINGS[b.type].housing ?? 0)) continue;
    const p = doorPos(b);
    const d = Math.hypot(p.x - u.x, p.y - u.y);
    if (d < bd) {
      bd = d;
      best = b;
    }
  }
  return best;
}

/** Ameaça para morador: qualquer inimigo, menos guardiões de ruínas (eles só lutam com ninjas). */
const dangerNear = (g: Game, u: Unit, r: number) => {
  const t = g.nearestHostile(u, r);
  return !!t && t.guard == null;
};

function flee(g: Game, u: Unit) {
  const s = shelterFor(g, u);
  u.carry = null;
  u.state = 'flee';
  if (s) {
    const p = doorPos(s);
    setDestination(g, u, p.x, p.y);
  }
  fxText(g, u.x, u.y - 20, '!', '#ff5a5a');
}

function goHome(g: Game, u: Unit) {
  const home = g.building(u.homeId) ?? g.hokage();
  if (!home) return;
  const p = doorPos(home);
  if (setDestination(g, u, p.x, p.y)) u.state = 'goHome';
}

function work(g: Game, u: Unit, dt: number) {
  switch (u.state) {
    case 'idle':
      u.moving = false;
      if (u.timer <= 0) decide(g, u);
      break;
    case 'wander':
      if (followPath(g, u, dt, 0.6)) {
        u.state = 'idle';
        u.timer = rand(1.5, 4);
      }
      break;
    case 'toField':
      if (followPath(g, u, dt)) {
        u.state = 'farming';
        u.timer = 5;
      }
      break;
    case 'farming':
      u.moving = false;
      u.anim = 0.2;
      if (u.timer <= 0) {
        const job = g.building(u.jobId);
        const out = job && BUILDINGS[job.type].job === 'gardener' ? FIELD_OUTPUT.gardener : FIELD_OUTPUT.farmer;
        const amount = out.res === 'food' ? Math.max(1, Math.round(farmYield(job) * harvestMult(g.state, u.x, u.y))) : out.amount;
        g.state.res[out.res] += amount;
        fxText(g, u.x, u.y - 20, `+${amount}${RES_INFO[out.res].icon}`, '#ffe08a');
        // o pedaço colhido fica sem planta e volta a crescer aos poucos
        fx(g, 'harvest', u.x + Math.cos(u.facing) * 8, u.y + Math.sin(u.facing) * 8, { life: 30, r: 10, color: '#6b4a2b' });
        u.state = 'idle';
      }
      break;
    case 'toNode': {
      const n = g.node(u.taskId);
      if (!n) u.state = 'idle';
      else if (followPath(g, u, dt)) {
        u.state = 'gather';
        u.timer = 4;
        u.facing = Math.atan2(tileCenter(n.ty) - u.y, tileCenter(n.tx) - u.x);
      }
      break;
    }
    case 'gather': {
      const n = g.node(u.taskId);
      if (!n) {
        u.state = 'idle';
        break;
      }
      u.moving = false;
      u.anim = 0.2;
      const yieldOf = NODE_YIELD[n.type as keyof typeof NODE_YIELD];
      if (!yieldOf) {
        u.state = 'idle';
        break;
      }
      if (Math.random() < dt * 2.5) fx(g, 'chips', tileCenter(n.tx), tileCenter(n.ty), { color: yieldOf.chips, life: 0.4 });
      if (u.timer <= 0) {
        const amount = Math.min(n.amount, yieldOf.amount);
        n.amount -= amount;
        // esgotou: vira toco / rocha rachada e cresce de volta com o tempo (não some do mapa)
        if (n.amount <= 0) {
          n.amount = 0;
          n.regrow = REGROW[n.type] ?? 0;
          if (!n.regrow) g.removeNode(n.id);
        }
        u.carry = { res: yieldOf.res, amount };
        deposit(g, u);
      }
      break;
    }
    case 'toDeposit':
      if (followPath(g, u, dt)) {
        if (u.carry) {
          g.state.res[u.carry.res] += u.carry.amount;
          fxText(g, u.x, u.y - 20, `+${u.carry.amount}${RES_INFO[u.carry.res].icon}`, '#ffe08a');
        }
        u.carry = null;
        u.state = 'idle';
        u.timer = 0.3;
      }
      break;
    case 'toShop':
      if (followPath(g, u, dt)) {
        u.state = 'shop';
        u.timer = 8;
      }
      break;
    case 'shop':
      u.moving = false;
      if (!g.building(u.jobId)?.built) u.state = 'idle';
      else if (u.timer <= 0) {
        const shop = g.building(u.jobId)!;
        const ryo = marketYield(shop);
        g.state.res.ryo += ryo;
        // mercado especializado: também vende o excedente da mercadoria escolhida
        const sold = marketSale(g, shop);
        fxText(g, u.x, u.y - 20, `+${ryo + sold}{ryo}`, '#ffe08a');
        u.timer = 8;
      }
      break;
    case 'toCraft':
      if (followPath(g, u, dt)) {
        u.state = 'craft';
        u.timer = 0;
      }
      break;
    case 'craft': {
      const b = g.building(u.jobId);
      if (!b?.built) {
        u.state = 'idle';
        break;
      }
      u.moving = false;
      u.facing = -Math.PI / 2;
      if (advanceCraft(g, b.id, dt)) {
        u.anim = 0.2;
        if (Math.random() < dt * 2) fx(g, 'chips', u.x, u.y - 14, { color: b.type === 'forge' ? '#ffb347' : '#cfe8ff', life: 0.35 });
      } else if (b.type === 'sealshop' && g.state.res.wood >= PAPER.minWood) {
        // sem pedidos: a oficina de selos faz papel com madeira
        u.anim = 0.2;
        if (u.timer <= 0) u.timer = PAPER.time;
        else if (u.timer <= dt) {
          g.state.res.wood -= PAPER.wood;
          g.state.res.paper += 1;
          fxText(g, u.x, u.y - 20, `+1${RES_INFO.paper.icon}`, '#ffe08a');
        }
      }
      break;
    }
    case 'toSite': {
      const b = g.building(u.taskId);
      if (!b || !needsBuilders(b)) u.state = 'idle';
      else if (followPath(g, u, dt)) u.state = 'build';
      break;
    }
    case 'build': {
      const b = g.building(u.taskId);
      if (!b || !needsBuilders(b)) {
        u.state = 'idle';
        break;
      }
      u.moving = false;
      u.anim = 0.2;
      const p = doorPos(b);
      u.facing = Math.atan2(p.y - 16 - u.y, p.x - u.x);
      if (Math.random() < dt * 2) fx(g, 'chips', u.x + Math.cos(u.facing) * 10, u.y + Math.sin(u.facing) * 10, { color: '#d9b77a', life: 0.4 });
      if (b.built) {
        workUpgrade(g, b, dt); // upgrade: o prédio segue funcionando durante a obra
        break;
      }
      b.progress += dt;
      if (b.progress >= BUILDINGS[b.type].buildTime) completeBuilding(g, b);
      break;
    }
    default:
      u.state = 'idle';
  }
}

export function completeBuilding(g: Game, b: Building) {
  const def = BUILDINGS[b.type];
  b.built = true;
  b.progress = def.buildTime;
  if (def.enclosure) g.world.rebuild(); // cercado pronto: os muros passam a bloquear
  g.toast(`${def.icon} ${def.name} concluída!`, 'good', doorPos(b));
}

function decide(g: Game, u: Unit) {
  const job = g.building(u.jobId);
  if (u.jobId != null && (!job || !job.built)) u.jobId = null;
  if (u.carry && job) {
    deposit(g, u);
    return;
  }
  if (job) {
    startJob(g, u, job);
    return;
  }
  const site = nearestSite(g, u);
  if (site) {
    const spot = siteSpot(g, site);
    u.taskId = site.id;
    if (setDestination(g, u, spot.x, spot.y)) {
      u.state = 'toSite';
      return;
    }
  }
  wander(g, u);
}

function startJob(g: Game, u: Unit, b: Building) {
  const def = BUILDINGS[b.type];
  switch (def.job) {
    case 'farmer':
    case 'gardener': {
      const x = (b.tx + rand(0.3, def.w - 0.3)) * TILE;
      const y = (b.ty + rand(0.3, def.h - 0.3)) * TILE;
      if (setDestination(g, u, x, y)) u.state = 'toField';
      break;
    }
    case 'lumber':
    case 'miner':
    case 'ironminer': {
      const nodeType = def.job === 'lumber' ? 'tree' : def.job === 'miner' ? 'rock' : 'ore';
      const n = findNode(g, b, nodeType);
      if (!n) {
        u.state = 'idle';
        u.timer = 6;
        const what = { tree: 'árvores', rock: 'rochas', ore: 'veios de minério' }[nodeType];
        if (Math.random() < 0.15) g.toast(`${def.icon} Não há ${what} perto de ${def.name}.`, 'warn', doorPos(b));
        wander(g, u);
        return;
      }
      u.taskId = n.id;
      if (setDestination(g, u, tileCenter(n.tx), tileCenter(n.ty) + 12)) u.state = 'toNode';
      break;
    }
    case 'crafter': {
      const p = doorPos(b);
      if (setDestination(g, u, p.x, p.y + 4)) u.state = 'toCraft';
      break;
    }
    case 'merchant': {
      const p = doorPos(b);
      if (setDestination(g, u, p.x + rand(-6, 6), p.y + 4)) u.state = 'toShop';
      break;
    }
    default:
      wander(g, u);
  }
}

function deposit(g: Game, u: Unit) {
  const b = g.building(u.jobId) ?? g.hokage();
  if (!b) return;
  const p = doorPos(b);
  if (setDestination(g, u, p.x, p.y)) u.state = 'toDeposit';
  else u.state = 'idle';
}

function findNode(g: Game, b: Building, type: 'tree' | 'rock' | 'ore') {
  const p = doorPos(b);
  const near = g.state.nodes
    .filter((n) => n.type === type && n.amount > 0)
    .map((n) => ({ n, d: Math.hypot(tileCenter(n.tx) - p.x, tileCenter(n.ty) - p.y) }))
    .filter((e) => e.d < searchTiles(b) * TILE)
    .sort((a, b) => a.d - b.d)
    .slice(0, 4);
  return near.length ? pick(near).n : null;
}

function nearestSite(g: Game, u: Unit) {
  let best: Building | undefined;
  let bd = Infinity;
  for (const b of g.state.buildings) {
    if (!needsBuilders(b)) continue;
    const p = doorPos(b);
    const d = Math.hypot(p.x - u.x, p.y - u.y);
    if (d < bd) {
      bd = d;
      best = b;
    }
  }
  return best;
}

/** Um ponto livre ao redor do canteiro de obras. */
function siteSpot(g: Game, b: Building) {
  const def = BUILDINGS[b.type];
  const spots: { x: number; y: number }[] = [];
  for (let x = b.tx - 1; x <= b.tx + def.w; x++)
    for (const y of [b.ty - 1, b.ty + def.h]) if (g.world.walkable(x, y)) spots.push({ x: tileCenter(x), y: tileCenter(y) });
  for (let y = b.ty; y < b.ty + def.h; y++)
    for (const x of [b.tx - 1, b.tx + def.w]) if (g.world.walkable(x, y)) spots.push({ x: tileCenter(x), y: tileCenter(y) });
  return spots.length ? pick(spots) : doorPos(b);
}

function wander(g: Game, u: Unit) {
  const home = g.building(u.homeId) ?? g.hokage();
  const base = home ? doorPos(home) : { x: u.x, y: u.y };
  const tx = toTile(base.x) + randi(-4, 4);
  const ty = toTile(base.y) + randi(-1, 4);
  if (setDestination(g, u, tileCenter(tx), tileCenter(ty))) u.state = 'wander';
  else {
    u.state = 'idle';
    u.timer = 2;
  }
}
