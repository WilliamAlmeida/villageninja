// Fábricas de entidades. Toda criação de unidade passa por aqui.
import { DAY_LENGTH } from '../config';
import { chance, pick, rand } from '../core/rng';
import { ANIMALS, type AnimalType } from '../data/animals';
import { JUTSU_LIST } from '../data/jutsus';
import { NATURE_KEYS, type Nature } from '../data/natures';
import { derive, RANKS, STAT_KEYS, type Rank, type Stats } from '../data/ninja';
import { randomName, randomRogueName } from '../data/names';
import type { Game } from './game';
import type { Faction, Look, NinjaInfo, Unit, UnitKind } from './types';

const SKINS = ['#f2d0a9', '#e8b98a', '#d9a066', '#c68a5a', '#f5dcc0'];
const HAIRS = ['#2b1d16', '#4a2f1d', '#151515', '#7a4b2a', '#e0b85f', '#c04a2a', '#3d3d6c', '#e8e0d0', '#ff8fb0'];
const CLOTHS = ['#8c6b4a', '#6f8a5a', '#7a6a8f', '#a0704a', '#5f7f8f', '#9a5a4a', '#b08f5a'];
const NINJA_CLOTHS = ['#2d3e5c', '#3b3b46', '#4a3a5e', '#24443a', '#5a2f2f', '#e07b22'];

export function randomLook(kind: UnitKind): Look {
  return {
    skin: pick(SKINS),
    hair: pick(HAIRS),
    cloth: kind === 'rogue' ? pick(['#2a2230', '#3a2a2a', '#1f2a2a']) : kind === 'villager' ? pick(CLOTHS) : pick(NINJA_CLOTHS),
    spiky: chance(0.5),
  };
}

function baseUnit(g: Game, kind: UnitKind, faction: Faction, x: number, y: number, name: string): Unit {
  return {
    id: g.newId(), kind, faction, name, x, y, facing: Math.PI / 2, moving: false,
    hp: 30, maxHp: 30, chakra: 0, maxChakra: 0, speed: 46,
    path: [], goalX: x, goalY: y, hasGoal: false, repath: 0,
    state: 'idle', timer: Math.random(), targetId: null, taskId: null, homeId: null, jobId: null, carry: null,
    attackCd: 0, stun: 0, shield: 0, hitFlash: 0, combatTimer: 0, anim: 0, hidden: false, dead: false,
    look: randomLook(kind),
    command: null,
  };
}

export function createVillager(g: Game, x: number, y: number): Unit {
  const u = baseUnit(g, 'villager', 'village', x, y, randomName());
  u.hp = u.maxHp = 30;
  u.speed = 46;
  return g.addUnit(u);
}

/** Atributos aleatórios: base baixa + 2 talentos naturais. */
export function randomStats(rank: Rank, bonus = 0): Stats {
  const cap = RANKS[rank].statCap;
  const s = {} as Stats;
  for (const k of STAT_KEYS) s[k] = Math.max(0.3, Math.min(cap, rand(0.8, 2.6) + bonus));
  for (let i = 0; i < 2; i++) {
    const k = pick(STAT_KEYS);
    s[k] = Math.min(cap, s[k] + rand(1, 2));
  }
  return s;
}

/** Atualiza HP/chakra/velocidade a partir dos atributos, mantendo a proporção atual. */
export function refreshDerived(u: Unit) {
  if (!u.ninja) return;
  const d = derive(u.ninja.stats);
  const hpR = u.maxHp > 0 ? u.hp / u.maxHp : 1;
  const ckR = u.maxChakra > 0 ? u.chakra / u.maxChakra : 1;
  u.maxHp = d.maxHp;
  u.maxChakra = d.maxChakra;
  u.hp = Math.max(1, Math.round(d.maxHp * hpR));
  u.chakra = d.maxChakra * ckR;
  u.speed = d.speed;
}

/** Jutsus que um ninja "nasce sabendo" (nem todos nascem com algum). */
function innateJutsu(nature: Nature, maxRank: number, exclude: (string | null)[] = []) {
  const pool = JUTSU_LIST.filter(
    (j) => j.rank <= maxRank && (j.nature === null || j.nature === nature) && j.effect !== 'clone' && j.effect !== 'heal' && !exclude.includes(j.id),
  );
  // jutsus da própria natureza são mais prováveis
  const weighted = pool.flatMap((j) => (j.nature ? [j, j, j] : [j]));
  return weighted.length ? pick(weighted).id : null;
}

export function makeNinjaInfo(rank: Rank, stats: Stats, innate: number): NinjaInfo {
  const nature = pick(NATURE_KEYS);
  const n: NinjaInfo = {
    rank, nature, stats, jutsu: [null, null], cd: [0, 0], level: 1, xp: 0, kills: 0,
    learning: null, focus: null, order: 'auto',
  };
  const maxRank = Math.min(RANKS[rank].maxJutsuRank, 2);
  for (let i = 0; i < innate; i++) n.jutsu[i] = innateJutsu(nature, maxRank, n.jutsu);
  return n;
}

/** 45% nascem com 1 jutsu, 12% com 2, o resto sem nenhum. */
export function rollInnateCount() {
  const r = Math.random();
  return r < 0.12 ? 2 : r < 0.57 ? 1 : 0;
}

export function createNinja(g: Game, x: number, y: number, rank: Rank = 'genin', innate = rollInnateCount()): Unit {
  const u = baseUnit(g, 'ninja', 'village', x, y, randomName());
  u.ninja = makeNinjaInfo(rank, randomStats(rank), innate);
  u.maxHp = 0;
  refreshDerived(u);
  u.hp = u.maxHp;
  u.chakra = u.maxChakra;
  return g.addUnit(u);
}

/** Transforma um morador em ninja (recrutamento na Academia). */
export function convertToNinja(g: Game, u: Unit) {
  u.kind = 'ninja';
  u.ninja = makeNinjaInfo('genin', randomStats('genin'), rollInnateCount());
  u.look = { ...u.look, cloth: pick(NINJA_CLOTHS) };
  u.jobId = null;
  u.carry = null;
  u.state = 'idle';
  u.hidden = false;
  u.maxHp = 0;
  refreshDerived(u);
  u.hp = u.maxHp;
  u.chakra = u.maxChakra;
  for (const b of g.state.buildings) b.workers = b.workers.filter((id) => id !== u.id);
}

export interface RogueOpts {
  rank?: Rank;
  /** Bônus somado a cada atributo. */
  stats?: number;
  hpMult?: number;
  jutsu?: number;
  name?: string;
}

export function createRogue(g: Game, x: number, y: number, day: number, o: RogueOpts = {}): Unit {
  const rank: Rank = o.rank ?? (day >= 12 ? 'jounin' : day >= 6 ? 'chunin' : 'genin');
  const u = baseUnit(g, 'rogue', 'enemy', x, y, o.name ?? randomRogueName());
  const bonus = o.stats ?? Math.min(3, day * 0.12);
  u.ninja = makeNinjaInfo(rank, randomStats(rank, bonus), o.jutsu ?? (chance(0.4) ? 2 : 1));
  u.ninja.level = 1 + Math.floor(day / 2);
  u.maxHp = 0;
  refreshDerived(u);
  u.maxHp = Math.round(u.maxHp * (o.hpMult ?? 1));
  u.hp = u.maxHp;
  u.chakra = u.maxChakra;
  u.state = 'march';
  return g.addUnit(u);
}

export function createAnimal(g: Game, type: AnimalType, x: number, y: number): Unit {
  const def = ANIMALS[type];
  const u = baseUnit(g, 'animal', 'wild', x, y, def.name);
  u.animal = type;
  u.hp = u.maxHp = def.hp;
  u.speed = def.speed;
  u.state = 'roam';
  u.life = DAY_LENGTH * rand(0.5, 1);
  return g.addUnit(u);
}

/** Kage Bunshin: cópia temporária do dono, sem jutsus. */
export function createClone(g: Game, owner: Unit, x: number, y: number, life: number): Unit {
  const u = baseUnit(g, 'clone', owner.faction, x, y, owner.name);
  u.look = { ...owner.look };
  u.ninja = { ...owner.ninja!, jutsu: [null, null], cd: [0, 0], learning: null, stats: { ...owner.ninja!.stats } };
  u.maxHp = Math.max(10, Math.round(owner.maxHp * 0.3));
  u.hp = u.maxHp;
  u.speed = owner.speed;
  u.life = life;
  u.ownerId = owner.id;
  return g.addUnit(u);
}
