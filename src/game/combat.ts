// Regras de combate compartilhadas por ninjas, renegados, clones, animais e torres.
import { chance, rand } from '../core/rng';
import { ANIMALS } from '../data/animals';
import { costLabel } from '../data/resources';
import { createAnimal } from './entities';
import { isRangedJutsu, JUTSUS, jutsuChakra, jutsuCooldown, jutsuDuration, jutsuPower, type JutsuDef } from '../data/jutsus';
import { natureMultiplier, type Nature } from '../data/natures';
import { derive } from '../data/ninja';
import { createClone } from './entities';
import { canHit } from './factions';
import { recordDuelDamage, recordDuelJutsu } from './examStats';
import { fx, fxText } from './fx';
import type { Game } from './game';
import { chase, push } from './movement';
import { gainXp } from './progression';
import { consumeItem } from './gear';
import { gearBonus } from './gearBonus';
import { ITEMS } from '../data/items';
import { hasTeammateNear } from './teams';
import { KAGE_DAMAGE_BONUS } from './kage';
import { bossDefeated } from './bosses';
import type { Faction, Projectile, ProjectileKind, Unit } from './types';

export const MELEE_RANGE = 22;

function meleeStats(u: Unit) {
  if (u.animal) {
    const d = ANIMALS[u.animal];
    return { dmg: d.damage, cd: d.attackCd, range: d.range };
  }
  if (u.ninja) {
    const d = derive(u.ninja.stats);
    return { dmg: (d.meleeDmg + gearBonus(u).melee) * (u.kind === 'clone' ? 0.5 : 1), cd: d.meleeCd, range: MELEE_RANGE };
  }
  return { dmg: 2, cd: 1.5, range: MELEE_RANGE };
}

const canUseJutsu = (u: Unit) => !!u.ninja && u.kind !== 'clone';

/** Alcance do melhor jutsu ofensivo pronto (0 se nenhum). */
function readyRangedRange(u: Unit): number {
  const n = u.ninja!;
  let r = 0;
  for (let i = 0; i < 2; i++) {
    const id = n.jutsu[i];
    if (!id || n.cd[i]! > 0) continue;
    const def = JUTSUS[id]!;
    if (!isRangedJutsu(def) || u.chakra < jutsuChakra(def, n.stats)) continue;
    r = Math.max(r, def.range);
  }
  return r;
}

/** IA de luta: escolhe jutsu, aproxima e ataca. */
export function engage(g: Game, u: Unit, t: Unit, dt: number) {
  u.combatTimer = 5;
  u.targetId = t.id;
  u.hidden = false;
  const d = Math.hypot(t.x - u.x, t.y - u.y);

  if (canUseJutsu(u) && tryConsumable(g, u, t, d)) return;
  if (u.attackCd <= 0 && canUseJutsu(u)) {
    const slot = pickJutsu(g, u, t, d);
    if (slot >= 0) {
      castJutsu(g, u, slot, t);
      return;
    }
  }

  const ms = meleeStats(u);
  let desired = ms.range;
  if (canUseJutsu(u)) {
    const r = readyRangedRange(u);
    if (r > 0) desired = r * 0.85;
  }

  if (d > desired) {
    if (canUseJutsu(u) && u.attackCd <= 0 && d > 50 && d < 130) throwKunai(g, u, t);
    chase(g, u, t.x, t.y, dt, desired * 0.9);
  } else {
    u.moving = false;
    u.facing = Math.atan2(t.y - u.y, t.x - u.x);
    if (d <= ms.range + 6 && u.attackCd <= 0) {
      u.attackCd = ms.cd;
      u.anim = 0.25;
      applyDamage(g, u, t, ms.dmg, null, { melee: true });
    }
  }
}

/** Usa o consumível carregado na hora certa (pílula quase caindo, bomba no alcance). */
function tryConsumable(g: Game, u: Unit, t: Unit, d: number): boolean {
  const e = u.ninja?.equip;
  if (!e?.item || !e.itemReady) return false;
  const use = ITEMS[e.item]?.use;
  if (!use) return false;
  if (use.kind === 'heal' && u.hp < u.maxHp * 0.3) {
    consumeItem(g, u);
    u.hp = Math.min(u.maxHp, u.hp + u.maxHp * use.amount);
    fx(g, 'heal', u.x, u.y, { r: 16, color: '#7dff9a', life: 0.8 });
    return true;
  }
  if (use.kind === 'chakra' && u.chakra < u.maxChakra * 0.15 && u.ninja!.jutsu.some(Boolean)) {
    consumeItem(g, u);
    u.chakra = Math.min(u.maxChakra, u.chakra + u.maxChakra * use.amount);
    fx(g, 'ring', u.x, u.y, { r: 16, color: '#4da6ff', life: 0.6 });
    return true;
  }
  if (use.kind === 'bomb' && u.attackCd <= 0 && d > 40 && d < 130) {
    consumeItem(g, u);
    u.attackCd = 0.8;
    spawnProjectile(g, u, u.faction, u.x, u.y - 4, t.x, t.y, {
      damage: use.amount, radius: use.radius ?? 50, nature: null, color: '#ff7a3b', size: 5, speed: 300, kind: 'kunai', stun: 0, range: 140,
    });
    return true;
  }
  return false;
}

function pickJutsu(g: Game, u: Unit, t: Unit, d: number): number {
  const n = u.ninja!;
  let best = -1;
  let bestScore = 0;
  for (let i = 0; i < 2; i++) {
    const id = n.jutsu[i];
    if (!id || n.cd[i]! > 0) continue;
    const def = JUTSUS[id]!;
    if (u.chakra < jutsuChakra(def, n.stats)) continue;
    let score = 0;
    switch (def.effect) {
      case 'heal':
        break; // tratado em trySupport
      case 'shield':
        if (u.shield <= 0 && u.hp < u.maxHp * 0.8) score = 50;
        break;
      case 'clone': {
        if (u.arenaSide) break; // sem clones no duelo
        const clones = g.state.units.filter((c) => c.kind === 'clone' && c.ownerId === u.id && !c.dead).length;
        if (d < def.range && clones === 0) score = 60;
        break;
      }
      case 'stun':
        if (t.stun <= 0 && d <= def.range) score = 40;
        break;
      case 'melee':
        if (d <= def.range + 6) score = jutsuPower(def, n.stats);
        break;
      default:
        if (d <= def.range) score = jutsuPower(def, n.stats) * natureMultiplier(def.nature, t.ninja?.nature);
    }
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

function startCast(g: Game, u: Unit, slot: number, def: JutsuDef) {
  const n = u.ninja!;
  u.chakra -= jutsuChakra(def, n.stats);
  n.cd[slot] = jutsuCooldown(def, n.stats);
  u.attackCd = 0.7;
  u.anim = 0.4;
  fxText(g, u.x, u.y - 30, def.shout, def.color, true);
  if (u.arenaSide) recordDuelJutsu(g.state, u.id);
}

export function castJutsu(g: Game, u: Unit, slot: number, t: Unit) {
  const n = u.ninja!;
  const def = JUTSUS[n.jutsu[slot]!]!;
  startCast(g, u, slot, def);
  const power = jutsuPower(def, n.stats);
  u.facing = Math.atan2(t.y - u.y, t.x - u.x);

  switch (def.effect) {
    case 'projectile':
      spawnProjectile(g, u, u.faction, u.x, u.y - 4, t.x, t.y, {
        damage: power, radius: def.radius ?? 0, nature: def.nature, color: def.color,
        size: def.radius ? 9 : 6, speed: def.projSpeed ?? 250, kind: def.projKind ?? 'orb', stun: def.stun ?? 0, range: def.range,
      });
      break;
    case 'multi': {
      const count = def.count ?? 3;
      const base = Math.atan2(t.y - u.y, t.x - u.x);
      for (let i = 0; i < count; i++) {
        const a = base + (count > 1 ? (i / (count - 1) - 0.5) * 0.6 : 0);
        spawnProjectile(g, u, u.faction, u.x, u.y - 4, u.x + Math.cos(a) * def.range, u.y + Math.sin(a) * def.range, {
          damage: power, radius: 0, nature: def.nature, color: def.color, size: 5,
          speed: def.projSpeed ?? 260, kind: def.projKind ?? 'orb', stun: def.stun ?? 0, range: def.range,
        });
      }
      break;
    }
    case 'aoe':
      fx(g, 'wind', u.x, u.y, { x2: t.x, y2: t.y, color: def.color, life: 0.5 });
      fx(g, 'ring', t.x, t.y, { r: def.radius ?? 50, color: def.color, life: 0.5 });
      areaDamage(g, u, u.faction, t.x, t.y, def.radius ?? 50, power, def.nature, 45);
      break;
    case 'dash': {
      const a = Math.atan2(t.y - u.y, t.x - u.x);
      const ox = u.x;
      const oy = u.y;
      const nx = t.x - Math.cos(a) * 16;
      const ny = t.y - Math.sin(a) * 16;
      if (g.world.walkablePx(nx, ny)) {
        u.x = nx;
        u.y = ny;
      }
      u.hasGoal = false;
      fx(g, 'bolt', ox, oy, { x2: t.x, y2: t.y, color: def.color, life: 0.4 });
      fx(g, 'burst', t.x, t.y, { r: 26, color: def.color, life: 0.4 });
      applyDamage(g, u, t, power, def.nature, {});
      break;
    }
    case 'melee':
      fx(g, 'slash', t.x, t.y, { r: 24, color: def.color, life: 0.35 });
      applyDamage(g, u, t, power, def.nature, { knock: 22 });
      break;
    case 'stun': {
      const s = t.ninja?.stats;
      const resist = s ? (s.genjutsu + s.inteligencia) * 0.035 : 0;
      fx(g, 'swirl', t.x, t.y - 8, { r: 20, color: def.color, life: 0.9 });
      if (chance(resist)) fxText(g, t.x, t.y - 20, 'Kai!', '#d9c2ff');
      else t.stun = Math.max(t.stun, jutsuDuration(def, n.stats));
      break;
    }
    case 'clone': {
      const count = def.count ?? 2;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        const cx = u.x + Math.cos(a) * 20;
        const cy = u.y + Math.sin(a) * 20;
        const c = createClone(g, u, g.world.walkablePx(cx, cy) ? cx : u.x, g.world.walkablePx(cx, cy) ? cy : u.y, def.duration ?? 10);
        fx(g, 'smoke', c.x, c.y, { r: 16, life: 0.6, color: '#e8e8e8' });
      }
      break;
    }
    case 'bind':
      // raízes prendem o alvo e causam dano
      fx(g, 'swirl', t.x, t.y, { r: 22, color: def.color, life: 1.2 });
      fx(g, 'burst', t.x, t.y, { r: 20, color: def.color, life: 0.5 });
      applyDamage(g, u, t, power, null, { stun: def.duration ?? 2 });
      break;
    case 'shield':
      u.shield = def.duration ?? 6;
      fx(g, 'ring', u.x, u.y, { r: 22, color: def.color, life: 0.5 });
      break;
    case 'heal':
      break;
  }
}

/** Ninjas médicos curam aliados feridos próximos. */
export function trySupport(g: Game, u: Unit): boolean {
  const n = u.ninja;
  if (!n || u.kind === 'clone' || u.attackCd > 0 || u.arenaSide != null) return false;
  for (let i = 0; i < 2; i++) {
    const id = n.jutsu[i];
    if (!id || n.cd[i]! > 0) continue;
    const def = JUTSUS[id]!;
    if (def.effect !== 'heal' || u.chakra < jutsuChakra(def, n.stats)) continue;
    let best: Unit | null = null;
    let ratio = 0.6;
    for (const o of g.state.units) {
      if (o.dead || o.hidden || o.faction !== u.faction || o.kind === 'animal') continue;
      if (Math.hypot(o.x - u.x, o.y - u.y) > def.range) continue;
      const r = o.hp / o.maxHp;
      if (r < ratio) {
        ratio = r;
        best = o;
      }
    }
    if (!best) continue;
    startCast(g, u, i, def);
    const amount = Math.round(jutsuPower(def, n.stats));
    best.hp = Math.min(best.maxHp, best.hp + amount);
    fx(g, 'heal', best.x, best.y, { r: 18, color: def.color, life: 0.8 });
    fxText(g, best.x, best.y - 18, `+${amount}`, def.color);
    return true;
  }
  return false;
}

function throwKunai(g: Game, u: Unit, t: Unit) {
  const d = derive(u.ninja!.stats);
  u.attackCd = 1.6;
  u.anim = 0.2;
  spawnProjectile(g, u, u.faction, u.x, u.y - 4, t.x, t.y, {
    damage: d.kunaiDmg + gearBonus(u).kunai, radius: 0, nature: null, color: '#cfd6dd', size: 4, speed: 360, kind: 'kunai', stun: 0, range: 160,
  });
}

interface ProjOpts {
  damage: number;
  radius: number;
  nature: Nature | null;
  color: string;
  size: number;
  speed: number;
  kind: ProjectileKind;
  stun: number;
  range: number;
}

export function spawnProjectile(g: Game, owner: Unit | null, faction: Faction, x: number, y: number, tx: number, ty: number, o: ProjOpts) {
  const a = Math.atan2(ty - y, tx - x);
  const p: Projectile = {
    id: g.newId(), x, y, vx: Math.cos(a) * o.speed, vy: Math.sin(a) * o.speed, tx, ty, faction,
    ownerId: owner?.id ?? null, damage: o.damage, radius: o.radius, nature: o.nature, color: o.color,
    size: o.size, stun: o.stun, life: (o.range * 1.4) / o.speed, kind: o.kind, side: owner?.arenaSide || undefined,
  };
  g.state.projectiles.push(p);
  return p;
}

export function areaDamage(g: Game, src: Unit | null, faction: Faction, x: number, y: number, r: number, dmg: number, nature: Nature | null, knock = 0, stun = 0, side = src?.arenaSide) {
  for (const o of g.state.units) {
    if (o.dead || o.hidden || !canHit(faction, side, o)) continue;
    const d = Math.hypot(o.x - x, o.y - y);
    if (d > r) continue;
    const k = knock > 0 && d > 0.1 ? knock * (1 - d / r) : 0;
    applyDamage(g, src, o, dmg * (1 - (0.4 * d) / r), nature, { stun, knock: k, from: { x, y } });
  }
}

interface DamageOpts {
  melee?: boolean;
  stun?: number;
  knock?: number;
  from?: { x: number; y: number };
}

export function applyDamage(g: Game, src: Unit | null, t: Unit, amount: number, nature: Nature | null, opts: DamageOpts) {
  if (t.dead) return;
  if (opts.melee && t.ninja && chance(derive(t.ninja.stats).dodge)) {
    fxText(g, t.x, t.y - 20, 'Esquiva!', '#cfe8ff');
    return;
  }
  const mult = natureMultiplier(nature, t.ninja?.nature);
  let dmg = amount * mult;
  // lutar junto da equipe dá +10% de dano
  if (src?.faction === 'village' && src.ninja && hasTeammateNear(g, src)) dmg *= 1.1;
  // "Vontade" do Kage: com um Kage vivo, todos os ninjas da vila batem mais forte
  if (src?.faction === 'village' && src.ninja && !src.arenaSide && g.state.kageId != null && !g.unit(g.state.kageId)?.dead) dmg *= KAGE_DAMAGE_BONUS;
  if (t.ninja) dmg *= 1 - Math.min(0.6, derive(t.ninja.stats).defense + gearBonus(t).defense);
  if (t.shield > 0) dmg *= 0.4;
  dmg = Math.max(1, Math.round(dmg * rand(0.9, 1.1)));
  t.hp -= dmg;
  t.hitFlash = 0.15;
  if (t.arenaSide) recordDuelDamage(g.state, src?.id, dmg);
  t.combatTimer = 5;
  fxText(g, t.x + rand(-6, 6), t.y - 18, mult > 1 ? `${dmg}!` : `${dmg}`, mult > 1 ? '#ffb347' : mult < 1 ? '#9aa4b0' : '#ffffff');
  if (opts.stun) t.stun = Math.max(t.stun, opts.stun);
  if (opts.knock) {
    const from = opts.from ?? src ?? t;
    const a = Math.atan2(t.y - from.y, t.x - from.x);
    push(g, t, Math.cos(a) * opts.knock, Math.sin(a) * opts.knock);
  }
  // quem apanha revida
  if (src && !src.dead && t.faction !== 'village' && t.targetId == null) t.targetId = src.id;
  if (t.hp <= 0) {
    // duelo do Exame Chunin não mata: nocaute
    if (t.arenaSide) {
      t.hp = 1;
      t.state = 'ko';
      t.stun = 99;
      fxText(g, t.x, t.y - 30, 'Nocaute!', '#ffd34d', true);
    } else killUnit(g, t, src);
  }
}

export function killUnit(g: Game, t: Unit, src: Unit | null) {
  // Hidra: perde uma cabeça e volta com a vida cheia enquanto tiver mais de uma
  if (t.heads && t.heads > 1) {
    t.heads--;
    t.hp = t.maxHp;
    fx(g, 'ring', t.x, t.y, { r: 40, color: '#7dff5a', life: 0.8 });
    fxText(g, t.x, t.y - 44, `Uma cabeça caiu! Restam ${t.heads}`, '#7dff5a', true);
    g.toast(`{beast} ${t.name} perdeu uma cabeça! Restam ${t.heads}.`, 'good', t);
    return;
  }
  t.dead = true;
  t.hp = 0;
  if (t.kind === 'clone') {
    fx(g, 'smoke', t.x, t.y, { r: 16, life: 0.6, color: '#e8e8e8' });
    return;
  }
  fx(g, 'burst', t.x, t.y, { r: 18, color: '#ffffff', life: 0.4 });
  const killer = src?.kind === 'clone' ? g.unit(src.ownerId) : src;
  // Golem de Barro: cai e se divide em dois menores (até a 3ª geração)
  const split = t.animal === 'golem' && (t.tier ?? 0) < 2;
  if (split) splitGolem(g, t);
  const pieces = t.animal === 'golem' && g.state.units.some((o) => !o.dead && o.animal === 'golem' && o.boss);
  if (t.boss && !pieces) bossDefeated(g, t);
  // ladrão abatido: o que ele levou volta para a vila
  if (t.loot) {
    g.give(t.loot);
    fxText(g, t.x, t.y - 40, `Recuperado: ${costLabel(t.loot)}`, '#7dff8a', true);
    t.loot = undefined;
  }
  if (t.faction !== 'village') {
    // killer nulo = torre / Residência do Hokage
    if (!killer || killer.faction === 'village') {
      g.state.stats.kills++;
      if (t.animal && t.ownerId != null) {
        /* invocação: não rende nada */
      } else if (t.animal) {
        const def = ANIMALS[t.animal];
        g.give(def.reward);
        rewardText(g, t, def.reward);
        if (killer) gainXp(g, killer, def.xp);
      } else if (t.kind === 'rogue' && t.role !== 'puppet') {
        const ryo = 30 + g.state.day * 4;
        g.give({ ryo });
        rewardText(g, t, { ryo });
        if (killer) gainXp(g, killer, 40 + g.state.day * 3);
      }
      if (killer?.ninja) killer.ninja.kills++;
    }
  } else {
    g.state.stats.lost++;
    g.toast(t.kind === 'ninja' ? `{skull} O ninja ${t.name} caiu em combate!` : `{skull} ${t.name} foi morto(a).`, 'danger', t);
  }
}

/** Divide o golem em dois menores, com metade da vida máxima, ao lado de onde caiu. */
function splitGolem(g: Game, t: Unit) {
  fx(g, 'burst', t.x, t.y, { r: 34, color: '#a0603a', life: 0.6 });
  fxText(g, t.x, t.y - 40, 'Se dividiu!', '#e0a070', true);
  for (const dx of [-16, 16]) {
    const c = createAnimal(g, 'golem', t.x + dx, t.y + 6);
    c.tier = (t.tier ?? 0) + 1;
    c.maxHp = c.hp = Math.max(40, Math.round(t.maxHp * 0.5));
    c.boss = true;
    c.life = 1e9;
    c.state = 'rampage';
    c.name = c.tier === 1 ? 'Golem de Barro' : 'Golenzinho de Barro';
  }
}

function rewardText(g: Game, t: Unit, r: { food?: number; ryo?: number; wood?: number; stone?: number }) {
  const parts: string[] = [];
  if (r.food) parts.push(`+${r.food}{food}`);
  if (r.ryo) parts.push(`+${r.ryo}{ryo}`);
  if (parts.length) fxText(g, t.x, t.y - 30, parts.join(' '), '#ffe08a');
}
