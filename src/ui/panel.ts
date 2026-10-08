// Painel lateral de detalhes. Estrutura HTML só é recriada quando muda;
// valores dinâmicos (barras, números) são atualizados in-place via data-t / data-b.
import type { App } from '../app';
import { ANIMALS } from '../data/animals';
import { BUILDINGS } from '../data/buildings';
import { ROGUE_ROLES } from '../data/enemies';
import { MINE_USES, SITES } from '../data/sites';
import { GOLD_PRICE, MINE } from '../data/expeditions';
import { ACTION_LABEL, ACTION_TIME, HOME_POS, REGION, REGION_NODES, REL, type RegionAction, type RegionNodeDef } from '../data/region';
import { CONTRACTS } from '../data/contracts';
import { SPECS, type SpecKind } from '../data/specs';
import { FESTIVAL, MOOD, SEASONS, WEATHERS } from '../data/seasons';
import { daysToNextSeason, festivalBlock, festivalOn, holdFestival, moodFactors, seasonOf } from '../game/mood';
import { learnSpec, specBlock } from '../game/specs';
import { adoptDog, breedBlock, dogBlock, dogCap, dogOf, DOG_COST, freeDogs, giveDog, releaseDog, villageDogs } from '../game/ninken';
import { BREED_LIST, BREEDS, breedArt, type DogBreed } from '../data/breeds';
import { artUrl } from '../render/art';
import { searchTiles } from '../game/systems/villagers';
import { TILE } from '../config';
import { doorPos, tileCenter } from '../game/world';
import { plainTokens } from '../core/tokens';
import { actionBlock, actionCost, COVERT, covertBlock, nodeActions, nodePower, regionOf, startCovert, startRegion } from '../game/region';
import regionMap from '../art/region.jpg';
import { RES_INFO, RES_KEYS, type ResKey } from '../data/resources';
import { activeExpeditions, chooseExpedition, expeditionUnits, floorPower, mineBlock, startMine, teamBusy, teamMinePower } from '../game/expeditions';
import { guardiansOf, mineUses, missingScrolls, sitePos } from '../game/explore';
import { JUTSU_TYPE_LABEL, JUTSUS, jutsuChakra, jutsuCooldown } from '../data/jutsus';
import { NATURES } from '../data/natures';
import { ROLE_INFO, roleOf, setTeamTactic, TACTIC_INFO, type Role, type Tactic } from '../game/tactics';
import { isOpen, LIBRARY, LIBRARY_JUTSUS, libraryLevel, openBlock, openScroll, scrollCost, studyable } from '../game/library';
import { JUTSU_RANK_LABEL, RANKS, STAT_INFO, STAT_KEYS, xpToNext, type StatKey } from '../data/ninja';
import {
  costLabel, demolish, jutsuOptions, promote, recruitNinja, RECRUIT_COST, setDesiredWorkers, setFocus, setOrder, teachJutsu,
  type Result,
} from '../game/commands';
import { nextRank } from '../game/progression';
import { nextLevelStatus, upgradeVillage } from '../game/village';
import {
  abandonMission, acceptMission, autoAssign, freeTeams, MISSION_TIME, maxActiveMissions, missionOfTeam, missionPower, missionReward, missionRisk,
  recommendTeam, teamPower, teamsForMission, templateOf, type MissionRisk,
} from '../game/missions';
import { artPortrait, bladeIcon, kagePortrait, swordsmanPortrait, unitPortrait } from '../render/sprites';
import { ART, CARDS, ICONS } from './pxicons';
import missionScrollUrl from '../art/ui-scroll.png';
import { missionFocus } from '../game/missionView';
import { currentKage, electionStatus, electKage, KAGE_COST, KAGE_MIN_LEVEL } from '../game/kage';
import { KAGE_ARTS } from '../data/kageArts';
import { ORG, ORG_LAIR, ORG_MEMBERS, ORG_PAIRS } from '../data/org';
import { lairGuards, nextPair, prepareDefense } from '../game/org';
import { SANNIN, SANNIN_PATHS, type SanninPath } from '../data/sannin';
import { nameSannin, sanninBlock, sanninCandidates, sanninOf, sannins, statCapOf } from '../game/sannin';
import { AUTO_CRAFT_LEVEL, buyRare, canAutoCraft, hireBlock, hireMercenary, maxLearners, MERCS, RARE_PRICE, setKeep, teachAll } from '../game/automation';
import { CARE, catchingUp, isRookie } from '../game/care';
import { marketLot, setFieldFocus, setMarketGood, trainees, trainSlots } from '../game/specialize';
import { FIELD_FOCUS_BONUS, MARKET_GOOD_LIST, MARKET_GOODS, type MarketGood } from '../data/specialize';
import { flickerCooldown, flickerStyle, isShinobi, KAWARIMI, kawarimiChance, SHUNSHIN } from '../game/techniques';
import { AWAKEN_COST, awakenKekkei, awakenOptions, canFoundClan, clanMembers, clanOf, FOUND_COST, FOUND_MIN_LEVEL, foundClan, surname } from '../game/clans';
import { KEKKEI, KEKKEI_LIST, type KekkeiId } from '../data/kekkei';
import { arenaSpots, EXAM_MIN_LEVEL, examLabel, examSize, examStatus, setExamSize, startExam } from '../game/exam';
import { MISSION_RANKS, MISSION_TYPE_LABEL } from '../data/missions';
import { ITEM_LIST, ITEMS, SLOT_LABEL, type ItemSlot } from '../data/items';
import { autoEquip, cancelCraft, craftBlock, enqueueCraft, equip, gearBonus, isWorkshop, recipesOf, stock, unequip, autoEquipAll, setAutoGear } from '../game/gear';
import { bladeOf, canWield } from '../game/blades';
import { ANBU, anbuBlock, anbuCandidates, anbus, anbuSlots, appointAnbu, dismissAnbu, freeMask, maskInfo, maskOf } from '../game/anbu';
import { MASK_LIST } from '../data/anbu';
import { BLADE_IDS, BLADES, MIST_BLADES } from '../data/blades';
import { SWORDSMEN, SWORDSMEN_ORG } from '../data/swordsmen';
import { SOUND, SOUND_MEMBERS } from '../data/sound';
import { WITH_SOUND } from '../game/sound';
import { levelDef, MAX_VILLAGE_LEVEL } from '../data/villageLevels';
import {
  attackersOf, autoTeams, availableFighters, clearCommand, commandLabel, isAttackable, nearestFighters, orderAttack, createTeam, createTeamWith, disbandTeam, joinAsMember, joinAsSensei, leaveTeam, MAX_MEMBERS, orderRetreat,
  setTeamOrder, teamFit, teamOf, teamUnits,
} from '../game/teams';
import type { Building, Expedition, Mission, NinjaOrder, Site, Team, Unit } from '../game/types';
import { occupantsOf } from '../game/interior';
import { isNight } from '../game/time';
import { drawInterior } from '../render/interior';
import { esc, el, sideBySide } from './dom';
import { MAX_BUILDING_LEVEL, UPGRADES } from '../data/upgrades';
import { craftMult, housingOf, levelOf, queueMax, startUpgrade, upgradeStatus, upgradeTime, workersOf } from '../game/upgrade';
import { atlasCell, rich } from './icons';
import { GLYPHS } from './glyphs';
import { morph } from './morph';
import { blocked, blockedClick, tipAttr } from './popup';
import { JOB_LABEL, STATE_LABEL } from './labels';

type UnitTab = 'info' | 'cmd' | 'gear';

export type View =
  | { kind: 'unit'; id: number; teach?: boolean }
  | { kind: 'village' }
  | { kind: 'kage' }
  | { kind: 'bingo' }
  | { kind: 'stats' }
  | { kind: 'missions' }
  | { kind: 'group' }
  | { kind: 'building'; id: number }
  | { kind: 'team'; id: number }
  | { kind: 'roster' }
  | { kind: 'teams' }
  | { kind: 'clans' }
  | { kind: 'site'; id: number }
  | { kind: 'expeditions' }
  | { kind: 'region' }
  | { kind: 'crafts' };

/** Para onde o botão "Voltar" do ninja leva (tela da janela de onde ele foi aberto). */
const BACK_LABEL: Partial<Record<View['kind'], string>> = {
  roster: 'a lista de ninjas', teams: 'as equipes', team: 'a equipe', clans: 'os clãs', missions: 'as missões', region: 'a região', expeditions: 'as expedições', village: 'a vila', kage: 'o Kage', bingo: 'o Bingo Book', crafts: 'as oficinas',
};

interface Built {
  html: string;
  t: Record<string, string>;
  b: Record<string, number>;
}

/** Abas da janela central: cada grupo de telas de gestão. */
const WINDOW_TABS: Record<string, [View['kind'], string][]> = {
  ninjas: [['roster', '{ninja} Ninjas'], ['teams', '{users} Equipes'], ['clans', '{castle} Clãs']],
  village: [['village', '{home} Vila'], ['kage', '{kage} Kage'], ['bingo', '{skull} Bingo Book'], ['stats', '{chart} Estatísticas']],
  world: [['region', '{map} Região'], ['expeditions', '{pickaxe} Expedições']],
};
const GROUP_TITLE: Record<string, string> = { ninjas: '{ninja} Ninjas', village: '{castle} Vila', world: '{map} Mundo' };
const TAB_GROUP: Partial<Record<View['kind'], string>> = { roster: 'ninjas', teams: 'ninjas', clans: 'ninjas', team: 'ninjas', village: 'village', kage: 'village', bingo: 'village', stats: 'village', expeditions: 'world', region: 'world' };

type BuildingTab = 'main' | 'inside';

/** Recurso que cada prédio de coleta procura. */
const GATHER_NODE: Partial<Record<Building['type'], 'tree' | 'rock' | 'ore'>> = { lumber: 'tree', quarry: 'rock', ironmine: 'ore' };

/** O que cada ação da região faz (dica dos botões). */
const ACTION_TIP: Record<RegionAction, string> = {
  rescue: 'Vira um mapa jogável: a equipe entra no esconderijo, derrota os guardiões e o líder e traz o raptado de volta. Corra: passado o prazo ele recebe o selo amaldiçoado.',
  covert: 'Os ANBU livres se infiltram e trazem metade do que um saque traria, sem infâmia e sem estragar a relação — se não forem descobertos.',
  trade: 'Caravana de troca: paga na hora e volta com a mercadoria (honra dá bônus). Melhora a relação.',
  protect: 'A equipe defende o vilarejo de bandidos. Relação +20 e honra; com relação 60+ ele vira protegido e paga tributo todo dia.',
  raid: 'Vira uma invasão jogável: sua equipe entra no mapa do vilarejo e você comanda a luta (aparece "Ver invasão" no alto). Saqueie o armazém ou derrote os guardas. Relação despenca e eles mandam uma vingança.',
  annex: 'Com relação 90+ ele se une em paz. Com relação -60 ou menos, só à força: vira uma invasão jogável e é preciso derrotar o chefe deles. Vassalo paga tributo dobrado e manda moradores.',
  explore: 'Vira uma exploração jogável: a equipe desembarca na ilha, enfrenta os bichos e recolhe as amostras (baús). Libera o posto avançado.',
  outpost: 'Monta um posto que produz recursos da ilha todo dia.',
  train: 'Os monges treinam a equipe: muito XP e atributos.',
  contract: 'Vira uma prova jogável: vença o guardião (o animal do contrato, enorme). O ninja mais forte da equipe sem contrato aprende a invocar.',
  assault: 'A invasão final: a equipe entra no covil (mapa jogável) e enfrenta os guardiões e o líder da Ordem do Eclipse. Vencendo, a Ordem acaba.',
};

type MissionTab = 'active' | 'offered' | 'recent';
/** Janela larga o bastante para os contratos ativos numa coluna ao lado das missões. */
const WIDE_BOARD = '(min-width: 1000px) and (min-height: 521px)';
/**
 * Imagem com esqueleto: sem URL ainda (retrato sendo gerado) ou enquanto o arquivo carrega, mostra um bloco animado
 * no lugar; decodifica fora da thread principal e só carrega quando aparece na tela.
 */
const pimg = (url: string | null | undefined, cls = '') =>
  url
    ? `<img class="${cls} pim" src="${url}" alt="" draggable="false" decoding="async" loading="lazy" onload="this.classList.add('ok')">`
    : `<span class="${cls} skel"></span>`;
/** Ícone de um requisito de nível da vila (prédio pelo nome; senão pelo assunto). */
function reqIcon(label: string): string {
  // lista uniforme: só glifos lisos (prédio sem glifo próprio usa o genérico)
  const b = Object.values(BUILDINGS).find((d) => d.name === label);
  if (b) return GLYPHS[b.icon.slice(1, -1)] ? b.icon : '{houses}';
  const l = label.toLowerCase();
  if (l.includes('popula')) return '{users}';
  if (l.includes('ninja')) return '{ninja}';
  if (l.includes('chunin') || l.includes('jounin')) return '{medal}';
  if (l.includes('invas')) return '{shield}';
  if (l.includes('miss')) return '{clipboard}';
  if (l.includes('clã')) return '{castle}';
  if (l.includes('kage')) return '{kage}';
  return '{todo}';
}
/** Ilustração de um benefício de nível da vila, pelo assunto do texto. */
function perkArt(perk: string): string {
  const l = perk.toLowerCase();
  if (l.includes('territ')) return 'perk-territory';
  if (l.includes('clã') || l.includes('clan') || l.includes('kekkei')) return 'perk-clans';
  if (l.includes('kage')) return 'perk-kage';
  if (l.includes('imposto') || l.includes('ryo')) return 'perk-taxes';
  if (l.includes('ameaça') || l.includes('invas') || l.includes('chefe')) return 'perk-threat';
  return 'perk-buildings';
}
/**
 * Padrões de botão do jogo:
 * - liga/desliga: rótulo curto e o estado na chave (`togBtn`), nunca "ligado/desligado" escrito;
 * - ações em lote: verbo curto com a contagem entre parênteses ("Ensinar (4)"), a explicação vai na dica;
 * - custo: etiqueta dentro do botão, à direita (`costTag`), sem parênteses.
 */
const togBtn = (act: string, on: boolean, label: string, title: string, tip: string, arg = '') =>
  `<button class="btn tog ${on ? 'on' : ''}" data-act="${act}" ${arg ? `data-arg="${arg}"` : ''} ${tipAttr(title, tip)}>${label}<i class="sw"></i></button>`;
/** Papel de luta (game/tactics.ts): ícone e etiqueta com a explicação na dica. */
const ROLE_ICON: Record<Role, string> = { tank: '{shield}', striker: '{fist}', ranged: '{target}', support: '{medic}' };
const TACTIC_ICON: Record<Tactic, string> = { free: '{swords}', focus: '{target}', hold: '{flag}', flank: '{run}' };
const roleBadge = (r: Role) => `<span class="badge role-${r}" ${tipAttr(ROLE_INFO[r].name, ROLE_INFO[r].desc, true)}>${ROLE_ICON[r]} ${ROLE_INFO[r].name}</span>`;
const costTag = (cost: Partial<Record<ResKey, number>>) => `<small class="bcost">${costLabel(cost)}</small>`;
/** "i" ao lado do título de uma seção: a explicação fica na dica (um toque ou o mouse em cima), não escrita no drawer. */
const infoTip = (title: string, text: string) => `<span class="itip" ${tipAttr(title, text, true)}>{info}</span>`;
const RANK_BADGE_ICON: Record<string, string> = { genin: '{leaf}', chunin: '{medal}', jounin: '{star}', sannin: '{scroll}', kage: '{kage}' };
const MISSION_TYPE_ICON: Record<Mission['type'], string> = { herbs: '{leaf}', hunt: '{beast}', escort: '{cart}', camp: '{flag}', wanted: '{target}' };
const RISK_LABEL: Record<MissionRisk, [string, string]> = {
  safe: ['Seguro', '{shield}'], good: ['Favorável', '{shield}'], risky: ['Arriscado', '{alert}'], danger: ['Perigoso', '{skull}'],
};
type RosterFilter = 'all' | 'free' | 'team' | 'mission' | 'hurt' | 'genin' | 'chunin' | 'jounin' | 'sannin' | 'anbu' | 'kage';
/** Filtros de graduação: aparecem sempre, mesmo vazios (dá para ver que existe Sannin e Kage). */
const RANK_FILTERS: RosterFilter[] = ['genin', 'chunin', 'jounin', 'sannin', 'anbu', 'kage'];
type RosterSort = 'level' | 'rank' | 'power' | 'hp' | 'name';
const ROSTER_SORTS: [RosterSort, string, string][] = [
  ['level', 'Nível', 'Maior nível primeiro'],
  ['rank', 'Patente', 'Kage, Jounin, Chunin e Genin (empate: nível)'],
  ['power', 'Atributos', 'Soma dos atributos, do mais forte ao mais fraco'],
  ['hp', 'Vida', 'Mais feridos primeiro'],
  ['name', 'Nome', 'Ordem alfabética'],
];
const statSum = (u: Unit) => Object.values(u.ninja!.stats).reduce((a, b) => a + b, 0);

const ACTION_ICON: Record<string, string> = {
  trade: '{cart}', protect: '{shield}', raid: '{swords}', annex: '{flag}', explore: '{map}', outpost: '{hut}', train: '{dummy}', contract: '{scroll}', assault: '{skull}',
};
const ROUTINE_ICON: Record<string, string> = { auto: '{refresh}', train: '{dummy}', patrol: '{flag}', scout: '{eye}' };
const ROUTINES: [NinjaOrder, string][] = [['auto', 'Auto'], ['train', 'Treinar'], ['patrol', 'Patrulhar'], ['scout', 'Explorar']];
/** O que cada rotina faz (dica e texto abaixo dos botões). */
const ROUTINE_TIP: Record<NinjaOrder, string> = {
  auto: 'Decide sozinho: acompanha o líder da equipe; sem equipe, treina na maior parte do dia e patrulha no resto. Dorme à noite.',
  train: 'Passa o dia no Campo de Treino ganhando atributos e XP. Dorme à noite.',
  patrol: 'Só patrulha o território, também à noite: não dorme nem treina.',
  scout: 'Batedor: de dia vai até a borda da névoa e revela o mapa (ruínas, baús, minas). À noite dorme.',
};

/**
 * Painel de detalhes em dois modos:
 * - `drawer`: lateral, para o que foi tocado no mapa (ninja, prédio, grupo), compacto e com abas;
 * - `window`: janela central com abas, para as telas de gestão (Vila, Ninjas/Equipes/Clãs, Missões).
 */
export class Panel {
  readonly root: HTMLElement;
  private body: HTMLElement;
  /** Tela de onde a equipe aberta veio (o "Voltar" da equipe leva para lá). */
  private teamFrom: View | null = null;
  private view: View | null = null;
  private lastHtml = '';
  /** Dedo/mouse apertado dentro do painel: segura as trocas de estrutura até soltar. */
  private pressing = false;
  private armedDemolish = 0;
  /** Aba do painel do ninja (mantida ao trocar de ninja). */
  private unitTab: UnitTab = 'info';
  /** Filtro da grade do inventário do ninja. */
  private invFilter: 'all' | ItemSlot = 'all';
  /** Oficina aberta na janela Oficinas (uma por vez, em abas). */
  private craftTab: 'forge' | 'pharmacy' | 'sealshop' = 'forge';
  /** Lista mostrada no Canil (uma por vez). */
  private kennelTab: 'without' | 'with' = 'without';
  /** Biblioteca: pergaminhos fechados ou abertos. */
  private libTab: 'closed' | 'open' = 'closed';
  /** Máscara escolhida para o próximo nomeado da ANBU (null = a primeira livre). */
  private anbuMaskSel: string | null = null;
  /** Lista de ninjas: filtro e ordem escolhidos (mantidos enquanto o jogo está aberto). */
  private rosterFilter: RosterFilter = 'all';
  private rosterSort: RosterSort = 'level';
  /** Quadro de missões: aba e missão com a lista de equipes aberta ("Trocar equipe"). */
  private missionTab: MissionTab = 'offered';
  private missionPick: number | null = null;
  /** Candidato escolhido em cada caminho Sannin (o "Nomear" usa este). */
  private sanninSel: Record<string, number> = {};
  /** Raça escolhida para a próxima adoção de ninken. */
  private dogBreed: DogBreed = 'shiba';
  /** Cão sem dono escolhido no Canil para dar a um ninja (null = o da raça escolhida). */
  private dogPick: number | null = null;
  /** Região: lugar aberto e equipe escolhida para as ações. */
  private regionNode: string | null = null;
  private regionTeam: number | null = null;
  /** Aba do painel do prédio (geral × lá dentro). */
  private buildingTab: BuildingTab = 'main';
  /** Pedido para abrir uma tela de gestão na janela central. */
  onWindow: (view: View) => void = () => {};
  /** Ninja sob o mouse numa lista do painel (destacado no mapa). */
  hoverId: number | null = null;
  private lastTime = 0;
  /** Chamado ao tocar em "Mover" num prédio. */
  onMove: (id: number) => void = () => {};
  /** Chamado quando o jogador entra no modo "dar ordem". */
  onOrderMode: () => void = () => {};
  onHover: (id: number | null) => void = () => {};

  constructor(
    private app: App,
    readonly mode: 'drawer' | 'window' = 'drawer',
  ) {
    const inner = '<button class="close" data-act="close" title="Fechar (Esc)">{x}</button><div class="body"></div>';
    this.root =
      mode === 'window'
        ? el('div', { id: 'win', hidden: '' }, rich(`<div class="box">${inner}</div>`))
        : el('aside', { id: 'panel', hidden: '' }, rich(inner));
    this.body = this.root.querySelector('.body')!;
    this.root.addEventListener('click', (e) => {
      if (e.target === this.root) return this.show(null); // clique fora da janela fecha
      this.onClick(e);
    });
    // passar o mouse numa linha de ninja destaca o ninja no mapa
    this.root.addEventListener('pointerover', (e) => {
      if (e.pointerType !== 'mouse') return;
      const row = (e.target as HTMLElement).closest<HTMLElement>('[data-act="pick"]');
      this.setHover(row ? Number(row.dataset.arg) : null);
    });
    this.root.addEventListener('pointerleave', () => this.setHover(null));
    this.root.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.pressing = true;
    });
    const release = () => {
      if (!this.pressing) return;
      // solta um instante depois: o click (que vem depois do pointerup) ainda acha o mesmo botão
      setTimeout(() => (this.pressing = false), 60);
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
  }

  get isOpen() {
    return this.view !== null;
  }
  get kind() {
    return this.view?.kind ?? null;
  }

  private setHover(id: number | null) {
    if (id === this.hoverId) return;
    this.hoverId = id;
    this.onHover(id);
  }

  /** Redesenha o interior do prédio (a cada frame, para as animações). */
  frame(time: number) {
    this.lastTime = time;
    if (this.view?.kind !== 'building') return;
    const cv = this.body.querySelector<HTMLCanvasElement>('canvas.interior');
    const b = this.app.game.building(this.view.id);
    if (!cv || !b) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(cv.clientWidth * dpr);
    const h = Math.round(cv.clientHeight * dpr);
    if (!w || !h) return;
    if (cv.width !== w || cv.height !== h) {
      cv.width = w;
      cv.height = h;
    }
    drawInterior(cv.getContext('2d')!, w, h, BUILDINGS[b.type], occupantsOf(this.app.game, b), time, isNight(this.app.game.state), housingOf(b));
  }

  show(view: View | null) {
    // a tela da equipe guarda de onde veio (lista de ninjas, clãs…) para o "Voltar"
    if (view?.kind === 'team') this.teamFrom = this.view && this.view.kind !== 'team' ? { ...this.view } : this.teamFrom;
    if (view?.kind !== 'group') this.app.group = [];
    this.setHover(null);
    if (view?.kind !== this.view?.kind || (view && 'id' in view && this.view && 'id' in this.view && view.id !== this.view.id)) this.buildingTab = 'main';
    this.view = view;
    this.lastHtml = '';
    this.armedDemolish = 0;
    this.root.hidden = !view;
    this.body.scrollTop = 0;
    this.update();
  }

  update() {
    if (!this.view) return;
    const g = this.app.game;
    let built: Built | null = null;
    if (this.view.kind === 'roster') built = this.roster();
    else if (this.view.kind === 'teams') built = this.teamsList();
    else if (this.view.kind === 'clans') built = this.clansList();
    else if (this.view.kind === 'group') built = this.groupView();
    else if (this.view.kind === 'village') built = this.villageView();
    else if (this.view.kind === 'kage') built = { html: this.tabs('kage') + this.kageSection(), t: {}, b: {} };
    else if (this.view.kind === 'bingo') built = { html: this.tabs('bingo') + `<div class="kfill bingo">${this.orgSection()}${this.swordsmenSection()}${this.soundSection()}</div>`, t: {}, b: {} };
    else if (this.view.kind === 'stats') built = this.statsView();
    else if (this.view.kind === 'missions') built = this.missionsView();
    else if (this.view.kind === 'expeditions') built = this.expeditionsView();
    else if (this.view.kind === 'region') built = this.regionView();
    else if (this.view.kind === 'crafts') built = this.craftsView();
    else if (this.view.kind === 'team') {
      const tm = g.team(this.view.id);
      if (tm) built = this.teamsList(tm);
    } else if (this.view.kind === 'site') {
      const id = this.view.id;
      const site = g.state.sites.find((x) => x.id === id);
      if (site) built = this.siteView(site);
    } else if (this.view.kind === 'unit') {
      const u = g.unit(this.view.id);
      if (u) built = this.view.teach && u.ninja && u.faction === 'village' && u.kind === 'ninja' ? this.teach(u) : this.unit(u);
    } else {
      const b = g.building(this.view.id);
      if (b) built = this.building(b);
    }
    if (!built) {
      this.show(null);
      return;
    }
    // estrutura mudou: aplica só a diferença (morph), e nunca com o dedo/mouse apertado no painel (o clique valeria
    // num botão que acabou de ser trocado); a atualização espera soltar
    if (built.html !== this.lastHtml && !this.pressing) {
      const first = !this.body.firstChild;
      if (first) this.body.innerHTML = rich(built.html);
      else morph(this.body, rich(built.html));
      this.lastHtml = built.html;
      this.frame(this.lastTime); // o canvas do interior pode ter sido recriado: redesenha já
    }
    for (const [k, v] of Object.entries(built.t)) {
      const e = this.body.querySelector<HTMLElement>(`[data-t="${k}"]`);
      if (e && e.textContent !== v) e.textContent = v;
    }
    for (const [k, v] of Object.entries(built.b)) {
      const e = this.body.querySelector<HTMLElement>(`[data-b="${k}"]`);
      if (e) e.style.width = `${Math.max(0, Math.min(1, v)) * 100}%`;
    }
  }

  // ------------------------------------------------------------------ views
  private unit(u: Unit): Built {
    const t: Record<string, string> = {};
    const b: Record<string, number> = {};
    t.hp = `${Math.ceil(u.hp)} / ${u.maxHp}`;
    b.hp = u.hp / u.maxHp;
    t.state = STATE_LABEL[u.state] ?? u.state;
    let html = '';
    const back = this.app.back;
    if (back && back.id === u.id)
      html += `<button class="btn mini backbtn" data-act="back-list">{back} Voltar para ${BACK_LABEL[back.view.kind as View['kind']] ?? 'a lista'}</button>`;

    if (u.ninja) {
      const n = u.ninja;
      const nat = NATURES[n.nature];
      const isOwn = u.faction === 'village' && u.kind === 'ninja';
      const title = u.kind === 'clone' ? `Clone de ${esc(u.name)}` : esc(u.name);
      const rank = n.sannin ? 'sannin' : n.rank;
      const pic = unitPortrait(u, true);
      const clan = clanOf(this.app.game, u);
      // cabeçalho: retrato grande, nome, graduação/natureza/linhagem e o que está fazendo; abaixo, números rápidos
      html += `<div class="fhead"><span class="fh-face">${pimg(pic)}</span><div class="fh-main">
        <div class="fh-name">${title}</div><div class="badges">
        ${u.faction === 'enemy' ? `<span class="badge enemy">${u.role ? ROGUE_ROLES[u.role].name : 'Renegado'} · ${RANKS[n.rank].name}</span>` : `<span class="rbadge r-${rank}">${RANK_BADGE_ICON[rank] ?? ''} ${n.sannin ? 'Sannin' : RANKS[n.rank].name}</span>`}
        <span class="badge nat" style="--c:${nat.color}">${nat.kanji} ${nat.name}</span>${u.faction === 'village' && roleOf(u) ? roleBadge(roleOf(u)!) : ''}${this.lineageBadges(u)}</div>
        <div class="fh-state">{eye} <span data-t="state"></span></div></div></div>
        <div class="fquick"><span ${tipAttr('Nível', 'Sobe enchendo a barra de XP; cada nível dá atributos.', true)}><small>Nível</small><b>${n.level}</b></span>
        <span ${tipAttr('Abates', 'Inimigos derrubados por este ninja.', true)}><small>{swords} Abates</small><b>${n.kills}</b></span>
        <span ${tipAttr('Poder', 'Soma dos atributos (o que conta na força da equipe).', true)}><small>{star} Poder</small><b>${Math.round(statSum(u))}</b></span>
        <span ${tipAttr('Clã', clan ? `Clã ${clan.name}.` : 'Sem clã. Chunin+ pode fundar um.', true)}><small>{castle} Clã</small><b>${clan ? esc(clan.name) : '—'}</b></span></div>`;
      // vida, chakra e XP lado a lado (economiza altura no painel)
      const vit = (k: string, ic: string, label: string, tip: string) =>
        `<div class="vbox ${k}" ${tipAttr(label, tip, true)}><small>${ic} ${label}</small><div class="nc-bar ${k}"><i data-b="${k}"></i></div><span class="vnum" data-t="${k}"></span></div>`;
      html += `<div class="vit">${vit('hp', '{plus}', 'Vida', 'Chega a zero e o ninja cai. Recupera descansando em casa ou no hospital.')}${vit(
        'ck', '{drop}', 'Chakra', 'Gasto pelos jutsus. Recupera sozinho com o tempo (Stamina e Inteligência aceleram).',
      )}${isOwn ? vit('xp', '{star}', 'XP', 'Experiência de lutas, treinos e missões. Ao encher, sobe de nível e ganha atributos.') : ''}</div>`;
      t.hp = `${Math.ceil(u.hp)}/${u.maxHp}`;
      t.ck = `${Math.floor(u.chakra)}/${u.maxChakra}`;
      b.ck = u.chakra / Math.max(1, u.maxChakra);
      if (u.role) html += `<div class="warnbox">${ROGUE_ROLES[u.role].icon} ${esc(ROGUE_ROLES[u.role].desc)}${u.cloak ? ' <b>Ainda invisível.</b>' : ''}</div>`;
      if (!isOwn && isAttackable(u)) html += this.attackSection(u, t);
      if (isOwn) {
        t.xp = `${Math.floor(n.xp)}/${xpToNext(n.level)}`;
        b.xp = n.xp / xpToNext(n.level);
        // abas: o painel do ninja mostra um assunto por vez em vez de uma lista comprida
        html += `<div class="mtabs subtabs">`;
        for (const [k, label] of [['info', '{ninja} Ficha'], ['cmd', '{flag} Ordens'], ['gear', '{luggage} Inventário']] as [UnitTab, string][])
          html += `<button data-act="unit-tab" data-arg="${k}" class="${this.unitTab === k ? 'on' : ''}">${label}</button>`;
        html += `</div>`;
        if (this.unitTab === 'cmd') {
          html += this.ninjaOrders(u);
          t.cmd = commandLabel(u);
          return { html, t, b };
        }
        if (this.unitTab === 'gear') return { html: html + this.equipSection(u), t, b };
      }
      if (u.heritage?.parents) html += `<p class="hint">Filho(a) de ${esc(u.heritage.parents.join(' e '))}</p>`;
      html += `<h4>Atributos <small>(máx ${statCapOf(n)})</small></h4><div class="stats">`;
      for (const k of STAT_KEYS) {
        const info = STAT_INFO[k];
        html += `<div class="stat" title="${info.label}"><span>${info.short}</span><div class="sb"><i data-b="s-${k}" style="background:${info.color}"></i></div><b data-t="s-${k}"></b></div>`;
        t[`s-${k}`] = n.stats[k].toFixed(1);
        b[`s-${k}`] = n.stats[k] / 10;
      }
      html += `</div><h4>Jutsus</h4><div class="slots">`;
      for (let i = 0; i < 2; i++) {
        const id = n.jutsu[i];
        if (!id) {
          html += `<div class="slot empty">Slot ${i + 1} — vazio</div>`;
          continue;
        }
        const d = JUTSUS[id]!;
        const cd = jutsuCooldown(d, n.stats);
        html += `<div class="slot" style="--c:${d.color}"><i class="cd" data-b="cd${i}"></i><span class="sl-ic">${NATURES[d.nature as keyof typeof NATURES]?.kanji ?? '術'}</span><div class="sl-txt"><div class="jn">${esc(d.name)}</div>
          <div class="jm">Rank ${JUTSU_RANK_LABEL[d.rank]} · ${JUTSU_TYPE_LABEL[d.type]} · ${jutsuChakra(d, n.stats)} chakra</div></div><span class="sl-cd">{hourglass} ${cd.toFixed(1)}s</span></div>`;
        b[`cd${i}`] = n.cd[i]! / cd;
      }
      html += `</div>` + this.basicTechniques(u, t);
      if (n.learning) {
        const d = JUTSUS[n.learning.jutsuId]!;
        html += `<h4>Estudando</h4><div class="hint">${esc(d.name)} → slot ${n.learning.slot + 1}</div><div class="bar pg"><i data-b="learn"></i><span data-t="learn"></span></div>`;
        b.learn = n.learning.progress / n.learning.total;
        t.learn = `${Math.floor(b.learn * 100)}%`;
      }
      if (isOwn) html += this.ninjaCareer(u);
      else if (u.kind === 'clone') html += `<p class="hint">Clone das sombras. Some em <span data-t="life"></span>s.</p>`;
      if (u.kind === 'clone') t.life = String(Math.ceil(u.life ?? 0));
      return { html, t, b };
    }

    if (u.animal) {
      const d = ANIMALS[u.animal];
      const owner = u.faction === 'village' ? this.app.game.unit(u.ownerId) : undefined;
      if (u.faction === 'village') {
        // aliado: cão ninja ou invocação de contrato
        html += `<div class="ph"><div class="title">${esc(u.name)}</div><div class="badges"><span class="badge rank">${u.animal === 'dog' ? `Ninken · ${esc(BREEDS[u.breed ?? 'shiba'].name)}` : 'Invocação'}</span></div></div>`;
        html += `<div class="sub"><span data-t="state"></span></div><div class="bar hp"><i data-b="hp"></i><span data-t="hp"></span></div>`;
        html += `<p class="hint">${owner ? `Acompanha ${esc(owner.name)}.` : ''} ${
          u.animal === 'dog' ? `Luta junto, fareja espiões invisíveis por perto e, fora da vila, acha ervas. ${esc(BREEDS[u.breed ?? 'shiba'].desc)}` : `Some em ${Math.ceil(u.life ?? 0)}s.`
        }</p>`;
        if (owner) html += `<div class="btnrow"><button class="btn" data-act="pick" data-arg="${owner.id}">{ninja} Ver o dono</button></div>`;
        return { html, t, b };
      }
      html += `<div class="ph"><div class="title">${d.name}</div><div class="badges"><span class="badge enemy">Animal selvagem</span></div></div>`;
      html += `<div class="sub"><span data-t="state"></span></div><div class="bar hp"><i data-b="hp"></i><span data-t="hp"></span></div>`;
      if (isAttackable(u)) html += this.attackSection(u, t);
      if (u.loot) html += `<div class="warnbox">{paw} Está levando ${costLabel(u.loot)}. Abata antes que fuja para recuperar.</div>`;
      if (u.heads) html += `<div class="warnbox">{beast} Cabeças restantes: <b>${u.heads}</b>. Cada vez que a vida zera, uma cai e ela volta inteira.</div>`;
      if (u.animal === 'golem') html += `<p class="hint">Pedaço da ${u.tier ? `${u.tier}ª divisão` : 'forma inteira'}${(u.tier ?? 0) < 2 ? ' · ainda vai se dividir ao cair' : ' · não se divide mais'}.</p>`;
      html += `<p class="hint">${d.desc ? esc(d.desc) : 'Ataca moradores que chegam perto.'} Ao ser abatido rende ${costLabel(d.reward)} e XP.</p>`;
      html += `<p class="hint">Dano ${d.damage} · Velocidade ${d.speed}</p>`;
      return { html, t, b };
    }

    // morador
    const job = this.app.game.building(u.jobId);
    const jobDef = job ? BUILDINGS[job.type] : null;
    html += `<div class="ph"><div class="title">${esc(u.name)}</div><div class="badges"><span class="badge">Morador(a)</span>${this.lineageBadges(u)}</div></div>`;
    html += `<div class="sub">${jobDef?.job ? JOB_LABEL[jobDef.job] : 'Sem emprego (ajuda nas obras)'} · <span data-t="state"></span></div>`;
    html += `<div class="bar hp"><i data-b="hp"></i><span data-t="hp"></span></div>`;
    const h = u.heritage;
    if (h?.parents) html += `<p class="hint">Filho(a) de ${esc(h.parents.join(' e '))}</p>`;
    if (h && (h.nature || h.bias || h.kekkei)) {
      const parts = [
        h.nature && `${NATURES[h.nature].kanji} ${NATURES[h.nature].name}`,
        h.bias && STAT_INFO[h.bias].label,
        h.kekkei && `${KEKKEI[h.kekkei].kanji} ${KEKKEI[h.kekkei].name}!`,
      ].filter(Boolean);
      html += `<div class="warnbox">{dna} Talento de família: ${parts.join(' · ')}. Recrute na Academia para aproveitar.</div>`;
    }
    html += `<p class="hint">Moradores trabalham de dia, dormem à noite e fogem para casa quando há perigo. Recrute-os como ninjas na Academia.</p>`;
    return { html, t, b };
  }

  /** Aba Ordens: ordem direta, rotina, foco do treino e equipe. */
  private ninjaOrders(u: Unit) {
    const n = u.ninja!;
    const team = teamOf(this.app.game, u);
    let html = `<h4>Ordem direta</h4><p class="hint">Atual: <b data-t="cmd"></b></p><div class="btnrow">
      <button class="btn primary" data-act="cmd-mode" data-arg="self">{pin} Dar ordem</button>`;
    if (team) html += `<button class="btn primary" data-act="cmd-mode" data-arg="team">{users} À equipe</button>`;
    html += `<button class="btn" data-act="cmd-retreat" data-arg="self">{run} Recuar</button>`;
    if (u.command) html += `<button class="btn" data-act="cmd-clear" data-arg="self">{x} Cancelar</button>`;
    html += `</div><p class="hint">No computador: botão direito no mapa manda mover ou atacar.</p>`;
    html += `<h4>Rotina</h4><div class="seg">`;
    for (const [k, label] of ROUTINES)
      html += `<button data-act="order" data-arg="${k}" class="${n.order === k ? 'on' : ''}" ${tipAttr(label, ROUTINE_TIP[k])}>${label}</button>`;
    html += `</div><p class="hint">${ROUTINE_TIP[n.order]}</p>`;
    html += `<h4>Foco do treino</h4><div class="chips">`;
    const bySensei = team?.senseiId != null && team.senseiId !== u.id;
    const auto = bySensei ? 'Sensei decide' : 'Aleatório';
    const autoTip = bySensei ? 'Metade das vezes o sensei puxa o treino para os pontos fortes dele.' : 'Cada sessão treina um atributo ao acaso.';
    html += `<button data-act="focus" data-arg="" class="${n.focus ? '' : 'on'}" ${tipAttr(auto, autoTip)}>${auto}</button>`;
    for (const k of STAT_KEYS)
      html += `<button data-act="focus" data-arg="${k}" class="${n.focus === k ? 'on' : ''}" ${tipAttr(STAT_INFO[k].label, STAT_INFO[k].desc)}>${STAT_INFO[k].label}</button>`;
    // a explicação do foco atual fica visível (no celular não existe "passar o mouse")
    html += `</div><p class="hint">${n.focus ? `<b>${STAT_INFO[n.focus].label}:</b> ${STAT_INFO[n.focus].desc}` : autoTip} Cada sessão no Campo de Treino sobe o atributo escolhido (até o limite da patente).</p>`;
    return html + this.teamSection(u, team);
  }

  /**
   * Mandar ninjas atacarem o inimigo/animal aberto no painel: os mais próximos, uma equipe ou todos.
   * Só lista quem está disponível (fora de missão e com vida acima de 35%).
   */
  private attackSection(target: Unit, t: Record<string, string>) {
    const g = this.app.game;
    const free = availableFighters(g);
    const on = attackersOf(g, target.id);
    t.atk = on.length ? `${on.length} ninja(s) atacando` : 'Ninguém atacando ainda';
    let html = `<h4>{swords} Atacar</h4><p class="hint"><span data-t="atk"></span></p>`;
    if (!free.length) return html + `<p class="why">Nenhum ninja disponível (todos em missão, feridos ou a vila não tem ninjas).</p>`;
    const near = Math.min(3, free.length);
    html += `<div class="btnrow">
      <button class="btn primary" data-act="atk" data-arg="near" ${tipAttr('Mais próximos', `Os ${near} ninjas disponíveis mais perto do alvo largam o que fazem e atacam.`)}>{swords} ${near} mais próximo(s)</button>
      <button class="btn" data-act="atk" data-arg="all" ${tipAttr('Todos', 'Todos os ninjas disponíveis atacam este alvo.')}>{users} Todos (${free.length})</button>`;
    const ids = new Set(free.map((u) => u.id));
    for (const tm of g.state.teams) {
      const n = teamUnits(g, tm).filter((u) => ids.has(u.id)).length;
      if (n) html += `<button class="btn" data-act="atk" data-arg="team" data-team="${tm.id}" style="--c:${tm.color}"><span class="dot"></span>${esc(tm.name)} (${n})</button>`;
    }
    if (on.length) html += `<button class="btn" data-act="atk-stop">{x} Cancelar ataque</button>`;
    return html + `</div>`;
  }

  /** Local especial: o que é, guardiões e quem mandar investigar. */
  private siteView(site: Site): Built {
    const g = this.app.game;
    const def = SITES[site.kind];
    const t: Record<string, string> = {};
    let html = `<div class="ph"><div class="title">${def.icon} ${def.name}</div></div><p class="hint">${esc(def.desc)}</p>`;
    if (site.kind === 'cave') return { html: html + this.caveSection(site), t, b: {} };
    if (site.done) return { html: html + `<p class="hint">{check} Já investigado.</p>`, t, b: {} };
    const guards = guardiansOf(g, site);
    if (guards.length) html += `<div class="warnbox">{swords} ${guards.length} guardião(ões) protegem o local. Quem for investigar luta com eles primeiro.</div>`;
    if (site.kind === 'ruin') {
      const left = missingScrolls(g.state).length;
      html += `<p class="hint">${left ? `{scroll} Pode haver um pergaminho proibido (${left} ainda perdidos pelo mundo).` : '{scroll} Os pergaminhos já foram achados: restam relíquias.'}</p>`;
    }
    const going = g.state.units.filter((u) => !u.dead && u.command?.kind === 'investigate' && u.command.siteId === site.id);
    if (going.length) html += `<p class="hint">{run} A caminho: ${going.map((u) => esc(u.name.split(' ').pop()!)).join(', ')}</p>`;
    const free = availableFighters(g);
    html += `<h4>Mandar investigar</h4>`;
    if (!free.length) return { html: html + `<p class="why">Nenhum ninja disponível.</p>`, t, b: {} };
    html += `<div class="btnrow"><button class="btn primary" data-act="site-go" data-arg="near">{run} Ninja mais perto</button>`;
    const ids = new Set(free.map((u) => u.id));
    for (const tm of g.state.teams) {
      const n = teamUnits(g, tm).filter((u) => ids.has(u.id)).length;
      if (n) html += `<button class="btn" data-act="site-go" data-arg="team" data-team="${tm.id}" style="--c:${tm.color}"><span class="dot"></span>${esc(tm.name)} (${n})</button>`;
    }
    html += `</div>`;
    return { html, t, b: {} };
  }

  /** Entrada de mina: andares, força recomendada e as equipes que podem partir. */
  private caveSection(site: Site) {
    const g = this.app.game;
    const uses = mineUses(site);
    const how = infoTip(
      'Como funciona',
      'Cada andar é uma caverna jogável: a equipe entra (aparece "Ver invasão" no alto), luta com os bichos, abre os baús e procura a descida. Vencendo um andar, você decide: descer mais (mais risco e minérios melhores) ou voltar. No fundo há um guardião. O saque só chega se voltarem.',
    );
    let html = `<div class="scards2">
      <div class="sc2"><small>Andares ${how}</small><b>{pickaxe} ${MINE.floors}</b></div>
      <div class="sc2"><small>Aguenta ${infoTip('Expedições', `Cada expedição (voltando ou não) gasta um uso. No último os túneis desabam e outra entrada aparece noutro lugar do mapa em alguns dias.`)}</small><b>${uses} <span>exp.</span></b><span class="wpips">${Array.from({ length: MINE_USES }, (_, i) => `<i class="${i < uses ? 'on' : ''}"></i>`).join('')}</span></div>
      <div class="sc2"><small>No fundo</small><b>${RES_INFO.crystal.icon}${RES_INFO.gold.icon}${RES_INFO.darksteel.icon}</b></div>
    </div>`;
    html += `<h4>{swords} Força recomendada ${infoTip('Força recomendada', 'Força somada da equipe para o andar sem sustos. Abaixo disso a equipe sofre mais e pode ter de voltar.')}</h4><div class="scards2">${[1, 3, 5]
      .map((f) => `<div class="sc2"><small>Andar ${f}</small><b>{swords} ${floorPower(f)}</b></div>`)
      .join('')}</div>`;
    const here = activeExpeditions(g).filter((e) => e.siteId === site.id);
    if (here.length)
      html += `<p class="hint">{run} Na mina agora: ${here.map((e) => esc(g.team(e.teamId)?.name ?? '?')).join(', ')} <button class="btn mini" data-act="win" data-arg="expeditions">Acompanhar</button></p>`;
    html += `<h4>Mandar equipe</h4>`;
    if (!g.state.teams.length) return html + `<p class="why">Forme uma equipe em {ninja} Ninjas → Equipes.</p>`;
    html += `<div class="btnrow mine-teams">`;
    for (const tm of g.state.teams) {
      const why = mineBlock(g, tm.id);
      html += `<button class="btn" data-act="mine-go" data-arg="${site.id}" data-team="${tm.id}" style="--c:${tm.color}" ${blocked(g, [why], undefined, 'Não dá para partir')}><span class="dot"></span>${esc(tm.name)} {swords}${teamMinePower(g, tm.id)}</button>`;
    }
    return html + `</div>`;
  }

  /** Janela Mundo → Região: mapa com vilarejos, ilhas e lugares sagrados; à direita, o lugar escolhido e as ações. */
  private regionView(): Built {
    const g = this.app.game;
    const s = g.state;
    let html = this.tabs('region');
    const busyAt = new Map<string, string[]>();
    for (const e of activeExpeditions(g))
      if (e.node) busyAt.set(e.node, [...(busyAt.get(e.node) ?? []), g.team(e.teamId)?.color ?? '#fff']);
    html += `<div class="regionwrap"><div class="rmap"><img src="${regionMap}" alt="" draggable="false">
      <span class="rnode home" style="left:${HOME_POS.x}%;top:${HOME_POS.y}%">{castle}<span>Sua vila</span></span>`;
    for (const def of REGION_NODES) {
      if (def.kind === 'hideout' && (def.id === 'som' ? !s.sound.captive : !s.org.lairKnown)) continue; // covil: só descoberto; Som: só com raptado
      const st = regionOf(s, def.id);
      const icon = def.kind === 'village' ? '{houses}' : def.kind === 'island' ? '{ship}' : def.kind === 'hideout' ? '{skull}' : '{scroll}';
      const flags = st.outpost ? ' {flag}' : '';
      const dots = (busyAt.get(def.id) ?? []).map((c) => `<i class="tdot" style="--c:${c}"></i>`).join('');
      html += `<button class="rnode k-${def.kind} s-${st.status} ${this.regionNode === def.id ? 'on' : ''}" data-act="r-node" data-arg="${def.id}" style="left:${def.x}%;top:${def.y}%">${icon}<span>${def.name}${flags}</span>${dots}</button>`;
    }
    html += `</div><div class="rside">`;
    const def = this.regionNode ? REGION[this.regionNode] : undefined;
    if (!def)
      html += `<div class="howto"><b>Como funciona</b><ol>
        <li><b>Toque num lugar</b> do mapa: {houses} vilarejos, {ship} ilhas ou {scroll} lugares sagrados.</li>
        <li><b>Escolha a equipe</b>: compare a força dela {swords} com as defesas do lugar.</li>
        <li><b>Escolha a ação</b>. A equipe viaja e some da vila; acompanhe em Expedições. Saquear e anexar à força viram uma <b>invasão jogável</b>: aparece "Ver invasão" no alto da tela.</li></ol>
        <b>Para que serve</b><ul><li>{houses} Vilarejos: proteja e comercie para ganhar <b>tributo diário</b> e anexar (traz <b>moradores</b>); ou saqueie.</li>
        <li>{ship} Ilhas (precisa de Porto): explore, monte <b>postos</b> que rendem recursos todo dia, e <b>treine no templo</b> (muito XP).</li>
        <li>{scroll} Lugares sagrados (precisa de Porto): vença a prova e ganhe um <b>contrato de invocação</b> (sapo, serpente, lesma).</li></ul></div>`;
    else html += this.regionNodeSection(def);
    html += `</div></div>`;
    const t: Record<string, string> = {};
    const b: Record<string, number> = {};
    const live = g.state.expeditions.filter((e) => e.status !== 'done' && e.status !== 'lost');
    if (live.length) html += `<h4>{flag} Expedições ativas</h4><div class="xstrip">${live.map((e) => this.expCard(e, t, b, false)).join('')}</div>`;
    return { html, t, b };
  }

  /** Detalhe de um lugar da região: situação, escolha da equipe e ações. */
  private regionNodeSection(def: RegionNodeDef) {
    const g = this.app.game;
    const s = g.state;
    const st = regionOf(s, def.id);
    const kindLabel = { village: 'Vilarejo', island: 'Ilha', sacred: 'Lugar sagrado', hideout: 'Covil' }[def.kind];
    const statusLabel = { neutral: 'Neutro', protected: 'Protegido', vassal: 'Vassalo', hostile: 'Hostil' }[st.status];
    const kindIcon = { village: '{houses}', island: '{ship}', sacred: '{scroll}', hideout: '{skull}' }[def.kind];
    const stCls = { neutral: 'info', protected: 'safe', vassal: 'good', hostile: 'danger' }[st.status];
    let html = `<div class="rhead"><span class="rh-ic k-${def.kind}">${kindIcon}</span><div><div class="rh-name">${def.name}</div><div class="td-chips">
      <span class="mchip">${kindIcon} ${kindLabel}</span>${def.kind === 'village' ? `<span class="mpill ${stCls}">${statusLabel}</span>` : ''}<span class="mchip">{shield} Defesas ${nodePower(s, def)}</span></div></div></div>
      <p class="bh-desc">${esc(def.desc)}</p>`;
    if (def.kind === 'village') {
      const pct = (st.rel + 100) / 2;
      html += `<div class="bsec rrel"><div class="rrel-top"><b>Relação ${st.rel}</b>${def.tribute ? `<span class="mchip" ${tipAttr('Tributo diário', 'Protegido manda isto todo dia; vassalo manda o dobro.', true)}>{ryo} Tributo: ${costLabel(def.tribute)}/dia</span>` : ''}</div>
        <div class="relbar" ${tipAttr('Relação', `De -100 (inimigos) a 100 (aliados). Protegido a partir de ${REL.protected}; anexar em paz com ${REL.annexPeace}+ ou à força com ${REL.annexForce} ou menos.`)}><i style="left:calc(${pct}% - 1px)"></i></div>
        <div class="rrel-lbl"><span>Hostil</span><span>Neutra</span><span>Aliada</span></div>`;
    } else if (def.kind === 'island') {
      html += `<p class="hint">${st.explored ? '{check} Explorada' : '{todo} Ainda não explorada'} · ${st.outpost ? `{flag} Posto avançado: ${costLabel(def.outpost ?? {})}/dia` : `Posto avançado renderia ${costLabel(def.outpost ?? {})} por dia`}</p>`;
    } else if (def.id === 'som') {
      const c = s.sound.captive ? g.unit(s.sound.captive.id) : null;
      html += `<p class="hint">${c ? `{alert} Preso lá: <b>${esc(c.name)}</b>. Prazo: fim do dia ${s.sound.captive!.until}; depois ele recebe o selo amaldiçoado.` : 'Ninguém da vila está preso lá.'} Guardam o lugar: <b>${SOUND_MEMBERS.hakkotsu.name}</b>, ${esc(SOUND_MEMBERS.hakkotsu.title)}, e dois membros.</p>`;
    } else if (def.kind === 'hideout') {
      html += `<p class="hint">${s.org.done ? '{check} A Ordem foi destruída.' : `Guardam o covil: ${lairGuards(s).map((id) => `<b>${ORG_MEMBERS[id].name}</b>, ${esc(ORG_MEMBERS[id].title)}`).join(' e ')}.`}</p>`;
    } else if (def.contract) {
      const c = CONTRACTS[def.contract];
      const owners = s.units.filter((u) => !u.dead && u.ninja?.contract === def.contract).map((u) => esc(u.name.split(' ').pop()!));
      html += `<p class="hint">{scroll} ${c.name}: ${esc(c.desc)}${owners.length ? ` Contratados: ${owners.join(', ')}.` : ''}</p>`;
    }
    // próximo passo sugerido para o lugar
    if (def.kind === 'village') {
      const next =
        st.status === 'vassal'
          ? 'É seu vassalo: manda tributo dobrado todo dia.'
          : st.rel >= REL.annexPeace
            ? 'Relação alta: já dá para <b>anexar em paz</b>.'
            : st.rel <= REL.annexForce
              ? 'Relação péssima: só dá para <b>anexar à força</b> (invasão jogável) ou saquear de novo.'
              : `Para anexar em paz: <b>proteja</b> e <b>comercie</b> até a relação chegar a ${REL.annexPeace}.`;
      html += `<p class="bnote">{info} ${next}</p></div>`;
    }
    // equipe que vai
    const teams = s.teams.filter((tm) => teamUnits(g, tm).length);
    if (!teams.length) return html + `<p class="why">Forme uma equipe em {ninja} Ninjas → Equipes.</p>`;
    if (this.regionTeam == null || !teams.some((tm) => tm.id === this.regionTeam)) this.regionTeam = teams[0]!.id;
    html += `<div class="bsec"><h4>{users} Equipe</h4><div class="fchips rteams">`;
    for (const tm of teams)
      html += `<button data-act="r-team" data-arg="${tm.id}" class="${this.regionTeam === tm.id ? 'on' : ''}" style="--c:${tm.color}"><span class="dot"></span>${esc(tm.name)} <small>{swords}${teamMinePower(g, tm.id)}</small></button>`;
    const tp = teamMinePower(g, this.regionTeam);
    const np = nodePower(s, def);
    const k = tp / Math.max(1, np);
    const sel = g.team(this.regionTeam);
    const fit: [string, string] = k >= 1.5 ? ['folgado', 'safe'] : k >= 1 ? ['equilibrado', 'good'] : k >= 0.7 ? ['arriscado', 'risky'] : ['muito perigoso', 'danger'];
    html += `</div><div class="rfit"><span class="faces">${sel ? teamUnits(g, sel).map((u) => this.face(u)).join('') : ''}</span><span class="mpill ${fit[1]}">{swords} ${tp} × defesas ${np} · ${fit[0]}</span></div></div>`;
    html += `<div class="bsec"><h4>{target} Ações</h4><div class="ractions">`;
    const busy = teamBusy(g, this.regionTeam);
    for (const a of nodeActions(def)) {
      const why = actionBlock(g, def.id, a);
      const cost = actionCost(def, a);
      const time = ACTION_TIME[a].travel * 2 + ACTION_TIME[a].work;
      html += `<button class="btn" data-act="r-go" data-arg="${a}" ${blocked(g, [why, busy], cost)} ${tipAttr(ACTION_LABEL[a], ACTION_TIP[a])}>
        <b>${ACTION_ICON[a] ?? ''} ${ACTION_LABEL[a]}</b><small>${a === 'raid' || a === 'explore' || a === 'contract' || a === 'assault' || (a === 'annex' && st.rel <= REL.annexForce) ? '{swords} mapa jogável' : `${cost ? `${costLabel(cost)} · ` : ''}~${time}s`}</small></button>`;
    }
    return html + `</div></div>`;
  }

  /** Janela Mundo → Expedições: andamento, diário e decisões de cada expedição. */
  /**
   * Cartão de expedição: equipe, lugar e ação, o que está fazendo (selo), retratos com a vida, barra e tempo, e o saque.
   * `full` (aba Expedições) mostra também o diário e as escolhas da mina.
   */
  private expCard(e: Expedition, t: Record<string, string>, b: Record<string, number>, full: boolean) {
    const g = this.app.game;
    const tm = g.team(e.teamId);
    const live = e.status !== 'done' && e.status !== 'lost';
    const total = e.status === 'going' || e.status === 'return' ? MINE.travel : MINE.floorTime;
    const mine = e.kind === 'mine';
    const where = mine ? `Mina · andar ${e.floor}/${MINE.floors}` : `${ACTION_LABEL[e.action!]} · ${REGION[e.node!]?.name ?? ''}`;
    const label: Record<Expedition['status'], [string, string, string]> = {
      going: ['A caminho', '{run}', 'good'], explore: [mine ? 'Explorando' : 'No serviço', mine ? '{pickaxe}' : '{shield}', 'safe'],
      choice: ['Andar concluído', '{check}', 'safe'], return: ['Voltando', '{back}', 'info'], done: ['Terminou', '{check}', 'info'],
      lost: ['Perdida', '{skull}', 'danger'], scene: [mine ? 'Jogando o andar' : 'Invasão jogável', '{swords}', 'danger'],
    };
    const [st, ic, cls] = label[e.status];
    let html = `<div class="xcard ${live ? '' : 'ended'}" style="--c:${tm?.color ?? '#888'}"><div class="xc-top"><span class="dot"></span><div class="xc-t"><b>${esc(tm?.name ?? 'Equipe')}</b><span>${esc(where)}</span></div><span class="mpill ${cls}">${ic} ${st}</span></div>`;
    const us = live ? expeditionUnits(g, e) : [];
    html += `<div class="xc-mid"><span class="faces">${us.map((u) => this.face(u)).join('')}</span>`;
    if (e.status === 'going' || e.status === 'explore' || e.status === 'return') {
      html += `<div class="xc-prog"><div class="nc-bar xp"><i data-b="ex${e.id}"></i></div><span>{hourglass} <span data-t="ex${e.id}"></span></span></div>`;
      b[`ex${e.id}`] = 1 - Math.max(0, e.timer) / total;
      t[`ex${e.id}`] = `${Math.ceil(Math.max(0, e.timer))}s`;
    } else if (e.status === 'scene') html += `<button class="btn danger mini" data-act="view-scene">{flag} Ver invasão</button>`;
    html += `</div>`;
    if (full && us.length) {
      html += `<div class="jm">${us.map((u) => `${esc(u.name.split(' ').pop()!)} <span data-t="exh${u.id}"></span>`).join(' · ')}</div>`;
      for (const u of us) t[`exh${u.id}`] = `${Math.round((u.hp / u.maxHp) * 100)}%`;
    }
    html += `<div class="xc-loot">{luggage} Saque: ${Object.keys(e.loot).length ? costLabel(e.loot) : '—'}</div>`;
    if (full) html += `<ul class="explog">${e.log.slice(-5).map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`;
    if (e.status === 'choice') {
      const next = e.floor + 1;
      html += `<div class="btnrow"><button class="btn primary" data-act="exp-deeper" data-arg="${e.id}">{pickaxe} Descer ao andar ${next} <small>{swords}${floorPower(next)}</small></button>
        <button class="btn" data-act="exp-back" data-arg="${e.id}">{run} Voltar com o saque</button></div>`;
    }
    return html + `</div>`;
  }

  private expeditionsView(): Built {
    const g = this.app.game;
    const t: Record<string, string> = {};
    const b: Record<string, number> = {};
    let html = this.tabs('expeditions');
    const caves = g.state.sites.filter((x) => x.kind === 'cave' && x.found);
    const list = [...g.state.expeditions].reverse();
    if (!list.length)
      html += `<div class="warnbox">{map} Nenhuma expedição ainda. ${
        caves.length ? 'Toque numa entrada de mina no mapa para mandar uma equipe.' : 'Explore o mapa (rotina Explorar dos ninjas) para achar entradas de mina.'
      }</div>`;
    if (caves.length)
      html += `<p class="hint">Minas conhecidas: ${caves.map((c) => `<button class="btn mini" data-act="site-open" data-arg="${c.id}">{pickaxe} Ver mina</button>`).join(' ')}</p>`;
    html += `<div class="xlist">${list.map((e) => this.expCard(e, t, b, true)).join('')}</div>`;
    return { html, t, b };
  }


  /** Ícone de um item: a espada recortada do sprite (lâminas lendárias) ou o ícone do item. */
  private itemIcon(id: string) {
    const d = ITEMS[id]!;
    return d.blade ? pimg(bladeIcon(d.blade), 'inv-blade') : `<span class="inv-ic">${d.icon}</span>`;
  }

  /**
   * Inventário do ninja (como nos RPGs): o boneco no meio com os espaços em volta (arma, colete, consumível) e o bônus
   * somado; embaixo a grade do estoque da vila, com filtro por tipo. Toque num item para equipar; num espaço para tirar.
   */
  private equipSection(u: Unit) {
    const g = this.app.game;
    const e = u.ninja!.equip;
    const slot = (k: ItemSlot, area: string) => {
      const id = e[k];
      const d = id ? ITEMS[id] : undefined;
      const state = k === 'item' && d ? (e.itemReady ? 'pronto' : 'gasto, repõe na vila') : '';
      if (!d) return `<div class="inv-slot empty" style="grid-area:${area}"><span class="inv-sl">${SLOT_LABEL[k]}</span><span class="inv-none">{plus}</span></div>`;
      return `<button class="inv-slot" style="grid-area:${area}" data-act="unequip" data-arg="${k}" ${tipAttr(d.name, `${d.desc} Toque para tirar.`)}><span class="inv-sl">${SLOT_LABEL[k]}</span>${this.itemIcon(d.id)}<small>${esc(d.name)}${state ? ` · ${state}` : ''}</small></button>`;
    };
    const gb = gearBonus(u);
    let html = `<div class="inv"><div class="inv-doll">${slot('weapon', 'w')}<span class="inv-fig" style="grid-area:f">${pimg(unitPortrait(u, true))}</span>${slot('armor', 'a')}${slot('item', 'i')}
      <div class="inv-stats" style="grid-area:s"><span>{swords} +${gb.melee} dano</span><span>{kunai} +${gb.kunai} kunai</span><span>{shield} ${Math.round(gb.defense * 100)}% defesa</span><span>{medic} +${gb.hp} vida</span></div></div>`;
    // grade do estoque
    const stockList = ITEM_LIST.filter((d) => stock(g, d.id) > 0);
    const count = (k: ItemSlot | 'all') => stockList.filter((d) => k === 'all' || d.slot === k).length;
    html += `<div class="inv-head"><b>{luggage} Estoque da vila</b><span class="chips">${(['all', 'weapon', 'armor', 'item'] as const)
      .map((k) => `<button data-act="inv-filter" data-arg="${k}" class="${this.invFilter === k ? 'on' : ''}">${k === 'all' ? 'Tudo' : SLOT_LABEL[k]} ${count(k)}</button>`)
      .join('')}</span></div>`;
    const list = stockList.filter((d) => this.invFilter === 'all' || d.slot === this.invFilter);
    if (!list.length) html += `<p class="hint">${stockList.length ? 'Nada deste tipo no estoque.' : 'Estoque vazio. Fabrique na Forja, Farmácia ou Oficina de Selos.'}</p>`;
    else {
      html += `<div class="inv-grid scrollist">`;
      for (const d of list) {
        const cur = e[d.slot] ? ITEMS[e[d.slot]!] : undefined;
        const better = d.slot === 'weapon' ? (d.bonus?.melee ?? 0) > (cur?.bonus?.melee ?? 0) : d.slot === 'armor' ? (d.bonus?.defense ?? 0) > (cur?.bonus?.defense ?? 0) : !cur;
        const why = canWield(u, d.id);
        html += `<button class="inv-cell ${d.blade ? 'legend' : ''}" data-act="equip" data-arg="${d.id}" ${blocked(g, [why])} ${tipAttr(d.name, `${SLOT_LABEL[d.slot]}. ${d.desc}`)}>${this.itemIcon(d.id)}<span class="inv-n">${esc(d.name)}</span><b class="inv-q">×${stock(g, d.id)}</b>${better && !why ? '<span class="inv-up">{up}</span>' : ''}</button>`;
      }
      html += `</div>`;
    }
    if (stockList.length) html += `<div class="btnrow"><button class="btn" data-act="autoequip">{gear} Equipar o melhor</button></div>`;
    return html + `</div>`;
  }

  /** Aba Ficha: ensinar jutsu, promoção e clã. */
  private ninjaCareer(u: Unit) {
    const n = u.ninja!;
    const g = this.app.game;
    let html = '';
    if (catchingUp(g, u)) html += `<p class="hint">{up} Bem abaixo da média da vila: treina com <b>XP em dobro</b> até alcançar os outros.</p>`;
    if (isRookie(u) && g.state.flags.shelterRookies) html += `<p class="hint">{ninja} Novato: se abriga de inimigos fortes demais (Proteger novatos, na lista de Ninjas).</p>`;
    // blocos: profissão, contrato, ninken e equipe
    html += `<div class="ftiles">`;
    html += `<div class="ftile"><small>{medal} Profissão</small>`;
    if (n.spec) html += `<b>${SPECS[n.spec].name}</b><span>${esc(SPECS[n.spec].desc)}</span>`;
    else {
      html += `<span>Chunin+ aprende uma:</span><div class="btnrow">`;
      for (const k of Object.keys(SPECS) as SpecKind[])
        html += `<button class="btn mini" data-act="spec" data-arg="${k}" ${blocked(g, [specBlock(g, u, k)], SPECS[k].cost)} ${tipAttr(SPECS[k].name, `${SPECS[k].desc} Custo: ${plainTokens(costLabel(SPECS[k].cost))}.`)}>${SPECS[k].icon} ${SPECS[k].name}</button>`;
      html += `</div>`;
    }
    html += `</div><div class="ftile"><small>{scroll} Contrato</small>`;
    html += n.contract
      ? `<b>${CONTRACTS[n.contract].name}</b><span>${CONTRACTS[n.contract].chakra} chakra · a cada ${CONTRACTS[n.contract].cd}s</span>`
      : `<b>Nenhum</b><span>Os lugares sagrados (Mundo → Região) dão contratos.</span>`;
    const dog = dogOf(g, u);
    html += `</div><div class="ftile"><small>{paw} Ninken</small>`;
    html += dog
      ? `<b>${esc(dog.name)}</b><span>${esc(BREEDS[dog.breed ?? 'shiba'].name)} · vida ${Math.ceil(dog.hp)}/${dog.maxHp}</span><button class="btn mini" data-act="dog-release" data-arg="${u.id}" ${tipAttr('Soltar o cão', 'O cão volta para o Canil e pode ir para outro ninja sem custo.')}>{x} Soltar</button>`
      : `<button class="btn mini" data-act="dog" ${blocked(g, [dogBlock(g, u, this.dogBreed)], DOG_COST)} ${tipAttr('Ninken', `Cão ninja que acompanha o ninja, luta junto, fareja espiões invisíveis e, fora da vila, acha ervas. Raça: ${BREEDS[this.dogBreed].name} (escolha no Canil). Custo: ${plainTokens(costLabel(DOG_COST))}.`)}>{paw} Adotar ${esc(BREEDS[this.dogBreed].name)}</button>`;
    const team = teamOf(g, u);
    html += `</div><div class="ftile"><small>{users} Equipe</small>`;
    html += team
      ? `<b><span class="dot" style="--c:${team.color}"></span>${esc(team.name)}</b><span>${team.senseiId === u.id ? 'Sensei' : 'Membro'}</span><button class="btn mini" data-act="open-team" data-arg="${team.id}">{users} Ver equipe</button>`
      : `<b>Sem equipe</b><span>Monte equipes em Ninjas → Equipes.</span>`;
    html += `</div></div>`;
    // ações: ensinar, promover, fundar clã, ver no mapa
    html += `<div class="factions"><button class="btn primary" data-act="teach-open">{books} Ensinar jutsu</button>`;
    const next = nextRank(u);
    if (next === 'kage') {
      html += `<span class="hint">{kage} Jounin de nível ${KAGE_MIN_LEVEL}+ pode ser eleito Kage na Residência do Hokage.</span>`;
    } else if (next) {
      const r = RANKS[next];
      const villageOk = (r.minVillageLevel ?? 0) <= g.state.level;
      html += `<button class="btn" data-act="promote" ${blocked(g, [n.level < r.minLevel && `Precisa chegar ao nível ${r.minLevel} (está no ${n.level}).`, !villageOk && `A vila precisa ser ${levelDef(r.minVillageLevel!).name}.`], r.promoteCost)} ${tipAttr(`Promover a ${r.name}`, `Custo: ${plainTokens(costLabel(r.promoteCost))}. Nível mínimo ${r.minLevel}.`)}>{medal} Promover a ${r.name}</button>`;
    }
    if (n.rank !== 'genin' && !clanOf(g, u)) {
      const fc = canFoundClan(g, u);
      html += `<button class="btn" data-act="found-clan" ${blocked(g, [!fc.ok && fc.error !== 'Recursos insuficientes.' && fc.error], FOUND_COST)} ${tipAttr(`Fundar clã ${surname(u)}`, `Custo: ${plainTokens(costLabel(FOUND_COST))}.`)}>{castle} Fundar clã</button>`;
    }
    html += `<button class="btn ghost" data-act="pick" data-arg="${u.id}">{pin} Ver no mapa</button></div>`;
    return html;
  }

  private teamSection(u: Unit, team: Team | undefined) {
    const g = this.app.game;
    let html = `<h4>Equipe</h4>`;
    if (team) {
      const role = team.senseiId === u.id ? 'Sensei' : 'Membro';
      html += `<div class="teamtag" style="--c:${team.color}"><span class="dot"></span><b>${esc(team.name)}</b> · ${role}</div>
        <div class="btnrow"><button class="btn" data-act="open-team" data-arg="${team.id}">{users} Ver equipe</button><button class="btn" data-act="team-leave">Sair</button></div>`;
      return html;
    }
    if (u.ninja!.rank === 'kage') return html + `<p class="hint">O Kage não entra em equipes.</p>`;
    const lead = u.ninja!.rank !== 'genin';
    html += `<div class="btnrow">`;
    for (const t of g.state.teams) {
      if (lead && t.senseiId == null)
        html += `<button class="btn" data-act="team-join" data-arg="${t.id}" data-slot="sensei" style="--c:${t.color}"><span class="dot"></span>Sensei de ${esc(t.name)}</button>`;
      if (t.memberIds.length < MAX_MEMBERS)
        html += `<button class="btn" data-act="team-join" data-arg="${t.id}" data-slot="member" style="--c:${t.color}"><span class="dot"></span>${esc(t.name)} (${t.memberIds.length}/${MAX_MEMBERS})</button>`;
    }
    html += `<button class="btn" data-act="team-create-with">{plus} Nova equipe</button></div>`;
    return html;
  }

  private teach(u: Unit): Built {
    const n = u.ninja!;
    const g = this.app.game;
    const academy = g.findBuilt('academy');
    const nat = NATURES[n.nature];
    let html = `<div class="ph"><div class="row"><button class="btn icon" data-act="teach-back" title="Voltar">{back}</button><div class="title">Ensinar jutsu</div></div></div>`;
    html += `<p class="hint">${esc(u.name)} · ${nat.kanji} ${nat.name} · rank máx ${JUTSU_RANK_LABEL[RANKS[n.rank].maxJutsuRank]}. Só aprende jutsus da sua natureza ou neutros.</p>`;
    if (!academy) html += `<div class="warnbox">Construa a <b>Academia Ninja</b> para ensinar jutsus.</div>`;
    if (n.learning) html += `<div class="warnbox">Já está estudando ${esc(JUTSUS[n.learning.jutsuId]!.name)}.</div>`;
    const free = n.jutsu[0] === null ? 0 : n.jutsu[1] === null ? 1 : -1;
    // jutsus da natureza dele que ainda esperam o pergaminho ser aberto na Biblioteca
    const waiting = LIBRARY_JUTSUS.filter((j) => !isOpen(g.state, j.id) && (j.nature === null || j.nature === n.nature)).length;
    if (waiting)
      html += `<p class="hint">{books} Mais ${waiting} jutsu(s) para ${esc(u.name.split(' ')[0]!)}: abra o pergaminho na <b>Biblioteca</b>${libraryLevel(g) ? '' : ' (construa-a primeiro)'}.</p>`;
    html += `<div class="scrollist jscroll">`; // os cartões rolam por dentro; o "Voltar" e os avisos ficam à vista
    for (const o of jutsuOptions(u, studyable(g.state))) {
      const d = o.def;
      const afford = g.canAfford(d.cost);
      const learnBlock = blocked(g, [!academy && 'Construa a Academia Ninja para ensinar jutsus.', !!n.learning && 'Já está estudando outro jutsu.'], d.cost);
      html += `<div class="jcard ${o.ok ? '' : 'locked'}" style="--c:${d.color}"><div class="jn">${esc(d.name)}</div>
        <div class="jm">Rank ${JUTSU_RANK_LABEL[d.rank]} · ${JUTSU_TYPE_LABEL[d.type]} · ${d.chakra} chakra · ${costLabel(d.cost)} · ${d.learnTime}s</div>
        <div class="jd">${esc(d.desc)}</div>`;
      if (!o.ok) html += `<div class="why">${esc(o.reason ?? '')}</div>`;
      else {
        html += `<div class="jb">`;
        if (free >= 0) html += `<button class="btn primary" data-act="learn" data-arg="${d.id}" data-slot="${free}" ${learnBlock}>Aprender (slot ${free + 1})</button>`;
        else
          for (const s of [0, 1])
            html += `<button class="btn" data-act="learn" data-arg="${d.id}" data-slot="${s}" ${learnBlock}>Substituir ${esc(JUTSUS[n.jutsu[s]!]!.shout.replace('!', ''))}</button>`;
        html += `</div>`;
        if (!afford) html += `<div class="why">Faltam recursos</div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
    return { html, t: {}, b: {} };
  }

  private building(bd: Building): Built {
    const g = this.app.game;
    const d = BUILDINGS[bd.type];
    const t: Record<string, string> = {};
    const b: Record<string, number> = {};
    if (g.state.sceneInfo)
      return {
        html: `<div class="ph"><div class="title">${d.icon} ${d.name}</div><div class="badges"><span class="badge enemy">Do inimigo</span></div></div><p class="hint">${d.desc}</p>${
          bd.id === g.state.sceneInfo.warehouseId ? `<p class="hint">{ryo} <b>Armazém:</b> fique na porta sem guardas por perto para saquear.</p>` : ''
        }${bd.type === 'tower' ? `<p class="why">A torre atira kunais na sua equipe.</p>` : ''}`,
        t,
        b,
      };
    let html = this.buildingHead(bd);
    // aba "Lá dentro" para prédios com interior (moradia ou alguém dentro agora)
    const inside = d.walkable ? [] : occupantsOf(g, bd);
    const hasInside = bd.built && !d.walkable && (inside.length > 0 || !!d.housing);
    if (hasInside) {
      html += `<div class="mtabs subtabs"><button data-act="btab" data-arg="main" class="${this.buildingTab === 'main' ? 'on' : ''}">{scroll} Geral</button>
        <button data-act="btab" data-arg="inside" class="${this.buildingTab === 'inside' ? 'on' : ''}">{eye} Lá dentro (${inside.length})</button></div>`;
      if (this.buildingTab === 'inside') {
        if (d.housing) {
          const residents = g.villagers().filter((u) => u.homeId === bd.id).length;
          html += `<p class="hint">Moradia: <span data-t="res"></span> moradores</p>`;
          t.res = `${residents} / ${housingOf(bd)}`;
        }
        return { html: html + this.interiorSection(bd, t, b), t, b };
      }
    }
    if (!bd.built) {
      html += `<div class="bsec"><h4>{hammer} Em construção ${infoTip('Em construção', 'Moradores sem emprego vão até a obra para construir.')}</h4><div class="bar pg"><i data-b="prog"></i><span data-t="prog"></span></div></div>`;
      b.prog = Math.min(1, bd.progress / d.buildTime);
      t.prog = `${Math.floor(b.prog * 100)}%`;
    } else {
      html += this.upgradeSection(bd, t, b);
      if (bd.type === 'hokage') html += this.villageSummary();
      if (bd.type === 'missions') html += this.missionsSummary() + this.hireSection();
      if (isWorkshop(bd.type)) html += this.workshopSection(bd, t, b);
      if (bd.type === 'arena') html += this.arenaSection(b);
      if (bd.type === 'sealshop') html += `<p class="hint">{paper} Artesão faz papel sozinho ${infoTip('Artesão', 'Sem pedidos, o artesão faz 1{paper} com 4{wood} a cada 8 s (se houver 30{wood} ou mais).')}</p>`;
      if (d.workers) {
        // uma marca por vaga: cheia = trabalhando, contorno = pedido (a caminho), apagada = vaga livre
        const max = workersOf(bd);
        const pips = Array.from({ length: max }, (_, i) => `<i class="${i < bd.workers.length ? 'on' : i < bd.desired ? 'want' : ''}"></i>`).join('');
        html += `<div class="bsec"><h4>{users} Trabalhadores ${infoTip('Trabalhadores', `Toque + e − para pedir moradores para este prédio (até ${max}). Cada marca é uma vaga: cheia = trabalhando, contorno = pedido e a caminho, apagada = livre.`)}</h4><div class="workers"><button class="btn" data-act="workers" data-arg="-1">{minus}</button>
          <span class="wnum"><b><span data-t="workers"></span><small>/${max}</small></b><span class="wpips">${pips}</span></span>
          <button class="btn primary" data-act="workers" data-arg="1">{plus}</button></div>`;
        t.workers = String(bd.workers.length);
        if (bd.workers.length < bd.desired) {
          const idle = g.villagers().filter((u) => u.jobId == null).length;
          html += `<p class="${idle ? 'bnote' : 'why'}">{alert} ${idle ? 'Os moradores livres estão a caminho.' : 'Faltam moradores livres: todos já trabalham. Construa casas para a vila crescer ou tire gente de outro prédio.'}</p>`;
        }
        html += this.gatherInfo(bd) + `</div>`;
      }
      if (d.housing) {
        const residents = g.villagers().filter((u) => u.homeId === bd.id).length;
        html += `<div class="bsec"><h4>{house} Moradia</h4><div class="bslots"><b data-t="res"></b><span>moradores</span></div></div>`;
        t.res = `${residents} / ${housingOf(bd)}`;
      }
      if (bd.type === 'kennel') html += this.kennelSection();
      if (bd.type === 'library') html += this.librarySection();
      if (bd.type === 'hospital' && bd.built) {
        const base = Math.round(Math.min(CARE.rescueMax, CARE.rescue + (levelOf(bd) - 1) * CARE.rescuePerLevel) * 100);
        html += `<p class="hint">{medic} <b>Resgate:</b> ${base}% · +${Math.round(CARE.rescueMedic * 100)}% com médico ${infoTip('Resgate', `Ninja da vila que cair tem ${base}% de chance de ser trazido para cá gravemente ferido, em vez de morrer (+${Math.round(CARE.rescueMedic * 100)}% com um ninja médico por perto, até ${Math.round(CARE.rescueMax * 100)}%). Cada nível do Hospital aumenta a chance.`)}</p>`;
      }
      if (bd.type === 'market') {
        html += this.marketSection(bd) + this.rareSection();
        html += `<h4>{gold} Ouro ${infoTip('Ouro', `O mercado compra o ouro das minas por ${GOLD_PRICE}{ryo} cada.`)}</h4>`;
        html += `<div class="btnrow"><button class="btn" data-act="sell-gold" data-arg="1" ${blocked(g, [g.state.res.gold < 1 && 'Sem ouro. Ele vem das partes fundas das minas.'])}>{gold} Vender 1 <small class="bcost">+${GOLD_PRICE}{ryo}</small></button>
          <button class="btn" data-act="sell-gold" data-arg="all" ${blocked(g, [g.state.res.gold < 1 && 'Sem ouro. Ele vem das partes fundas das minas.'])}>Vender tudo</button></div>`;
      }
      if (bd.type === 'academy') {
        const villagers = g.state.units.filter((u) => !u.dead && u.kind === 'villager').length;
        html += `<div class="bsec"><h4>{userplus} Recrutamento ${infoTip('Recrutamento', 'Transforma um morador em Genin. Alguns já nascem com jutsu, outros precisam estudar aqui.')}</h4>
          <div class="wtools"><button class="btn primary" data-act="recruit" ${blocked(g, [villagers <= 1 && 'Precisa sobrar pelo menos um morador na vila.'], RECRUIT_COST)}>{ninja} Recrutar ${costTag(RECRUIT_COST)}</button></div></div>`;
        html += `<div class="bsec"><h4>{books} Ensino ${infoTip('Ensino', 'Para escolher o jutsu de alguém: selecione o ninja → "Ensinar jutsu".')}</h4><div class="wtools">${this.teachBar()}</div></div>`;
      }
      if (bd.type === 'training') html += this.fieldSection(bd, t);
      if (d.healRate) html += `<p class="hint">Cura ${d.healRate} HP/s de quem descansa aqui.</p>`;
    }
    html += `<div class="bfoot"><button class="btn ghost" data-act="move">{refresh} Mover <small>grátis</small></button>`;
    if (bd.type !== 'hokage')
      html += `<button class="btn danger" data-act="demolish">${this.armedDemolish ? 'Toque de novo para confirmar' : `{trash} Demolir <small>devolve ${bd.built ? '50%' : '100%'}</small>`}</button>`;
    html += `</div>`;
    return { html, t, b };
  }

  /** Campo de Treino: vagas e foco. */
  private fieldSection(bd: Building, t: Record<string, string>) {
    const g = this.app.game;
    t.slots = `${trainees(g, bd)} / ${trainSlots(bd)}`;
    const used = trainees(g, bd);
    const total = trainSlots(bd);
    let html = `<div class="bsec"><h4>{users} Vagas ${infoTip('Vagas', `Ninjas no modo Auto/Treinar vêm aqui de dia e ganham atributos e XP; cada um vai ao campo com vaga mais perto, preferindo o do seu foco.${levelOf(bd) < 3 ? ' O upgrade abre mais vagas.' : ''}`)}</h4><div class="bslots"><b data-t="slots"></b><span>treinando agora</span><span class="pips">${Array.from({ length: total }, (_, i) => `<i class="${i < used ? 'on' : ''}"></i>`).join('')}</span></div></div>`;
    html += `<div class="bsec"><h4>{target} Foco do campo ${infoTip(
      'Foco do campo',
      bd.focus
        ? `${STAT_INFO[bd.focus].label}: +${Math.round((FIELD_FOCUS_BONUS - 1) * 100)}% neste atributo. Ninjas sem foco próprio treinam ${STAT_INFO[bd.focus].label} aqui.`
        : 'Com vários campos, dê um foco diferente a cada um (ex.: um de Taijutsu, outro de Ninjutsu).',
    )}</h4><div class="chips">`;
    html += `<button data-act="field-focus" data-arg="" class="${bd.focus ? '' : 'on'}" ${tipAttr('Livre', 'Sem especialidade: cada ninja treina o próprio foco (ou o que o sensei/acaso escolher).')}>Livre</button>`;
    for (const k of STAT_KEYS)
      html += `<button data-act="field-focus" data-arg="${k}" class="${bd.focus === k ? 'on' : ''}" ${tipAttr(STAT_INFO[k].label, `Treino de ${STAT_INFO[k].label} rende +${Math.round((FIELD_FOCUS_BONUS - 1) * 100)}% aqui. Ninjas sem foco próprio treinam isto; quem tem esse foco prefere este campo.`)}>${STAT_INFO[k].label}</button>`;
    html += `</div></div>`;
    return html;
  }

  /** Mercado: o que vende do excedente. */
  private marketSection(bd: Building) {
    const m = marketLot(bd);
    let html = `<h4>{ryo} Vende o excedente ${infoTip(
      'Vende o excedente',
      m
        ? `A cada venda (8 s) leva até ${m.lot} ${RES_INFO[bd.sells!].icon} por +${m.ryo}{ryo}, sempre deixando ${m.keep} no estoque. Dois mercados podem escoar coisas diferentes.`
        : 'Escolha uma mercadoria para o comerciante vender o que sobrar no estoque (madeira, pedra, comida ou ervas).',
    )}</h4><div class="chips">`;
    html += `<button data-act="market-good" data-arg="" class="${bd.sells ? '' : 'on'}" ${tipAttr('Nada', 'Só o ryo de sempre do comerciante.')}>Nada</button>`;
    for (const k of MARKET_GOOD_LIST) {
      const d = MARKET_GOODS[k];
      html += `<button data-act="market-good" data-arg="${k}" class="${bd.sells === k ? 'on' : ''}" ${tipAttr(d.name, `Vende ${d.name.toLowerCase()} acima de ${d.keep} no estoque, a ${d.price} ryo cada.`)}>${RES_INFO[k].icon} ${d.name}</button>`;
    }
    return html + `</div>`;
  }

  /** Ensino de jutsus: ensinar agora quem tem espaço livre e o modo automático. */
  private teachBar() {
    const g = this.app.game;
    const free = g.state.units.filter((u) => !u.dead && u.kind === 'ninja' && u.faction === 'village' && u.ninja && !u.ninja.learning && u.ninja.jutsu.includes(null)).length;
    return `<button class="btn" data-act="teach-all" ${blocked(g, [!g.findBuilt('academy') && 'Construa a Academia Ninja.', !free && 'Ninguém com espaço livre para jutsu.'])} ${tipAttr(
      'Ensinar',
      'Cada ninja com espaço livre vai estudar o melhor jutsu que pode aprender (pela natureza, rank e atributos dele). Paga o ryo de cada jutsu.',
    )}>{books} Ensinar (${free})</button>
      ${togBtn('auto-teach', !!g.state.flags.autoTeach, '{scroll} Auto-ensino', 'Ensino automático', `Ligado: a Academia manda sozinha quem tiver espaço livre estudar (até ${maxLearners(g)} ao mesmo tempo, para não esvaziar a defesa). Jutsus proibidos ficam de fora.`)}`;
  }

  /** Mesa de Missões: contratar ninjas mercenários (destino para o ryo). */
  private hireSection() {
    const g = this.app.game;
    let html = `<h4>{ninja} Contratar mercenário ${infoTip('Mercenários', 'Ninjas errantes servem a vila por ryo. Chegam prontos, mas ocupam uma vaga de casa.')}</h4><div class="btnrow">`;
    for (const r of ['chunin', 'jounin'] as const) {
      const m = MERCS[r];
      const why = hireBlock(g, r);
      html += `<button class="btn primary" data-act="hire" data-arg="${r}" ${blocked(g, [why && !why.startsWith('Custa') && why], m.cost)}>${RANKS[r].name} nv ${m.level} ${costTag(m.cost)}</button>`;
    }
    return html + `</div>`;
  }

  /** Mercado: materiais raros (antes só das minas) para os itens lendários. */
  private rareSection() {
    const g = this.app.game;
    let html = `<h4>{crystal} Materiais raros ${infoTip('Materiais raros', 'Mercadores de longe trazem cristal de chakra e aço negro, usados nos itens lendários da Forja e da Farmácia.')}</h4><div class="btnrow">`;
    for (const res of ['crystal', 'darksteel'] as const) {
      const price = RARE_PRICE[res]!;
      for (const n of [1, 5])
        html += `<button class="btn" data-act="buy-rare" data-arg="${res}:${n}" ${blocked(g, [g.state.level < 2 && 'Só para uma Vila Oculta.'], { ryo: price * n })}>${RES_INFO[res].icon} +${n} · ${price * n}{ryo}</button>`;
    }
    return html + `</div>`;
  }

  /** Janela das Oficinas: Forja, Farmácia e Selos lado a lado, com produção, fila, receitas e fabricação automática. */
  private craftsView(): Built {
    const g = this.app.game;
    const t: Record<string, string> = {};
    const b: Record<string, number> = {};
    const ninjas = g.state.units.filter((u) => !u.dead && u.kind === 'ninja' && u.faction === 'village' && u.ninja);
    const lack = (slot: ItemSlot) => ninjas.filter((u) => !u.ninja!.equip[slot]).length;
    const on = !!g.state.flags.autoGear;
    const chip = (n: number, ic: string, label: string) => `<span class="mchip ${n ? 'bad' : ''}">${ic} ${n} ${label}</span>`;
    let html = this.winTop(
      '{anvil} Oficinas',
      `<span class="mchip">{ninja} ${ninjas.length}</span>${chip(lack('weapon'), '{kunai}', '')}${chip(lack('armor'), '{vest}', '')}${chip(lack('item'), '{pill}', '')}`,
      `<button class="btn" data-act="gear-all" ${tipAttr('Equipar', 'Passa o melhor do estoque para cada ninja; os mais fortes escolhem primeiro.')}>{kunai} Equipar</button>
       ${togBtn('gear-auto', on, '{gear} Auto', 'Equipamento automático', 'Ligado: a cada poucos segundos o que for fabricado vai sozinho para quem precisa.')}`,
      (['forge', 'pharmacy', 'sealshop'] as const).map((k): [string, string, boolean, string] => [k, `${BUILDINGS[k].icon} ${k === 'sealshop' ? 'Selos' : BUILDINGS[k].name}`, this.craftTab === k, 'craft-tab']),
    );
    // uma oficina por vez (menos coisa atualizando o tempo todo e mais espaço para as receitas)
    html += `<div class="craftone">${this.craftCard(this.craftTab, t, b)}</div>`;
    return { html, t, b };
  }

  /**
   * Uma oficina na janela: arte e nível, artesão, estoque, produção atual, fila em casas, receitas (com +1/+5 e
   * "Manter" do nível 2 em diante) e o upgrade.
   */
  private craftCard(type: 'forge' | 'pharmacy' | 'sealshop', t: Record<string, string>, b: Record<string, number>) {
    const g = this.app.game;
    const d = BUILDINGS[type];
    const bd = g.state.buildings.find((x) => x.type === type);
    const lvl = bd ? levelOf(bd) : 1;
    const url = (lvl > 1 && artUrl(`${type}-${lvl}`)) || artUrl(type);
    let html = `<div class="wscard"><div class="wshead"><span class="ws-art">${url ? pimg(url) : d.icon}</span><div class="ws-hmain">
      <span class="wsname">${d.icon} ${esc(d.name)}</span>`;
    if (!bd) return html + `</div></div><p class="why">Ainda não construída. Abra Construir (B) para erguer: ${esc(d.name)}.</p></div>`;
    html += `<span class="mchip">Nv ${lvl}</span>`;
    if (!bd.built) return html + `</div></div><p class="hint">{hammer} Em obra…</p></div>`;
    html += bd.workers.length
      ? `<span class="mpill safe">{users} Artesão trabalhando</span>`
      : `<span class="ws-noone"><span class="mpill danger">{users} Sem artesão</span><button class="btn mini" data-act="ws-worker" data-arg="${bd.id}">{plus} Chamar</button></span>`;
    html += `</div></div>`;
    const recipes = recipesOf(type);
    // estoque
    html += `<div class="ws-sec ws-a"><h4>{luggage} Estoque</h4><div class="ws-stock">${recipes
      .map((r) => `<span class="ws-it" ${tipAttr(r.name, `${r.desc} (${SLOT_LABEL[r.slot]})`, true)}><span class="ws-ic">${r.icon}</span><span>${esc(r.name)}</span><b>${stock(g, r.id)}</b></span>`)
      .join('')}</div></div>`;
    // produção e fila
    const q = bd.queue ?? [];
    const used = q.length + (bd.craft ? 1 : 0);
    const max = queueMax(bd);
    html += `<div class="ws-sec ws-b"><h4>{hammer} Produção atual</h4>`;
    if (bd.craft) {
      const it = ITEMS[bd.craft.itemId]!;
      const k = `cr${bd.id}`;
      b[k] = bd.craft.progress / it.craftTime;
      t[k] = `${Math.floor(b[k] * 100)}%`;
      html += `<div class="ws-now"><span class="ws-ic big">${it.icon}</span><div><b>${esc(it.name)}</b><div class="xc-prog"><div class="nc-bar xp"><i data-b="${k}"></i></div><span data-t="${k}"></span></div></div></div>`;
    } else html += `<div class="ws-now idle"><span class="ws-ic big">{gear}</span><b>Nada em produção</b></div>`;
    html += `<h4>{todo} Fila de produção <small>${used}/${max}</small></h4><div class="ws-queue">`;
    for (let i = 0; i < max; i++) {
      const id = i === 0 ? bd.craft?.itemId : q[bd.craft ? i - 1 : i];
      html += id ? `<span class="ws-slot on" ${tipAttr(ITEMS[id]!.name, i === 0 && bd.craft ? 'Em produção.' : 'Na fila.', true)}>${ITEMS[id]!.icon}</span>` : `<span class="ws-slot"></span>`;
    }
    if (used) html += `<button class="ws-slot x" data-act="ws-cancel" data-arg="${bd.id}" ${tipAttr('Cancelar o último', 'Devolve os recursos do último pedido.')}>{x}</button>`;
    html += `</div></div>`;
    // receitas
    const auto = canAutoCraft(bd);
    html += `<div class="ws-sec ws-r"><h4>{scroll} Receitas</h4><div class="scrollist">`;
    for (const r of recipes) {
      const locked = (r.minLevel ?? 0) > g.state.level;
      const keep = bd.keep?.[r.id] ?? 0;
      const time = Math.round(r.craftTime / craftMult(bd));
      html += `<div class="wsrow ${locked ? 'locked' : ''}"><span class="ws-ic">${r.icon}</span><div class="wsr-main"><div class="wsr-top"><span class="wsr-name" ${tipAttr(r.name, `${r.desc} (${SLOT_LABEL[r.slot]})`)}>${esc(r.name)}</span><span class="mchip">${stock(g, r.id)} no estoque</span></div>
        <div class="wsr-cost">${costLabel(r.cost)} · ${time}s</div>`;
      if (locked) html += `<div class="why">{lock} Requer ${levelDef(r.minLevel!).name}</div>`;
      else if (r.blade) {
        // lâmina lendária: única, forjada uma vez (sem lote e sem "Manter")
        const why = craftBlock(g, bd, r.id);
        const done = g.state.blades.includes(r.blade);
        html += `<div class="wsr-acts">${done ? `<span class="mpill safe">{check} Forjada</span>` : `<button class="btn mini primary" data-act="ws-craft" data-arg="${bd.id}:${r.id}:1" ${blocked(g, [used >= max && `A fila está cheia (máximo ${max}).`, why], r.cost)}>{anvil} Forjar</button>`}<span class="hint">Lendária, única${r.kageOnly ? ' · só o Kage usa' : ''}</span></div>`;
      } else {
        const full = used >= max && `A fila está cheia (máximo ${max}).`;
        html += `<div class="wsr-acts"><button class="btn mini primary" data-act="ws-craft" data-arg="${bd.id}:${r.id}:1" ${blocked(g, [full], r.cost)}>+1</button><button class="btn mini primary" data-act="ws-craft" data-arg="${bd.id}:${r.id}:5" ${blocked(g, [full], r.cost)}>+5</button>`;
        html += auto
          ? `<span class="chips wsr-keep"><span class="hint">Manter</span>${[0, 3, 5, 10, 20]
              .map((n) => `<button data-act="ws-keep" data-arg="${bd.id}:${r.id}:${n}" class="${keep === n ? 'on' : ''}">${n || 'não'}</button>`)
              .join('')}</span>`
          : `<span class="ws-lock">{lock} Nv ${AUTO_CRAFT_LEVEL} libera Manter</span>`;
        html += `</div>`;
      }
      html += `</div></div>`;
    }
    html += `</div></div>`;
    if (bd.upgrade != null) html += `<p class="hint">{up} Upgrade em obra…</p>`;
    else if (lvl < 3) {
      const st = upgradeStatus(g, bd);
      const cost = st.cost ?? {};
      const minV = UPGRADES[type]!.minVillage[lvl - 1] ?? 0;
      const req = minV > 0 ? `<span class="mchip ${g.state.level < minV ? 'bad' : 'good'}" ${tipAttr('Requisito', `A vila precisa ser ${levelDef(minV).name}.`, true)}>${levelDef(minV).icon} ${levelDef(minV).name}</span>` : '';
      const chips = req + RES_KEYS.filter((k) => cost[k]).map((k) => `<span class="mchip ${g.state.res[k] < cost[k]! ? 'bad' : ''}">${RES_INFO[k].icon} ${cost[k]}</span>`).join('');
      html += `<div class="bup ws-u"><div class="bup-t">{up} Melhorar para Nv ${lvl + 1}</div><div class="bup-row"><div class="bup-txt">${
        auto ? esc(UPGRADES[type]!.perks[lvl]!) : `No nível ${AUTO_CRAFT_LEVEL} ela fabrica sozinha para manter o estoque.`
      }<div class="bup-cost">${chips}</div></div><button class="btn primary" data-act="ws-upgrade" data-arg="${bd.id}" ${blocked(g, [st.reason !== 'Recursos insuficientes.' && st.reason], st.cost ?? undefined)}>{up} Nível ${lvl + 1}</button></div></div>`;
    }
    return html + `</div>`;
  }

  /** Proteger novatos: Genins se abrigam de inimigos fortes demais (com veteranos em casa para defender). */
  /** Equipar com o estoque agora e o modo automático (passa sozinho o que for sendo fabricado). */
  private gearBar(compact = false) {
    const on = !!this.app.game.state.flags.autoGear;
    return `<div class="wtools ${compact ? 'workshop-bar' : ''}"><button class="btn" data-act="gear-all" ${tipAttr('Equipar', 'Passa o melhor do estoque para cada ninja; os mais fortes escolhem primeiro.')}>{kunai} Equipar</button>
      ${togBtn('gear-auto', on, '{gear} Auto', 'Equipamento automático', 'Ligado: a cada poucos segundos o que for fabricado vai sozinho para quem precisa.')}</div>`;
  }

  /** Escolha da raça do próximo ninken (vale para o Canil e para o botão na ficha do ninja). */
  private breedPicker() {
    // cartão com o cão parado de frente (quadro do meio da linha 2 da folha 4×3)
    // ordenadas pelo nível do Canil que libera; o cão de lado (olhando para a direita), meio corpo dentro do cartão
    const g = this.app.game;
    let html = `<div class="breeds">`;
    for (const k of [...BREED_LIST].sort((a, b) => BREEDS[a].kennel - BREEDS[b].kennel)) {
      const d = BREEDS[k];
      const url = artUrl(breedArt(k));
      const pic = url ? `<span class="pic" style="background-image:url('${url}')"></span>` : `<span class="pic none">{paw}</span>`;
      const lock = breedBlock(g, k);
      html += `<button data-act="dog-breed" data-arg="${k}" class="breed ${this.dogBreed === k ? 'on' : ''} ${lock ? 'locked' : ''}" ${lock ? blocked(g, [lock]) : tipAttr(d.name, d.desc)}>${pic}<span class="n">${esc(d.name)}</span><span class="lv">${lock ? '{lock} ' : ''}Nv ${d.kennel}</span></button>`;
    }
    return html + `</div><p class="hint"><b>${esc(BREEDS[this.dogBreed].name)}:</b> ${esc(BREEDS[this.dogBreed].desc)}</p>`;
  }

  /**
   * Canil: quantos cães cabem (pelo nível), a raça escolhida, os ninjas SEM cão (adotar novo ou dar um que espera no
   * Canil) e os COM cão (soltar para passar a outro). As listas rolam por dentro, sem levar o topo junto.
   */
  private kennelSection() {
    const g = this.app.game;
    const ninjas = g.state.units.filter((u) => !u.dead && u.kind === 'ninja' && u.faction === 'village');
    const cap = dogCap(g);
    const all = villageDogs(g);
    const free = freeDogs(g);
    let html = '';
    // só o essencial: vagas e o custo de adotar (o que o cão faz já está na descrição do prédio e na raça escolhida)
    const chips = RES_KEYS.filter((k) => DOG_COST[k]).map((k) => `<span class="mchip ${g.state.res[k] < DOG_COST[k]! ? 'bad' : ''}">${RES_INFO[k].icon} ${DOG_COST[k]}</span>`).join('');
    html = `<div class="khead"><h4>{paw} Ninken <small class="${all.length > cap ? 'bad' : ''}">${all.length}/${cap} cães</small></h4><span class="bup-cost"><small>Adotar</small>${chips}</span></div>`;
    html += this.breedPicker();
    if (!ninjas.length) return html + `<p class="why">Nenhum ninja na vila.</p>`;
    // cão esperando no Canil: o escolhido na lista; sem escolha, o da raça escolhida
    const waiting = free.find((d) => d.id === this.dogPick) ?? free.find((d) => (d.breed ?? 'shiba') === this.dogBreed) ?? free[0];
    if (free.length)
      html += `<div class="bsec"><h4>{home} No Canil, sem dono <small>${free.length}</small></h4><div class="kfree scrollist">${free
        .map(
          (d) =>
            `<button class="${d === waiting ? 'on' : ''}" data-act="dog-pick" data-arg="${d.id}">{paw} <b>${esc(d.name.replace(' (ninken)', ''))}</b><small>${esc(BREEDS[d.breed ?? 'shiba'].name)} · vida ${Math.ceil(d.hp)}/${d.maxHp}</small></button>`,
        )
        .join('')}</div></div>`;
    const without = ninjas.filter((u) => !dogOf(g, u));
    const withDog = ninjas.filter((u) => dogOf(g, u));
    // uma lista por vez (abas); no máximo 20 ninjas, os de nível mais alto primeiro
    const MAX_ROWS = 20;
    const byLevel = (a: Unit, b: Unit) => b.ninja!.level - a.ninja!.level;
    html += `<div class="seg ktabs"><button data-act="kennel-tab" data-arg="without" class="${this.kennelTab === 'without' ? 'on' : ''}">{users} Sem cão ${without.length}</button><button data-act="kennel-tab" data-arg="with" class="${this.kennelTab === 'with' ? 'on' : ''}">{paw} Com cão ${withDog.length}</button></div>`;
    const more = (n: number) => (n > MAX_ROWS ? `<p class="hint">Mostrando ${MAX_ROWS} de ${n} (os de nível mais alto). Os outros: pelo inventário/ficha de cada ninja.</p>` : '');
    if (this.kennelTab === 'without') {
      if (!without.length) return html + `<p class="hint">Todos os ninjas já têm cão.</p>`;
      html += `<div class="roster scrollist">`;
      for (const u of without.sort(byLevel).slice(0, MAX_ROWS)) {
        const give = waiting
          ? `<button class="btn mini primary" data-act="dog-give" data-arg="${waiting.id}:${u.id}" ${blocked(g, [u.away != null && 'Está fora numa expedição.'])} ${tipAttr('Dar cão', `${waiting.name} (escolhido na lista do Canil) vai com este ninja, sem custo.`)}>{paw} Dar</button>`
          : '';
        const why = dogBlock(g, u, this.dogBreed);
        html += `<div class="cand krow">${this.face(u)}<span class="rn">${esc(u.name)}</span><span class="badges"><span class="badge rank">${RANKS[u.ninja!.rank].name}</span><span class="badge">Nv ${u.ninja!.level}</span></span><span class="btnrow">${give}<button class="btn mini ${give ? '' : 'primary'}" data-act="dog-for" data-arg="${u.id}" ${blocked(g, [why], DOG_COST)} ${tipAttr('Adotar', `Um ${BREEDS[this.dogBreed].name} para este ninja (a raça se escolhe acima).`)}>{plus} Adotar</button></span></div>`;
      }
      return html + `</div>${more(without.length)}`;
    }
    if (!withDog.length) html += `<p class="hint">Nenhum ninja com cão ainda.</p>`;
    else {
      html += `<div class="roster scrollist">`;
      for (const u of withDog.sort(byLevel).slice(0, MAX_ROWS)) {
        const d = dogOf(g, u)!;
        html += `<div class="cand krow">${this.face(u)}<span class="rn">${esc(u.name)}</span><span class="badges"><span class="badge">{paw} ${esc(d.name.replace(' (ninken)', ''))}</span><span class="badge">${esc(BREEDS[d.breed ?? 'shiba'].name)}</span></span><span class="btnrow"><button class="btn mini" data-act="dog-release" data-arg="${u.id}" ${tipAttr('Soltar o cão', 'O cão volta para o Canil e fica esperando: dá para passá-lo a outro ninja sem custo.')}>{x} Soltar</button></span></div>`;
      }
      html += `</div>${more(withDog.length)}`;
    }
    return html;
  }

  /** Biblioteca: pergaminhos para abrir (liberam o jutsu para os ninjas estudarem) e os já abertos. */
  private librarySection() {
    const g = this.app.game;
    const lv = libraryLevel(g);
    const ninjas = g.state.units.filter((u) => !u.dead && u.kind === 'ninja' && u.faction === 'village' && u.ninja);
    const opened = LIBRARY_JUTSUS.filter((j) => isOpen(g.state, j.id));
    const closed = LIBRARY_JUTSUS.filter((j) => !isOpen(g.state, j.id));
    let html = `<h4>{scroll} Pergaminhos <small>${opened.length}/${LIBRARY_JUTSUS.length} abertos · até rank ${JUTSU_RANK_LABEL[LIBRARY.maxRank[Math.max(0, lv - 1)]!]}</small> ${infoTip(
      'Pergaminhos',
      `A Academia ensina sozinha só os jutsus básicos (rank E e D). Do rank C em diante, abra o pergaminho aqui: o jutsu passa a aparecer em "Ensinar jutsu" de quem pode aprendê-lo. O nível da Biblioteca diz até que rank dá para abrir (C, depois B, depois A e S).`,
    )}</h4>`;
    html += `<div class="seg ktabs"><button data-act="lib-tab" data-arg="closed" class="${this.libTab === 'closed' ? 'on' : ''}">{lock} Fechados ${closed.length}</button><button data-act="lib-tab" data-arg="open" class="${this.libTab === 'open' ? 'on' : ''}">{books} Abertos ${opened.length}</button></div>`;
    const list = this.libTab === 'closed' ? closed : opened;
    if (!list.length) return html + `<p class="hint">${this.libTab === 'closed' ? 'Todos os pergaminhos já foram abertos.' : 'Nenhum pergaminho aberto ainda.'}</p>`;
    html += `<div class="scrollist lscroll">`;
    for (const j of list) {
      // quantos ninjas da vila poderiam estudar (natureza e rank), sem contar quem já sabe
      const fit = ninjas.filter((u) => (j.nature === null || j.nature === u.ninja!.nature) && j.rank <= RANKS[u.ninja!.rank].maxJutsuRank && !u.ninja!.jutsu.includes(j.id)).length;
      const nat = j.nature ? `${NATURES[j.nature].kanji} ${NATURES[j.nature].name}` : 'Neutro';
      const why = openBlock(g, j.id);
      const btn = isOpen(g.state, j.id)
        ? `<span class="mpill good">{check} Aberto</span>`
        : `<button class="btn mini primary" data-act="lib-open" data-arg="${j.id}" ${blocked(g, [why && !why.startsWith('Custa') && why], scrollCost(j))}>{scroll} Abrir ${costTag(scrollCost(j))}</button>`;
      html += `<div class="lrow" style="--c:${j.color}" ${tipAttr(j.name, `${j.desc} ${JUTSU_TYPE_LABEL[j.type]} · ${nat}. ${fit} ninja(s) da vila podem aprender.`)}><span class="lrank">${JUTSU_RANK_LABEL[j.rank]}</span><b class="ln">${esc(j.name)}</b><small class="lsub">${esc(nat)} · {users} ${fit}</small>${btn}</div>`;
    }
    return html + `</div>`;
  }

  /** Lenhador, pedreira e mina: o que há ao alcance (o círculo tracejado no mapa) e o que está crescendo de volta. */
  private gatherInfo(bd: Building) {
    const kind = GATHER_NODE[bd.type];
    if (!kind) return '';
    const g = this.app.game;
    const r = searchTiles(bd);
    const p = doorPos(bd);
    const near = g.state.nodes.filter((n) => n.type === kind && Math.hypot(tileCenter(n.tx) - p.x, tileCenter(n.ty) - p.y) < r * TILE);
    const ready = near.filter((n) => n.amount > 0).length;
    const growing = near.length - ready;
    const word = { tree: 'árvores', rock: 'rochas', ore: 'veios de ferro' }[kind];
    const tip = infoTip('Alcance', `Os trabalhadores buscam ${word} até ${r} tiles daqui (o círculo tracejado no mapa)${levelOf(bd) < 3 && UPGRADES[bd.type] ? '; cada nível do prédio aumenta o alcance' : ''}. O que se esgota cresce de volta sozinho.`);
    let html = `<div class="gchips"><span class="mchip">{eye} ${r} tiles</span><span class="mchip ${ready ? 'good' : 'bad'}">${ready} ${word} prontas</span>${
      growing ? `<span class="mchip">{refresh} ${growing} crescendo</span>` : ''
    }${tip}</div>`;
    if (!ready) html += `<p class="why">Nada pronto ao alcance agora. ${growing ? 'Elas voltam a crescer sozinhas em alguns dias.' : 'Mova o prédio para perto de mais recursos.'}</p>`;
    return html;
  }

  /** Corte do interior: quem está lá dentro agora (dormindo, estudando, abrigado…). */
  private interiorSection(bd: Building, t: Record<string, string>, b: Record<string, number>) {
    const d = BUILDINGS[bd.type];
    if (d.walkable) return '';
    const inside = occupantsOf(this.app.game, bd);
    if (!inside.length && !d.housing) return '';
    let html = `<canvas class="interior"></canvas>`;
    if (!inside.length) return html + `<p class="hint">Ninguém aqui agora. À noite os moradores voltam para dormir.</p>`;
    html += `<div class="roster binside scrollist">`;
    for (const u of inside) {
      if (u.ninja) html += this.ninjaRow(u, t, b, this.face(u));
      else {
        t[`st${u.id}`] = STATE_LABEL[u.state] ?? u.state;
        b[`hp${u.id}`] = u.hp / u.maxHp;
        html += `<button class="rrow" data-act="pick" data-arg="${u.id}"><span class="rn">${esc(u.name)}</span><span class="badges"><span class="badge">Morador(a)</span></span>
          <span class="rm"><span data-t="st${u.id}"></span></span><span class="mini"><i data-b="hp${u.id}"></i></span></button>`;
      }
    }
    return html + `</div>`;
  }

  /** Vários ninjas marcados com a caixa de seleção: ordens em conjunto. */
  private groupView(): Built | null {
    const g = this.app.game;
    const units = this.app.group.map((id) => g.unit(id)).filter((u): u is Unit => !!u && !u.dead);
    this.app.group = units.map((u) => u.id);
    if (!units.length) return null;
    const t: Record<string, string> = {};
    const b: Record<string, number> = {};
    let html = `<div class="ph"><div class="title">{select} Grupo · ${units.length} ninjas</div></div>
      <p class="hint">Toque em "Dar ordem" e depois no mapa: no chão para mover/defender, num inimigo ou animal para atacar — mesmo antes de ele chegar à vila. No computador, basta o botão direito no mapa.</p>
      <div class="btnrow"><button class="btn primary" data-act="cmd-mode" data-arg="group">{pin} Dar ordem</button>
      <button class="btn" data-act="cmd-retreat" data-arg="group">{run} Recuar</button>
      <button class="btn" data-act="cmd-clear" data-arg="group">{x} Cancelar ordens</button></div>
      <h4>Selecionados</h4><div class="roster scrollist">`;
    for (const u of units) html += this.ninjaRow(u, t, b);
    html += `</div>`;
    return { html, t, b };
  }

  /** Barra de abas do grupo de telas da view (Ninjas/Equipes/Clãs ou Vila/Kage/Estatísticas). */
  /**
   * Topo das janelas com abas: título do grupo, etiquetas com os números do grupo, ações à direita e as abas
   * sublinhadas. Fica preso no alto ao rolar.
   */
  private tabs(active: View['kind'], right = '') {
    const group = TAB_GROUP[active] ?? '';
    const tabs = WINDOW_TABS[group];
    if (!tabs) return '';
    const on = active === 'team' ? 'teams' : active; // a equipe aberta fica sob a aba Equipes
    return this.winTop(GROUP_TITLE[group] ?? '', this.groupChips(group), right, tabs.map(([k, label]) => [k, label, on === k, 'tab']));
  }

  /** Cabeçalho + abas (usado pelas janelas com grupo e pelo quadro de missões). */
  private winTop(title: string, chips: string, right: string, tabs: [string, string, boolean, string][]) {
    // uma linha só (como no mockup): título, abas em botões, e à direita as etiquetas e as ações; no celular as
    // etiquetas descem para a segunda linha
    const nav = tabs.length ? `<nav class="wtabs">${tabs.map(([k, label, on, act]) => `<button data-act="${act}" data-arg="${k}" class="${on ? 'on' : ''}">${label}</button>`).join('')}</nav>` : '';
    return `<div class="wtop"><div class="whead"><div class="mh-title">${title}</div>${nav}<div class="wright">${chips}${right}</div></div></div>`;
  }

  /** Números de cada grupo de janelas, em etiquetas no cabeçalho. */
  private groupChips(group: string) {
    const g = this.app.game;
    const s = g.state;
    const chip = (ic: string, text: string, cls = '') => `<span class="mchip ${cls}">${ic} ${text}</span>`;
    if (group === 'ninjas') {
      const ninjas = s.units.filter((u) => !u.dead && u.kind === 'ninja' && u.faction === 'village');
      const hurt = ninjas.filter((u) => u.hp < u.maxHp * 0.6).length;
      return chip('{ninja}', `${ninjas.length} ninjas`) + chip('{users}', `${s.teams.length} equipes`) + (hurt ? chip('{medic}', `${hurt} feridos`, 'bad') : '');
    }
    if (group === 'village')
      return chip('{star}', `Reputação ${s.reputation}`, 'gold') + chip('{calendar}', `Dia ${s.day}`);
    if (group === 'world') {
      const exps = s.expeditions.filter((e) => e.status !== 'done' && e.status !== 'lost').length;
      return chip('{star}', `Honra ${s.honor}`, 'gold') + chip('{skull}', `Infâmia ${s.infamy}`, s.infamy ? 'bad' : '') + chip('{flag}', `Expedições ${exps}`);
    }
    return '';
  }

  /** Nível do prédio, o que o próximo nível dá e o botão de upgrade (ou a obra em andamento). */
  private upgradeSection(bd: Building, t: Record<string, string>, b: Record<string, number>) {
    const def = UPGRADES[bd.type];
    if (!def) return '';
    const g = this.app.game;
    const lvl = levelOf(bd);
    let html = `<div class="bup"><div class="bup-t">{up} Melhoria <small>agora: ${esc(def.perks[lvl - 1]!)}</small></div>`;
    if (bd.upgrade != null) {
      html += `<div class="bar pg"><i data-b="upg"></i><span data-t="upg"></span></div><div class="hint">Moradores sem emprego estão fazendo a obra; o prédio continua funcionando.</div></div>`;
      b.upg = Math.min(1, bd.upgrade / upgradeTime(bd));
      t.upg = `Obra do nível ${lvl + 1}: ${Math.floor(b.upg * 100)}%`;
      return html;
    }
    if (lvl >= MAX_BUILDING_LEVEL) return html + `<div class="hint">{check} Nível máximo.</div></div>`;
    const st = upgradeStatus(g, bd);
    const cost = st.cost ?? {};
    // requisito de nível da vila também como etiqueta (ex.: Biblioteca nível 3 pede a Vila Oculta)
    const minV = def.minVillage[lvl - 1] ?? 0;
    const req = minV > 0 ? `<span class="mchip ${g.state.level < minV ? 'bad' : 'good'}" ${tipAttr('Requisito', `A vila precisa ser ${levelDef(minV).name}.`, true)}>${levelDef(minV).icon} ${levelDef(minV).name}</span>` : '';
    const chips = req + RES_KEYS.filter((k) => cost[k]).map((k) => `<span class="mchip ${g.state.res[k] < cost[k]! ? 'bad' : ''}">${RES_INFO[k].icon} ${cost[k]}</span>`).join('');
    html += `<div class="bup-row"><div class="bup-txt"><b>Nível ${lvl + 1}:</b> ${esc(def.perks[lvl]!)}<div class="bup-cost">${chips}</div></div>
      <button class="btn primary" data-act="upgrade-building" ${blocked(g, [st.reason !== 'Recursos insuficientes.' && st.reason], st.cost ?? undefined)}>{up} Nível ${lvl + 1}</button></div>`;
    if (st.reason && st.reason !== 'Recursos insuficientes.' && !st.reason.startsWith('Requer ')) html += `<p class="why">${esc(st.reason)}</p>`;
    return html + `</div>`;
  }

  /** Topo do painel de prédio: a arte do nível, nome, estrelas, status e a descrição. */
  private buildingHead(bd: Building) {
    const g = this.app.game;
    const d = BUILDINGS[bd.type];
    const lvl = bd.type === 'hokage' ? g.state.level + 1 : levelOf(bd);
    const url = (lvl > 1 && artUrl(`${bd.type}-${lvl}`)) || artUrl(bd.type);
    const max = bd.type === 'hokage' ? 4 : UPGRADES[bd.type] ? MAX_BUILDING_LEVEL : 0;
    const stars = max ? `<span class="bstars">${Array.from({ length: max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}">{star}</i>`).join('')}</span>` : '';
    const [st, cls] = !bd.built ? ['Em obra', 'good'] : bd.upgrade != null ? ['Melhorando', 'good'] : ['Funcionando', 'safe'];
    return `<div class="bhead"><span class="bh-art">${url ? pimg(url) : d.icon}</span><div class="bh-main">
      <div class="bh-name">${d.name}</div><div class="bh-row">${max ? `<b>Nível ${lvl}</b>${stars}` : ''}<span class="mpill ${cls}">${st}</span></div></div></div>
      <p class="bh-desc">${d.desc}</p>`;
  }

  /** Resumo da vila no painel da Residência do Hokage; o detalhe abre na janela. */
  private villageSummary() {
    const g = this.app.game;
    const cur = levelDef(g.state.level);
    const st = nextLevelStatus(g);
    let html = `<div class="lvlcard"><div class="lvlname">${cur.icon} ${cur.name}</div><div class="hint">Nível ${g.state.level} de ${MAX_VILLAGE_LEVEL}${
      st ? ` · próximo: ${st.def.name} (${st.checks.filter((c) => c.ok).length}/${st.checks.length} requisitos)` : ''
    }</div></div>`;
    html += `<div class="actions"><button class="btn primary" data-act="win" data-arg="village">{castle} Abrir painel da Vila</button></div>`;
    return html;
  }

  /** Resumo da Mesa de Missões; o quadro completo abre na janela. */
  private missionsSummary() {
    const g = this.app.game;
    const ms = g.state.missions;
    const active = ms.filter((m) => m.status === 'active').length;
    const offered = ms.filter((m) => m.status === 'offered').length;
    return `<div class="lvlcard"><div class="lvlname">{star} Reputação ${g.state.reputation}</div>
      <div class="hint">${offered} missão(ões) no quadro · ${active}/${maxActiveMissions(g)} em andamento</div></div>
      <div class="actions"><button class="btn primary" data-act="win" data-arg="missions">{clipboard} Abrir quadro de missões</button></div>`;
  }

  private villageView(): Built {
    const g = this.app.game;
    const fest = `<button class="btn primary" data-act="festival" ${blocked(g, [festivalBlock(g)], FESTIVAL.cost)}>{party} Festival</button>`;
    return { html: this.tabs('village', fest) + this.villageSection(), t: {}, b: {} };
  }

  private missionsView(): Built {
    const t: Record<string, string> = {};
    const b: Record<string, number> = {};
    if (!this.app.game.findBuilt('missions'))
      return { html: `<div class="ph"><div class="title">{clipboard} Quadro de missões</div></div><div class="warnbox">Construa a {clipboard} Mesa de Missões (menu Construir) para receber pedidos.</div>`, t, b };
    return { html: this.missionsSection(t, b), t, b };
  }

  /**
   * Estatísticas: números da vila numa grade compacta à esquerda e, ao lado, os destaques (quem mais abateu, os de
   * nível mais alto); embaixo, ninjas por patente e por natureza do chakra em barras.
   */
  private statsView(): Built {
    const g = this.app.game;
    const s = g.state;
    const ninjas = s.units.filter((u) => !u.dead && u.kind === 'ninja' && u.faction === 'village');
    const cell = (icon: string, label: string, v: string | number, tip: string) =>
      `<div class="statcard" ${tipAttr(label, tip, true)}><span class="si ic-wrap">{${icon}}</span><span>${label}</span><b>${v}</b></div>`;
    let left = `<div class="bsec"><h4>{chart} Números da vila</h4><div class="statgrid">`;
    left += cell('calendar', 'Dia', s.day, 'Dias desde a fundação da vila.');
    left += cell('users', 'População', `${g.population()} / ${g.popCap()}`, `Moradores e ninjas / vagas nas casas, até o teto do nível da vila (${levelDef(g.state.level).popLimit}). Construa ou melhore casas, ou suba o nível da vila, para crescer.`);
    left += cell('shinobi', 'Ninjas', ninjas.length, 'Ninjas da vila (recrutados na Academia).');
    left += cell('star', 'Reputação', s.reputation, 'Sobe com missões, exames, chefes vencidos e o Monte dos Kages; cai quando uma missão fracassa.');
    left += cell('swords', 'Abates', s.stats.kills, 'Inimigos e animais derrotados.');
    left += cell('shield', 'Invasões repelidas', s.stats.raidsRepelled, 'Ataques de renegados que a vila venceu.');
    left += cell('skull', 'Chefes derrotados', s.stats.bossesDefeated, 'Ameaças-chefe vencidas.');
    left += cell('clipboard', 'Missões cumpridas', s.stats.missionsDone, 'Missões da Mesa de Missões concluídas com sucesso.');
    left += cell('baby', 'Nascimentos', s.stats.born, 'Crianças nascidas na vila.');
    left += cell('grave', 'Perdas', s.stats.lost, 'Moradores e ninjas que morreram.');
    left += cell('castle', 'Clãs', s.clans.length, 'Clãs fundados por ninjas da vila.');
    left += cell('flag', 'Equipes', s.teams.length, 'Equipes de ninjas montadas.');
    left += `</div></div>`;
    // distribuições em barras (patente e natureza)
    const bars = (title: string, rows: [string, string, number, string][]) => {
      const max = Math.max(1, ...rows.map((r) => r[2]));
      return `<div class="bsec"><h4>${title}</h4><div class="sbars">${rows
        .map(([ic, label, n, color]) => `<div class="sbar"><span class="sb-l">${ic} ${label}</span><div class="nc-bar"><i style="width:${(n / max) * 100}%;background:${color}"></i></div><b>${n}</b></div>`)
        .join('')}</div></div>`;
    };
    const RANK_ICON: Record<string, string> = { genin: '{leaf}', chunin: '{medal}', jounin: '{star}', kage: '{kage}' };
    const RANK_COLOR: Record<string, string> = { genin: '#9fe08a', chunin: '#c9a6ff', jounin: '#ffd24a', kage: '#ff962e' };
    const ranks = Object.entries(RANKS).map(([k, r]) => [RANK_ICON[k] ?? '{ninja}', r.name, ninjas.filter((u) => u.ninja!.rank === k).length, RANK_COLOR[k] ?? '#ccc'] as [string, string, number, string]);
    ranks.splice(3, 0, ['{scroll}', 'Sannin', ninjas.filter((u) => u.ninja!.sannin).length, '#ff7a7a']);
    const natures = (Object.keys(NATURES) as (keyof typeof NATURES)[]).map((k) => [`<span class="kj" style="color:${NATURES[k].color}">${NATURES[k].kanji}</span>`, NATURES[k].name, ninjas.filter((u) => u.ninja!.nature === k).length, NATURES[k].color] as [string, string, number, string]);
    left += `<div class="scols">${bars('{medal} Ninjas por patente', ranks)}${bars('{drop} Natureza do chakra', natures)}</div>`;
    // destaques: retrato, nome, número
    const top = (title: string, list: Unit[], val: (u: Unit) => string) =>
      `<div class="bsec"><h4>${title}</h4><div class="tops">${list
        .map((u, i) => `<button class="topr" data-act="pick" data-arg="${u.id}"><span class="tp-n">${i + 1}</span>${this.face(u)}<span class="tp-name"><b>${esc(u.name)}</b><small>${u.ninja!.sannin ? 'Sannin' : RANKS[u.ninja!.rank].name}</small></span><b class="tp-v">${val(u)}</b></button>`)
        .join('') || '<p class="hint">Nenhum ninja ainda.</p>'}</div></div>`;
    const right =
      top('{swords} Mais abates', [...ninjas].sort((a, z) => z.ninja!.kills - a.ninja!.kills).slice(0, 5), (u) => `${u.ninja!.kills}`) +
      top('{star} Nível mais alto', [...ninjas].sort((a, z) => z.ninja!.level - a.ninja!.level || z.ninja!.xp - a.ninja!.xp).slice(0, 5), (u) => `Nv ${u.ninja!.level}`);
    return { html: this.tabs('stats') + `<div class="vfill vgrid sgridw"><div class="vcol">${left}</div><div class="vcol">${right}</div></div>`, t: {}, b: {} };
  }

  /** Insígnias de clã e kekkei genkai. */
  private lineageBadges(u: Unit) {
    const clan = clanOf(this.app.game, u);
    const kk = u.ninja?.kekkei;
    return (
      (clan ? `<span class="badge nat" style="--c:${clan.color}">家 ${esc(clan.name)}</span>` : '') +
      (kk ? `<span class="badge nat" style="--c:${KEKKEI[kk].color}">${KEKKEI[kk].kanji} ${KEKKEI[kk].name}</span>` : '') +
      (u.ninja?.spec ? `<span class="badge">${SPECS[u.ninja.spec].icon} ${SPECS[u.ninja.spec].name}</span>` : '') +
      (u.ninja?.contract ? `<span class="badge">{scroll} ${CONTRACTS[u.ninja.contract].name}</span>` : '')
    );
  }

  private clansList(): Built {
    const g = this.app.game;
    let html = this.tabs('clans');
    html += `<p class="hint">Um Chunin+ de nível ${FOUND_MIN_LEVEL}+ pode fundar um clã com o próprio sobrenome (nível Vila). Parentes entram no clã,
      filhos herdam a especialidade e a natureza, e em Vila Oculta o clã pode despertar uma kekkei genkai.</p>`;
    if (!g.state.clans.length) html += `<p class="hint">Nenhum clã ainda.</p>`;
    for (const c of g.state.clans) {
      const members = clanMembers(g, c);
      const ninjas = members.filter((u) => u.ninja);
      const nat = NATURES[c.nature];
      html += `<div class="mcard" style="--c:${c.color}"><div class="mt"><span class="dot"></span>Clã ${esc(c.name)}
        ${c.kekkei ? `<span class="badge nat" style="--c:${KEKKEI[c.kekkei].color}">${KEKKEI[c.kekkei].kanji} ${KEKKEI[c.kekkei].name}</span>` : ''}</div>
        <div class="jm">Fundador: ${esc(c.founderName)} (dia ${c.day}) · ${members.length} membro(s), ${ninjas.length} ninja(s)</div>
        <div class="jd">Especialidade: ${STAT_INFO[c.specialty].label} · natureza ${nat.kanji} ${nat.name}</div>
        <div class="jm">Naturezas dos ninjas: ${[...new Set(ninjas.map((u) => NATURES[u.ninja!.nature].kanji))].join(' ') || '—'}</div>`;
      if (!c.kekkei) {
        const opts = awakenOptions(g, c);
        html += `<div class="btnrow">`;
        if (g.state.level < 2) html += `<span class="why">Kekkei genkai: requer ${levelDef(2).name}.</span>`;
        else if (!opts.length) html += `<span class="why">Para despertar, o clã precisa de ninjas de duas naturezas compatíveis (ex.: 風+水 = 氷 Gelo).</span>`;
        else
          for (const k of opts)
            html += `<button class="btn" data-act="awaken" data-arg="${c.id}" data-k="${k.id}" ${blocked(g, [], AWAKEN_COST)} ${tipAttr(`Despertar ${k.name}`, `Kekkei genkai ${k.pt}.`)}>${k.kanji} Despertar ${k.name} ${costTag(AWAKEN_COST)}</button>`;
        html += `</div>`;
      }
      html += `</div>`;
    }
    html += `<h4>Kekkei genkai</h4><ul class="reqs">`;
    for (const k of KEKKEI_LIST)
      html += `<li>${k.kanji} ${k.name} (${k.pt}) <b>${NATURES[k.natures[0]].kanji} + ${NATURES[k.natures[1]].kanji}</b></li>`;
    html += `</ul>`;
    return { html, t: {}, b: {} };
  }

  /** Técnicas que todo ninja sabe (Shunshin, Kawarimi) e a arte do Kage; a IA usa sozinha. */
  private basicTechniques(u: Unit, t: Record<string, string>) {
    if (!isShinobi(u)) return '';
    const n = u.ninja!;
    const ready = (cd = 0) => (cd > 0 ? `${Math.ceil(cd)}s` : 'pronto');
    const style = { leaf: 'folhas', mist: 'névoa', water: 'água', sand: 'areia', smoke: 'fumaça', flash: 'clarão' }[flickerStyle(u)];
    t.flick = ready(u.flickerCd);
    t.kawa = ready(u.kawaCd);
    let html = `<h4>Técnicas básicas <small>(automáticas)</small></h4><div class="ftechs">
      <span class="badge" ${tipAttr('Shunshin no Jutsu', `Corpo cintilante: some num redemoinho de ${style} e aparece até ${SHUNSHIN.maxDist / 32 | 0} tiles adiante. Usa para chegar na luta, recuar quando luta de longe e fugir ferido. Recarga ${flickerCooldown(n.stats).toFixed(1)}s (menor com Velocidade).`, true)}>{run} Shunshin · <b data-t="flick"></b></span>
      <span class="badge" ${tipAttr('Kawarimi no Jutsu', `Substituição: num golpe forte ou fatal, ${Math.round(kawarimiChance(n.stats) * 100)}% de chance de trocar de lugar com um tronco (Velocidade e Inteligência aumentam). ${KAWARIMI.chakra} de chakra, recarga ${KAWARIMI.cooldown}s.`, true)}>{leaf} Kawarimi · <b data-t="kawa"></b></span>`;
    if (n.sannin) {
      const s = SANNIN_PATHS[n.sannin];
      t.sart = ready(u.sanninCd);
      html += `<span class="badge" style="color:${s.color}" ${tipAttr(`${s.title}: ${s.art}`, `${s.desc} Recarga ${s.cooldown}s.`, true)}>{sparkle} ${esc(s.art)} · <b data-t="sart"></b></span>`;
    }
    if (n.kageArt) {
      const k = KAGE_ARTS[n.kageArt];
      t.kart = ready(u.artCd);
      html += `<span class="badge" style="color:${k.color}" ${tipAttr(k.name, k.desc, true)}>{kage} ${esc(k.name.replace(' no Jutsu', ''))} · <b data-t="kart"></b></span>`;
    }
    return html + `</div>`;
  }

  /**
   * Aba Kage (mockup kage.png): Kage atual à esquerda (retrato com chapéu e manto, etiquetas, Hiraishin, ações), a
   * ANBU à direita, os Três Sannin embaixo. `.kfill` estica para ocupar a janela toda (sem sobra). As ameaças (Ordem do
   * Eclipse, Espadachins da Névoa) ficam na aba Bingo Book.
   */
  private kageSection() {
    const g = this.app.game;
    const k = currentKage(g);
    let html = `<div class="kfill"><div class="kgrid"><section class="kpanel kcard"><div class="kp-head">{scroll}<b>Kage atual</b></div>`;
    if (k) {
      const art = k.ninja!.kageArt && KAGE_ARTS[k.ninja!.kageArt];
      const monument = g.state.buildings.some((b) => b.type === 'monument');
      html += `<div class="kbody"><button class="k-face" data-act="pick" data-arg="${k.id}" style="${ART['kage-bg'] ? `background-image:url('${ART['kage-bg']}')` : ''}">${pimg(kagePortrait(k))}</button>
        <div class="k-main"><div class="k-name">${esc(k.name)}<span class="kpill">{kage} Kage atual</span></div>
        <div class="k-chips"><span class="mchip">Nv ${k.ninja!.level}</span><span class="mchip">{swords} Dano da vila +10%</span><span class="mchip ${monument ? '' : 'gold'}">{castle} ${monument ? 'Monte dos Kages' : 'Monte dos Kages pendente'}</span></div>`;
      if (art) {
        const pic = ART['kunai-card'] ?? ART['kunai-hiraishin'];
        html += `<div class="kart"><b class="kart-t">${esc(art.name)}</b><div class="kart-row"><span class="kart-pic ${ART['kunai-card'] ? 'full' : ''}">${pimg(pic)}</span>
          <div class="kart-info"><div class="k-chips one"><span class="mchip">{drop} Chakra ${art.chakra}</span><span class="mchip">{hourglass} Recarga ${art.cooldown}s</span><span class="mchip">{clock} Marca ${art.markLife}s</span></div>
          <p ${tipAttr(art.name, art.desc, true)}>Kunais marcadas; teleporte em clarão amarelo e retorno à Residência ao cair.</p></div></div></div>`;
      }
      html += `<div class="k-acts"><button class="btn primary" data-act="pick" data-arg="${k.id}">Ver Kage</button><button class="btn ghost" data-act="go-hokage">{castle} Ir à Residência</button></div></div></div>`;
    } else if (g.state.ceremony) {
      html += `<p class="hint">{party} Cerimônia em andamento…</p>`;
    } else {
      const st = electionStatus(g);
      html += `<p class="hint">Um Jounin de nível ${KAGE_MIN_LEVEL}+ pode ser eleito Kage (${costLabel(KAGE_COST)}). Com Kage vivo, todos os ninjas causam +10% de dano.</p>`;
      if (st.candidates.length)
        html += `<div class="kcands">${st.candidates
          .slice(0, 3)
          .map((c) => `<button class="kcand" data-act="elect" data-arg="${c.id}" ${blocked(g, [!st.ready && st.reason])}>${this.face(c)}<span><b>${esc(c.name)}</b><small>Jounin · Nv ${c.ninja!.level}</small></span><span class="btn primary mini">{kage} Eleger</span></button>`)
          .join('')}</div>`;
      else html += `<p class="why">${esc(st.reason)}</p>`;
    }
    if (g.state.kageHistory.length > 1)
      html += `<p class="hint k-hist">{books} Kages: ${g.state.kageHistory.map((h) => `${esc(h.name)} (dia ${h.day})`).join(' · ')}</p>`;
    html += `</section>${this.anbuSection()}</div>`;
    return html + this.sanninSection() + `</div>`;
  }

  /** Ordem do Eclipse: emblema, progresso e próxima aparição, os 8 bustos com o estado, a dupla e as ações. */
  private orgSection() {
    const g = this.app.game;
    const o = g.state.org;
    const emblem = atlasCell(ICONS, 'eclipse', 'o-emb') ?? '{skull}';
    let html = `<section class="kpanel ocard"><div class="o-head">${emblem}<div><b>${ORG.name}</b><small>8 lendários · atacam em duplas · quem cai não volta</small></div></div>`;
    if (o.done) return html + `<p class="hint">{check} Destruída. A vila é lendária.</p></section>`;
    const known = g.state.level >= ORG.minVillage;
    html += `<div class="o-prog"><div class="o-count"><b>${o.down.length}/8 derrotados</b><div class="nc-bar"><i style="width:${(o.down.length / 8) * 100}%"></i></div></div>
      <span class="o-next">{clock} ${known ? (o.nextDay ? `Próxima aparição: dia ${o.nextDay}` : 'Logo') : 'Não sabem da vila'}</span></div><div class="ogrid">`;
    const live = g.state.units.filter((u) => !u.dead && u.org);
    const onMap = new Set(live.map((u) => u.org));
    const cur = ORG_PAIRS.findIndex((p) => p.some((x) => !o.down.includes(x)));
    for (const id of [...ORG_PAIRS.flat(), ...ORG_LAIR]) {
      const d = ORG_MEMBERS[id];
      const down = o.down.includes(id);
      const lair = ORG_LAIR.includes(id);
      const pairIdx = ORG_PAIRS.findIndex((p) => p.includes(id));
      // o líder fica em silhueta até cair; os guardiões aparecem quando o covil é descoberto
      const hidden = id === 'yomi' && !down;
      const unknown = !down && !onMap.has(id) && (lair ? !o.lairKnown && id !== 'yomi' : cur >= 0 && pairIdx > cur);
      const [st, cls] = down ? ['{check} Derrotado', 'down'] : onMap.has(id) ? ['{swords} Ativo', 'live'] : unknown ? ['{question} Desconhecido', 'unk'] : lair ? ['{lock} Covil', 'lair'] : ['{alert} À solta', ''];
      // o sprite do membro, como os Espadachins; o líder fica em silhueta até cair
      const bust = pimg(artPortrait(`org-${id}`, true), hidden ? 'om-bust om-shadow' : 'om-bust');
      html += `<div class="omem ${cls}" ${tipAttr(hidden ? '???' : `${d.name}, ${d.title}`, hidden ? 'O líder da Ordem. Ninguém viu o rosto dele.' : `${d.art}: ${d.desc}`, true)}><span class="om-face">${bust}${down ? '<span class="om-check">{check}</span>' : ''}</span><b>${d.name}</b><small>${st}</small></div>`;
    }
    html += `</div>`;
    const pairNow = live.map((u) => ORG_MEMBERS[u.org!].name);
    const next = (nextPair(g.state) ?? []).filter((id) => !o.down.includes(id)).map((id) => ORG_MEMBERS[id].name);
    const who = pairNow.length ? `Dupla atual: <b>${pairNow.join(' & ')}</b>` : next.length ? `Próxima dupla: <b>${next.join(' & ')}</b>` : o.lairKnown ? '<b>Restam os guardiões do covil</b>' : 'Duplas vencidas';
    html += `<div class="o-foot"><span>{users} ${who}</span>
      <button class="btn primary" data-act="org-defend" ${tipAttr('Preparar defesa', 'Todos os ninjas livres na vila passam a patrulhar e os novatos se abrigam de inimigos fortes demais.')}>{shield} Preparar defesa</button>
      <button class="btn ghost" data-act="win" data-arg="region" ${o.lairKnown ? tipAttr('Covil descoberto', 'Mundo → Região → Covil do Eclipse: a invasão final.') : ''}>{pin} ${o.lairKnown ? 'Ver o covil' : 'Ver região'}</button></div>`;
    return html + `</section>`;
  }

  /** Os Três Sannin: emblema do caminho, o Sannin (ou os candidatos), o animal com a técnica e o botão. */
  private sanninSection() {
    const g = this.app.game;
    const cost = (['ryo', 'food', 'wood', 'stone'] as const).filter((k) => SANNIN.cost[k]).map((k) => `${SANNIN.cost[k]} ${RES_INFO[k].name.toLowerCase()}`).join(' + ');
    let html = `<section class="kpanel ssec"><div class="kp-head">{sparkle}<b>Os Três Sannin</b><small>Jounins Nv ${SANNIN.minLevel}+ · custo ${cost}</small></div><div class="sgrid">`;
    const cands = sanninCandidates(g);
    for (const path of ['toad', 'snake', 'slug'] as const) {
      const d = SANNIN_PATHS[path];
      const who = sanninOf(g, path);
      const beast = ART[`beast-${path}`] ?? artPortrait(path, true);
      const emblem = atlasCell(ICONS, `path-${path}`, 'sc-emb') ?? `<span class="sc-emb none">{scroll}</span>`;
      html += `<div class="scard" style="--c:${d.color}"><div class="sc-head">${emblem}<b>${esc(d.title)}</b></div><div class="sc-body">`;
      if (who)
        html += `<button class="sc-who" data-act="pick" data-arg="${who.id}">${pimg(unitPortrait(who))}<span class="sc-tag"><b>${esc(who.name.split(' ').pop()!)}</b><small>Nv ${who.ninja!.level}</small></span></button>`;
      else {
        const sel = this.sanninSel[path];
        html += `<div class="sc-cands"><small>${cands.length ? 'Candidatos disponíveis' : esc(sanninBlock(g, undefined, path) ?? 'Sem candidatos.')}</small>`;
        for (const c of cands.slice(0, 2))
          html += `<button class="sc-cand ${sel === c.id ? 'on' : ''}" data-act="sannin-sel" data-arg="${path}:${c.id}">${this.face(c)}<span><b>${esc(c.name.split(' ').pop()!)}</b><small>Nv ${c.ninja!.level}</small></span></button>`;
        html += `</div>`;
      }
      html += `<span class="sc-beast" ${tipAttr(d.art, d.desc, true)}>${pimg(beast)}<b>${esc(d.art)}</b></span></div>`;
      if (who) html += `<div class="sc-done">{shield} Nomeado</div>`;
      else {
        const c = cands.find((x) => x.id === this.sanninSel[path]) ?? cands[0];
        const why = c ? sanninBlock(g, c, path) : 'Sem candidatos.';
        html += `<button class="btn primary sc-go" data-act="sannin" data-arg="${c?.id ?? 0}:${path}" ${blocked(g, [!c && 'Nenhum Jounin de nível 20+ disponível.', why && !why.startsWith('Custa') && why], SANNIN.cost)}>{userplus} Nomear</button>`;
      }
      html += `</div>`;
    }
    return html + `</div></section>`;
  }

  /**
   * ANBU: os nomeados (sprite com a máscara, o animal e o atributo que ele representa), os candidatos e a missão
   * secreta na Região.
   */
  private anbuSection() {
    const g = this.app.game;
    const slots = anbuSlots(g);
    const list = anbus(g);
    const tip = tipAttr('ANBU', `Nomeados pelo Kage (precisa da Torre de Inteligência). Saem das equipes comuns (só formam equipe entre si) e usam a máscara que você escolher: cada animal representa um atributo e dá +1 nele. Invisíveis até atacar (emboscada: +${Math.round((ANBU.ambush - 1) * 100)}% no golpe), patrulham à noite, revelam espiões e aparecem ao lado do Kage quando ele luta.`, true);
    let html = `<section class="kpanel acard"><div class="kp-head">{shield}<b ${tip}>ANBU</b><small>${list.length}/${slots || '—'} vagas · ${costLabel(ANBU.cost)}</small></div>`;
    const block = anbuBlock(g);
    if (!list.length && block && !block.startsWith('Escolha')) html += `<p class="hint">${esc(block)}</p>`;
    if (list.length) {
      html += `<div class="alist">`;
      for (const u of list) {
        const m = maskOf(u);
        const away = u.away != null;
        html += `<div class="arow"><button class="a-face" data-act="pick" data-arg="${u.id}">${pimg(unitPortrait(u))}</button><span class="a-main"><b>${esc(m.name)}</b><small>${esc(u.name)} · Nv ${u.ninja!.level} · ${esc(m.stat)}${away ? ' · fora' : ''}</small></span>
          <button class="btn mini ghost" data-act="anbu-out" data-arg="${u.id}" ${tipAttr('Dispensar', 'Volta a ser ninja comum (o atributo ganho fica).')}>{x}</button></div>`;
      }
      html += `</div>`;
    }
    const cands = anbuCandidates(g).slice(0, 3);
    if (list.length < slots && cands.length) {
      // a máscara é escolhida aqui (qualquer uma, para qualquer ninja): dá +1 no atributo que ela representa
      const sel = this.anbuMaskSel ?? freeMask(g);
      const used = new Set(list.map((u) => maskOf(u).animal));
      html += `<div class="a-masks"><small>Máscara do próximo</small><span class="chips">${MASK_LIST.map((m) => {
        const i = maskInfo(m);
        return `<button data-act="anbu-mask" data-arg="${m}" class="${sel === m ? 'on' : ''}" ${tipAttr(i.name, `Representa ${i.stat}: o nomeado ganha +1 nele.${used.has(m) ? ' Já há um ANBU com esta máscara.' : ''}`)}>${esc(i.name)}${used.has(m) ? ' ·' : ''}</button>`;
      }).join('')}</span><small>${esc(maskInfo(sel).name)} = ${esc(maskInfo(sel).stat)} +1</small></div>`;
      html += `<div class="kcands">`;
      for (const c of cands)
        html += `<button class="kcand" data-act="anbu-in" data-arg="${c.id}" ${blocked(g, [anbuBlock(g, c)?.startsWith('Custa') ? null : anbuBlock(g, c)], ANBU.cost)}>${this.face(c)}<span><b>${esc(c.name)}</b><small>${RANKS[c.ninja!.rank].name} · Nv ${c.ninja!.level}</small></span><span class="btn primary mini">{userplus} Nomear</span></button>`;
      html += `</div>`;
    }
    if (list.length) {
      const nodes = REGION_NODES.filter((n) => n.kind === 'village' && regionOf(g.state, n.id).status !== 'vassal');
      html += `<div class="a-cov"><small ${tipAttr('Missão secreta', `${ACTION_TIP.covert} Furtividade: a força deles conta ${COVERT.stealth}×.`, true)}>{eye} Missão secreta</small><span class="chips">${nodes
        .map((n) => `<button data-act="covert" data-arg="${n.id}" ${blocked(g, [covertBlock(g, n.id)])}>${esc(n.name)}</button>`)
        .join('')}</span></div>`;
    }
    return html + `</section>`;
  }

  /** Espadachins da Névoa: os sete (sprite com a lâmina, estado) e as lâminas lendárias da vila com quem as carrega. */
  private swordsmenSection() {
    const g = this.app.game;
    const s = g.state;
    const st = s.swordsmen;
    const taken = MIST_BLADES.filter((b) => s.blades.includes(b)).length;
    const onMap = new Set(s.units.filter((u) => !u.dead && u.swordsman).map((u) => u.swordsman));
    const known = s.level >= SWORDSMEN_ORG.minVillage;
    let html = `<section class="kpanel ocard"><div class="kp-head">{swords}<b ${tipAttr(SWORDSMEN_ORG.name, 'Invadem a vila em dupla com escolta. Cada invasão rende no máximo UMA espada: o primeiro espadachim derrubado cai e deixa a espada; os outros somem na névoa e voltam.', true)}>${SWORDSMEN_ORG.name}</b><small>${taken}/7 espadas</small></div>`;
    html += `<div class="o-prog"><div class="o-count"><b>${taken}/7 derrotados</b><div class="nc-bar"><i style="width:${(taken / 7) * 100}%"></i></div></div><span class="o-next">{clock} ${st.done ? 'Acabaram' : known ? (st.nextDay ? `Próxima invasão: dia ${st.nextDay}` : 'Logo') : 'A partir da Vila Oculta'}</span></div><div class="ogrid">`;
    for (const id of MIST_BLADES) {
      const d = SWORDSMEN[id];
      const got = s.blades.includes(id);
      const [label, cls] = got ? ['{check} Espada da vila', 'down'] : onMap.has(id) ? ['{swords} Atacando', 'live'] : ['{alert} À solta', ''];
      html += `<div class="omem ${cls}" ${tipAttr(`${d.name}, ${d.title}`, `${BLADES[id].name}: ${BLADES[id].effect}`, true)}><span class="om-face">${pimg(swordsmanPortrait(id), 'om-bust')}${got ? '<span class="om-check">{check}</span>' : ''}</span><b>${esc(BLADES[id].name)}</b><small>${label}</small></div>`;
    }
    html += `</div><small class="bl-title">{swords} Lâminas lendárias <span>${s.blades.length}/${BLADE_IDS.length}</span></small><div class="blist">`;
    const holder = new Map<string, Unit>();
    for (const u of s.units) if (!u.dead && u.faction === 'village' && bladeOf(u)) holder.set(bladeOf(u)!, u);
    for (const id of BLADE_IDS) {
      const d = BLADES[id];
      const got = s.blades.includes(id);
      const who = holder.get(id);
      const where = !got ? d.source : who ? who.name.split(' ').pop()! : 'no estoque';
      const icon = bladeIcon(id); // a espada no fundo do cartão
      html += `<span class="bl ${got ? 'on' : ''}" ${tipAttr(d.name, `${d.effect} De onde vem: ${d.source}.`, true)}>${pimg(icon, 'bl-ic')}<b>${esc(d.name)}</b><small>${esc(where)}</small>${got ? '<span class="bl-ok">{check}</span>' : ''}</span>`;
    }
    return html + `</div></section>`;
  }

  /** Quinteto do Som: os cinco pelo sprite, o placar de raptos, o raptado à espera de resgate e quem tem o selo. */
  private soundSection() {
    const g = this.app.game;
    const s = g.state;
    const st = s.sound;
    const onMap = new Set(s.units.filter((u) => !u.dead && u.sound && !u.hidden).map((u) => u.sound));
    const known = s.level >= SOUND.minVillage;
    const target = st.raid ? g.unit(st.raid.targetId) : null;
    let html = `<section class="kpanel ocard"><div class="kp-head">{skull}<b ${tipAttr(SOUND.name, 'Vêm raptar o ninja mais talentoso da vila (nunca o Kage nem um Sannin). Derrube quem carrega para soltá-lo. Se fugirem, há alguns dias para resgatar no esconderijo (Região); depois disso ele volta com o selo amaldiçoado, do lado deles. Eles voltam sempre.', true)}>${SOUND.name}</b><small>raptam o mais talentoso · voltam sempre</small></div>`;
    html += `<div class="snd-prog"><span class="mchip good">{shield} ${st.stopped} rapto(s) impedido(s)</span><span class="mchip ${st.lost ? 'bad' : ''}">{skull} ${st.lost} levado(s)</span><span class="o-next">{clock} ${target ? `Atrás de: ${esc(target.name)}` : known ? (st.nextDay ? `Próxima invasão: dia ${st.nextDay}` : 'Logo') : 'A partir da Vila Oculta'}</span></div>`;
    if (st.captive) {
      const c = g.unit(st.captive.id);
      html += `<div class="snd-alert">{alert} <span><b>${esc(c?.name ?? '?')}</b> está preso(a) no Esconderijo do Som. Resgate até o fim do dia ${st.captive.until}.</span><button class="btn primary mini" data-act="win" data-arg="region">{pin} Resgatar</button></div>`;
    }
    html += `<div class="ogrid five">`;
    for (const id of ['iwao', 'kumomaru', 'kanade', 'sokon', 'hakkotsu'] as const) {
      const d = SOUND_MEMBERS[id];
      const [label, cls] = onMap.has(id) ? ['{swords} Atacando', 'live'] : id === 'hakkotsu' ? ['{lock} Esconderijo', 'lair'] : ['{alert} À solta', ''];
      html += `<div class="omem ${cls}" ${tipAttr(`${d.name}, ${d.title}`, `${d.art}: ${d.desc}`, true)}><span class="om-face">${pimg(artPortrait(`sound-${id}`, true), 'om-bust')}</span><b>${d.name}</b><small>${label}</small></div>`;
    }
    html += `</div>`;
    const cursed = s.units.filter((u) => !u.dead && u.cursed && u.faction === 'enemy');
    if (cursed.length) html += `<p class="hint">{skull} Com o selo amaldiçoado, do lado deles: ${cursed.map((u) => `<b>${esc(u.name)}</b>`).join(', ')}. Derrote-o(s) numa invasão para trazê-lo(s) de volta.</p>`;
    return html + `</section>`;
  }

  /** Os níveis da vila em sequência: arte da Residência, nome, território e impostos, e o que cada um trouxe. */
  private villagePath() {
    const s = this.app.game.state;
    let html = `<div class="bsec"><h4>{map} Caminho da vila</h4><div class="vpath">`;
    for (let i = 0; i <= MAX_VILLAGE_LEVEL; i++) {
      const d = levelDef(i);
      const url = artUrl(i > 0 ? `hokage-${i + 1}` : 'hokage') ?? artUrl('hokage');
      const done = s.level >= i;
      html += `<div class="vstep ${done ? 'done' : ''} ${s.level === i ? 'now' : ''}"><span class="vs-art">${url ? `<img src="${url}" alt="" draggable="false">` : d.icon}</span>
        <b>${d.icon} ${d.name}</b><small>território ${d.territory} · ${d.tax}{ryo}/morador</small><span class="vs-perk">${esc(d.perks[0] ?? '')}</span>
        <span class="mpill ${done ? 'safe' : 'info'}">${done ? '{check} Alcançado' : 'A seguir'}</span></div>`;
    }
    return html + `</div></div>`;
  }

  /** Marcos da vila com o progresso: metas grandes de longo prazo (seguem fazendo sentido no nível máximo). */
  private villageMarks() {
    const g = this.app.game;
    const s = g.state;
    const marks: [string, string, number, number][] = [
      ['{kage}', 'Kage eleito', s.kageHistory.length ? 1 : 0, 1],
      ['{scroll}', 'Os Três Sannin', sannins(g).length, 3],
      ['{moon}', 'Ordem do Eclipse destruída', s.org.done ? 8 : s.org.down.length, 8],
      ['{shield}', 'Invasões repelidas', s.stats.raidsRepelled, 100],
      ['{clipboard}', 'Missões cumpridas', s.stats.missionsDone, 100],
      ['{swords}', 'Abates', s.stats.kills, 2000],
      ['{skull}', 'Chefes derrotados', s.stats.bossesDefeated, 50],
      ['{castle}', 'Clãs fundados', s.clans.length, 5],
    ];
    let html = `<div class="bsec"><h4>{trophy} Marcos da vila</h4><div class="vmarks">`;
    for (const [ic, label, have, need] of marks) {
      const done = have >= need;
      html += `<div class="vmark ${done ? 'done' : ''}"><span class="vm-ic">${ic}</span><div><b>${label}</b><div class="nc-bar ${done ? 'hp' : 'xp'}"><i style="width:${Math.min(100, (have / need) * 100)}%"></i></div></div><small>${Math.min(have, need)}/${need}</small></div>`;
    }
    return html + `</div></div>`;
  }

  /** Vida da vila: população e felicidade (com os fatores), estação e clima, e o festival. */
  private lifeSection() {
    const g = this.app.game;
    const s = g.state;
    const season = SEASONS[seasonOf(s)];
    const w = WEATHERS[s.weather];
    const pop = g.population();
    const cap = g.popCap();
    const scene = (k: string) => (ART[k] ? pimg(ART[k], 'vscene') : '');
    let html = `<div class="bsec vlife"><h4>{users} Vida da vila</h4><div class="vrow">${scene('scene-village')}<div class="vrow-main">
      <div class="vstat"><span>{users} População</span><b>${pop}/${cap}</b></div><div class="nc-bar hp"><i style="width:${Math.round(Math.min(100, (pop / Math.max(1, cap)) * 100))}%"></i></div>
      <div class="vstat"><span>{smile} Felicidade</span><b>${Math.round(s.happiness)}/100</b></div><div class="nc-bar xp"><i style="width:${Math.round(Math.min(100, s.happiness))}%"></i></div></div></div>
      <h5>Fatores de felicidade</h5><div class="vfactors">`;
    for (const [l, v] of moodFactors(g)) html += `<span class="${v >= 0 ? 'ok' : 'bad'}">${esc(l)} <b>${v > 0 && l !== 'Base' ? '+' : ''}${v}</b></span>`;
    html += `</div><p class="hint" ${tipAttr('Felicidade', `Felizes, os moradores trabalham até 25% mais rápido e têm mais filhos. Abaixo de ${MOOD.leave}, um vai embora por dia.`, true)}>{info} Felizes trabalham mais rápido e têm mais filhos.</p></div>`;
    html += `<div class="bsec"><h4>{sun} Estação e clima</h4><div class="vrow">${scene(`scene-${seasonOf(s)}`)}<div class="vrow-main">
      <b class="vr-title">${season.icon} ${season.name} · ${w.icon} ${w.name}</b><p class="vr-txt">${esc(season.desc)} Hoje: ${esc(w.desc)}</p>
      <p class="vr-sub">{clock} Faltam ${daysToNextSeason(s)} dia(s) para a próxima estação</p></div></div></div>`;
    const why = festivalBlock(g);
    const on = festivalOn(s);
    const chips = RES_KEYS.filter((k) => FESTIVAL.cost[k]).map((k) => `<span class="mchip">${RES_INFO[k].icon} ${FESTIVAL.cost[k]} ${RES_INFO[k].name.toLowerCase()}</span>`).join('');
    html += `<div class="bsec vfest"><h4>{party} ${season.festival}</h4><div class="vrow">${scene('scene-festival')}<div class="vrow-main">
      ${on ? '<span class="mpill safe">{party} Acontecendo agora</span>' : '<span class="mpill safe">Disponível</span>'}
      <p class="vr-txt">+${FESTIVAL.mood} de felicidade até o fim do dia seguinte.</p><div class="td-chips">${chips}</div>
      <button class="btn primary" data-act="festival" ${blocked(g, [why], FESTIVAL.cost)}>{party} Realizar festival</button></div></div></div>`;
    return html;
  }

  /**
   * Aba Vila: cartão da vila (arte, nível, próximo marco e progresso), requisitos e benefícios lado a lado, o botão de
   * elevar com o custo e, à direita, a vida da vila (população, felicidade e fatores), a estação e o festival.
   */
  private villageSection() {
    const g = this.app.game;
    const s = g.state;
    const cur = levelDef(s.level);
    const st = nextLevelStatus(g);
    const url = artUrl(s.level > 0 ? `hokage-${s.level + 1}` : 'hokage') ?? artUrl('hokage');
    const done = st ? st.checks.filter((c) => c.ok).length : 0;
    let left = `<div class="vhero"><span class="vh-art">${url ? pimg(url) : cur.icon}</span><div class="vh-main">
      <div class="vh-name">${cur.icon} ${cur.name}</div>
      <div class="hint">Nível ${s.level + 1} de ${MAX_VILLAGE_LEVEL + 1} · território ${cur.territory} · impostos ${cur.tax} {ryo}/morador</div>`;
    if (st) {
      left += `<div class="vh-next"><span>Próximo marco: <b>${st.def.icon} ${st.def.name}</b></span><span class="mchip ${st.ready ? '' : 'gold'}">${done}/${st.checks.length} requisitos</span></div>
        <div class="nc-bar xp vh-bar"><i style="width:${(done / Math.max(1, st.checks.length)) * 100}%"></i></div>`;
    } else left += `<div class="vh-next">{trophy} A vila chegou ao nível máximo!</div>`;
    left += `</div></div>`;
    if (st) {
      left += `<div class="vcols"><div class="bsec"><h4>{clipboard} Requisitos para elevar</h4><ul class="vreqs">`;
      for (const c of st.checks)
        left += `<li class="${c.ok ? 'ok' : ''}"><span class="vr-ic">${reqIcon(c.label)}</span><span>${esc(c.label)}</span><b>${Math.min(c.have, c.need)}/${c.need}</b><span class="mpill ${c.ok ? 'safe' : 'good'}">${c.ok ? '{check} Completo' : 'Pendente'}</span></li>`;
      left += `</ul></div><div class="bsec"><h4>{star} Benefícios</h4><div class="vperks">${st.def.perks
        .map((p) => {
          const [title, ...rest] = p.split(/:\s*/);
          return `<div class="vperk">${pimg(ART[perkArt(p)], 'vp-art')}<div><b>${esc(title!)}</b>${rest.length ? `<small>${esc(rest.join(': '))}</small>` : ''}</div></div>`;
        })
        .join('')}</div></div></div>`;
      const chips = RES_KEYS.filter((k) => st.def.cost[k]).map((k) => `<span class="mchip ${s.res[k] < st.def.cost[k]! ? 'bad' : ''}">${RES_INFO[k].icon} ${st.def.cost[k]}</span>`).join('');
      left += `<div class="vup"><button class="btn primary big" data-act="upgrade" ${blocked(g, st.checks.filter((c) => !c.ok).map((c) => `{todo} ${c.label}: ${Math.min(c.have, c.need)} de ${c.need}`), st.def.cost, st.ready ? undefined : 'Faltam requisitos')}>{up} Elevar a ${st.def.name}</button><span class="vup-cost">${chips}</span></div>`;
      if (st.ready && !st.afford) left += `<p class="hint">Requisitos cumpridos — faltam recursos.</p>`;
      else if (!st.ready) left += `<p class="hint">{info} Falta: ${st.checks.filter((c) => !c.ok).map((c) => esc(c.label.toLowerCase())).join(', ')}.</p>`;
    }
    // nível máximo: a coluna mostra o caminho percorrido e os marcos da vila (antes ficava vazia)
    if (!st) left += this.villagePath() + this.villageMarks();
    return `<div class="vfill vgrid"><div class="vcol">${left}</div><div class="vcol">${this.lifeSection()}</div></div>`;
  }

  /** Exame Chunin: convocar, chaveamento ao vivo e resultado do último exame. */
  private arenaSection(b: Record<string, number>) {
    const g = this.app.game;
    const ex = g.state.exam;
    let html = '';
    if (ex) {
      html += `<div class="lvlcard"><div class="lvlname">{arena} Exame Chunin</div><div class="hint">${esc(examLabel(g))}</div></div>`;
      const a = ex.phase !== 'gather' ? g.unit(ex.bracket[ex.match]) : undefined;
      const c = ex.phase !== 'gather' ? g.unit(ex.bracket[ex.match + 1]) : undefined;
      if (a && c) {
        html += `<div class="duel"><div><b>${esc(a.name.split(' ').pop()!)}</b><div class="bar hp"><i data-b="da"></i></div></div><span class="vs">VS</span>
          <div><b>${esc(c.name.replace(' (convidado)', '').split(' ').pop()!)}</b><div class="bar hp"><i data-b="dc"></i></div></div></div>`;
        b.da = a.hp / a.maxHp;
        b.dc = c.hp / c.maxHp;
      }
      html += `<div class="btnrow"><button class="btn primary" data-act="watch">{pin} Assistir</button></div><h4>Participantes</h4><div class="bracket">`;
      const now = new Set([ex.bracket[ex.match], ex.bracket[ex.match + 1]]);
      for (const e of ex.entrants)
        html += `<div class="brow ${e.out ? 'out' : ''} ${ex.phase !== 'gather' && now.has(e.id) ? 'now' : ''}">${e.village ? '{leaf}' : '{flag}'} ${esc(e.name)}<span class="wins">${'{medal}'.repeat(e.wins)}</span></div>`;
      html += `</div>`;
      return html;
    }
    const st = examStatus(g);
    html += `<h4>Exame Chunin</h4><p class="hint">Genins de nível ${EXAM_MIN_LEVEL}+ lutam 1×1 contra colegas e convidados de outras vilas.
      O campeão e quem tiver bom desempenho (vitórias, dano, jutsus) viram Chunin de graça. Convidados trazem ryo e reputação.</p>`;
    const size = examSize(g.state);
    html += `<h4>Vagas</h4><div class="seg">`;
    for (const n of [4, 8])
      html += `<button data-act="exam-size" data-arg="${n}" class="${size === n ? 'on' : ''}" ${tipAttr(`${n} vagas`, `Até ${n} lutadores (genins da vila, completados com convidados). Cada um tem um lugar na arquibancada.`)}>${n}</button>`;
    html += `</div>`;
    if (st.eligible.length) html += `<p class="hint">Inscritos possíveis: ${st.eligible.map((u) => esc(u.name.split(' ').pop()!)).join(', ')}</p>`;
    html += `<div class="actions"><button class="btn primary" data-act="exam-start" ${blocked(g, [!st.ready && st.reason])}>{megaphone} Convocar Exame Chunin</button></div>`;
    if (!st.ready) html += `<p class="why">${esc(st.reason)}</p>`;
    const last = g.state.lastExam;
    if (last) {
      html += `<h4>Último exame (dia ${last.day})</h4><p class="hint">{trophy} ${esc(last.champion)}</p><ul class="reqs">`;
      for (const r of last.ranking)
        html += `<li class="${r.promoted ? 'ok' : ''}">${r.promoted ? '{medal}' : r.village ? '{leaf}' : '{flag}'} ${esc(r.name)} <b>${r.score}</b></li>`;
      html += `</ul>`;
    }
    return html;
  }

  /** Oficina: estoque, receitas (fabricar) e fila de produção. */
  private workshopSection(bd: Building, t: Record<string, string>, b: Record<string, number>) {
    const g = this.app.game;
    const recipes = recipesOf(bd.type);
    const MAX_QUEUE = queueMax(bd);
    let html = `<div class="actions"><button class="btn primary" data-act="win" data-arg="crafts">{anvil} Abrir painel das Oficinas</button></div>`;
    html += this.gearBar(true) + `<h4>Estoque</h4><div class="btnrow">`;
    for (const r of recipes) html += `<span class="badge">${r.icon} ${esc(r.name)}: ${stock(g, r.id)}</span>`;
    html += `</div>`;
    const queue = bd.queue ?? [];
    html += `<h4>Produção (${queue.length + (bd.craft ? 1 : 0)}/${MAX_QUEUE})</h4>`;
    if (bd.craft) {
      const d = ITEMS[bd.craft.itemId]!;
      html += `<div class="hint">${d.icon} ${esc(d.name)}</div><div class="bar pg"><i data-b="craft"></i><span data-t="craft"></span></div>`;
      b.craft = bd.craft.progress / d.craftTime;
      t.craft = `${Math.floor(b.craft * 100)}%`;
    } else html += `<p class="hint">${bd.workers.length ? 'Nada em produção.' : 'Sem artesão: aumente os trabalhadores (+).'}</p>`;
    if (queue.length) html += `<p class="hint">Na fila: ${queue.map((id) => ITEMS[id]!.icon).join(' ')}</p>`;
    if (queue.length || bd.craft) html += `<div class="btnrow"><button class="btn" data-act="craft-cancel" ${tipAttr('Cancelar último', 'Tira o último pedido da fila e devolve os recursos.')}>{x} Cancelar último</button></div>`;
    html += `<h4>Receitas</h4><div class="scrollist jscroll">`;
    for (const r of recipes) {
      const locked = (r.minLevel ?? 0) > g.state.level;
      html += `<div class="jcard ${locked ? 'locked' : ''}"><div class="jn">${r.icon} ${esc(r.name)} <small>· ${SLOT_LABEL[r.slot]}</small></div>
        <div class="jm">${costLabel(r.cost)} · ${r.craftTime}s</div><div class="jd">${esc(r.desc)}</div>
        <div class="jb">${locked ? `<span class="why">{lock} Requer ${levelDef(r.minLevel!).name}</span>` : r.blade && g.state.blades.includes(r.blade) ? `<span class="mpill safe">{check} Forjada</span>` : `<button class="btn primary" data-act="craft" data-arg="${r.id}" ${blocked(g, [queue.length + (bd.craft ? 1 : 0) >= MAX_QUEUE && `A fila está cheia (máximo ${MAX_QUEUE}).`, r.blade && craftBlock(g, bd, r.id)], r.cost)}>${r.blade ? 'Forjar' : 'Fabricar'}</button>`}</div></div>`;
    }
    return html + `</div>`;
  }

  /**
   * Quadro de missões: cabeçalho com reputação e "Auto designar", abas (Ativas / Disponíveis / Recentes) e cada missão
   * como um contrato com a equipe recomendada. Na janela larga os contratos ativos ficam numa coluna à direita.
   */
  private missionsSection(t: Record<string, string>, b: Record<string, number>) {
    const g = this.app.game;
    const ms = g.state.missions;
    const active = ms.filter((m) => m.status === 'active');
    const offered = ms.filter((m) => m.status === 'offered');
    const ended = ms.filter((m) => m.status === 'done' || m.status === 'failed').slice(-8).reverse();
    const wide = window.matchMedia(WIDE_BOARD).matches;
    let tab = this.missionTab;
    if (wide && tab === 'active') tab = 'offered'; // na larga as ativas já estão na coluna
    const max = maxActiveMissions(g);
    const full = active.length >= max;
    const canAuto = !full && offered.some((m) => {
      const tm = recommendTeam(g, m);
      return !!tm && teamPower(g, tm) >= missionPower(m);
    });
    const chips = `<span class="mchip gold" ${tipAttr('Reputação', 'Sobe com missões cumpridas, exames e chefes vencidos; cai quando uma missão fracassa.', true)}>{star} Reputação ${g.state.reputation}</span>
      <span class="mchip" ${tipAttr('Cumpridas', 'Missões concluídas desde a fundação da vila.', true)}>{todo} ${g.state.stats.missionsDone} cumpridas</span>
      <span class="mchip" ${tipAttr('Em andamento', `Até ${max} ao mesmo tempo (cresce com o nível da vila). O quadro renova todo dia.`, true)}>{refresh} Em andamento ${active.length}/${max}</span>`;
    const auto = `<button class="btn primary" data-act="m-auto" ${blocked(g, [full && 'Limite de missões simultâneas atingido.', !full && !canAuto && 'Nenhuma equipe livre dá conta das missões do quadro.'])} ${tipAttr('Auto designar', 'Das missões mais difíceis para as mais fáceis, manda a equipe mais fraca que ainda dá conta (poupa as fortes). Só envia com risco Seguro ou Favorável.')}>{users} Auto designar</button>`;
    const tabs: [MissionTab, string, string, number][] = [
      ['active', '{swords}', 'Ativas', active.length],
      ['offered', '{scroll}', 'Disponíveis', offered.length],
      ['recent', '{hourglass}', 'Recentes', ended.length],
    ];
    let html = this.winTop(
      '{clipboard} Quadro de missões',
      chips,
      auto,
      tabs.filter(([k]) => !(wide && k === 'active')).map(([k, ic, label, n]) => [k, `${ic} ${label}${k === 'recent' ? '' : ` (${n})`}`, tab === k, 'm-tab']),
    );
    let main = '';
    if (tab === 'active') {
      const list = this.activeContracts(active, t, b);
      main = list ? `<div class="mactives">${list}</div>` : `<p class="hint">Nenhuma missão em andamento. Envie uma equipe pela aba Disponíveis.</p>`;
    }
    else if (tab === 'recent') {
      main = `<h4>Recentes</h4>`;
      if (!ended.length) main += `<p class="hint">Nenhuma missão terminada ainda.</p>`;
      for (const m of ended) {
        const r = MISSION_RANKS[m.rank]!;
        const ok = m.status === 'done';
        main += `<div class="mrecent">${this.seal(r.label, r.color, true)}<span class="mr-t">${esc(m.title)}<small>${esc(m.result ?? '')}</small></span><span class="mpill ${ok ? 'safe' : 'danger'}">${ok ? '{check} Cumprida' : '{fail} Fracassou'}</span></div>`;
      }
    } else {
      main = `<h4>Missões disponíveis</h4>`;
      if (!offered.length) main += `<p class="hint">Nenhuma missão no quadro hoje. Volte amanhã.</p>`;
      const anyFree = freeTeams(g).length > 0;
      for (const m of offered) main += this.contractCard(m, full, anyFree);
    }
    if (wide) {
      const side = this.activeContracts(active, t, b) || `<p class="hint">Nenhuma em andamento. Escolha uma missão e toque em Enviar.</p>`;
      html += `<div class="mboard"><div class="mmain">${main}</div><aside class="mside"><h4>Contratos ativos</h4>${side}</aside></div>`;
    } else html += main;
    return html;
  }

  /** Selo do rank: pergaminho com o lacre de cera (ou só o lacre, pequeno). */
  private seal(label: string, color: string, small = false) {
    const px = atlasCell(CARDS, `seal-${label}`, 'wax');
    return `<span class="mseal ${small ? 'sm' : ''} ${px ? 'px' : ''}" style="--c:${color}">${small ? '' : `<img src="${missionScrollUrl}" alt="" draggable="false">`}${px ?? `<b>${label}</b>`}</span>`;
  }

  /** Uma missão oferecida: contrato com recompensa, equipe recomendada (com risco) e a troca de equipe. */
  private contractCard(m: Mission, full: boolean, anyFree: boolean) {
    const g = this.app.game;
    const tpl = templateOf(m);
    const r = MISSION_RANKS[m.rank]!;
    const need = missionPower(m);
    const reward = missionReward(tpl);
    const chips = RES_KEYS.filter((k) => reward[k])
      .map((k) => `<span class="mchip">${RES_INFO[k].icon} ${reward[k]}${k === 'ryo' ? ' ryo' : ''}</span>`)
      .join('');
    let html = `<div class="mcontract" style="--c:${r.color}">${this.seal(r.label, r.color)}
      <div class="mc-body"><div class="mc-top"><div class="mc-head"><div class="mc-title">${esc(m.title)}</div>
        <div class="mc-meta">${MISSION_TYPE_ICON[m.type]} ${MISSION_TYPE_LABEL[m.type]} · Dificuldade ${need} · ${Math.round(MISSION_TIME)}s</div></div>
        <div class="mc-reward">${chips}<span class="mchip">{star} +${r.xp} XP</span></div></div>
        <div class="mc-desc">${esc(tpl.desc)}</div><div class="mc-foot">`;
    const rec = recommendTeam(g, m);
    if (full) html += `<span class="why">Limite de missões simultâneas atingido.</span>`;
    else if (!anyFree || !rec) html += `<span class="why">Nenhuma equipe livre. Forme uma em {ninja} Ninjas → Equipes.</span>`;
    else {
      const p = teamPower(g, rec);
      html += `<span class="mc-rec">{users} Recomendada: <span class="dot" style="--c:${rec.color}"></span><b>${esc(rec.name)}</b> · poder ${p}</span>${this.riskPill(missionRisk(p, need))}
        <span class="mc-acts"><button class="btn primary" data-act="m-accept" data-arg="${m.id}" data-team="${rec.id}">Enviar</button><button class="btn ghost ${this.missionPick === m.id ? 'on' : ''}" data-act="m-pick" data-arg="${m.id}">Trocar equipe</button></span>`;
    }
    html += `</div>`;
    if (this.missionPick === m.id && !full && rec) {
      html += `<div class="mc-teams">`;
      for (const x of teamsForMission(g, m)) {
        const faces = teamUnits(g, x.team).slice(0, 4).map((u) => this.face(u)).join('');
        html += `<button class="mteam" data-act="m-accept" data-arg="${m.id}" data-team="${x.team.id}"><span class="dot" style="--c:${x.team.color}"></span><b>${esc(x.team.name)}</b><span class="faces">${faces}</span><span class="pw">{swords} ${x.power}</span>${this.riskPill(x.risk)}</button>`;
      }
      html += `</div>`;
    }
    return html + `</div></div>`;
  }

  private riskPill(r: MissionRisk) {
    const [label, ic] = RISK_LABEL[r];
    return `<span class="mpill ${r}">${ic} ${label}</span>`;
  }

  /** Retratinho do ninja (arte de frente), ou uma bolinha com a cor da roupa sem arte. */
  private face(u: Unit) {
    return pimg(unitPortrait(u), 'face');
  }

  /** Contratos em andamento: equipe, fase, barra, tempo, Ver no mapa e Recuar. */
  private activeContracts(active: Mission[], t: Record<string, string>, b: Record<string, number>) {
    const g = this.app.game;
    let html = '';
    for (const m of active) {
      const team = g.team(m.teamId);
      const r = MISSION_RANKS[m.rank]!;
      const [phase, ic, cls] = this.missionPhaseInfo(m);
      const faces = team ? teamUnits(g, team).slice(0, 4).map((u) => this.face(u)).join('') : '';
      html += `<div class="mactive"><div class="ma-top"><span class="dot" style="--c:${team?.color ?? '#888'}"></span><b>${esc(team?.name ?? 'Equipe')}</b><span class="mpill ${cls}">${ic} ${phase}</span></div>
        <div class="ma-title">${this.seal(r.label, r.color, true)}${esc(m.title)}</div>
        <div class="ma-mid"><span class="faces">${faces}</span><div class="ma-prog"><div class="bar pg"><i data-b="mp${m.id}"></i><span data-t="mpl${m.id}"></span></div>
        <div class="ma-time">{hourglass} <span data-t="mt${m.id}"></span></div></div></div>
        <div class="ma-acts"><button class="btn ghost" data-act="m-view" data-arg="${m.id}">{pin} Ver no mapa</button><button class="btn danger" data-act="m-abandon" data-arg="${m.id}" ${tipAttr('Recuar', 'A equipe abandona a missão e volta (conta como fracasso e a reputação cai).')}>{flag} Recuar</button></div></div>`;
      const left = Math.max(0, Math.ceil(m.timeLeft));
      t[`mt${m.id}`] = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
      b[`mp${m.id}`] = m.progress / Math.max(1, m.goal);
      t[`mpl${m.id}`] = `${m.progress}/${m.goal}`;
    }
    return html;
  }

  /** Fase da missão para o selo do contrato: texto, ícone e cor. */
  private missionPhaseInfo(m: Mission): [string, string, MissionRisk] {
    const ph = this.missionPhase(m);
    if (ph === 'emboscada!') return ['Emboscada!', '{alert}', 'danger'];
    if (ph === 'em combate') return ['Em combate', '{swords}', 'danger'];
    if (ph === 'a caminho' || ph === 'indo encontrar o mercador') return ['A caminho', '{run}', 'good'];
    if (ph === 'escoltando') return ['Escoltando', '{cart}', 'safe'];
    return ['Coletando', '{leaf}', 'safe'];
  }

  private missionPhase(m: Mission) {
    const g = this.app.game;
    const team = g.team(m.teamId);
    const lead = team ? teamUnits(g, team)[0] : undefined;
    const far = lead && Math.hypot(lead.x - m.x, lead.y - m.y) > 300;
    if (m.type === 'escort') return m.phase === 'meet' ? 'indo encontrar o mercador' : m.phase === 'ambushed' ? 'emboscada!' : 'escoltando';
    if (far) return 'a caminho';
    return m.type === 'herbs' ? 'coletando' : 'em combate';
  }

  private roster(): Built {
    const g = this.app.game;
    const ninjas = g.state.units.filter((u) => !u.dead && u.kind === 'ninja' && u.faction === 'village');
    const t: Record<string, string> = {};
    const b: Record<string, number> = {};
    let html = this.tabs('roster');
    if (!ninjas.length) return { html: html + `<p class="hint">Nenhum ninja. Construa a Academia e recrute moradores.</p>`, t, b };
    const onMission = new Set(g.state.missions.filter((m) => m.status === 'active').map((m) => m.teamId));
    const tests: Record<RosterFilter, [string, (u: Unit) => boolean]> = {
      all: ['Todos', () => true],
      free: ['Sem equipe', (u) => !teamOf(g, u)],
      team: ['Em equipe', (u) => !!teamOf(g, u)],
      mission: ['Em missão', (u) => onMission.has(teamOf(g, u)?.id ?? -1)],
      hurt: ['Feridos', (u) => u.hp < u.maxHp * 0.6],
      genin: ['Genin', (u) => u.ninja!.rank === 'genin'],
      chunin: ['Chunin', (u) => u.ninja!.rank === 'chunin'],
      jounin: ['Jounin', (u) => u.ninja!.rank === 'jounin'],
      sannin: ['Sannin', (u) => !!u.ninja!.sannin],
      anbu: ['ANBU', (u) => !!u.ninja!.anbu],
      kage: ['Kage', (u) => u.ninja!.rank === 'kage'],
    };
    // filtros (os de status só aparecem com alguém; os de graduação sempre) e a ordem, numa faixa
    html += `<div class="rfilters"><div class="fchips">`;
    for (const [k, [label, fn]] of Object.entries(tests) as [RosterFilter, [string, (u: Unit) => boolean]][]) {
      const n = ninjas.filter(fn).length;
      if (!n && k !== this.rosterFilter && k !== 'all' && !RANK_FILTERS.includes(k)) continue;
      html += `<button data-act="r-filter" data-arg="${k}" class="${this.rosterFilter === k ? 'on' : ''} ${k === 'hurt' ? 'bad' : ''}">${label} <small>${n}</small></button>`;
    }
    html += `</div><div class="fchips rsort"><span class="lbl">{refresh} Ordenar</span>`;
    for (const [k, label, tip] of ROSTER_SORTS)
      html += `<button data-act="r-sort" data-arg="${k}" class="${this.rosterSort === k ? 'on' : ''}" ${tipAttr(label, tip)}>${label}</button>`;
    html += `</div></div>`;
    const RANK_N: Record<string, number> = { genin: 0, chunin: 1, jounin: 2, kage: 3 };
    const by: Record<RosterSort, (a: Unit, z: Unit) => number> = {
      level: (a, z) => z.ninja!.level - a.ninja!.level || z.ninja!.xp - a.ninja!.xp,
      rank: (a, z) => RANK_N[z.ninja!.rank]! - RANK_N[a.ninja!.rank]! || z.ninja!.level - a.ninja!.level,
      power: (a, z) => statSum(z) - statSum(a),
      hp: (a, z) => a.hp / a.maxHp - z.hp / z.maxHp,
      name: (a, z) => a.name.localeCompare(z.name, 'pt-BR'),
    };
    const list = ninjas.filter(tests[this.rosterFilter][1]).sort(by[this.rosterSort]);
    html += this.rosterTools();
    if (!list.length) html += `<p class="hint">Nenhum ninja neste filtro.</p>`;
    html += `<div class="ncards">`;
    for (const u of list) html += this.ninjaCard(u, t, b, onMission);
    html += `</div>`;
    return { html, t, b };
  }

  /** Faixa de ações em lote da lista de ninjas: equipar, ensinar e os automáticos (chave liga/desliga). */
  private rosterTools() {
    const g = this.app.game;
    const f = g.state.flags;
    const free = g.state.units.filter((u) => !u.dead && u.kind === 'ninja' && u.faction === 'village' && u.ninja && !u.ninja.learning && u.ninja.jutsu.includes(null)).length;
    const tog = togBtn;
    return `<div class="wtools">
      <button class="btn primary" data-act="gear-all" ${tipAttr('Equipar', 'Passa o melhor do estoque para cada ninja; os mais fortes escolhem primeiro.')}>{kunai} Equipar</button>
      ${tog('gear-auto', !!f.autoGear, '{gear} Auto-equipar', 'Equipamento automático', 'Ligado: a cada poucos segundos o que for fabricado vai sozinho para quem precisa.')}
      ${tog('rookies', !!f.shelterRookies, '{shield} Proteger novatos', 'Proteger novatos', `Ligado: Genins fogem para casa (ou para o Hospital) quando chega um inimigo ${CARE.danger}× mais forte que eles, e saem quando o perigo passa. Só vale se houver um Chunin ou acima na vila para defender; uma ordem sua sempre manda.`)}
      <button class="btn" data-act="teach-all" ${blocked(g, [!g.findBuilt('academy') && 'Construa a Academia Ninja.', !free && 'Ninguém com espaço livre para jutsu.'])} ${tipAttr('Ensinar', 'Cada ninja com espaço livre vai estudar o melhor jutsu que pode aprender (pela natureza, rank e atributos dele). Paga o ryo de cada jutsu.')}>{books} Ensinar (${free})</button>
      ${tog('auto-teach', !!f.autoTeach, '{scroll} Auto-ensino', 'Ensino automático', `Ligado: a Academia manda sozinha quem tiver espaço livre estudar (até ${maxLearners(g)} ao mesmo tempo, para não esvaziar a defesa). Jutsus proibidos ficam de fora.`)}
    </div>`;
  }

  /** Cartão de ninja da janela: retrato, graduação, nível, vida e chakra, equipe, jutsus e o que está fazendo. */
  private ninjaCard(u: Unit, t: Record<string, string>, b: Record<string, number>, onMission: Set<number | null>) {
    const g = this.app.game;
    const n = u.ninja!;
    const nat = NATURES[n.nature];
    const team = teamOf(g, u);
    const js = n.jutsu.filter(Boolean).map((id) => JUTSUS[id!]!.shout.replace('!', '')).join(', ') || 'sem jutsu';
    b[`hp${u.id}`] = u.hp / u.maxHp;
    b[`ck${u.id}`] = u.chakra / Math.max(1, u.maxChakra);
    t[`hpt${u.id}`] = `${Math.ceil(u.hp)}/${u.maxHp}`;
    t[`ckt${u.id}`] = `${Math.floor(u.chakra)}/${u.maxChakra}`;
    const rank = n.sannin ? 'sannin' : n.rank;
    const rankLabel = n.sannin ? 'Sannin' : RANKS[n.rank].name;
    const [stLabel, stIc, stCls] = this.ninjaStatus(u, team && onMission.has(team.id));
    const pic = unitPortrait(u, true);
    return `<button class="ncard" data-act="pick" data-arg="${u.id}" ${team ? `style="--c:${team.color}"` : ''}>
      <span class="nc-face">${pimg(pic)}</span>
      <span class="nc-main"><span class="nc-name">${esc(u.name)}</span>
        <span class="nc-badges"><span class="rbadge r-${rank}">${RANK_BADGE_ICON[rank] ?? ''} ${rankLabel}</span><span class="lvbadge">Nv ${n.level}</span><span class="badge nat" style="--c:${nat.color}">${nat.kanji}</span></span>
        <span class="nc-bar hp"><i data-b="hp${u.id}"></i></span><span class="nc-num" data-t="hpt${u.id}"></span>
        <span class="nc-bar ck"><i data-b="ck${u.id}"></i></span><span class="nc-num" data-t="ckt${u.id}"></span></span>
      <span class="nc-line">${team ? `<span class="dot"></span>${esc(team.name)}` : `<span class="dot" style="--c:#666"></span>Sem equipe`}</span>
      <span class="nc-line">{kunai} ${esc(js)}</span>
      <span class="mpill ${stCls}">${stIc} ${stLabel}</span></button>`;
  }

  /** O que o ninja está fazendo, com ícone e cor (para o selo do cartão). */
  private ninjaStatus(u: Unit, mission: boolean | undefined): [string, string, string] {
    if (u.away === WITH_SOUND) return ['Raptado', '{skull}', 'danger'];
    if (u.captiveOf != null) return ['Sendo levado', '{alert}', 'danger'];
    if (u.away != null) return ['Fora da vila', '{map}', 'good'];
    if (mission) return ['Em missão', '{clipboard}', 'good'];
    if (u.hp < u.maxHp * 0.6) return ['Ferido', '{medic}', 'danger'];
    if (u.ninja?.learning) return ['Estudando', '{books}', 'info'];
    const label = STATE_LABEL[u.state] ?? u.state;
    if (u.state === 'train') return [label, '{dummy}', 'safe'];
    if (u.state === 'fight' || u.state === 'attack' || u.state === 'engage') return [label, '{swords}', 'risky'];
    return [label, '{house}', 'info'];
  }

  private ninjaRow(u: Unit, t: Record<string, string>, b: Record<string, number>, extra = '') {
    const n = u.ninja!;
    const nat = NATURES[n.nature];
    const team = teamOf(this.app.game, u);
    const js = n.jutsu.filter(Boolean).map((id) => JUTSUS[id!]!.shout.replace('!', '')).join(', ') || 'sem jutsu';
    t[`st${u.id}`] = STATE_LABEL[u.state] ?? u.state;
    b[`hp${u.id}`] = u.hp / u.maxHp;
    return `<button class="rrow" data-act="pick" data-arg="${u.id}" ${team ? `style="--c:${team.color}"` : ''}>
      <span class="rn">${team ? '<span class="dot"></span>' : ''}${extra}${esc(u.name)}</span>
      <span class="badges"><span class="badge rank">${RANKS[n.rank].name}</span><span class="badge nat" style="--c:${nat.color}">${nat.kanji}</span><span class="badge">Nv ${n.level}</span></span>
      <span class="rm">${esc(js)} · <span data-t="st${u.id}"></span></span><span class="mini"><i data-b="hp${u.id}"></i></span></button>`;
  }

  /**
   * Equipes: cartões (cor, sensei, retratos, poder, o que estão fazendo) e, na janela larga, a equipe escolhida ao lado.
   * Na estreita, a equipe aberta ocupa a tela (com Voltar).
   */
  private teamsList(sel: Team | null = null): Built {
    const g = this.app.game;
    const t: Record<string, string> = {};
    const b: Record<string, number> = {};
    const wide = window.matchMedia(WIDE_BOARD).matches;
    let html = this.tabs(sel ? 'team' : 'teams');
    if (sel && !wide) return { html: html + this.teamDetail(sel, t, b, true), t, b };
    // ações no topo, antes da lista (não ficam lá embaixo depois de muitas equipes)
    const free = g.state.units.filter((u) => !u.dead && u.kind === 'ninja' && u.faction === 'village' && u.ninja!.rank !== 'kage' && !teamOf(g, u)).length;
    let list = `<div class="wtools thead"><button class="btn primary" data-act="team-auto" ${blocked(g, [!free && 'Todos os ninjas já estão em equipes.'], undefined, 'Ninguém sem equipe')} ${tipAttr(
      'Montar automaticamente',
      'Completa as vagas das equipes que já existem e cria novas com quem está sem equipe, equilibrando a força e dando um sensei Chunin+ a cada uma quando houver.',
    )}>{users} Montar${free ? ` (${free})` : ''}</button>
      <button class="btn" data-act="team-new">{plus} Nova equipe</button>
      <button class="btn tog ${g.state.flags.autoSensei ? 'on' : ''}" data-act="auto-sensei" ${tipAttr(
        'Senseis automáticos',
        'Ligado: equipe sem sensei recebe um sozinha (um Chunin+ da própria equipe ou o Jounin livre mais forte).',
      )}>{crown} Auto-sensei<i class="sw"></i></button></div>`;
    list += `<h4>Equipes da vila</h4><div class="tcards">`;
    for (const tm of g.state.teams) list += this.teamCard(tm, sel?.id === tm.id);
    if (!g.state.teams.length) list += `<p class="hint">Nenhuma equipe ainda. Monte automaticamente ou crie uma vazia.</p>`;
    list += `</div>`;
    if (!wide) return { html: html + list, t, b };
    const detail = sel
      ? this.teamDetail(sel, t, b, false)
      : `<div class="tempty">{users}<p>Escolha uma equipe para ver a formação, dar ordens e trocar membros.</p><p class="hint">Equipes treinam e lutam juntas: seguem o líder, focam o mesmo alvo (+10% de dano juntos) e treinam 50% mais rápido com um sensei Chunin+.</p></div>`;
    return { html: html + `<div class="tboard"><div class="tlist">${list}</div><div class="tdetail">${detail}</div></div>`, t, b };
  }

  /** O que a equipe está fazendo agora (selo do cartão). */
  private teamStatus(tm: Team): [string, string, string] {
    const g = this.app.game;
    const m = missionOfTeam(g, tm.id);
    if (m) {
      const [ph, ic, cls] = this.missionPhaseInfo(m);
      return [ph === 'A caminho' ? 'A caminho' : 'Em missão', ic, cls === 'danger' ? 'danger' : 'good'];
    }
    const us = teamUnits(g, tm);
    if (!us.length) return ['Vazia', '{users}', 'info'];
    if (us.some((u) => u.away != null)) return ['Expedição', '{map}', 'good'];
    if (us.some((u) => u.state === 'fight')) return ['Em combate', '{swords}', 'danger'];
    if (us.every((u) => u.state === 'train' || u.state === 'toTrain')) return ['Treinando', '{dummy}', 'info'];
    return ['Livre', '{shield}', 'safe'];
  }

  private teamCard(tm: Team, on: boolean) {
    const g = this.app.game;
    const sensei = g.unit(tm.senseiId);
    const us = tm.memberIds.map((id) => g.unit(id)).filter((u): u is Unit => !!u);
    const faces = [sensei, ...us].filter((u): u is Unit => !!u).map((u) => this.face(u)).join('');
    const empty = Math.max(0, MAX_MEMBERS - us.length);
    const [st, ic, cls] = this.teamStatus(tm);
    return `<button class="tcard ${on ? 'on' : ''}" data-act="open-team" data-arg="${tm.id}" style="--c:${tm.color}">
      <span class="tc-name"><span class="dot"></span>${esc(tm.name)}</span>
      <span class="tc-sensei">{crown} Sensei: <b>${sensei ? esc(sensei.name.split(' ')[0]!) : 'sem sensei'}</b></span>
      <span class="tc-faces faces">${faces}${'<span class="face slot">{plus}</span>'.repeat(empty)}</span>
      <span class="tc-side"><span class="mchip">{swords} Poder ${teamPower(g, tm)}</span><span class="mpill ${cls}">${ic} ${st}</span></span></button>`;
  }

  /** Detalhe da equipe: números, formação (sensei e membros), rotina, missão, ordens, quem pode entrar e desfazer. */
  private teamDetail(tm: Team, t: Record<string, string>, b: Record<string, number>, back: boolean) {
    const g = this.app.game;
    const sensei = g.unit(tm.senseiId);
    const units = teamUnits(g, tm);
    const [st, ic, cls] = this.teamStatus(tm);
    let html = `<div class="td-head" style="--c:${tm.color}">${back ? `<button class="btn icon" data-act="team-back" title="Voltar">{back}</button>` : ''}<span class="dot"></span><b class="td-name">${esc(tm.name)}</b><span class="mpill ${cls}">${ic} ${st}</span></div>
      <div class="td-chips"><span class="mchip">{users} ${tm.memberIds.length}/${MAX_MEMBERS} membros</span><span class="mchip">{swords} Poder ${teamPower(g, tm)}</span>
      <span class="mchip" ${tipAttr('Juntos', 'Membros perto uns dos outros focam o mesmo alvo e causam +10% de dano.', true)}>{star} +10% dano junto</span>
      ${sensei ? `<span class="mchip" ${tipAttr('Sensei', 'Com um sensei Chunin+ a equipe treina 50% mais rápido.', true)}>{up} +50% treino</span>` : ''}</div>`;
    if (!sensei && !tm.memberIds.length)
      html += `<div class="warnbox">Monte a equipe aqui: escolha até ${MAX_MEMBERS} membros e, se quiser, um sensei Chunin ou Jounin (treinam 50% mais rápido).</div>`;
    // formação: o sensei em cima, os membros embaixo, cada um com retrato
    const tile = (u: Unit | undefined, role: string) => {
      if (!u) return `<div class="ttile empty"><span class="tt-face">{plus}</span><span class="tt-role">${role}</span></div>`;
      const pic = unitPortrait(u, true);
      b[`thp${u.id}`] = u.hp / u.maxHp;
      return `<div class="ttile"><button class="tt-x" data-act="team-remove" data-arg="${u.id}" ${tipAttr('Tirar da equipe', `${u.name} sai da equipe.`)}>{x}</button>
        <button class="tt-pick" data-act="pick" data-arg="${u.id}"><span class="tt-face">${pimg(pic)}</span>
        <span class="tt-name">${esc(u.name.split(' ')[0]!)}</span><span class="tt-role ${role === 'Sensei' ? 'sensei' : ''}">${role} · Nv ${u.ninja!.level}${roleOf(u) ? ` · ${ROLE_ICON[roleOf(u)!]}` : ''}</span>
        <span class="nc-bar hp"><i data-b="thp${u.id}"></i></span></button></div>`;
    };
    html += `<div class="td-cols"><div><h4>Formação</h4><div class="tform"><div class="tf-top">${tile(sensei, 'Sensei')}</div><div class="tf-row">`;
    for (let i = 0; i < MAX_MEMBERS; i++) html += tile(g.unit(tm.memberIds[i]), 'Membro');
    html += `</div></div></div><div>`;
    const mission = missionOfTeam(g, tm.id);
    html += `<h4>Missão atual</h4><p class="td-mission">${mission
      ? `{clipboard} ${esc(mission.title)} (rank ${MISSION_RANKS[mission.rank]!.label}) · ${this.missionPhase(mission)}`
      : `Livre · envie pela {clipboard} Mesa de Missões.`}</p>`;
    if (units.length) {
      const n0 = units[0]!.ninja!;
      html += `<h4>Rotina da equipe</h4><div class="seg troutine">`;
      for (const [k, label] of ROUTINES)
        html += `<button data-act="team-mode" data-arg="${k}" class="${n0.order === k ? 'on' : ''}" ${tipAttr(label, ROUTINE_TIP[k])}>${ROUTINE_ICON[k]} ${label}</button>`;
      html += `</div><h4>Tática de luta ${infoTip('Tática de luta', 'Como a equipe luta quando encontra inimigos. Livre: duelos (cada um pega um adversário diferente). Os papéis (tanque, atacante, atirador, suporte) vêm dos atributos de cada um.')}</h4><div class="seg ttactic">`;
      const cur: Tactic = tm.tactic ?? 'free';
      for (const k of ['free', 'focus', 'hold', 'flank'] as Tactic[])
        html += `<button data-act="team-tactic" data-arg="${k}" class="${cur === k ? 'on' : ''}" ${tipAttr(TACTIC_INFO[k].name, TACTIC_INFO[k].desc)}>${TACTIC_ICON[k]} ${TACTIC_INFO[k].name}</button>`;
      html += `</div><h4>Ordens</h4><div class="tcmds">
        <button class="btn primary" data-act="cmd-mode" data-arg="team">{pin} Dar ordem</button>
        <button class="btn" data-act="cmd-retreat" data-arg="team">{run} Recuar</button>
        <button class="btn" data-act="cmd-clear" data-arg="team">{x} Cancelar</button>
        <button class="btn" data-act="team-autoequip">{kunai} Equipar equipe</button></div>`;
    }
    html += `</div></div>` + this.teamCandidates(tm);
    html += `<div class="actions"><button class="btn danger" data-act="team-disband">${this.armedDemolish ? 'Toque de novo para confirmar' : '{trash} Desfazer equipe'}</button></div>`;
    return html;
  }

  /** Ninjas sem equipe que podem entrar nesta: membro (qualquer patente) ou sensei (Chunin+). */
  private teamCandidates(tm: Team) {
    const g = this.app.game;
    // só quem pode entrar nesta equipe (o Kage nunca; ANBU só com ANBU)
    const free = g.state.units.filter((u) => !u.dead && u.kind === 'ninja' && u.faction === 'village' && !teamOf(g, u) && !teamFit(g, tm, u));
    const room = tm.memberIds.length < MAX_MEMBERS;
    if (!room && tm.senseiId != null) return '';
    let html = `<h4>Adicionar à equipe</h4>`;
    if (!free.length) return html + `<p class="hint">Todos os ninjas já estão em equipes. Recrute mais na Academia ou tire alguém de outra equipe.</p>`;
    html += `<div class="roster tcands scrollist">`;
    for (const u of free) {
      const n = u.ninja!;
      const nat = NATURES[n.nature];
      const lead = n.rank !== 'genin';
      html += `<div class="cand">${this.face(u)}<span class="rn">${esc(u.name)}</span>
        <span class="badges"><span class="badge rank">${RANKS[n.rank].name}</span><span class="badge nat" style="--c:${nat.color}">${nat.kanji}</span><span class="badge">Nv ${n.level}</span></span>
        <span class="btnrow">${room ? `<button class="btn mini primary" data-act="team-add" data-arg="${u.id}">{plus} Membro</button>` : ''}${
          lead && tm.senseiId == null ? `<button class="btn mini" data-act="team-sensei" data-arg="${u.id}">{crown} Sensei</button>` : ''
        }</span></div>`;
    }
    return html + `</div>`;
  }

  // ------------------------------------------------------------------ ações
  private commandIds(v: View, arg: string): number[] {
    const g = this.app.game;
    if (v.kind === 'group') return this.app.group;
    if (v.kind === 'team') {
      const tm = g.team(v.id);
      return tm ? teamUnits(g, tm).map((u) => u.id) : [];
    }
    if (v.kind !== 'unit') return [];
    if (arg === 'team') {
      const tm = teamOf(g, v.id);
      return tm ? teamUnits(g, tm).map((u) => u.id) : [v.id];
    }
    return [v.id];
  }

  private report(r: Result) {
    if (!r.ok) this.app.game.toast(r.error, 'warn');
    this.lastHtml = '';
    this.update();
  }

  private onClick(e: Event) {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!btn) return;
    const g = this.app.game;
    if (blockedClick(g, btn)) return; // bloqueado: mostra o que falta em vez de não fazer nada
    const act = btn.dataset.act;
    const arg = btn.dataset.arg ?? '';
    const v = this.view;
    switch (act) {
      case 'close':
        if (this.mode === 'drawer') g.select(null);
        this.show(null);
        return;
      case 'pick': {
        // da janela: fecha e abre o ninja no painel lateral, com a câmera nele (lembrando de onde veio, para o "Voltar")
        const u = g.unit(Number(arg));
        if (u) {
          // no desktop largo a janela fica aberta e encolhe para o lado; senão fecha e o ninja ganha o "Voltar"
          if (this.mode === 'window' && !sideBySide()) {
            if (this.view) this.app.back = { view: { ...this.view }, id: u.id };
            this.show(null);
          }
          g.select({ kind: 'unit', id: u.id });
          this.app.camera.focus(u.x, u.y);
        }
        return;
      }
      case 'back-list': {
        const bk = this.app.back;
        this.app.back = null;
        if (!bk) return;
        g.select(null);
        this.onWindow(bk.view as View);
        return;
      }
      case 'team-back':
        this.show(this.teamFrom ?? { kind: 'teams' });
        return;
      case 'ws-craft': {
        const [bid, id, n] = String(arg).split(':');
        let made = 0;
        let last: { ok: true } | { ok: false; error: string } = { ok: true };
        for (let i = 0; i < Number(n); i++) {
          last = enqueueCraft(g, Number(bid), id!);
          if (!last.ok) break;
          made++;
        }
        return this.report(made ? { ok: true } : last);
      }
      case 'ws-cancel':
        return this.report(cancelCraft(g, Number(arg)));
      case 'ws-keep': {
        const [bid, id, n] = String(arg).split(':');
        return this.report(setKeep(g, Number(bid), id!, Number(n)));
      }
      case 'ws-worker':
        return this.report(setDesiredWorkers(g, Number(arg), 1));
      case 'ws-upgrade':
        return this.report(startUpgrade(g, Number(arg)));
      case 'teach-all': {
        const n = teachAll(g);
        g.toast(n ? `{scroll} ${n} ninja(s) foram estudar um jutsu novo na Academia.` : '{scroll} Ninguém pôde começar a estudar agora (sem espaço, sem jutsu disponível ou sem ryo).', n ? 'good' : 'info');
        return this.report({ ok: true });
      }
      case 'auto-teach':
        g.state.flags.autoTeach = !g.state.flags.autoTeach;
        g.toast(g.state.flags.autoTeach ? '{scroll} Academia vai ensinar sozinha quem tiver espaço para jutsu.' : '{scroll} Ensino automático desligado.', 'info');
        return this.report({ ok: true });
      case 'auto-sensei':
        g.state.flags.autoSensei = !g.state.flags.autoSensei;
        return this.report({ ok: true });
      case 'sannin': {
        const [id, path] = String(arg).split(':');
        return this.report(nameSannin(g, Number(id), path as SanninPath));
      }
      case 'hire':
        return this.report(hireMercenary(g, arg as 'chunin' | 'jounin'));
      case 'buy-rare': {
        const [res, n] = String(arg).split(':');
        return this.report(buyRare(g, res as 'crystal' | 'darksteel', Number(n)));
      }
      case 'tab':
        if (this.mode === 'drawer') g.select(null);
        this.show({ kind: arg as 'roster' });
        return;
      case 'win':
        this.onWindow({ kind: arg as 'village' });
        return;
      case 'btab':
        this.buildingTab = arg as BuildingTab;
        return this.report({ ok: true });
      case 'awaken':
        return this.report(awakenKekkei(g, Number(arg), btn.dataset.k as KekkeiId));
      case 'org-defend':
        return this.report(prepareDefense(g));
      case 'anbu-in': {
        const r = appointAnbu(g, Number(arg), this.anbuMaskSel ?? freeMask(g));
        if (r.ok) this.anbuMaskSel = null;
        return this.report(r);
      }
      case 'anbu-mask':
        this.anbuMaskSel = MASK_LIST.includes(String(arg)) ? String(arg) : null;
        return this.report({ ok: true });
      case 'anbu-out':
        return this.report(dismissAnbu(g, Number(arg)));
      case 'covert':
        return this.report(startCovert(g, String(arg)));
      case 'sannin-sel': {
        const [path, id] = arg.split(':');
        this.sanninSel[path!] = Number(id);
        this.update();
        return;
      }
      case 'go-hokage': {
        const h = g.findBuilt('hokage');
        if (h) {
          if (this.mode === 'window') this.show(null);
          g.select({ kind: 'building', id: h.id });
          this.app.camera.focus((h.tx + BUILDINGS.hokage.w / 2) * TILE, (h.ty + BUILDINGS.hokage.h / 2) * TILE);
        }
        return;
      }
      case 'view-scene':
        if (this.mode === 'window') this.show(null);
        this.app.setView(true);
        return;
      case 'open-team':
        if (this.mode === 'window') this.show({ kind: 'team', id: Number(arg) });
        else this.onWindow({ kind: 'team', id: Number(arg) });
        return;
      case 'dog-pick':
        this.dogPick = Number(arg);
        return this.report({ ok: true });
      case 'lib-tab':
        this.libTab = arg === 'open' ? 'open' : 'closed';
        return this.report({ ok: true });
      case 'lib-open':
        return this.report(openScroll(g, String(arg)));
      case 'kennel-tab':
        this.kennelTab = arg === 'with' ? 'with' : 'without';
        return this.report({ ok: true });
      case 'craft-tab':
        if (arg === 'forge' || arg === 'pharmacy' || arg === 'sealshop') this.craftTab = arg;
        return this.report({ ok: true });
      case 'inv-filter':
        this.invFilter = (['weapon', 'armor', 'item'] as string[]).includes(String(arg)) ? (arg as ItemSlot) : 'all';
        return this.report({ ok: true });
      case 'dog-release':
        return this.report(releaseDog(g, Number(arg)));
      case 'dog-give': {
        const [dogId, unitId] = String(arg).split(':').map(Number);
        return this.report(giveDog(g, dogId!, unitId!));
      }
      case 'dog-for':
        return this.report(adoptDog(g, Number(arg), this.dogBreed));
      case 'gear-all': {
        const n = autoEquipAll(g);
        g.toast(n ? `{gear} ${n} ninja(s) receberam equipamento do estoque.` : '{gear} Ninguém precisava de nada do estoque.', n ? 'good' : 'info');
        return this.report({ ok: true });
      }
      case 'gear-auto':
        setAutoGear(g, !g.state.flags.autoGear);
        return this.report({ ok: true });
      case 'field-focus': {
        if (v?.kind !== 'building') return;
        return this.report(setFieldFocus(g, v.id, (arg || null) as StatKey | null));
      }
      case 'market-good': {
        if (v?.kind !== 'building') return;
        return this.report(setMarketGood(g, v.id, (arg || null) as MarketGood | null));
      }
      case 'rookies':
        g.state.flags.shelterRookies = !g.state.flags.shelterRookies;
        g.toast(g.state.flags.shelterRookies ? '{ninja} Genins vão se abrigar de inimigos fortes demais.' : '{ninja} Genins voltam a lutar contra qualquer inimigo.', 'info');
        return this.report({ ok: true });
      case 'dog': {
        if (v?.kind !== 'unit') return;
        return this.report(adoptDog(g, v.id, this.dogBreed));
      }
      case 'festival':
        return this.report(holdFestival(g));
      case 'spec': {
        if (v?.kind !== 'unit') return;
        return this.report(learnSpec(g, v.id, arg as SpecKind));
      }
      case 'r-node':
        this.regionNode = arg;
        return this.report({ ok: true });
      case 'r-team':
        this.regionTeam = Number(arg);
        return this.report({ ok: true });
      case 'r-go': {
        if (!this.regionNode || this.regionTeam == null) return;
        const r = startRegion(g, this.regionTeam, this.regionNode, arg as RegionAction);
        return this.report(r);
      }
      case 'sell-gold': {
        const n = arg === 'all' ? Math.floor(g.state.res.gold) : Math.min(1, Math.floor(g.state.res.gold));
        if (n <= 0) return;
        g.state.res.gold -= n;
        g.state.res.ryo += n * GOLD_PRICE;
        g.toast(`{gold} Vendeu ${n} ouro por ${n * GOLD_PRICE}{ryo}.`, 'good');
        return this.report({ ok: true });
      }
      case 'mine-go': {
        const r = startMine(g, Number(btn.dataset.team), Number(arg));
        if (r.ok && this.mode === 'drawer') this.onWindow({ kind: 'expeditions' });
        return this.report(r);
      }
      case 'exp-deeper':
      case 'exp-back':
        return this.report(chooseExpedition(g, Number(arg), act === 'exp-deeper'));
      case 'site-open': {
        const site = g.state.sites.find((x) => x.id === Number(arg));
        if (!site) return;
        if (this.mode === 'window') this.show(null);
        const p = sitePos(site);
        this.app.camera.focus(p.x, p.y);
        g.select({ kind: 'site', id: site.id });
        return;
      }
      case 'site-go': {
        if (v?.kind !== 'site') return;
        const site = g.state.sites.find((x) => x.id === v.id);
        if (!site || site.done) return;
        const free = availableFighters(g);
        const p = sitePos(site);
        let ids: Unit[];
        if (arg === 'team') {
          const tm = g.team(Number(btn.dataset.team));
          const ok = new Set(free.map((u) => u.id));
          ids = tm ? teamUnits(g, tm).filter((u) => ok.has(u.id)) : [];
        } else ids = free.sort((a, z) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(z.x - p.x, z.y - p.y)).slice(0, 1);
        for (const u of ids) {
          u.command = { kind: 'investigate', siteId: site.id, t: 0 };
          u.hidden = false;
          u.state = 'idle';
        }
        if (ids.length) g.toast(`{run} ${ids.length} ninja(s) a caminho de ${SITES[site.kind].name}.`, 'info');
        return this.report({ ok: true });
      }
      case 'atk': {
        if (v?.kind !== 'unit') return;
        const target = g.unit(v.id);
        if (!isAttackable(target)) return;
        const free = availableFighters(g);
        let ids: number[];
        if (arg === 'near') ids = nearestFighters(g, target, 3).map((u) => u.id);
        else if (arg === 'team') {
          const tm = g.team(Number(btn.dataset.team));
          const ok = new Set(free.map((u) => u.id));
          ids = tm ? teamUnits(g, tm).filter((u) => ok.has(u.id)).map((u) => u.id) : [];
        } else ids = free.map((u) => u.id);
        const r = orderAttack(g, ids, target.id);
        if (r.ok) g.toast(`{swords} ${ids.length} ninja(s) indo atacar ${target.name}.`, 'good');
        return this.report(r);
      }
      case 'atk-stop': {
        if (v?.kind !== 'unit') return;
        return this.report(clearCommand(g, attackersOf(g, v.id).map((u) => u.id)));
      }
      case 'dog-breed':
        this.dogBreed = BREED_LIST.includes(arg as DogBreed) ? (arg as DogBreed) : 'shiba';
        return this.report({ ok: true });
      case 'r-filter':
        this.rosterFilter = arg as RosterFilter;
        return this.report({ ok: true });
      case 'r-sort':
        this.rosterSort = arg as RosterSort;
        return this.report({ ok: true });
      case 'team-auto': {
        const r = autoTeams(g);
        if (!r.ok) return this.report(r);
        g.toast(`{users} ${r.placed} ninja(s) em equipe${r.created ? ` · ${r.created} equipe(s) nova(s)` : ''}.`, 'good');
        return this.report(r);
      }
      case 'team-new': {
        const tm = createTeam(g);
        if (this.mode === 'window') this.show({ kind: 'team', id: tm.id });
        else this.onWindow({ kind: 'team', id: tm.id });
        return;
      }
      // vila e missões (valem no painel do prédio e na janela)
      case 'upgrade':
        return this.report(upgradeVillage(g));
      case 'elect':
        return this.report(electKage(g, Number(arg)));
      case 'm-accept':
        this.missionPick = null;
        return this.report(acceptMission(g, Number(arg), Number(btn.dataset.team)));
      case 'm-pick':
        this.missionPick = this.missionPick === Number(arg) ? null : Number(arg);
        this.update();
        return;
      case 'm-tab':
        this.missionTab = arg as MissionTab;
        this.update();
        return;
      case 'm-auto': {
        const r = autoAssign(g);
        if (r.ok) g.toast(`{users} Auto designar: ${r.sent} equipe(s) partiram.`, 'good');
        return this.report(r);
      }
      case 'm-abandon':
        return this.report(abandonMission(g, Number(arg)));
      case 'm-view': {
        const m = g.state.missions.find((x) => x.id === Number(arg));
        if (m) {
          const p = missionFocus(g, m);
          this.app.camera.focus(p.x, p.y);
          if (this.mode === 'window') this.show(null);
        }
        return;
      }
    }
    // ordens valem tanto para a tela do ninja quanto para a da equipe
    if ((v?.kind === 'unit' || v?.kind === 'team' || v?.kind === 'group') && act?.startsWith('cmd-')) {
      const ids = this.commandIds(v, arg);
      if (act === 'cmd-mode') {
        if (!ids.length) return this.report({ ok: false, error: 'Nenhum ninja para receber a ordem.' });
        this.app.orderMode = { ids, label: v.kind === 'group' ? `${ids.length} ninjas` : arg === 'team' || v.kind === 'team' ? 'equipe' : 'ninja' };
        this.onOrderMode();
        return;
      }
      if (act === 'cmd-retreat') return this.report(orderRetreat(g, ids));
      if (act === 'cmd-clear') return this.report(clearCommand(g, ids));
    }
    if (v?.kind === 'team') {
      switch (act) {
        case 'team-mode':
          return this.report(setTeamOrder(g, v.id, arg as NinjaOrder));
        case 'team-tactic':
          return this.report(setTeamTactic(g, v.id, arg as Tactic));
        case 'team-add':
          return this.report(joinAsMember(g, v.id, Number(arg)));
        case 'team-sensei':
          return this.report(joinAsSensei(g, v.id, Number(arg)));
        case 'team-remove':
          leaveTeam(g, Number(arg));
          return this.report({ ok: true });
        case 'team-autoequip': {
          const tm = g.team(v.id);
          return this.report(tm ? autoEquip(g, teamUnits(g, tm).map((u) => u.id)) : { ok: false, error: 'Equipe inválida.' });
        }
        case 'team-disband':
          if (!this.armedDemolish) {
            this.armedDemolish = 1;
            this.lastHtml = '';
            this.update();
            return;
          }
          disbandTeam(g, v.id);
          this.show({ kind: 'teams' });
          return;
      }
    }
    if (v?.kind === 'unit') {
      switch (act) {
        case 'unit-tab':
          this.unitTab = arg as UnitTab;
          this.body.scrollTop = 0;
          return this.report({ ok: true });
        case 'focus':
          return this.report(setFocus(g, v.id, (arg || null) as StatKey | null));
        case 'teach-open':
          this.show({ kind: 'unit', id: v.id, teach: true });
          return;
        case 'teach-back':
          this.show({ kind: 'unit', id: v.id });
          return;
        case 'learn': {
          const r = teachJutsu(g, v.id, arg, Number(btn.dataset.slot) as 0 | 1);
          if (r.ok) this.show({ kind: 'unit', id: v.id });
          else this.report(r);
          return;
        }
        case 'promote':
          return this.report(promote(g, v.id));
        case 'order':
          return this.report(setOrder(g, v.id, arg as NinjaOrder));
        case 'focus-cam': {
          const u = g.unit(v.id);
          if (u) this.app.camera.focus(u.x, u.y);
          return;
        }
        case 'found-clan':
          return this.report(foundClan(g, v.id));
        case 'equip':
          return this.report(equip(g, v.id, arg));
        case 'unequip':
          return this.report(unequip(g, v.id, arg as ItemSlot));
        case 'autoequip':
          return this.report(autoEquip(g, [v.id]));
        case 'team-join':
          return this.report(btn.dataset.slot === 'sensei' ? joinAsSensei(g, Number(arg), v.id) : joinAsMember(g, Number(arg), v.id));
        case 'team-create-with':
          return this.report(createTeamWith(g, v.id));
        case 'team-leave':
          leaveTeam(g, v.id);
          return this.report({ ok: true });
      }
    }
    if (v?.kind === 'building') {
      switch (act) {
        case 'workers':
          return this.report(setDesiredWorkers(g, v.id, Number(arg)));
        case 'recruit':
          return this.report(recruitNinja(g));
        case 'craft':
          return this.report(enqueueCraft(g, v.id, arg));
        case 'exam-start':
          return this.report(startExam(g));
        case 'exam-size':
          return this.report(setExamSize(g, Number(arg)));
        case 'watch': {
          const a = g.findBuilt('arena');
          if (a) {
            const c = arenaSpots(a).center;
            this.app.camera.focus(c.x, c.y);
          }
          return;
        }
        case 'craft-cancel':
          return this.report(cancelCraft(g, v.id));
        case 'move':
          this.onMove(v.id);
          return;
        case 'upgrade-building':
          return this.report(startUpgrade(g, v.id));
        case 'demolish':
          if (!this.armedDemolish) {
            this.armedDemolish = 1;
            this.lastHtml = '';
            this.update();
            return;
          }
          this.report(demolish(g, v.id));
          return;
      }
    }
  }
}
