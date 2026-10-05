import { MAP_H, MAP_W, TILE } from '../../config';
import { rand, randi } from '../../core/rng';
import { ANIMALS, type AnimalDef } from '../../data/animals';
import { BUILDINGS } from '../../data/buildings';
import { BOMB, HEAL, PUPPET, SPY, SUMMON } from '../../data/enemies';
import { SPEC } from '../../data/specs';
import { spyNinjaNear } from '../specs';
import { DOG, dogSniff } from '../ninken';
import { createAnimal, createRogue } from '../entities';
import { costLabel } from '../../data/resources';
import { applyDamage, areaDamage, engage, spawnProjectile, trySupport } from '../combat';
import { fx, fxText } from '../fx';
import { occupantsOf } from '../interior';
import { isNight } from '../time';
import type { Game } from '../game';
import { chase, followPath, setDestination } from '../movement';
import type { Building, Unit } from '../types';
import { buildingCenter, CENTER_TX, CENTER_TY, doorPos, tileCenter, toTile } from '../world';

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
  // invocação: some quando o tempo acaba
  if (u.ownerId != null && u.life <= 0) {
    u.dead = true;
    fx(g, 'smoke', u.x, u.y, { r: 14, life: 0.6, color: '#d8c8ff' });
    return;
  }
  if (u.stun > 0) {
    u.moving = false;
    return;
  }
  if (u.faction === 'village') return ally(g, u, dt, def);
  if (u.state === 'charge') return charging(g, u, dt, def);
  if (u.missionId != null) return guardHome(g, u, dt, def.aggro);
  if (u.boss) return titan(g, u, dt, def.aggro);
  if (def.thief) return thief(g, u, dt, def);
  // bicho noturno vai embora quando amanhece
  if (def.night && !isNight(g.state) && u.state !== 'leave') u.life = 0;
  const t = validTarget(g, u, def.aggro * 2.5) ?? g.nearestHostile(u, def.aggro);
  if (t) {
    if (def.ability && animalAbility(g, u, t, def, dt)) return;
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
  if (u.role === 'puppet') return puppet(g, u, dt);
  if (u.cloak) revealSpy(g, u);
  if (!u.cloak) trySupport(g, u);
  if (u.missionId != null) return guardHome(g, u, dt, 220);
  if (u.guard != null) return guardHome(g, u, dt, 110, 60); // guardião não se afasta do altar
  if (u.state !== 'escape' && u.role === 'spy' && spy(g, u, dt)) return;
  if (u.state !== 'escape' && u.role === 'puppeteer' && puppeteer(g, u, dt)) return;
  if (u.state !== 'escape' && u.role === 'summoner') summonTick(g, u, dt);
  if (u.state !== 'escape' && u.role === 'medic' && medic(g, u, dt)) return;
  if (u.state !== 'escape' && u.role === 'bomber' && bomber(g, u, dt)) return;
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
    fxText(g, u.x, u.y - 30, `-${stolen}{ryo}`, '#ff5a5a', true);
    g.toast(`{ryo} ${u.name} roubou ${stolen} ryo da Residência do Hokage!`, 'danger', u);
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
function guardHome(g: Game, u: Unit, dt: number, aggro: number, chaseExtra = 200) {
  const hx = u.homeX ?? u.x;
  const hy = u.homeY ?? u.y;
  const leash = aggro + chaseExtra;
  let t = validTarget(g, u, leash);
  if (t && Math.hypot(t.x - hx, t.y - hy) > leash) t = null;
  t ??= g.nearestHostile(u, aggro);
  if (t && u.guard != null && t.kind !== 'ninja' && t.kind !== 'clone') t = null; // guardião: só ninjas
  if (t) {
    u.targetId = t.id;
    // feras de missão também usam o golpe especial (teia, bote, investida, veneno da hidra)
    if (u.animal) {
      const def = ANIMALS[u.animal];
      u.abilityCd = (u.abilityCd ?? 0) - (def.ability ? 0 : dt);
      if (u.animal === 'hydra' && hydraSpit(g, u, t)) return;
      if (def.ability && animalAbility(g, u, t, def, dt)) return;
    }
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

/** Fera Colossal: marcha até a vila e dá pisões que atingem todos ao redor. */
function titan(g: Game, u: Unit, dt: number, aggro: number) {
  u.abilityCd = (u.abilityCd ?? 0) - dt;
  const near = g.nearestHostile(u, 90);
  if (u.animal === 'titan' && near && u.abilityCd <= 0) {
    u.abilityCd = 5;
    u.anim = 0.4;
    fx(g, 'ring', u.x, u.y, { r: 95, color: '#ff8a5a', life: 0.6 });
    fx(g, 'burst', u.x, u.y, { r: 50, color: '#a0522d', life: 0.5 });
    areaDamage(g, u, u.faction, u.x, u.y, 95, 22 + g.state.level * 4, null, 50);
    return;
  }
  const t = validTarget(g, u, aggro * 1.5) ?? g.nearestHostile(u, aggro);
  if (t) {
    if (u.animal === 'hydra' && hydraSpit(g, u, t)) return;
    engage(g, u, t, dt);
    return;
  }
  const hk = g.hokage();
  if (!hk) return;
  const p = doorPos(hk);
  if (!u.hasGoal || u.timer <= 0) {
    setDestination(g, u, p.x, p.y + 20);
    u.timer = 3;
  }
  followPath(g, u, dt);
}

/** Vai embora pela borda mais próxima (o que levou, levou). */
function flee(g: Game, u: Unit) {
  u.state = 'escape';
  const e = nearestEdge(u.x, u.y);
  setDestination(g, u, e.x, e.y);
}

const dist = (u: Unit, p: { x: number; y: number }) => Math.hypot(u.x - p.x, u.y - p.y);
const inside = (u: Unit, b: Building) => {
  const d = BUILDINGS[b.type];
  return u.x > b.tx * TILE && u.x < (b.tx + d.w) * TILE && u.y > b.ty * TILE && u.y < (b.ty + d.h) * TILE;
};

/**
 * Bichos ladrões. Corvo: bica a fazenda e leva comida aos poucos. Macaco: pega ryo (ou ervas) uma vez e foge.
 * Não caçam ninguém; o corvo só bica quem chega muito perto. Abatido, devolve o que levou (ver killUnit).
 */
function thief(g: Game, u: Unit, dt: number, def: AnimalDef) {
  if (u.state === 'escape') {
    if (followPath(g, u, dt, def.thief === 'stash' ? 1.15 : 0.9)) {
      u.dead = true;
      if (u.loot) g.toast(`{paw} ${def.name} fugiu com ${costLabel(u.loot)}.`, 'warn');
    }
    return;
  }
  const near = def.aggro ? g.nearestHostile(u, def.aggro) : null;
  if (near) return engage(g, u, near, dt);
  if ((u.life ?? 0) <= 0) return flee(g, u);
  const res = g.state.res;
  if (def.thief === 'farm') {
    const farms = g.builtOf('farm');
    if (!farms.length || (u.loot?.food ?? 0) >= 12) return flee(g, u);
    const cur = g.building(u.taskId);
    const b = cur && cur.built ? cur : farms.reduce((a, f) => (dist(u, buildingCenter(f)) < dist(u, buildingCenter(a)) ? f : a));
    u.taskId = b.id;
    if (!inside(u, b)) {
      if (!u.hasGoal || u.timer <= 0) {
        u.timer = 3;
        const d = BUILDINGS[b.type];
        setDestination(g, u, (b.tx + rand(0.3, d.w - 0.3)) * TILE, (b.ty + rand(0.3, d.h - 0.3)) * TILE);
      }
      followPath(g, u, dt);
      return;
    }
    u.moving = false;
    if (u.timer > 0) return;
    u.timer = 2.5;
    u.anim = 0.3;
    const take = Math.min(2, Math.floor(res.food));
    if (take <= 0) return flee(g, u);
    res.food -= take;
    u.loot = { food: (u.loot?.food ?? 0) + take };
    fxText(g, u.x, u.y - 14, `-${take}{food}`, '#ff8a8a');
    return;
  }
  // macaco: vai até o estoque (Residência do Hokage, ou a horta se houver ervas), pega e foge
  const garden = g.findBuilt('herbgarden');
  const herbs = res.herbs >= 5 && !!garden && u.id % 2 === 0;
  const b = herbs ? garden : g.hokage();
  if (!b) return flee(g, u);
  const p = doorPos(b);
  if (!u.hasGoal || u.timer <= 0) {
    u.timer = 3;
    if (!setDestination(g, u, p.x, p.y + 4)) return flee(g, u);
  }
  if (followPath(g, u, dt) && Math.hypot(p.x - u.x, p.y - u.y) < 36) {
    const key = herbs ? 'herbs' : 'ryo';
    const amount = herbs ? Math.min(Math.floor(res.herbs), 6 + g.state.day) : Math.min(Math.floor(res.ryo), 15 + g.state.day * 3);
    if (amount > 0) {
      res[key] -= amount;
      u.loot = { [key]: amount };
      fxText(g, u.x, u.y - 24, `-${amount}{${key}}`, '#ff5a5a', true);
      g.toast(`{paw} Um macaco roubou ${costLabel(u.loot)}! Alcance-o antes que fuja.`, 'danger', u);
    }
    flee(g, u);
  }
}

/** Prédio que o bombardeiro mira: o mais perto que esteja de pé (a Residência e os campos não). */
function bombTarget(g: Game, u: Unit): Building | null {
  let best: Building | null = null;
  let bd = Infinity;
  for (const b of g.state.buildings) {
    const d = BUILDINGS[b.type];
    if (!b.built || b.type === 'hokage' || d.walkable) continue;
    const k = dist(u, buildingCenter(b));
    if (k < bd) {
      bd = k;
      best = b;
    }
  }
  return best;
}

/** Bombardeiro: vai até um prédio e lança papel-bomba; só luta com quem chega bem perto. Retorna true se agiu. */
function bomber(g: Game, u: Unit, dt: number): boolean {
  if ((u.bombs ?? 0) >= BOMB.max) return false; // sem bombas: vira um renegado comum
  const close = g.nearestHostile(u, 50);
  if (close) {
    engage(g, u, close, dt);
    return true;
  }
  const b = bombTarget(g, u);
  if (!b) return false;
  u.abilityCd = (u.abilityCd ?? 0) - dt;
  const c = buildingCenter(b);
  if (dist(u, c) > BOMB.range) {
    if (!u.hasGoal || u.timer <= 0) {
      u.timer = 2;
      if (!setDestination(g, u, c.x, c.y + 30)) return false;
    }
    followPath(g, u, dt);
    return true;
  }
  u.moving = false;
  u.facing = Math.atan2(c.y - u.y, c.x - u.x);
  if (u.abilityCd > 0) return true;
  u.abilityCd = BOMB.cd;
  u.bombs = (u.bombs ?? 0) + 1;
  u.anim = 0.4;
  bombBuilding(g, u, b);
  return true;
}

/** O papel-bomba explode: o prédio vira obra pela metade (os construtores refazem) e fere quem está perto. */
export function bombBuilding(g: Game, src: Unit | null, b: Building) {
  const d = BUILDINGS[b.type];
  const c = buildingCenter(b);
  fx(g, 'burst', c.x, c.y, { r: BOMB.radius, color: '#ff8a3d', life: 0.6 });
  fx(g, 'smoke', c.x, c.y - 10, { r: 30, life: 1, color: '#6b6b6b' });
  areaDamage(g, src, 'enemy', c.x, c.y, BOMB.radius, BOMB.unitDmg, null, 30);
  // quem estava lá dentro sai pela porta (não fica escondido nas ruínas)
  const door = doorPos(b);
  for (const o of occupantsOf(g, b)) {
    o.hidden = false;
    o.state = 'idle';
    o.timer = 0;
    o.x = door.x;
    o.y = door.y + 6;
  }
  b.built = false;
  b.progress = d.buildTime * (1 - BOMB.damage);
  b.upgrade = null;
  g.state.timers.jobs = 0; // chama construtores já
  g.toast(`{bomb} Papel-bomba! ${d.name} foi danificado e parou de funcionar até os moradores reconstruírem.`, 'danger', c);
}

/** Médico: segue o grupo e cura o aliado mais ferido. Retorna true se agiu (senão luta como os outros). */
function medic(g: Game, u: Unit, dt: number): boolean {
  u.abilityCd = (u.abilityCd ?? 0) - dt;
  const allies = g.state.units.filter((o) => !o.dead && o !== u && o.faction === 'enemy' && o.kind === 'rogue' && o.missionId == null);
  if (!allies.length) return false;
  const hurt = allies
    .filter((o) => o.hp < o.maxHp * 0.85 && dist(u, o) < HEAL.range)
    .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
  if (hurt && u.abilityCd <= 0) {
    u.abilityCd = HEAL.cd;
    u.anim = 0.4;
    const amount = Math.round(hurt.maxHp * HEAL.amount);
    hurt.hp = Math.min(hurt.maxHp, hurt.hp + amount);
    fx(g, 'ring', hurt.x, hurt.y, { r: 20, color: '#7dff8a', life: 0.6 });
    fxText(g, hurt.x, hurt.y - 26, `+${amount}`, '#7dff8a');
  }
  const close = g.nearestHostile(u, 45);
  if (close) {
    engage(g, u, close, dt);
    return true;
  }
  // fica um pouco atrás do aliado mais ferido (ou do mais perto)
  const lead = hurt ?? allies.reduce((a, o) => (dist(u, o) < dist(u, a) ? o : a));
  chase(g, u, lead.x - 24, lead.y - 18, dt, 20);
  return true;
}

/** Golpes especiais de animais. Retorna true se usou (o turno é dele). */
function animalAbility(g: Game, u: Unit, t: Unit, def: AnimalDef, dt: number): boolean {
  u.abilityCd = (u.abilityCd ?? rand(1, 3)) - dt;
  if (u.abilityCd > 0) return false;
  const d = dist(u, t);
  if (def.ability === 'web' && d > 40 && d < 130) {
    // teia: projétil que prende quem acerta
    u.abilityCd = 6;
    u.anim = 0.4;
    u.facing = Math.atan2(t.y - u.y, t.x - u.x);
    spawnProjectile(g, u, u.faction, u.x, u.y - 4, t.x, t.y, {
      damage: 3, radius: 14, nature: null, color: '#f2f2f2', size: 4, speed: 220, kind: 'orb', stun: 2.6, range: 140,
    });
    return true;
  }
  if (def.ability === 'pounce' && d > 50 && d < 150) {
    // bote: salta até o alvo e morde forte
    u.abilityCd = 7;
    const a = Math.atan2(t.y - u.y, t.x - u.x);
    fx(g, 'wind', u.x, u.y, { r: 16, life: 0.4, color: '#8a6bd9' });
    u.x = t.x - Math.cos(a) * 18;
    u.y = t.y - Math.sin(a) * 18;
    u.facing = a;
    u.anim = 0.4;
    applyDamage(g, u, t, def.damage * 1.8, null, { melee: true, knock: 20, from: { x: u.x, y: u.y } });
    fx(g, 'slash', t.x, t.y, { r: 16, life: 0.35, color: '#c9a0ff' });
    return true;
  }
  if (def.ability === 'charge' && d > 60 && d < 220) {
    // investida: corre em linha reta na direção do alvo
    u.abilityCd = 9;
    u.state = 'charge';
    u.facing = Math.atan2(t.y - u.y, t.x - u.x);
    u.timer = 1.1;
    u.hits = [];
    fxText(g, u.x, u.y - 30, '!!', '#ff8a3d', true);
    return true;
  }
  return false;
}

/** Rinoceronte em investida: atropela quem estiver no caminho e danifica o prédio em que bater. */
function charging(g: Game, u: Unit, dt: number, def: AnimalDef) {
  // (o timer já é descontado no começo de animal())
  const sp = def.speed * 3.2 * dt;
  const nx = u.x + Math.cos(u.facing) * sp;
  const ny = u.y + Math.sin(u.facing) * sp;
  u.moving = true;
  if (!g.world.walkablePx(nx, ny) || u.timer <= 0) {
    // bateu em algo: se for prédio, ele perde parte da obra
    const b = g.world.walkablePx(nx, ny) ? null : buildingAtPx(g, nx, ny);
    if (b && b.built && b.type !== 'hokage') {
      b.progress = BUILDINGS[b.type].buildTime * 0.75;
      b.built = false;
      b.upgrade = null;
      g.state.timers.jobs = 0;
      fx(g, 'burst', nx, ny, { r: 30, color: '#b9b2a2', life: 0.5 });
      g.toast(`{paw} O ${def.name} acertou ${BUILDINGS[b.type].name} em cheio! Os moradores vão consertar.`, 'danger', b && buildingCenter(b));
    }
    fx(g, 'smoke', u.x, u.y, { r: 18, life: 0.6, color: '#a89f8a' });
    u.state = 'roam';
    u.stun = b ? 1.2 : 0.3; // fica tonto depois de bater
    u.hits = undefined;
    return;
  }
  u.x = nx;
  u.y = ny;
  if (Math.random() < 0.4) fx(g, 'chips', u.x, u.y + 6, { r: 8, life: 0.4, color: '#a89f8a' });
  for (const o of g.state.units) {
    if (o.dead || o.hidden || o.faction === u.faction || u.hits!.includes(o.id) || o.faction === 'guest') continue;
    if (Math.hypot(o.x - u.x, o.y - u.y) > def.size + 10) continue;
    u.hits!.push(o.id);
    applyDamage(g, u, o, def.damage * 1.5, null, { knock: 40, stun: 0.6, from: { x: u.x, y: u.y } });
  }
}

/** Prédio que ocupa o ponto (px). */
function buildingAtPx(g: Game, x: number, y: number): Building | null {
  const tx = toTile(x);
  const ty = toTile(y);
  return g.state.buildings.find((b) => {
    const d = BUILDINGS[b.type];
    return tx >= b.tx && tx < b.tx + d.w && ty >= b.ty && ty < b.ty + d.h;
  }) ?? null;
}

// ------------------------------------------------------------------ renegados especiais (2ª leva)

/** Espião: invisível até ser descoberto; vai até um prédio, sabota e foge. Retorna true se agiu. */
function spy(g: Game, u: Unit, dt: number): boolean {
  if (!u.cloak) return false; // descoberto: luta (ou foge) como os outros
  if (u.bombs) {
    flee(g, u); // já sabotou: vai embora ainda invisível
    return true;
  }
  const b = bombTarget(g, u);
  if (!b) return false;
  const c = buildingCenter(b);
  if (dist(u, c) > 72) {
    if (!u.hasGoal || u.timer <= 0) {
      u.timer = 2;
      if (!setDestination(g, u, c.x, c.y + 22)) return false;
    }
    followPath(g, u, dt);
    u.abilityCd = 0;
    return true;
  }
  u.moving = false;
  u.abilityCd = (u.abilityCd ?? 0) + dt;
  if (u.abilityCd < SPY.sabotage) return true;
  const d = BUILDINGS[b.type];
  b.built = false;
  b.progress = d.buildTime * (1 - SPY.damage);
  b.upgrade = null;
  g.state.timers.jobs = 0;
  fx(g, 'smoke', c.x, c.y - 8, { r: 24, life: 1, color: '#6b5a7a' });
  u.bombs = 1; // sabotagem feita
  g.toast(`{eye} Sabotagem! Alguém invisível danificou ${d.name}. Torres e ninjas com Inteligência alta descobrem espiões.`, 'danger', c);
  flee(g, u);
  return true;
}

/** Descobre o espião (vale também enquanto ele foge). */
function revealSpy(g: Game, u: Unit) {
  if (!u.cloak || !spyRevealed(g, u)) return;
  u.cloak = false;
  fx(g, 'ring', u.x, u.y, { r: 22, color: '#c9a0ff', life: 0.7 });
  fxText(g, u.x, u.y - 30, 'Descoberto!', '#c9a0ff', true);
  g.toast('{eye} Um espião invisível foi descoberto! Agora dá para atacá-lo.', 'warn', u);
}

/** Torre por perto ou ninja da vila esperto o bastante e próximo. */
function spyRevealed(g: Game, u: Unit) {
  for (const b of g.state.buildings)
    if ((b.type === 'tower' || b.type === 'intel') && b.built && dist(u, buildingCenter(b)) < SPY.towerRange * (b.type === 'intel' ? 1.6 : 1)) return true;
  if (spyNinjaNear(g, u.x, u.y, SPEC.spyReveal)) return true;
  // faro dos ninken
  if (g.state.units.some((o) => !o.dead && o.animal === 'dog' && o.faction === 'village' && dist(u, o) < DOG.sniff)) return true;
  return g.state.units.some(
    (o) => !o.dead && !o.hidden && o.faction === 'village' && o.ninja && o.ninja.stats.inteligencia >= SPY.minInt && dist(u, o) < SPY.ninjaRange,
  );
}

const puppetsOf = (g: Game, u: Unit) => g.state.units.filter((o) => !o.dead && o.role === 'puppet' && o.ownerId === u.id);

/** Marionetista: monta marionetes e fica longe, deixando que elas lutem. Retorna true se agiu. */
function puppeteer(g: Game, u: Unit, dt: number): boolean {
  u.abilityCd = (u.abilityCd ?? 0) - dt;
  const t = g.nearestHostile(u, 260);
  if (!t) return false;
  const mine = puppetsOf(g, u);
  if (mine.length < PUPPET.max && u.abilityCd <= 0) {
    u.abilityCd = PUPPET.cd;
    u.anim = 0.5;
    for (let i = mine.length; i < PUPPET.max; i++) {
      const p = createRogue(g, u.x + rand(-20, 20), u.y + rand(-14, 14), g.state.day, { rank: 'genin', jutsu: 0, hpMult: PUPPET.hpMult, name: 'Marionete' });
      p.role = 'puppet';
      p.ownerId = u.id;
      p.state = 'fight';
      fx(g, 'smoke', p.x, p.y, { r: 16, life: 0.6, color: '#c8a26a' });
    }
    fxText(g, u.x, u.y - 30, 'Marionetes!', '#c8a26a', true);
  }
  // mantém distância: as marionetes lutam por ele
  const d = dist(u, t);
  if (d < PUPPET.keepAway) {
    const a = Math.atan2(u.y - t.y, u.x - t.x);
    chase(g, u, u.x + Math.cos(a) * 60, u.y + Math.sin(a) * 60, dt, 4);
  } else u.moving = false;
  u.facing = Math.atan2(t.y - u.y, t.x - u.x);
  return true;
}

/** Marionete: luta perto do dono e desmonta se ele cair. */
function puppet(g: Game, u: Unit, dt: number) {
  const owner = g.unit(u.ownerId);
  if (!owner || owner.dead) {
    u.dead = true;
    fx(g, 'smoke', u.x, u.y, { r: 16, life: 0.6, color: '#c8a26a' });
    fxText(g, u.x, u.y - 20, 'desmontou', '#c8a26a');
    return;
  }
  const t = validTarget(g, u, 260) ?? g.nearestHostile(u, 200);
  if (t) return engage(g, u, t, dt);
  chase(g, u, owner.x + 22, owner.y + 10, dt, 16);
}

/** Invocador: no meio da luta chama lobos temporários (luta normalmente no resto do tempo). */
function summonTick(g: Game, u: Unit, dt: number) {
  u.abilityCd = (u.abilityCd ?? 4) - dt;
  if (u.abilityCd > 0 || !g.nearestHostile(u, 200)) return;
  u.abilityCd = SUMMON.cd;
  u.anim = 0.5;
  fx(g, 'swirl', u.x, u.y, { r: 26, life: 0.8, color: '#b36bff' });
  fxText(g, u.x, u.y - 30, 'Invocação!', '#c9a0ff', true);
  for (let i = 0; i < SUMMON.count; i++) {
    const w = createAnimal(g, 'wolf', u.x + rand(-24, 24), u.y + rand(-18, 18));
    w.faction = 'enemy';
    w.ownerId = u.id;
    w.life = SUMMON.life;
    w.name = 'Lobo invocado';
    fx(g, 'smoke', w.x, w.y, { r: 14, life: 0.6, color: '#d8c8ff' });
  }
}

/** Hidra: cospe veneno em área em quem está longe. Retorna true se cuspiu. */
function hydraSpit(g: Game, u: Unit, t: Unit): boolean {
  const d = dist(u, t);
  if ((u.abilityCd ?? 0) > 0 || d < 60 || d > 210) return false;
  u.abilityCd = 5;
  u.anim = 0.4;
  u.facing = Math.atan2(t.y - u.y, t.x - u.x);
  spawnProjectile(g, u, u.faction, u.x, u.y - 10, t.x, t.y, {
    damage: 14 + g.state.level * 3, radius: 34, nature: null, color: '#7dff5a', size: 6, speed: 190, kind: 'orb', stun: 0, range: 230,
  });
  return true;
}

/** Bicho aliado da vila (invocação do contrato, cão ninja): luta perto do dono e o segue; a lesma cura. */
function ally(g: Game, u: Unit, dt: number, def: AnimalDef) {
  const owner = g.unit(u.ownerId);
  if (!owner || owner.dead) {
    u.dead = true;
    fx(g, 'smoke', u.x, u.y, { r: 16, life: 0.6, color: '#e8e8e8' });
    return;
  }
  if (u.animal === 'dog') dogSniff(g, u, owner, dt);
  if (u.animal === 'slug') {
    u.abilityCd = (u.abilityCd ?? 0) - dt;
    if (u.abilityCd <= 0) {
      u.abilityCd = 3;
      let healed = 0;
      for (const o of g.state.units)
        if (!o.dead && !o.hidden && o.faction === 'village' && o.hp < o.maxHp && dist(u, o) < 120) {
          o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.08);
          healed++;
        }
      if (healed) fx(g, 'heal', u.x, u.y, { r: 120, color: '#9fe8ff', life: 0.7 });
    }
  } else {
    const t = validTarget(g, u, def.aggro * 1.5) ?? g.nearestHostile(u, def.aggro);
    if (t) return engage(g, u, t, dt);
  }
  // fora do mapa (dono em expedição) ou escondido: espera; senão acompanha o dono
  if (owner.hidden) {
    u.moving = false;
    return;
  }
  chase(g, u, owner.x - 18, owner.y + 10, dt, 20);
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
