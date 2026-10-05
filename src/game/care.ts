// Cuidado com os ninjas da vila: novatos se abrigam de inimigos fortes demais, feridos podem ser resgatados para o
// Hospital em vez de morrer, quem ficou para trás treina com XP em dobro e o XP de um abate é dividido com quem ajudou.
import { chance } from '../core/rng';
import { ANIMALS } from '../data/animals';
import { STAT_KEYS } from '../data/ninja';
import { escapeFlicker } from './techniques';
import { fx, fxText } from './fx';
import type { Game } from './game';
import { followPath, setDestination } from './movement';
import { gainXp } from './progression';
import { teamOf, teamUnits } from './teams';
import type { Unit } from './types';
import { levelOf } from './upgrade';
import { doorPos } from './world';

export const CARE = {
  /** Inimigo que é tantas vezes mais forte que o novato o faz se abrigar. */
  danger: 1.5,
  /** Distância (px) em que o novato percebe o perigo (ou qualquer inimigo dentro da vila). */
  sense: 300,
  /** Resgate de feridos: chance com Hospital nível 1, a mais por nível e com um médico por perto; teto. */
  rescue: 0.35,
  rescuePerLevel: 0.15,
  rescueMedic: 0.2,
  rescueMax: 0.85,
  medicRange: 220,
  /** Quem está tantos níveis abaixo da média da vila treina com XP em dobro. */
  behind: 3,
  /** Divisão do XP de um abate: quem também acertou e quem é da equipe e estava perto. */
  assist: 0.5,
  team: 0.25,
  teamRange: 260,
};

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/** Força de luta para comparar (atributos, rank e jutsus; bichos pela vida e mordida). Não usa o nível. */
export function fightPower(u: Unit): number {
  if (u.ninja) {
    const n = u.ninja;
    const stats = STAT_KEYS.reduce((a, k) => a + n.stats[k], 0);
    return stats + ['genin', 'chunin', 'jounin', 'kage'].indexOf(n.rank) * 3 + n.jutsu.filter(Boolean).length * 2;
  }
  if (u.animal) {
    const d = ANIMALS[u.animal];
    return (u.maxHp / 8 + d.damage) * (u.boss ? 2 : 1);
  }
  return 5;
}

// ------------------------------------------------------------------ B. proteger novatos
export const isRookie = (u: Unit) => u.kind === 'ninja' && u.faction === 'village' && u.ninja?.rank === 'genin';

/** A vila tem algum ninja Chunin ou acima em casa para defender. */
export const hasVeterans = (g: Game) =>
  g.state.units.some((o) => !o.dead && o.kind === 'ninja' && o.faction === 'village' && o.away == null && o.ninja && o.ninja.rank !== 'genin');

/** Inimigo perto (ou dentro da vila) forte demais para este novato. */
export function dangerFor(g: Game, u: Unit): Unit | null {
  const mine = fightPower(u);
  for (const o of g.state.units) {
    if (o.dead || o.hidden || o.faction === 'village' || o.faction === 'guest' || o.arenaSide != null) continue;
    if (dist(o, u) > CARE.sense && !g.world.inVillage(o.x, o.y)) continue;
    if (fightPower(o) > mine * CARE.danger) return o;
  }
  return null;
}

function shelterPoint(g: Game, u: Unit) {
  const b = g.building(u.homeId) ?? g.findBuilt('hospital') ?? g.hokage();
  return b ? doorPos(b) : null;
}

/**
 * Novato (Genin) com inimigo forte demais por perto vai se abrigar em casa (ou no Hospital / Residência) e só sai
 * quando o perigo passa. Retorna true se controlou o ninja neste tick.
 */
export function shelterTick(g: Game, u: Unit, dt: number): boolean {
  if (!g.state.flags.shelterRookies || !isRookie(u)) return false;
  // sem nenhum veterano (Chunin+) na vila, os novatos são a única defesa: lutam
  if (!hasVeterans(g)) {
    if (u.state === 'shelter' || u.state === 'toShelter') {
      u.hidden = false;
      u.state = 'idle';
    }
    return false;
  }
  const danger = dangerFor(g, u);
  // já está dentro de um prédio (dormindo, estudando, descansando): fica lá até o perigo passar
  if (danger && u.hidden && u.state !== 'toShelter') return true;
  if (u.state === 'shelter') {
    if (danger) return true;
    u.hidden = false;
    u.state = 'idle';
    return false;
  }
  if (!danger) {
    if (u.state === 'toShelter') u.state = 'idle';
    return false;
  }
  if (u.state !== 'toShelter') {
    const p = shelterPoint(g, u);
    if (!p) return false;
    escapeFlicker(g, u);
    if (!setDestination(g, u, p.x, p.y)) return false;
    u.state = 'toShelter';
    u.targetId = null;
    fxText(g, u.x, u.y - 26, 'Abrigar!', '#cfe8ff');
  }
  if (followPath(g, u, dt, 1.2)) {
    u.state = 'shelter';
    u.hidden = true;
    u.moving = false;
  }
  return true;
}

// ------------------------------------------------------------------ E. resgate de feridos
/** Chance de um ninja da vila que caiu agora ser resgatado para o Hospital (0 sem Hospital). */
export function rescueChance(g: Game, u: Unit): number {
  const hospitals = g.builtOf('hospital');
  if (!hospitals.length) return 0;
  const lvl = Math.max(...hospitals.map(levelOf));
  let p = CARE.rescue + (lvl - 1) * CARE.rescuePerLevel;
  const medic = g.state.units.some(
    (o) => o !== u && !o.dead && !o.hidden && o.faction === 'village' && o.ninja && (o.ninja.spec === 'medic' || o.ninja.jutsu.includes('shousen')) && dist(o, u) < CARE.medicRange,
  );
  if (medic) p += CARE.rescueMedic;
  return Math.min(CARE.rescueMax, p);
}

/** Ninja da vila zerou a vida: talvez seja resgatado (fica com 1 de vida, abrigado no Hospital até se curar). */
export function tryRescue(g: Game, u: Unit): boolean {
  if (u.kind !== 'ninja' || u.faction !== 'village' || u.away != null) return false;
  if (!chance(rescueChance(g, u))) return false;
  const h = g.findBuilt('hospital');
  if (!h) return false;
  fx(g, 'smoke', u.x, u.y - 4, { r: 16, life: 0.6, color: '#e8e8e8' });
  fxText(g, u.x, u.y - 30, 'Resgatado!', '#7dff9a', true);
  const p = doorPos(h);
  u.x = p.x;
  u.y = p.y;
  u.hp = 1;
  u.stun = 0;
  u.cast = undefined;
  u.dash = undefined;
  u.targetId = null;
  u.path.length = 0;
  u.hasGoal = false;
  u.command = { kind: 'retreat' };
  u.state = 'cmdRest';
  u.hidden = true;
  g.toast(`{medic} ${u.name} caiu gravemente ferido(a), mas foi resgatado(a) e levado(a) ao Hospital.`, 'warn', u);
  return true;
}

// ------------------------------------------------------------------ D. recuperação de atraso
/** Nível médio dos ninjas da vila. */
export function averageLevel(g: Game) {
  const ns = g.state.units.filter((o) => !o.dead && o.kind === 'ninja' && o.faction === 'village' && o.ninja);
  return ns.length ? ns.reduce((a, o) => a + o.ninja!.level, 0) / ns.length : 1;
}

/** Bem abaixo da média da vila: treina com XP em dobro (os veteranos ajudam quem ficou para trás). */
export const catchingUp = (g: Game, u: Unit) => !!u.ninja && u.ninja.level <= averageLevel(g) - CARE.behind;

// ------------------------------------------------------------------ A. XP dividido
/** Anota quem da vila acertou o inimigo (clone conta para o dono). */
export function noteHit(t: Unit, src: Unit | null) {
  if (!src || src.faction !== 'village' || t.faction === 'village') return;
  const who = src.kind === 'clone' ? src.ownerId : src.ninja ? src.id : undefined;
  if (who == null) return;
  t.hitBy ??= [];
  if (!t.hitBy.includes(who)) t.hitBy.push(who);
}

/** XP de um abate: quem derrubou leva tudo; quem também acertou, metade; a equipe de quem derrubou por perto, 1/4. */
export function shareXp(g: Game, t: Unit, killer: Unit | null | undefined, xp: number) {
  const got = new Set<number>();
  if (killer) {
    gainXp(g, killer, xp);
    got.add(killer.id);
  }
  for (const id of t.hitBy ?? []) {
    const u = g.unit(id);
    if (!u || u.dead || got.has(id)) continue;
    gainXp(g, u, Math.round(xp * CARE.assist));
    got.add(id);
  }
  const team = killer ? teamOf(g, killer) : undefined;
  if (team)
    for (const m of teamUnits(g, team)) {
      if (got.has(m.id) || m.dead || dist(m, t) > CARE.teamRange) continue;
      gainXp(g, m, Math.round(xp * CARE.team));
      got.add(m.id);
    }
}
