// Todo o estado do jogo é dado puro (serializável em JSON).
// Sistemas mutam o estado; render e UI apenas leem.
import type { AnimalType } from '../data/animals';
import type { RogueRole } from '../data/enemies';
import type { BuildingType } from '../data/buildings';
import type { MissionType } from '../data/missions';
import type { KekkeiId } from '../data/kekkei';
import type { BossKind } from '../data/bosses';
import type { Nature } from '../data/natures';
import type { Rank, StatKey, Stats } from '../data/ninja';

export type { ResKey } from '../data/resources';
import type { ResKey } from '../data/resources';
export type Cost = Partial<Record<ResKey, number>>;
export type Faction = 'village' | 'wild' | 'enemy' | 'guest';
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
  equip: Equip;
  /** Kekkei genkai despertada (natureza combinada). */
  kekkei: KekkeiId | null;
}

/** Herança de família: o que um morador traz de berço (usado ao virar ninja). */
export interface Heritage {
  clanId: number | null;
  nature: Nature | null;
  /** Atributo em que tem talento natural. */
  bias: StatKey | null;
  kekkei: KekkeiId | null;
  parents: [string, string] | null;
}

export interface Clan {
  id: number;
  /** Sobrenome da família. */
  name: string;
  color: string;
  founderId: number;
  founderName: string;
  /** Atributo forte do clã (herdado pelos recrutas). */
  specialty: StatKey;
  nature: Nature;
  kekkei: KekkeiId | null;
  day: number;
}

export interface Equip {
  weapon: string | null;
  armor: string | null;
  /** Consumível escolhido; `itemReady` diz se o ninja está carregando um. */
  item: string | null;
  itemReady: boolean;
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
  /** Exame Chunin: 0 = participante aguardando, 1/2 = lado no duelo atual. */
  arenaSide?: number;
  heritage?: Heritage;
  /** Chefe de ameaça (aparece na barra de vida da tela). */
  boss?: boolean;
  /** Recarga de habilidade especial (pisão da Fera Colossal, bomba, cura). */
  abilityCd?: number;
  /** Renegado com função especial (ver data/enemies.ts). */
  role?: RogueRole;
  /** O que o bicho ladrão (corvo, macaco) levou da vila; volta se ele for abatido. */
  loot?: Cost;
  /** Bombas já lançadas (o bombardeiro desiste depois de algumas). */
  bombs?: number;
  /** Investida do rinoceronte: quem já foi atropelado nesta corrida. */
  hits?: number[];
  /** Espião ainda invisível (ninguém o acerta até ser descoberto). */
  cloak?: boolean;
  /** Hidra: cabeças que ainda restam (ao zerar a vida com mais de uma, perde uma e volta inteira). */
  heads?: number;
  /** Golem de barro: geração (0 = inteiro; cada golpe final o divide em dois menores). */
  tier?: number;
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
  /** Oficinas: itens na fila e o que está sendo feito agora. */
  queue?: string[];
  craft?: { itemId: string; progress: number } | null;
  /** Nível do prédio (1–3, ver data/upgrades.ts). */
  level?: number;
  /** Upgrade em obra: segundos trabalhados (null = nenhum). O prédio continua funcionando. */
  upgrade?: number | null;
  /** Torres: segundos desde o último arremesso contados para trás (o guarda aparece enquanto > 0; só visual). */
  shot?: number;
  /** Torres: ângulo (mundo) do último alvo, para o guarda olhar para ele. */
  aim?: number;
}

export interface ResourceNode {
  id: number;
  type: 'tree' | 'rock' | 'herb' | 'ore';
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
  /** Projétil de duelo: só atinge o lado oposto da arena. */
  side?: number;
}

/** `harvest`: canteiro recém-colhido (terra à mostra que volta a brotar com o tempo; desenhado no chão). */
export type EffectKind = 'text' | 'ring' | 'burst' | 'slash' | 'smoke' | 'bolt' | 'heal' | 'swirl' | 'chips' | 'wind' | 'harvest';

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
  exam: Exam | null;
  clans: Clan[];
  /** Kage atual (id) e os anteriores (para o Monte dos Kages). */
  kageId: number | null;
  kageHistory: { name: string; day: number }[];
  ceremony: { candidateId: number; timer: number } | null;
  /** Segundos até a próxima ameaça chefe e a que está a caminho. */
  bossTimer: number;
  pendingBoss: { kind: BossKind; x: number; y: number; t: number } | null;
  /** Dia a partir do qual um novo Exame Chunin pode ser convocado. */
  examNextDay: number;
  lastExam: ExamResult | null;
  projectiles: Projectile[];
  effects: Effect[];
  res: Record<ResKey, number>;
  /** Estoque de itens fabricados (id → quantidade). */
  items: Record<string, number>;
  nextId: number;
  timers: { animal: number; raid: number; birth: number; jobs: number; homes: number };
  flags: { starving: boolean; alert: boolean; raidActive: boolean; raidStole: boolean };
  stats: { kills: number; raidsRepelled: number; born: number; lost: number; missionsDone: number; bossesDefeated: number };
}

export interface ExamEntrant {
  id: number;
  name: string;
  village: boolean;
  wins: number;
  dmg: number;
  jutsus: number;
  out: boolean;
}

export interface Exam {
  phase: 'gather' | 'walk' | 'ready' | 'fight' | 'done';
  entrants: ExamEntrant[];
  /** Ids ainda vivos no chaveamento, em ordem. */
  bracket: number[];
  /** Vencedores da rodada atual. */
  next: number[];
  round: number;
  /** Índice do par atual dentro de `bracket` (0, 2, 4…). */
  match: number;
  timer: number;
}

export interface ExamResult {
  day: number;
  champion: string;
  ranking: { name: string; village: boolean; score: number; promoted: boolean }[];
}

export type Selection = { kind: 'unit' | 'building' | 'team'; id: number };
