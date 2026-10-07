// Todo o estado do jogo é dado puro (serializável em JSON).
import type { KageArtId } from '../data/kageArts';
import type { SanninPath } from '../data/sannin';
import type { DogBreed } from '../data/breeds';
import type { OrgMemberId } from '../data/org';
import type { BladeId, MistBlade } from '../data/blades';
import type { SoundId } from '../data/sound';
import type { OrgState } from './org';
import type { MarketGood } from '../data/specialize';
// Sistemas mutam o estado; render e UI apenas leem.
import type { AnimalType } from '../data/animals';
import type { RogueRole } from '../data/enemies';
import type { SiteKind } from '../data/sites';
import type { ContractKind, RegionAction } from '../data/region';
import type { SpecKind } from '../data/specs';
import type { Weather } from '../data/seasons';
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
/** Visual do Shunshin por vila/natureza; `flash` é o clarão amarelo do Hiraishin. */
export type FlickerStyle = 'leaf' | 'mist' | 'water' | 'sand' | 'smoke' | 'flash';
/** Ritmo do combate (menu): rápido = jutsu sai na hora; tático = selos antes, que um golpe interrompe. */
export type CombatPace = 'fast' | 'tactical';
export type NinjaOrder = 'auto' | 'train' | 'patrol' | 'scout';
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
  /** Contrato de invocação (sapo, serpente ou lesma). */
  contract?: ContractKind;
  /** Profissão (médico, espião, marionetista). */
  spec?: SpecKind;
  /** Técnica exclusiva do Kage (data/kageArts.ts). */
  kageArt?: KageArtId;
  /** Um dos Três Sannin (caminho do sapo, da serpente ou da lesma). */
  sannin?: SanninPath;
  /** Nomeado para a ANBU pelo Kage (game/anbu.ts): uniforme, máscara e furtividade. */
  anbu?: boolean;
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
  /** Recarga da invocação do contrato (ninjas da vila). */
  summonCd?: number;
  /** Fora do mapa numa expedição (id). Não age nem aparece até voltar. */
  away?: number;
  /** Guardião de um local especial (id do local): defende o lugar em vez de marchar. */
  guard?: number;
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
  /** Recargas do Shunshin, do Kawarimi e da arte do Kage. */
  flickerCd?: number;
  kawaCd?: number;
  artCd?: number;
  /** Fazendo os selos de um jutsu (ritmo tático): sai quando `t` zera; um golpe forte interrompe. */
  cast?: { id: string; targetId: number; t: number };
  /** Investida em andamento (Chidori, Passo de Sangue): corre até o alvo e golpeia ao chegar. */
  dash?: { targetId: number; t: number; power: number; nature: Nature | null; color: string; lx: number; ly: number; trail: number };
  /** Modo Sábio ativo (s restantes) e recarga da técnica lendária do Sannin. */
  sage?: number;
  sanninCd?: number;
  /** Cópia num mapa de missão: id do ninja original na vila (o resultado volta para ele). */
  origin?: number;
  /** Campo de Treino em que está treinando (ou indo treinar): ocupa uma vaga. */
  trainId?: number;
  /** Ninjas da vila que acertaram este inimigo (dividem o XP do abate). */
  hitBy?: number[];
  /** Membro da Ordem do Eclipse (técnica própria, arte própria). */
  org?: OrgMemberId;
  /** Raça do ninken (sem = shiba). */
  breed?: DogBreed;
  /** Marcado pela fórmula do Hiraishin (id do Kage) por `t` segundos. */
  mark?: { by: number; t: number };
  /** Espadachim da Névoa (carrega essa lâmina). */
  swordsman?: MistBlade;
  /** Lâmina lendária: `state.time` em que o efeito com recarga fica pronto de novo. */
  bladeAt?: number;
  /** ANBU: segundos até voltar a ficar invisível depois de atacar; recarga da guarda do Kage. */
  seenT?: number;
  guardCd?: number;
  /** Membro do Quinteto do Som; quem ele carrega (raptado); por quem está sendo carregado; gêmeos já separados. */
  sound?: SoundId;
  carrying?: number;
  captiveOf?: number;
  split?: boolean;
  /** Selo amaldiçoado: ninja da vila que não foi resgatado a tempo (luta pelo Som até ser derrotado e trazido de volta). */
  cursed?: boolean;
}

export type Command =
  | { kind: 'move'; x: number; y: number; time: number }
  | { kind: 'attack'; targetId: number }
  | { kind: 'retreat' }
  /** Ir até um local especial (ruínas, baú) e investigar por `t` segundos acumulados. */
  | { kind: 'investigate'; siteId: number; t: number };

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
  /** Campo de Treino: atributo de foco (treino +50% nele; sem foco próprio, o ninja treina este). */
  focus?: StatKey | null;
  /** Mercado: o que o comerciante vende do excedente do estoque (além do ryo de sempre). */
  sells?: MarketGood | null;
  /** Oficina com upgrade: quantos de cada item manter no estoque (fabrica sozinha). */
  keep?: Record<string, number>;
}

/** Expedição: equipe fora do mapa (mina e, depois, lugares da região). Ver game/expeditions.ts. */
export interface Expedition {
  id: number;
  kind: 'mine' | 'region';
  /** Região: lugar do mapa da região e o que a equipe foi fazer lá. */
  node?: string;
  action?: RegionAction;
  teamId: number;
  /** Quem foi (fica fora do mapa até voltar). */
  unitIds: number[];
  /** Mina: entrada de onde saiu. */
  siteId?: number;
  /** Andar atual (0 = a caminho). */
  floor: number;
  /** Segundos até o próximo passo. */
  timer: number;
  /** `scene`: a equipe está num mapa de missão jogável (state.scene) até ele terminar. */
  status: 'going' | 'explore' | 'choice' | 'return' | 'done' | 'lost' | 'scene';
  /** Diário (mais novo por último). */
  log: string[];
  /** O que já foi achado (só entra no estoque quando a equipe volta). */
  loot: Cost;
  day: number;
}

export interface SoundState {
  nextDay: number;
  /** Invasão em andamento: alvo, segundos desde a chegada, se já levaram alguém. */
  raid: { targetId: number; t: number; taken: boolean; /** Ninjas da vila mortos nesta invasão (até `SOUND.maxKills`). */ kills?: number } | null;
  /** Raptado esperando resgate no esconderijo (até o fim do dia `until`). */
  captive: { id: number; until: number } | null;
  /** Raptos impedidos e ninjas levados. */
  stopped: number;
  lost: number;
}

export interface SwordsmenState {
  /** Dia da próxima invasão (0 = ainda não agendada). */
  nextDay: number;
  /** Na invasão em andamento já caiu um espadachim (a espada dele ficou com a vila): os outros fogem na névoa. */
  taken: boolean;
  /** As sete espadas foram tomadas. */
  done: boolean;
}

/** Situação de um lugar do mapa da região (ver data/region.ts). */
export interface RegionState {
  /** Relação com o vilarejo (-100 inimigo … 100 aliado). */
  rel: number;
  status: 'neutral' | 'protected' | 'vassal' | 'hostile';
  /** Ilha já explorada / com posto avançado. */
  explored?: boolean;
  outpost?: boolean;
  /** Dia em que o vilarejo saqueado manda a vingança. */
  revengeDay?: number;
}

/** Local especial do mapa (ver data/sites.ts). */
export interface Site {
  id: number;
  kind: SiteKind;
  tx: number;
  ty: number;
  /** Já foi visto (saiu da névoa). */
  found: boolean;
  /** Já foi saqueado/investigado (ruína e baú somem do jogo depois disso; a mina fica). */
  done: boolean;
}

export interface ResourceNode {
  id: number;
  type: 'tree' | 'rock' | 'herb' | 'ore';
  /** Esgotado: segundos até voltar inteiro (árvore vira toco, rocha fica rachada). */
  regrow?: number;
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
  /** Kunai do Hiraishin: marca quem acertar com a fórmula do Kage (id). */
  mark?: number;
}

/** `harvest`: canteiro recém-colhido (terra à mostra que volta a brotar com o tempo; desenhado no chão). */
export type EffectKind =
  | 'text' | 'ring' | 'burst' | 'slash' | 'smoke' | 'bolt' | 'heal' | 'swirl' | 'chips' | 'wind' | 'harvest'
  /** Shunshin: redemoinho na saída e na chegada (`variant`); `afterimage`: vulto do ninja (`uid`) que se apaga. */
  | 'flicker' | 'afterimage'
  /** Kawarimi: o tronco que fica no lugar. `seal`: chakra juntando nas mãos durante os selos. */
  | 'log' | 'seal';

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
  variant?: FlickerStyle;
  uid?: number;
  facing?: number;
}

/** Nuvem de chuva cruzando o mapa (px de mundo). */
export interface Cloud {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
}

/** Mapa de missão jogável (vilarejo invadido, andar de mina…): o que é, objetivo e resultado. */
export interface SceneInfo {
  kind: 'village' | 'mine' | 'island' | 'trial' | 'hideout';
  /** Mina: andar, a descida (local) e o guardião do fundo. */
  floor?: number;
  stairsId?: number;
  bossId?: number;
  /** Expedição da vila que está aqui. */
  expId: number;
  node?: string;
  action?: RegionAction;
  title: string;
  goal: string;
  result: 'win' | 'lose' | 'retreat' | null;
  /** Armazém a saquear (raid) e líder a derrotar (anexar à força). */
  warehouseId?: number;
  leaderId?: number;
  /** Progresso do saque no armazém (s) e quanto precisa. */
  loot: number;
  lootNeed: number;
  defenders: number;
  entry: { x: number; y: number };
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
  /** Névoa: tiles já explorados, 1 bit por tile (32 por número). Ver game/explore.ts. */
  explored: number[];
  /** Locais especiais escondidos pelo mapa. */
  sites: Site[];
  /** Pergaminhos proibidos encontrados (ids de jutsu liberados para ensinar). */
  scrolls: string[];
  /** Expedições (em andamento e as últimas terminadas). */
  expeditions: Expedition[];
  /** Mapa da região: situação de cada vilarejo/ilha/lugar sagrado, e o último dia processado. */
  region: Record<string, RegionState>;
  regionDay: number;
  /** Fama da vila: honra (proteger, comerciar, anexar em paz) e infâmia (saquear, anexar à força). */
  honor: number;
  infamy: number;
  /** Clima do dia, felicidade (0–100), luto pelas mortes recentes e festival. */
  weather: Weather;
  happiness: number;
  grief: number;
  /** Último dia em que o clima foi sorteado. */
  moodDay: number;
  /** Dia do último festival e até quando ele dura (0 = nenhum). */
  festivalDay: number;
  festivalUntil: number;
  /** Ritmo do combate escolhido no menu. */
  pace: CombatPace;
  /** Neve acumulada no chão (0–1): sobe devagar enquanto neva e derrete devagar depois. */
  snow: number;
  /** Nuvens de chuva no mapa (só chove embaixo delas). */
  clouds: Cloud[];
  /** A Ordem do Eclipse: quem já caiu, próxima aparição, covil descoberto, destruída. */
  org: OrgState;
  /** Lâminas lendárias que a vila já conseguiu (nunca somem: quem cai com uma, ela volta ao estoque). */
  blades: BladeId[];
  /** Os Espadachins da Névoa: próxima invasão, espada já tomada nesta invasão, fim. */
  swordsmen: SwordsmenState;
  /** O Quinteto do Som: próxima invasão, a invasão em andamento, o raptado à espera de resgate e o placar. */
  sound: SoundState;
  /** Mapa de missão jogável em andamento (a equipe está lá; a vila continua andando). */
  scene?: GameState | null;
  /** Só nos mapas de missão: o que é e como termina. */
  sceneInfo?: SceneInfo;
  /** De que lado as torres e a Residência atiram (num mapa de missão as torres são do inimigo). */
  towersFaction?: Faction;
  res: Record<ResKey, number>;
  /** Estoque de itens fabricados (id → quantidade). */
  items: Record<string, number>;
  nextId: number;
  timers: { animal: number; raid: number; birth: number; jobs: number; homes: number };
  flags: { starving: boolean; alert: boolean; raidActive: boolean; raidStole: boolean; /** Distribui equipamento sozinho. */ autoGear?: boolean; /** Genins se abrigam de inimigos fortes demais. */ shelterRookies?: boolean; /** Academia ensina sozinha. */ autoTeach?: boolean; /** Equipes sem sensei recebem um. */ autoSensei?: boolean };
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

export type Selection = { kind: 'unit' | 'building' | 'team' | 'site'; id: number };
