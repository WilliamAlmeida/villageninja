import type { CropId } from '../data/crops';
// Todo o estado do jogo é dado puro (serializável em JSON).
import type { ModeKind } from '../data/bijuu';
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
import type { Vfx } from '../data/vfx';
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
export type FlickerStyle = 'leaf' | 'mist' | 'water' | 'sand' | 'smoke' | 'flash' | 'fire' | 'spark' | 'wind';
/** Ritmo do combate (menu): rápido = jutsu sai na hora; tático = selos antes, que um golpe interrompe. */
export type CombatPace = 'fast' | 'tactical';
export type NinjaOrder = 'auto' | 'train' | 'patrol' | 'scout';
/** `jet` jato d'água, `shard` gelo, `needle` agulha, `arrow` flecha (desenho em render/sprites.ts). */
export type ProjectileKind = 'orb' | 'dragon' | 'blade' | 'rock' | 'spark' | 'kunai' | 'jet' | 'shard' | 'needle' | 'arrow' | 'spinner' | 'housenka' | 'goukakyuu' | 'mizurappa' | 'suiryuudan';

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
  /** Kekkei genkai despertada (natureza combinada ou dōjutsu). */
  kekkei: KekkeiId | null;
  /** Sharingan: a cópia guardada (um jutsu de rank baixo visto em combate; aprende sem pergaminho nem a natureza). */
  seen?: string[];
  /** Contrato de invocação (sapo, serpente ou lesma). */
  contract?: ContractKind;
  /** Profissão (médico, espião, marionetista). */
  spec?: SpecKind;
  /** Técnica exclusiva do Kage (data/kageArts.ts). */
  kageArt?: KageArtId;
  /** Um dos Três Sannin (caminho do sapo, da serpente ou da lesma). */
  sannin?: SanninPath;
  /** Jinchuuriki: as caudas da fera selada nele (data/bijuu.ts). */
  bijuu?: number;
  /** Nomeado para a ANBU pelo Kage (game/anbu.ts): uniforme, máscara e furtividade. */
  anbu?: boolean;
  /** Animal da máscara da ANBU (escolhido ao nomear; sem = o do melhor atributo, saves antigos). */
  mask?: string;
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
  /** Quantos consumíveis carrega (até `CARRY` da patente); sem = 1 quando `itemReady`. */
  itemCount?: number;
  /** Durabilidade da arma e do colete equipados, de 1 (nova) a 0 (quebrada); sem = nova (game/wear.ts). */
  dura?: { weapon?: number; armor?: number };
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
  /** Tile de aterrar/cavar em que o morador está trabalhando (game/earthworks.ts). */
  earth?: { tx: number; ty: number };
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
  /** O que o `anim` está mostrando (só desenho: escolhe a pose do ninja em camadas): golpe de mão, arremesso, jutsu solto. */
  animKind?: 'strike' | 'throw' | 'cast' | 'release' | 'impact' | 'moves' | 'seals';
  /** Jutsu cuja coreografia (`JutsuDef.moves`) o `anim` está tocando (animKind 'moves'). */
  moveJutsu?: string;
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
  /** Segundos desde que foi empurrado por um golpe (conta para baixo; ring-out no Exame). */
  knockT?: number;
  /** Sentado na arquibancada do prédio de id (Exame Chunin): fica no lugar e é desenhado por cima do fundo da arena. */
  perch?: number;
  /** Acabou de pousar (Shunshin): tempo do "esmaga e estica" da aterrissagem. Só desenho. */
  landT?: number;
  /** Golpe corpo a corpo a caminho: o dano entra no auge do avanço do sprite (`resolveStrike`); dura até o avanço acabar. */
  strike?: { id: number; t: number; hit?: boolean };
  /** Tática da equipe copiada para o membro (teamSystem) e o ponto de "segurar posição". */
  tactic?: 'focus' | 'hold' | 'flank';
  anchor?: { x: number; y: number };
  /** Visual de quem está atordoado/preso e de quem está com escudo (data/vfx.ts). Só desenho. */
  stunVfx?: Vfx;
  shieldVfx?: Vfx;
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
  /** Fazendeiro de um campo cercado (id do campo; o canteiro da tarefa vai em `taskId`). */
  fieldId?: number;
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
  /** Selos em andamento: jutsu, alvo, segundos que faltam e o total (o desenho mostra os selos pelo andamento). */
  cast?: { id: string; targetId: number; t: number; total?: number };
  /** Atendimento próximo; campos opcionais permitem retomar saves sem migração. */
  healing?: { targetId: number; slot: number; stage: 'approach' | 'treat' | 'ending'; t: number; total: number; given: number; command: string; patientCommand: string; hp: number; patientHp: number; x: number; y: number; patientX: number; patientY: number };
  treatedBy?: number;
  healRetry?: number;
  cloneIntro?: number;
  edoIntro?: { elapsed: number; x: number; y: number; exitX: number; exitY: number };
  /** Sequência serializável dos cinco socos do Sekizō. */
  barrage?: { targetId: number; elapsed: number; next: number; power: number; angle?: number; distance?: number };
  /** Investida em andamento (Chidori, Passo de Sangue): corre até o alvo e golpeia ao chegar. */
  dash?: { /** Jutsu da investida (coreografia ao chegar). */ id?: string; targetId: number; t: number; power: number; nature: Nature | null; color: string; lx: number; ly: number; trail: number; vfx?: Vfx; /** Dono que iniciou o Gatsūga conjunto do ninken. */ partnerOf?: number };
  /** Modo Sábio ativo (s restantes) e recarga da técnica lendária do Sannin. */
  sage?: number;
  sanninCd?: number;
  /** Modo de combate ativo (manto da fera, Oito Portões, manto de Raiton; game/modes.ts): segundos, caudas do manto,
   *  descontrolado (as ondas pegam aliados) e a próxima onda de chakra. */
  mode?: { kind: ModeKind; t: number; tails?: number; wild?: boolean; blast?: number };
  /** Recarga do manto da fera do Jinchuuriki. */
  modeCd?: number;
  /** Chamas negras (Amaterasu): queimam `dps` por segundo até apagar; `src` = quem acendeu (fica com o abate). */
  burn?: { t: number; dps: number; src: number; acc?: number };
  /** Sharingan: jutsu que acabou de ver um inimigo usar e pode devolver uma vez (s restantes; game/dojutsu.ts). */
  mirror?: { id: string; t: number };
  /** Dōjutsu aceso (os olhos brilham em combate; o nome aparece ao acender). */
  eyeOn?: boolean;
  /** Shintenshin: a mente de `by` controla esta unidade por `t` s (luta pelo lado dele; `faction` = a original). */
  charm?: { t: number; faction: Faction; by: number };
  /** Ameaça escalada pela força da vila (systems/spawner.ts → scaleThreat): multiplica o dano que causa. */
  powerMult?: number;
  /** Sensei de equipe: a capa nas costas na cor da equipe (só desenho; `markSenseis` em teams.ts). */
  cape?: string;
  /** Voltou de expedição com espólio: anda carregando um saco por estes segundos (só desenho, pose `carry`). */
  carrySack?: number;
  /** Segurando um jutsu (a sombra do Kage Mane, a mente no Shintenshin): fica parado estes segundos. */
  channel?: number;
  /** Edo Tensei: ninja caído trazido de volta por um tempo (`life`, dono em `ownerId`); some sem contar como perda. */
  edo?: boolean;
  /** Id usado para o penteado do boneco (o Edo Tensei volta com o cabelo do ninja original). */
  lookId?: number;
  /** Fera Colossal: quantas caudas (qual Bijuu, data/bijuu.ts). */
  bijuu?: number;
  /** Cópia num mapa de missão: id do ninja original na vila (o resultado volta para ele). */
  origin?: number;
  /** Campo de Treino em que está treinando (ou indo treinar): ocupa uma vaga. */
  trainId?: number;
  /** Treino em andamento (só para a animação): o atributo que está subindo e a volta da corrida (centro, ângulo e raio; raio 0 = sem espaço). */
  trainStat?: StatKey;
  trainLap?: { cx: number; cy: number; a: number; r: number };
  /** Boneco do campo que está golpeando (índice dos pontos `postN`) e a perna da volta de corrida pelos bonecos. */
  trainPost?: number;
  /** Vigia de torre: id da Torre de Vigia que ele guarda (game/towerWatch.ts). */
  onTower?: number;
  /** Só desenho (cópia projetada no renderer): multiplica o tamanho do sprite (vigia da torre a 70%). */
  drawScale?: number;
  trainLeg?: number;
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
  /** Tática de luta (game/tactics.ts); sem = livre (duelos). `anchor`: ponto de "segurar posição". */
  tactic?: 'focus' | 'hold' | 'flank';
  anchor?: { x: number; y: number };
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
  /** Prédio de margem espelhado (troca x por y no terreno e espelha a arte): a água fica do outro lado. */
  flip?: boolean;
  /** Upgrade em obra: segundos trabalhados (null = nenhum). O prédio continua funcionando. */
  upgrade?: number | null;
  /** Upgrade pronto esperando espaço para o terreno maior do nível novo (o aviso sai uma vez só). */
  waitRoom?: boolean;
  /** Torre de Vigia: o ninja mandado para vigiar (game/towerWatch.ts; o dele é `Unit.onTower`). */
  guardId?: number;
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
  /** `colony`: moradores e ninjas indo morar numa colônia (game/colonies.ts). */
  kind: 'mine' | 'region' | 'colony';
  /** Região: lugar do mapa da região e o que a equipe foi fazer lá. */
  node?: string;
  action?: RegionAction;
  teamId: number;
  /** Quem foi (fica fora do mapa até voltar). */
  unitIds: number[];
  /** Colônia: quem viaja de mudança (saiu da lista da vila; entra na da colônia ao chegar). */
  passengers?: Unit[];
  /** Colônia: a mudança é da colônia de volta para a vila (sem = da vila para a colônia). */
  toHome?: boolean;
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
  /** Região: como acabou o serviço (só para o desenho da volta no mapa: carroça cheia, vazia ou sem carroça). Saves
   *  antigos não têm: vale o saque. */
  outcome?: 'win' | 'lose' | 'retreat';
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
  /** As sete espadas foram tomadas (eles continuam vindo, atrás delas). */
  done: boolean;
  /** Invasões feitas (a Ordem do Eclipse só aparece depois da primeira, como na história). */
  raids?: number;
}

/** Situação de um lugar do mapa da região (ver data/region.ts). */
export interface RegionState {
  /** Relação com o vilarejo (-100 inimigo … 100 aliado). */
  rel: number;
  status: 'neutral' | 'protected' | 'vassal' | 'hostile';
  /** Ilha já explorada / com posto avançado. */
  explored?: boolean;
  outpost?: boolean;
  /** Ilha com colônia fundada (o mapa dela fica em `state.colonies[id]`). */
  colony?: boolean;
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
  /** Já foi saqueado/investigado (ruína, baú) ou esgotado (mina): some do mapa e reaparece noutro lugar (`siteTick`). */
  done: boolean;
  /** Mina: expedições que ainda aguenta (sem = `MINE_USES`). */
  uses?: number;
  /** Segundos até reaparecer noutro lugar (contando desde que ficou `done`). */
  respawn?: number;
}

/** Obra no terreno marcada pelo jogador: aterrar (água → terra) ou cavar (terra → água). */
export interface Earthwork {
  tx: number;
  ty: number;
  op: 'fill' | 'dig';
}

export interface ResourceNode {
  id: number;
  type: 'tree' | 'rock' | 'herb' | 'ore';
  /** Esgotado: segundos até voltar inteiro (árvore vira toco, rocha fica rachada). */
  regrow?: number;
  /** Marcado para limpar (modo "Limpar área"): um morador sem obra vem arrancar (game/clearing.ts). */
  clear?: boolean;
  /** Arrancado: some do mapa (sem desenho nem colisão) até a rebrota longa. */
  cleared?: boolean;
  /** Pegando fogo (jutsu de fogo na luta, game/battleScars.ts): segundos que ainda queima. */
  burn?: number;
  missionId?: number;
  tx: number;
  ty: number;
  amount: number;
  max: number;
  variant: number;
}

/** Trajetória serializável do dragão: origem, controles da curva e tempo do voo. */
export interface DragonFlight {
  sx: number; sy: number;
  c1x: number; c1y: number;
  c2x: number; c2y: number;
  tx: number; ty: number;
  elapsed: number; duration: number; lift: number;
  /** Altura em que o corpo sai da fonte (sem: DRAGON_SOURCE_HEIGHT). */
  z0?: number;
}

/** Formação e trajetória das técnicas de água, tempestade e calor; estado transitório. */
export interface NatureFlight {
  elapsed: number; delay: number; duration: number;
  sx: number; sy: number; tx: number; ty: number;
  bend: number; index: number; count: number; targetId: number;
  launched: boolean; range: number;
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
  /** Estilo visual do rastro e do impacto (data/vfx.ts). */
  vfx?: Vfx;
  /** Jutsu que soltou: sprite e partículas próprias dele (data/jutsu-fx.json). */
  fx?: string;
  /** Suiryuudan modular: simulação e desenho compartilham esta curva. */
  dragon?: DragonFlight;
  /** Origem fixa de um canhão de ar do Sekizō. */
  cannon?: { sx: number; sy: number; index: number };
  natureFlight?: NatureFlight;
}

/** `harvest`: canteiro recém-colhido (terra à mostra que volta a brotar com o tempo; desenhado no chão). */
export type EffectKind =
  | 'text' | 'ring' | 'burst' | 'slash' | 'smoke' | 'bolt' | 'heal' | 'swirl' | 'chips' | 'wind' | 'harvest'
  /** Shunshin: redemoinho na saída e na chegada (`variant`); `afterimage`: vulto do ninja (`uid`) que se apaga. */
  | 'flicker' | 'afterimage'
  /** Kawarimi: o tronco que fica no lugar. `seal`: chakra juntando nas mãos durante os selos. */
  | 'log' | 'seal'
  /** Baú aberto: clarão dourado subindo, moedas pulando e confete (render/particles.ts). */
  | 'treasure'
  /** `hit`: impacto de golpe corpo a corpo; `beam`: feixe de x,y até x2,y2 (cura, dreno); `wave`: ondas que se
   *  abrem (som, miragem, repulsão; `vfx`); `gust`: rajada em leque do lançador até o alvo. */
  | 'hit' | 'beam' | 'wave' | 'gust'
  /** `tether`: sombra no chão de `uid` até `tid` (Kage Mane); `thunder`: raio caindo do céu no ponto (Kirin). */
  | 'tether' | 'thunder'
  /** `wall`: muralha do Doryuuheki parada no chão (`facing` = para onde foi levantada, `uid` = dono; game/walls.ts).
   *  `bones`: ossos brotando do chão em volta do ponto (Sawarabi no Mai, raio `r`). */
  | 'wall' | 'bones'
  /** Marca temporária de impacto no chão, desenhada antes das unidades. */
  | 'crater'
  /** Cabeça/fonte fixa e temporária de um disparo de jutsu. */
  | 'jutsuOrigin'
  /** Canhão de ar após o contato: conserva a direção do soco por um instante. */
  | 'pressure'
  /** Momento especial (Kage, Sannin, chefe, proibido): câmera lenta curta, fundo escuro e o nome no centro (main.ts). */
  | 'moment';

export interface Effect {
  /** Curva residual do Reiza após o contato, sem novo dano. */
  natureFlight?: NatureFlight;
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
  /** Texto auxiliar: tamanho e altura em pixels de cena, após a projeção. */
  fontSize?: number;
  textDy?: number;
  followId?: number;
  variant?: FlickerStyle;
  uid?: number;
  /** Segundo envolvido que o efeito segue (`tether`: a sombra vai de `uid` até `tid`). */
  tid?: number;
  facing?: number;
  /** Estilo das partículas (data/vfx.ts); sem: adivinhado pela cor. */
  vfx?: Vfx;
  /** Jutsu de onde veio: a exceção de partículas dele (data/jutsu-fx.json). */
  fx?: string;
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
  /** Tema do mapa (game/scene.ts): pescadores (mar, palafitas, barcos), mercadores (deserto) ou o platô de penhasco da prova. */
  theme?: SceneTheme;
}

export type SceneTheme = 'fishing' | 'desert' | 'cliff';

/** Colônia numa ilha (game/colonies.ts): o estado dela é um `GameState` dentro de `state.colonies` da vila. */
export interface ColonyInfo {
  /** Ilha do mapa da região (data/region.ts). */
  node: string;
  theme?: SceneTheme;
  /** Dia em que foi fundada. */
  founded: number;
  /** Último dia já contado no resumo fora da tela (produção creditada, obras avançadas). */
  day: number;
  /** Diário curto (mais novo por último): produção, ameaças, chegadas. */
  log: string[];
}

/** Ninja caído, para a Pedra Memorial e o Edo Tensei. */
export interface Fallen {
  id: number;
  name: string;
  rank: Rank;
  level: number;
  day: number;
  nature: Nature;
  stats: Stats;
  jutsu: [string | null, string | null];
  look: Unit['look'];
}

export interface GameState {
  version: number;
  seed: number;
  /** Nível da vila (0 = Aldeia). Ver data/villageLevels.ts. */
  level: number;
  time: number;
  day: number;
  speed: number;
  /** Tamanho do mapa em tiles (vila 102×68, mapas de missão 72×48; `tiles` tem mapW×mapH). */
  mapW: number;
  mapH: number;
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
  /** Bestas com cauda vencidas e seladas num jarro, esperando um Jinchuuriki (caudas de cada uma). */
  bijuu: { jar: number[] };
  /** Ruas calçadas: 1 bit por tile, como `explored` (game/roads.ts). */
  roads: number[];
  /** Tiles marcados para aterrar/cavar (game/earthworks.ts), esperando um morador. */
  earthworks?: Earthwork[];
  /** Ninjas da vila que caíram (mais recentes primeiro): Pedra Memorial e Edo Tensei (game/memorial.ts). */
  fallen: Fallen[];
  pendingBoss: { kind: BossKind; x: number; y: number; t: number } | null;
  /** Dia a partir do qual um novo Exame Chunin pode ser convocado. */
  examNextDay: number;
  lastExam: ExamResult | null;
  /** Último duelo por retrato (save v47; sem = nunca duelou). */
  lastDuel?: DuelResult | null;
  projectiles: Projectile[];
  effects: Effect[];
  /** Névoa: tiles já explorados, 1 bit por tile (32 por número). Ver game/explore.ts. */
  explored: number[];
  /** Locais especiais escondidos pelo mapa. */
  sites: Site[];
  /** Pergaminhos proibidos encontrados (ids de jutsu liberados para ensinar). */
  scrolls: string[];
  /** Pergaminhos abertos na Biblioteca: jutsus rank C+ liberados para estudo (game/library.ts). */
  jutsuOpen: string[];
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
  /** Campos cercados (game/fields.ts; save v49: substituem a Fazenda e a Horta de Ervas). */
  fields: Field[];
  /** Colônias nas ilhas (id da ilha → mapa dela), só na vila (save v48). */
  colonies: Record<string, GameState>;
  /** Só no mapa de uma colônia: de que ilha é e o que já foi contado. */
  colony?: ColonyInfo;
  res: Record<ResKey, number>;
  /** Estoque de itens fabricados (id → quantidade). */
  items: Record<string, number>;
  /** Peças gastas fora de um ninja (tiradas antes do conserto): durabilidade de cada uma, por item (game/wear.ts). */
  worn?: Record<string, number[]>;
  /** Consumíveis gastos nos últimos 7 dias (`days[0]` = o dia `day`), para o painel das oficinas. */
  usage?: { day: number; days: Record<string, number>[] };
  nextId: number;
  timers: { animal: number; raid: number; birth: number; jobs: number; homes: number };
  flags: { starving: boolean; alert: boolean; raidActive: boolean; raidStole: boolean; /** Distribui equipamento sozinho. */ autoGear?: boolean; /** Genins se abrigam de inimigos fortes demais. */ shelterRookies?: boolean; /** Academia ensina sozinha. */ autoTeach?: boolean; /** Equipes sem sensei recebem um. */ autoSensei?: boolean; /** Afastamento leve entre aliados lutando (padrão sim). */ spread?: boolean; /** Vagas do Exame Chunin (4 ou 8; padrão 8). */ examSize?: number; /** Forja nv 2+ conserta sozinha (padrão sim). */ autoRepair?: boolean; /** Ninja escolhido para os duelos por retrato (id). */ duelistId?: number };
  stats: { kills: number; raidsRepelled: number; born: number; lost: number; missionsDone: number; bossesDefeated: number; /** Duelos por retrato (save v47). */ duelsWon: number; duelsLost: number };
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
  /** `bow` (só no duelo): depois da luta os dois voltam ao seu canto e se cumprimentam com o selo. */
  phase: 'gather' | 'walk' | 'ready' | 'fight' | 'bow' | 'done';
  entrants: ExamEntrant[];
  /** Ids ainda vivos no chaveamento, em ordem. */
  bracket: number[];
  /** Vencedores da rodada atual. */
  next: number[];
  round: number;
  /** Índice do par atual dentro de `bracket` (0, 2, 4…). */
  match: number;
  timer: number;
  /** Duelo por retrato (game/duel.ts): um só par, sem promoção, sem cooldown do Exame. */
  duel?: boolean;
  /** Só assistem da arquibancada (equipe do campeão no duelo); não entram no chaveamento. */
  watchers?: number[];
}

/** Último duelo por retrato na arena. */
export interface DuelResult {
  day: number;
  /** Nome do ninja da vila e do retrato enfrentado. */
  mine: string;
  foe: string;
  won: boolean;
}

export interface ExamResult {
  day: number;
  champion: string;
  ranking: { name: string; village: boolean; score: number; promoted: boolean }[];
}

export type Selection = { kind: 'unit' | 'building' | 'team' | 'site' | 'field'; id: number };

/** Canteiro (um tile) de um campo cercado (game/fields.ts). `st`: 0 terra crua, 1 arada, 2 plantada, 3 madura. */
export interface Plot {
  tx: number;
  ty: number;
  st: 0 | 1 | 2 | 3;
  /** Cultura plantada (a do cercado no momento da semeadura). */
  crop?: CropId;
  /** Crescimento 0..1 (plantada) e segundos madura (murcha depois de `FIELD.witherDays`). */
  g: number;
  ripe?: number;
  /** Segundos de umidade que restam (rega, chuva, água vizinha). */
  wet?: number;
  /** Fertilidade 0..1 (cansa repetindo a cultura) e a última colhida. */
  fert: number;
  last?: CropId;
}

/** Campo cercado de formato livre: os canteiros ligados (vizinhos) formam um cercado, com uma cultura só. */
export interface Field {
  id: number;
  crop: CropId;
  plots: Plot[];
  /** Fazendeiros pedidos e os que estão nele (ids). */
  desired: number;
  workers: number[];
}
