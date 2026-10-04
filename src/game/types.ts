// Todo o estado do jogo é dado puro (serializável em JSON).
// Sistemas mutam o estado; render e UI apenas leem.
import type { AnimalType } from '../data/animals';
import type { BuildingType } from '../data/buildings';
import type { MissionType } from '../data/missions';
import type { Nature } from '../data/natures';
import type { Rank, StatKey, Stats } from '../data/ninja';

export type ResKey = 'wood' | 'stone' | 'food' | 'ryo';
export type Cost = Partial<Record<ResKey, number>>;
export type Faction = 'village' | 'wild' | 'enemy';
export type UnitKind = 'villager' | 'ninja' | 'animal' | 'rogue' | 'clone';
export type NinjaOrder = 'auto' | 'train' | 'patrol';
export type ProjectileKind = 'orb' | 'dragon' | 'blade' | 'rock' | 'spark' | 'kunai';

export interface Look {
  skin: string;
  hair: string;
  cloth: string;
  spiky: boolean;
}

export interface Learning {
  jutsuId: string;
  slot: 0 | 1;
  progress: number;
  total: number;
}

export interface NinjaInfo {
  rank: Rank;
  nature: Nature;
  stats: Stats;
  /** Cada ninja tem 2 slots de jutsu (podem estar vazios). */
  jutsu: [string | null, string | null];
  cd: [number, number];
  level: number;
  xp: number;
  kills: number;
  learning: Learning | null;
  focus: StatKey | null;
  order: NinjaOrder;
}

export interface Unit {
  id: number;
  kind: UnitKind;
  faction: Faction;
  name: string;
  x: number;
  y: number;
  facing: number;
  moving: boolean;
  hp: number;
  maxHp: number;
  chakra: number;
  maxChakra: number;
  speed: number;
  // navegação
  path: number[];
  goalX: number;
  goalY: number;
  hasGoal: boolean;
  repath: number;
  // IA
  state: string;
  timer: number;
  targetId: number | null;
  taskId: number | null;
  homeId: number | null;
  jobId: number | null;
  carry: { res: ResKey; amount: number } | null;
  // combate / status
  attackCd: number;
  stun: number;
  shield: number;
  hitFlash: number;
  combatTimer: number;
  anim: number;
  hidden: boolean;
  dead: boolean;
  look: Look;
  ninja?: NinjaInfo;
  animal?: AnimalType;
  /** Tempo de vida restante (clones). */
  life?: number;
  ownerId?: number;
  /** Unidade criada por uma missão (alvo, guarda, mercador). */
  missionId?: number;
  /** Posição que guarda (alvos de missão não marcham até a vila). */
  homeX?: number;
  homeY?: number;
  /** Ordem direta do jogador; sobrepõe a IA até ser cumprida ou cancelada. */
  command: Command | null;
}

export type Command =
  | { kind: 'move'; x: number; y: number; time: number }
  | { kind: 'attack'; targetId: number }
  | { kind: 'retreat' };

export type MissionStatus = 'offered' | 'active' | 'done' | 'failed';

export interface Mission {
  id: number;
  /** Índice em MISSION_TEMPLATES. */
  template: number;
  type: MissionType;
  rank: number;
  title: string;
  status: MissionStatus;
  teamId: number | null;
  /** Local do objetivo (px). */
  x: number;
  y: number;
  /** Escolta: [mercador, ...bandidos]; demais: inimigos a derrotar. */
  targetIds: number[];
  nodeIds: number[];
  progress: number;
  goal: number;
  timeLeft: number;
  phase: string;
  /** Motivo do fim (falha) para o histórico. */
  result?: string;
}

export interface Team {
  id: number;
  name: string;
  color: string;
  /** Jounin/Chunin responsável (opcional). */
  senseiId: number | null;
  /** Até 3 membros. */
  memberIds: number[];
}

export interface Building {
  id: number;
  type: BuildingType;
  tx: number;
  ty: number;
  built: boolean;
  progress: number;
  /** Quantos trabalhadores o jogador quer neste prédio. */
  desired: number;
  workers: number[];
  cd: number;
}

export interface ResourceNode {
  id: number;
  type: 'tree' | 'rock' | 'herb';
  missionId?: number;
  tx: number;
  ty: number;
  amount: number;
  max: number;
  variant: number;
}

export interface Projectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  tx: number;
  ty: number;
  faction: Faction;
  ownerId: number | null;
  damage: number;
  radius: number;
  nature: Nature | null;
  color: string;
  size: number;
  stun: number;
  life: number;
  kind: ProjectileKind;
  dead?: boolean;
}

export type EffectKind = 'text' | 'ring' | 'burst' | 'slash' | 'smoke' | 'bolt' | 'heal' | 'swirl' | 'chips' | 'wind';

export interface Effect {
  kind: EffectKind;
  x: number;
  y: number;
  t: number;
  life: number;
  color: string;
  text?: string;
  r?: number;
  x2?: number;
  y2?: number;
  big?: boolean;
}

export interface GameState {
  version: number;
  seed: number;
  /** Nível da vila (0 = Aldeia). Ver data/villageLevels.ts. */
  level: number;
  time: number;
  day: number;
  speed: number;
  tiles: number[];
  nodes: ResourceNode[];
  buildings: Building[];
  units: Unit[];
  teams: Team[];
  missions: Mission[];
  /** Reputação da vila (sobe com missões cumpridas). */
  reputation: number;
  /** Dia em que o quadro de missões foi renovado pela última vez. */
  missionDay: number;
  projectiles: Projectile[];
  effects: Effect[];
  res: Record<ResKey, number>;
  nextId: number;
  timers: { animal: number; raid: number; birth: number; jobs: number; homes: number };
  flags: { starving: boolean; alert: boolean; raidActive: boolean; raidStole: boolean };
  stats: { kills: number; raidsRepelled: number; born: number; lost: number; missionsDone: number };
}

export type Selection = { kind: 'unit' | 'building' | 'team'; id: number };
