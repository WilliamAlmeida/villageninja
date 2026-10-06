// Painel lateral de detalhes. Estrutura HTML só é recriada quando muda;
// valores dinâmicos (barras, números) são atualizados in-place via data-t / data-b.
import type { App } from '../app';
import { ANIMALS } from '../data/animals';
import { BUILDINGS } from '../data/buildings';
import { ROGUE_ROLES } from '../data/enemies';
import { SITES } from '../data/sites';
import { GOLD_PRICE, MINE } from '../data/expeditions';
import { ACTION_LABEL, ACTION_TIME, HOME_POS, REGION, REGION_NODES, REL, type RegionAction, type RegionNodeDef } from '../data/region';
import { CONTRACTS } from '../data/contracts';
import { SPECS, type SpecKind } from '../data/specs';
import { FESTIVAL, MOOD, SEASONS, WEATHERS } from '../data/seasons';
import { daysToNextSeason, festivalBlock, festivalOn, holdFestival, moodFactors, seasonOf } from '../game/mood';
import { learnSpec, specBlock } from '../game/specs';
import { adoptDog, DOG_COST, dogBlock, dogOf } from '../game/ninken';
import { BREED_LIST, BREEDS, breedArt, type DogBreed } from '../data/breeds';
import { artUrl } from '../render/art';
import { searchTiles } from '../game/systems/villagers';
import { TILE } from '../config';
import { doorPos, tileCenter } from '../game/world';
import { plainTokens } from '../core/tokens';
import { actionBlock, actionCost, nodeActions, nodePower, regionOf, startRegion } from '../game/region';
import regionMap from '../art/region.jpg';
import { RES_INFO, RES_KEYS } from '../data/resources';
import { activeExpeditions, chooseExpedition, expeditionUnits, floorPower, mineBlock, startMine, teamBusy, teamMinePower } from '../game/expeditions';
import { guardiansOf, missingScrolls, sitePos } from '../game/explore';
import { JUTSU_TYPE_LABEL, JUTSUS, jutsuChakra, jutsuCooldown } from '../data/jutsus';
import { NATURES } from '../data/natures';
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
import { unitPortrait } from '../render/sprites';
import missionScrollUrl from '../art/ui-scroll.png';
import { missionFocus } from '../game/missionView';
import { currentKage, electionStatus, electKage, KAGE_COST, KAGE_MIN_LEVEL } from '../game/kage';
import { KAGE_ARTS } from '../data/kageArts';
import { ORG, ORG_MEMBERS, ORG_PAIRS } from '../data/org';
import { lairGuards } from '../game/org';
import { SANNIN, SANNIN_PATHS, type SanninPath } from '../data/sannin';
import { nameSannin, sanninBlock, sanninCandidates, sanninOf, statCapOf } from '../game/sannin';
import { AUTO_CRAFT_LEVEL, buyRare, canAutoCraft, hireBlock, hireMercenary, maxLearners, MERCS, RARE_PRICE, setKeep, teachAll } from '../game/automation';
import { CARE, catchingUp, isRookie } from '../game/care';
import { marketLot, setFieldFocus, setMarketGood, trainees, trainSlots } from '../game/specialize';
import { FIELD_FOCUS_BONUS, MARKET_GOOD_LIST, MARKET_GOODS, type MarketGood } from '../data/specialize';
import { flickerCooldown, flickerStyle, isShinobi, KAWARIMI, kawarimiChance, SHUNSHIN } from '../game/techniques';
import { AWAKEN_COST, awakenKekkei, awakenOptions, canFoundClan, clanMembers, clanOf, FOUND_COST, FOUND_MIN_LEVEL, foundClan, surname } from '../game/clans';
import { KEKKEI, KEKKEI_LIST, type KekkeiId } from '../data/kekkei';
import { arenaSpots, EXAM_MIN_LEVEL, examLabel, examStatus, startExam } from '../game/exam';
import { MISSION_RANKS, MISSION_TYPE_LABEL } from '../data/missions';
import { ITEM_LIST, ITEMS, SLOT_LABEL, type ItemSlot } from '../data/items';
import { autoEquip, cancelCraft, enqueueCraft, equip, gearBonus, isWorkshop, recipesOf, stock, unequip, autoEquipAll, setAutoGear } from '../game/gear';
import { levelDef, MAX_VILLAGE_LEVEL } from '../data/villageLevels';
import {
  attackersOf, autoTeams, availableFighters, clearCommand, commandLabel, isAttackable, nearestFighters, orderAttack, createTeam, createTeamWith, disbandTeam, joinAsMember, joinAsSensei, leaveTeam, MAX_MEMBERS, orderRetreat,
  setTeamOrder, teamOf, teamUnits,
} from '../game/teams';
import type { Building, Expedition, Mission, NinjaOrder, Site, Team, Unit } from '../game/types';
import { occupantsOf } from '../game/interior';
import { isNight } from '../game/time';
import { drawInterior } from '../render/interior';
import { esc, el, sideBySide } from './dom';
import { MAX_BUILDING_LEVEL, UPGRADES } from '../data/upgrades';
import { craftMult, housingOf, levelOf, queueMax, startUpgrade, upgradeStatus, upgradeTime, workersOf } from '../game/upgrade';
import { rich } from './icons';
import { blocked, blockedClick, tipAttr } from './popup';
import { JOB_LABEL, STATE_LABEL } from './labels';

type UnitTab = 'info' | 'cmd' | 'gear';

export type View =
  | { kind: 'unit'; id: number; teach?: boolean }
  | { kind: 'village' }
  | { kind: 'kage' }
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
  roster: 'a lista de ninjas', teams: 'as equipes', team: 'a equipe', clans: 'os clãs', missions: 'as missões', region: 'a região', expeditions: 'as expedições', village: 'a vila', kage: 'o Kage', crafts: 'as oficinas',
};

interface Built {
  html: string;
  t: Record<string, string>;
  b: Record<string, number>;
}

/** Abas da janela central: cada grupo de telas de gestão. */
const WINDOW_TABS: Record<string, [View['kind'], string][]> = {
  ninjas: [['roster', '{ninja} Ninjas'], ['teams', '{users} Equipes'], ['clans', '{castle} Clãs']],
  village: [['village', '{castle} Vila'], ['kage', '{crown} Kage'], ['stats', '{trophy} Estatísticas']],
  world: [['region', '{map} Região'], ['expeditions', '{pickaxe} Expedições']],
};
const GROUP_TITLE: Record<string, string> = { ninjas: '{ninja} Ninjas', village: '{castle} Vila', world: '{map} Mundo' };
const TAB_GROUP: Partial<Record<View['kind'], string>> = { roster: 'ninjas', teams: 'ninjas', clans: 'ninjas', team: 'ninjas', village: 'village', kage: 'village', stats: 'village', expeditions: 'world', region: 'world' };

type BuildingTab = 'main' | 'inside';

/** Recurso que cada prédio de coleta procura. */
const GATHER_NODE: Partial<Record<Building['type'], 'tree' | 'rock' | 'ore'>> = { lumber: 'tree', quarry: 'rock', ironmine: 'ore' };

/** O que cada ação da região faz (dica dos botões). */
const ACTION_TIP: Record<RegionAction, string> = {
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
const RANK_BADGE_ICON: Record<string, string> = { genin: '{leaf}', chunin: '{medal}', jounin: '{star}', sannin: '{scroll}', kage: '{crown}' };
const MISSION_TYPE_ICON: Record<Mission['type'], string> = { herbs: '{leaf}', hunt: '{beast}', escort: '{cart}', camp: '{flag}', wanted: '{target}' };
const RISK_LABEL: Record<MissionRisk, [string, string]> = {
  safe: ['Seguro', '{shield}'], good: ['Favorável', '{shield}'], risky: ['Arriscado', '{alert}'], danger: ['Perigoso', '{skull}'],
};
type RosterFilter = 'all' | 'free' | 'team' | 'mission' | 'hurt' | 'genin' | 'chunin' | 'jounin' | 'sannin' | 'kage';
/** Filtros de graduação: aparecem sempre, mesmo vazios (dá para ver que existe Sannin e Kage). */
const RANK_FILTERS: RosterFilter[] = ['genin', 'chunin', 'jounin', 'sannin', 'kage'];
type RosterSort = 'level' | 'rank' | 'power' | 'hp' | 'name';
const ROSTER_SORTS: [RosterSort, string, string][] = [
  ['level', 'Nível', 'Maior nível primeiro'],
  ['rank', 'Patente', 'Kage, Jounin, Chunin e Genin (empate: nível)'],
  ['power', 'Atributos', 'Soma dos atributos, do mais forte ao mais fraco'],
  ['hp', 'Vida', 'Mais feridos primeiro'],
  ['name', 'Nome', 'Ordem alfabética'],
];
const statSum = (u: Unit) => Object.values(u.ninja!.stats).reduce((a, b) => a + b, 0);

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
  private armedDemolish = 0;
  /** Aba do painel do ninja (mantida ao trocar de ninja). */
  private unitTab: UnitTab = 'info';
  /** Lista de ninjas: filtro e ordem escolhidos (mantidos enquanto o jogo está aberto). */
  private rosterFilter: RosterFilter = 'all';
  private rosterSort: RosterSort = 'level';
  /** Quadro de missões: aba e missão com a lista de equipes aberta ("Trocar equipe"). */
  private missionTab: MissionTab = 'offered';
  private missionPick: number | null = null;
  /** Raça escolhida para a próxima adoção de ninken. */
  private dogBreed: DogBreed = 'shiba';
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
    this.root.addEventListener('pointerdown', (e) => e.stopPropagation());
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
    else if (this.view.kind === 'stats') built = this.statsView();
    else if (this.view.kind === 'missions') built = this.missionsView();
    else if (this.view.kind === 'expeditions') built = this.expeditionsView();
    else if (this.view.kind === 'region') built = this.regionView();
    else if (this.view.kind === 'crafts') built = this.craftsView();
    else if (this.view.kind === 'team') {
      const tm = g.team(this.view.id);
      if (tm) built = this.teamView(tm);
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
    if (built.html !== this.lastHtml) {
      this.body.innerHTML = rich(built.html);
      this.lastHtml = built.html;
      this.frame(this.lastTime); // o canvas do interior é recriado junto: redesenha já
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
      html += `<div class="ph"><div class="title">${title}</div><div class="badges">
        <span class="badge ${u.faction === 'enemy' ? 'enemy' : 'rank'}">${u.faction === 'enemy' ? `${u.role ? ROGUE_ROLES[u.role].name : 'Renegado'} · ` : ''}${RANKS[n.rank].name}</span>
        <span class="badge nat" style="--c:${nat.color}">${nat.kanji} ${nat.name}</span>${this.lineageBadges(u)}</div></div>`;
      html += `<div class="sub">Nível ${n.level} · <span data-t="state"></span></div>`;
      // vida, chakra e XP lado a lado (economiza altura no painel)
      const vit = (k: string, label: string, tip: string) =>
        `<div ${tipAttr(label, tip, true)}><small>${label}</small><div class="bar ${k}"><i data-b="${k}"></i><span data-t="${k}"></span></div></div>`;
      html += `<div class="vit">${vit('hp', 'Vida', 'Chega a zero e o ninja cai. Recupera descansando em casa ou no hospital.')}${vit(
        'ck', 'Chakra', 'Gasto pelos jutsus. Recupera sozinho com o tempo (Stamina e Inteligência aceleram).',
      )}${isOwn ? vit('xp', 'XP', 'Experiência de lutas, treinos e missões. Ao encher, sobe de nível e ganha atributos.') : ''}</div>`;
      t.hp = `${Math.ceil(u.hp)}/${u.maxHp}`;
      t.ck = `${Math.floor(u.chakra)}/${u.maxChakra}`;
      b.ck = u.chakra / Math.max(1, u.maxChakra);
      if (u.role) html += `<div class="warnbox">${ROGUE_ROLES[u.role].icon} ${esc(ROGUE_ROLES[u.role].desc)}${u.cloak ? ' <b>Ainda invisível.</b>' : ''}</div>`;
      if (!isOwn && isAttackable(u)) html += this.attackSection(u, t);
      if (isOwn) {
        t.xp = `${Math.floor(n.xp)}/${xpToNext(n.level)}`;
        b.xp = n.xp / xpToNext(n.level);
        // abas: o painel do ninja mostra um assunto por vez em vez de uma lista comprida
        html += `<div class="seg subtabs">`;
        for (const [k, label] of [['info', '{scroll} Ficha'], ['cmd', '{pin} Ordens'], ['gear', '{shield} Equipar']] as [UnitTab, string][])
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
        html += `<div class="slot" style="--c:${d.color}"><i class="cd" data-b="cd${i}"></i><div class="jn">${esc(d.name)}</div>
          <div class="jm">Rank ${JUTSU_RANK_LABEL[d.rank]} · ${JUTSU_TYPE_LABEL[d.type]} · ${jutsuChakra(d, n.stats)} chakra · ${cd.toFixed(1)}s</div></div>`;
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
    let html = `<div class="lvlcard"><div class="lvlname">{pickaxe} ${MINE.floors} andares</div><div class="hint">Força recomendada: andar 1 {swords}${floorPower(1)} · andar 3 {swords}${floorPower(3)} · andar 5 {swords}${floorPower(5)}.
      Os andares fundos têm ${RES_INFO.crystal.icon} cristal, ${RES_INFO.gold.icon} ouro e ${RES_INFO.darksteel.icon} aço negro.</div></div>`;
    html += `<p class="hint">Cada andar é uma <b>caverna jogável</b>: a equipe entra (aparece "Ver invasão" no alto), luta com os bichos, abre os baús e procura a descida. Vencendo um andar, você decide: descer mais (mais risco e minérios melhores) ou voltar. No fundo há um guardião. O saque só chega se voltarem.</p>`;
    const here = activeExpeditions(g).filter((e) => e.siteId === site.id);
    if (here.length)
      html += `<p class="hint">{run} Na mina agora: ${here.map((e) => esc(g.team(e.teamId)?.name ?? '?')).join(', ')} <button class="btn mini" data-act="win" data-arg="expeditions">Acompanhar</button></p>`;
    html += `<h4>Mandar equipe</h4>`;
    if (!g.state.teams.length) return html + `<p class="why">Forme uma equipe em {ninja} Ninjas → Equipes.</p>`;
    html += `<div class="btnrow">`;
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
      if (def.kind === 'hideout' && !s.org.lairKnown) continue; // o covil só aparece quando descoberto
      const st = regionOf(s, def.id);
      const icon = def.kind === 'village' ? '{houses}' : def.kind === 'island' ? '{ship}' : def.kind === 'hideout' ? '{skull}' : '{scroll}';
      const flags = st.outpost ? ' {flag}' : '';
      const dots = (busyAt.get(def.id) ?? []).map((c) => `<i class="tdot" style="--c:${c}"></i>`).join('');
      html += `<button class="rnode k-${def.kind} s-${st.status} ${this.regionNode === def.id ? 'on' : ''}" data-act="r-node" data-arg="${def.id}" style="left:${def.x}%;top:${def.y}%">${icon}<span>${def.name}${flags}</span>${dots}</button>`;
    }
    html += `</div><div class="rside">`;
    html += `<div class="fame" ${tipAttr('Fama da vila', 'Honra (proteger, comerciar, anexar em paz): trocas melhores e ninjas errantes pedindo para entrar. Infâmia (saquear, dominar à força): saques maiores, mas vinganças e caçadores de recompensa.', true)}>
      <span class="hon">{star} Honra <b>${s.honor}</b></span><span class="inf">{skull} Infâmia <b>${s.infamy}</b></span></div>`;
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
    return { html, t: {}, b: {} };
  }

  /** Detalhe de um lugar da região: situação, escolha da equipe e ações. */
  private regionNodeSection(def: RegionNodeDef) {
    const g = this.app.game;
    const s = g.state;
    const st = regionOf(s, def.id);
    const kindLabel = { village: 'Vilarejo', island: 'Ilha', sacred: 'Lugar sagrado', hideout: 'Covil' }[def.kind];
    const statusLabel = { neutral: 'Neutro', protected: 'Protegido', vassal: 'Vassalo', hostile: 'Hostil' }[st.status];
    let html = `<div class="ph"><div class="title">${def.name}</div><div class="badges"><span class="badge">${kindLabel}</span>${
      def.kind === 'village' ? `<span class="badge st-${st.status}">${statusLabel}</span>` : ''
    }</div></div><p class="hint">${esc(def.desc)}</p>`;
    if (def.kind === 'village') {
      const pct = (st.rel + 100) / 2;
      html += `<div class="relbar" ${tipAttr('Relação', `De -100 (inimigos) a 100 (aliados). Protegido a partir de ${REL.protected}; anexar em paz com ${REL.annexPeace}+ ou à força com ${REL.annexForce} ou menos.`)}><i style="left:calc(${pct}% - 1px)"></i><span>Relação ${st.rel}</span></div>`;
      if (def.tribute) html += `<p class="hint">Tributo por dia: ${costLabel(def.tribute)} (protegido) · dobro como vassalo.</p>`;
    } else if (def.kind === 'island') {
      html += `<p class="hint">${st.explored ? '{check} Explorada' : '{todo} Ainda não explorada'} · ${st.outpost ? `{flag} Posto avançado: ${costLabel(def.outpost ?? {})}/dia` : `Posto avançado renderia ${costLabel(def.outpost ?? {})} por dia`}</p>`;
    } else if (def.kind === 'hideout') {
      html += `<p class="hint">${s.org.done ? '{check} A Ordem foi destruída.' : `Guardam o covil: ${lairGuards(s).map((id) => `<b>${ORG_MEMBERS[id].name}</b>, ${esc(ORG_MEMBERS[id].title)}`).join(' e ')}.`}</p>`;
    } else if (def.contract) {
      const c = CONTRACTS[def.contract];
      const owners = s.units.filter((u) => !u.dead && u.ninja?.contract === def.contract).map((u) => esc(u.name.split(' ').pop()!));
      html += `<p class="hint">{scroll} ${c.name}: ${esc(c.desc)}${owners.length ? ` Contratados: ${owners.join(', ')}.` : ''}</p>`;
    }
    html += `<p class="hint">Defesas {swords}${nodePower(s, def)}</p>`;
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
      html += `<p class="hint">{todo} ${next}</p>`;
    }
    // equipe que vai
    const teams = s.teams.filter((tm) => teamUnits(g, tm).length);
    if (!teams.length) return html + `<p class="why">Forme uma equipe em {ninja} Ninjas → Equipes.</p>`;
    if (this.regionTeam == null || !teams.some((tm) => tm.id === this.regionTeam)) this.regionTeam = teams[0]!.id;
    html += `<h4>Equipe</h4><div class="chips rteams">`;
    for (const tm of teams)
      html += `<button data-act="r-team" data-arg="${tm.id}" class="${this.regionTeam === tm.id ? 'on' : ''}" style="--c:${tm.color}"><span class="dot"></span>${esc(tm.name)} {swords}${teamMinePower(g, tm.id)}</button>`;
    const tp = teamMinePower(g, this.regionTeam);
    const np = nodePower(s, def);
    const k = tp / Math.max(1, np);
    html += `</div><p class="${k >= 1.2 ? 'hint' : 'why'}">{swords} Sua equipe ${tp} × defesas ${np}: ${k >= 1.5 ? 'folgado' : k >= 1 ? 'equilibrado' : k >= 0.7 ? 'arriscado' : 'muito perigoso'}.</p>`;
    html += `<h4>Ações</h4><div class="ractions">`;
    const busy = teamBusy(g, this.regionTeam);
    for (const a of nodeActions(def)) {
      const why = actionBlock(g, def.id, a);
      const cost = actionCost(def, a);
      const time = ACTION_TIME[a].travel * 2 + ACTION_TIME[a].work;
      html += `<button class="btn" data-act="r-go" data-arg="${a}" ${blocked(g, [why, busy], cost)} ${tipAttr(ACTION_LABEL[a], ACTION_TIP[a])}>
        <b>${ACTION_LABEL[a]}</b><small>${a === 'raid' || a === 'explore' || a === 'contract' || a === 'assault' || (a === 'annex' && st.rel <= REL.annexForce) ? '{swords} mapa jogável' : `${cost ? `${costLabel(cost)} · ` : ''}~${time}s`}</small></button>`;
    }
    return html + `</div>`;
  }

  /** Janela Mundo → Expedições: andamento, diário e decisões de cada expedição. */
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
    for (const e of list) {
      const tm = g.team(e.teamId);
      const live = e.status !== 'done' && e.status !== 'lost';
      const total = e.status === 'going' || e.status === 'return' ? MINE.travel : MINE.floorTime;
      const mine = e.kind === 'mine';
      const where = mine ? 'Mina' : `${ACTION_LABEL[e.action!]} · ${REGION[e.node!]?.name ?? ''}`;
      const label: Record<Expedition['status'], string> = {
        going: mine ? 'a caminho da mina' : 'a caminho', explore: mine ? `explorando o andar ${e.floor}` : 'no serviço', choice: `andar ${e.floor} concluído`,
        return: 'voltando para a vila', done: 'terminou', lost: 'perdida', scene: mine ? `jogando o andar ${e.floor}` : 'invasão em andamento',
      };
      html += `<div class="mcard exp ${live ? '' : 'ended'}" style="--c:${tm?.color ?? '#888'}"><div class="mt"><span class="dot"></span>${esc(tm?.name ?? 'Equipe')} · ${esc(where)}
        <span class="badge">${label[e.status]}</span>${live && mine ? ` <span class="badge">{pickaxe} ${e.floor}/${MINE.floors}</span>` : ''}</div>`;
      if (e.status === 'going' || e.status === 'explore' || e.status === 'return') {
        html += `<div class="bar pg"><i data-b="ex${e.id}"></i><span data-t="ex${e.id}"></span></div>`;
        b[`ex${e.id}`] = 1 - Math.max(0, e.timer) / total;
        t[`ex${e.id}`] = `${Math.ceil(Math.max(0, e.timer))}s`;
      }
      if (live) {
        const us = expeditionUnits(g, e);
        html += `<div class="jm">${us.map((u) => `${esc(u.name.split(' ').pop()!)} <span data-t="exh${u.id}"></span>`).join(' · ')}</div>`;
        for (const u of us) t[`exh${u.id}`] = `${Math.round((u.hp / u.maxHp) * 100)}%`;
      }
      html += `<div class="jm">Saque: ${Object.keys(e.loot).length ? costLabel(e.loot) : '—'}</div>`;
      html += `<ul class="explog">${e.log.slice(-5).map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`;
      if (e.status === 'choice') {
        const next = e.floor + 1;
        html += `<div class="btnrow"><button class="btn primary" data-act="exp-deeper" data-arg="${e.id}">{pickaxe} Descer ao andar ${next} (recomendado {swords}${floorPower(next)})</button>
          <button class="btn" data-act="exp-back" data-arg="${e.id}">{run} Voltar com o saque</button></div>`;
      }
      html += `</div>`;
    }
    return { html, t, b };
  }


  /** Arma, colete e consumível: o atual e o que há no estoque para trocar. */
  private equipSection(u: Unit) {
    const g = this.app.game;
    const e = u.ninja!.equip;
    let html = `<h4>Equipamento</h4>`;
    for (const slot of ['weapon', 'armor', 'item'] as const) {
      const cur = e[slot] ? ITEMS[e[slot]!] : undefined;
      const status = slot === 'item' && cur ? (e.itemReady ? ' (pronto)' : ' (gasto — repõe na vila)') : '';
      html += `<div class="eqrow"><span class="eqlabel">${SLOT_LABEL[slot]}</span><span class="eqcur">${cur ? `${cur.icon} ${esc(cur.name)}${status}` : '—'}</span>`;
      if (cur) html += `<button class="btn mini" data-act="unequip" data-arg="${slot}">{x}</button>`;
      html += `</div>`;
      const opts = ITEM_LIST.filter((d) => d.slot === slot && d.id !== e[slot] && stock(g, d.id) > 0);
      if (opts.length)
        html += `<div class="btnrow eqopts">${opts.map((d) => `<button class="btn mini" data-act="equip" data-arg="${d.id}">${d.icon} ${esc(d.name)} ×${stock(g, d.id)}</button>`).join('')}</div>`;
    }
    const gb = gearBonus(u);
    if (gb.melee || gb.defense || gb.hp) html += `<p class="hint">Bônus: +${gb.melee} dano · +${gb.kunai} kunai · ${Math.round(gb.defense * 100)}% defesa · +${gb.hp} vida</p>`;
    if (!ITEM_LIST.some((d) => stock(g, d.id) > 0)) html += `<p class="hint">Estoque vazio. Fabrique na Forja, Farmácia ou Oficina de Selos.</p>`;
    else html += `<div class="btnrow"><button class="btn" data-act="autoequip">{gear} Equipar o melhor</button></div>`;
    return html;
  }

  /** Aba Ficha: ensinar jutsu, promoção e clã. */
  private ninjaCareer(u: Unit) {
    const n = u.ninja!;
    const g = this.app.game;
    let html = `<div class="actions"><button class="btn primary" data-act="teach-open">{scroll} Ensinar jutsu</button>`;
    if (catchingUp(g, u)) html += `<p class="hint">{up} Bem abaixo da média da vila: treina com <b>XP em dobro</b> até alcançar os outros.</p>`;
    if (isRookie(u) && g.state.flags.shelterRookies) html += `<p class="hint">{ninja} Novato: se abriga de inimigos fortes demais (Proteger novatos, na lista de Ninjas).</p>`;
    const next = nextRank(u);
    if (next === 'kage') {
      html += `<p class="hint">{crown} Jounin de nível ${KAGE_MIN_LEVEL}+ pode ser eleito Kage na Residência do Hokage.</p>`;
    } else if (next) {
      const r = RANKS[next];
      const villageOk = (r.minVillageLevel ?? 0) <= g.state.level;
      const why = n.level < r.minLevel ? `· nível ${r.minLevel}` : !villageOk ? `· requer ${levelDef(r.minVillageLevel!).name}` : '';
      html += `<button class="btn" data-act="promote" ${blocked(g, [n.level < r.minLevel && `Precisa chegar ao nível ${r.minLevel} (está no ${n.level}).`, !villageOk && `A vila precisa ser ${levelDef(r.minVillageLevel!).name}.`], r.promoteCost)}>{medal} Promover a ${r.name} (${costLabel(r.promoteCost)}) ${why}</button>`;
    }
    if (n.rank !== 'genin' && !clanOf(g, u)) {
      const fc = canFoundClan(g, u);
      html += `<button class="btn" data-act="found-clan" ${blocked(g, [!fc.ok && fc.error !== 'Recursos insuficientes.' && fc.error], FOUND_COST)}>{castle} Fundar clã ${esc(surname(u))} (${costLabel(FOUND_COST)})${fc.ok ? '' : ` · ${esc(fc.error)}`}</button>`;
    }
    html += `</div>`;
    // profissão (prédio próprio, Chunin+) e contrato de invocação (lugares sagrados da região)
    html += `<h4>{medal} Profissão</h4>`;
    if (n.spec) html += `<p class="hint"><b>${SPECS[n.spec].name}:</b> ${esc(SPECS[n.spec].desc)}</p>`;
    else {
      html += `<div class="btnrow">`;
      for (const k of Object.keys(SPECS) as SpecKind[])
        html += `<button class="btn mini" data-act="spec" data-arg="${k}" ${blocked(g, [specBlock(g, u, k)], SPECS[k].cost)} ${tipAttr(SPECS[k].name, `${SPECS[k].desc} Custo: ${plainTokens(costLabel(SPECS[k].cost))}.`)}>${SPECS[k].icon} ${SPECS[k].name}</button>`;
      html += `</div>`;
    }
    html += n.contract
      ? `<p class="hint">{scroll} <b>Contrato: ${CONTRACTS[n.contract].name}.</b> ${esc(CONTRACTS[n.contract].desc)} (${CONTRACTS[n.contract].chakra} chakra, a cada ${CONTRACTS[n.contract].cd}s)</p>`
      : `<p class="hint">{scroll} Sem contrato de invocação. Os lugares sagrados (janela Mundo → Região) dão contratos.</p>`;
    // ninken (cão ninja do Canil)
    const dog = dogOf(g, u);
    html += dog
      ? `<p class="hint">{paw} <b>${esc(dog.name)}</b> acompanha ${esc(u.name.split(' ').pop()!)} · vida ${Math.ceil(dog.hp)}/${dog.maxHp}</p>`
      : `<div class="btnrow"><button class="btn mini" data-act="dog" ${blocked(g, [dogBlock(g, u)], DOG_COST)} ${tipAttr('Ninken', 'Cão ninja que acompanha o ninja, luta junto, fareja espiões invisíveis e, fora da vila, acha ervas. A raça se escolhe no Canil.')}>{paw} Adotar ninken: ${esc(BREEDS[this.dogBreed].name)} (${costLabel(DOG_COST)})</button></div>`;
    html += `<p class="hint">Abates: ${n.kills}</p>`;
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
    for (const o of jutsuOptions(u, g.state.scrolls)) {
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
    let html = `<div class="ph"><div class="title">${d.icon} ${d.name}</div></div><p class="hint">${d.desc}</p>`;
    // aba "Lá dentro" para prédios com interior (moradia ou alguém dentro agora)
    const inside = d.walkable ? [] : occupantsOf(g, bd);
    const hasInside = bd.built && !d.walkable && (inside.length > 0 || !!d.housing);
    if (hasInside) {
      html += `<div class="seg subtabs"><button data-act="btab" data-arg="main" class="${this.buildingTab === 'main' ? 'on' : ''}">{scroll} Geral</button>
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
      html += `<h4>Em construção</h4><div class="bar pg"><i data-b="prog"></i><span data-t="prog"></span></div>`;
      html += `<p class="hint">Moradores sem emprego vão até a obra para construir.</p>`;
      b.prog = Math.min(1, bd.progress / d.buildTime);
      t.prog = `${Math.floor(b.prog * 100)}%`;
    } else {
      html += this.upgradeSection(bd, t, b);
      if (bd.type === 'hokage') html += this.villageSummary();
      if (bd.type === 'missions') html += this.missionsSummary() + this.hireSection();
      if (isWorkshop(bd.type)) html += this.workshopSection(bd, t, b);
      if (bd.type === 'arena') html += this.arenaSection(b);
      if (bd.type === 'sealshop') html += `<p class="hint">Sem pedidos, o artesão faz 1{paper} com 4{wood} a cada 8 s (se houver 30{wood} ou mais).</p>`;
      if (d.workers) {
        html += `<h4>Trabalhadores</h4><div class="workers"><button class="btn" data-act="workers" data-arg="-1">{minus}</button>
          <span class="wnum"><b data-t="workers"></b><small>trabalhando agora · você pediu <b data-t="wdesired"></b> (máx. ${workersOf(bd)})</small></span>
          <button class="btn" data-act="workers" data-arg="1">{plus}</button></div>`;
        t.workers = String(bd.workers.length);
        t.wdesired = String(bd.desired);
        if (bd.workers.length < bd.desired) {
          const idle = g.villagers().filter((u) => u.jobId == null).length;
          html += `<p class="why">${idle ? 'Os moradores livres estão a caminho.' : 'Faltam moradores livres: todos já trabalham. Construa casas para a vila crescer ou tire gente de outro prédio.'}</p>`;
        }
        html += this.gatherInfo(bd);
      }
      if (d.housing) {
        const residents = g.villagers().filter((u) => u.homeId === bd.id).length;
        html += `<h4>Moradia</h4><p class="hint"><span data-t="res"></span> moradores</p>`;
        t.res = `${residents} / ${housingOf(bd)}`;
      }
      if (bd.type === 'kennel') html += this.kennelSection();
      if (bd.type === 'hospital' && bd.built) {
        const base = Math.round(Math.min(CARE.rescueMax, CARE.rescue + (levelOf(bd) - 1) * CARE.rescuePerLevel) * 100);
        html += `<p class="hint">{medic} <b>Resgate:</b> ninja da vila que cair tem ${base}% de chance de ser trazido para cá gravemente ferido, em vez de morrer (+${Math.round(CARE.rescueMedic * 100)}% com um ninja médico por perto, até ${Math.round(CARE.rescueMax * 100)}%). Cada nível do Hospital aumenta a chance.</p>`;
      }
      if (bd.type === 'market') {
        html += this.marketSection(bd) + this.rareSection();
        html += `<h4>{gold} Ouro</h4><p class="hint">O mercado compra o ouro das minas por ${GOLD_PRICE}{ryo} cada. Você tem ${Math.floor(g.state.res.gold)}{gold}.</p>`;
        html += `<div class="btnrow"><button class="btn" data-act="sell-gold" data-arg="1" ${blocked(g, [g.state.res.gold < 1 && 'Sem ouro. Ele vem das partes fundas das minas.'])}>Vender 1 (+${GOLD_PRICE}{ryo})</button>
          <button class="btn" data-act="sell-gold" data-arg="all" ${blocked(g, [g.state.res.gold < 1 && 'Sem ouro. Ele vem das partes fundas das minas.'])}>Vender tudo</button></div>`;
      }
      if (bd.type === 'academy') {
        const villagers = g.state.units.filter((u) => !u.dead && u.kind === 'villager').length;
        html += `<h4>Recrutamento</h4><p class="hint">Transforma um morador em Genin. Alguns já nascem com jutsu, outros precisam estudar aqui.</p>`;
        html += `<div class="actions"><button class="btn primary" data-act="recruit" ${blocked(g, [villagers <= 1 && 'Precisa sobrar pelo menos um morador na vila.'], RECRUIT_COST)}>{ninja} Recrutar ninja (${costLabel(RECRUIT_COST)})</button></div>`;
        html += this.teachBar();
        html += `<p class="hint">Para escolher o jutsu de alguém: selecione o ninja → "Ensinar jutsu".</p>`;
      }
      if (bd.type === 'training') html += this.fieldSection(bd, t);
      if (d.healRate) html += `<p class="hint">Cura ${d.healRate} HP/s de quem descansa aqui.</p>`;
    }
    html += `<div class="actions"><button class="btn" data-act="move">{refresh} Mover de lugar (grátis)</button>`;
    if (bd.type !== 'hokage')
      html += `<button class="btn danger" data-act="demolish">${this.armedDemolish ? 'Toque de novo para confirmar' : `{trash} Demolir (devolve ${bd.built ? '50%' : '100%'})`}</button>`;
    html += `</div>`;
    return { html, t, b };
  }

  /** Campo de Treino: vagas e foco. */
  private fieldSection(bd: Building, t: Record<string, string>) {
    const g = this.app.game;
    t.slots = `${trainees(g, bd)} / ${trainSlots(bd)}`;
    let html = `<p class="hint">Ninjas no modo Auto/Treinar vêm aqui de dia e ganham atributos e XP. Cada ninja vai ao campo com vaga mais perto, preferindo o do seu foco.</p>`;
    html += `<p class="hint">{users} Vagas: <b data-t="slots"></b> treinando agora${levelOf(bd) < 3 ? ' (o upgrade abre mais vagas)' : ''}.</p>`;
    html += `<h4>Foco do campo</h4><div class="chips">`;
    html += `<button data-act="field-focus" data-arg="" class="${bd.focus ? '' : 'on'}" ${tipAttr('Livre', 'Sem especialidade: cada ninja treina o próprio foco (ou o que o sensei/acaso escolher).')}>Livre</button>`;
    for (const k of STAT_KEYS)
      html += `<button data-act="field-focus" data-arg="${k}" class="${bd.focus === k ? 'on' : ''}" ${tipAttr(STAT_INFO[k].label, `Treino de ${STAT_INFO[k].label} rende +${Math.round((FIELD_FOCUS_BONUS - 1) * 100)}% aqui. Ninjas sem foco próprio treinam isto; quem tem esse foco prefere este campo.`)}>${STAT_INFO[k].label}</button>`;
    html += `</div><p class="hint">${
      bd.focus
        ? `<b>${STAT_INFO[bd.focus].label}:</b> +${Math.round((FIELD_FOCUS_BONUS - 1) * 100)}% neste atributo. Ninjas sem foco próprio treinam ${STAT_INFO[bd.focus].label} aqui.`
        : 'Dica: com vários campos, dê um foco diferente a cada um (ex.: um de Taijutsu, outro de Ninjutsu).'
    }</p>`;
    return html;
  }

  /** Mercado: o que vende do excedente. */
  private marketSection(bd: Building) {
    let html = `<h4>{ryo} Vende o excedente</h4><div class="chips">`;
    html += `<button data-act="market-good" data-arg="" class="${bd.sells ? '' : 'on'}" ${tipAttr('Nada', 'Só o ryo de sempre do comerciante.')}>Nada</button>`;
    for (const k of MARKET_GOOD_LIST) {
      const d = MARKET_GOODS[k];
      html += `<button data-act="market-good" data-arg="${k}" class="${bd.sells === k ? 'on' : ''}" ${tipAttr(d.name, `Vende ${d.name.toLowerCase()} acima de ${d.keep} no estoque, a ${d.price} ryo cada.`)}>${RES_INFO[k].icon} ${d.name}</button>`;
    }
    html += `</div>`;
    const m = marketLot(bd);
    html += m
      ? `<p class="hint">A cada venda (8 s) leva até ${m.lot} ${RES_INFO[bd.sells!].icon} por +${m.ryo}{ryo}, sempre deixando ${m.keep} no estoque. Dois mercados podem escoar coisas diferentes.</p>`
      : `<p class="hint">Escolha uma mercadoria para o comerciante vender o que sobrar no estoque (madeira, pedra, comida ou ervas).</p>`;
    return html;
  }

  /** Ensino de jutsus: todos de uma vez agora e o modo automático. */
  private teachBar() {
    const g = this.app.game;
    const free = g.state.units.filter((u) => !u.dead && u.kind === 'ninja' && u.faction === 'village' && u.ninja && !u.ninja.learning && u.ninja.jutsu.includes(null)).length;
    const on = !!g.state.flags.autoTeach;
    return `<div class="btnrow gearbar"><button class="btn" data-act="teach-all" ${blocked(g, [!g.findBuilt('academy') && 'Construa a Academia Ninja.', !free && 'Ninguém com espaço livre para jutsu.'])} ${tipAttr(
      'Ensinar todos agora',
      'Cada ninja com espaço livre vai estudar o melhor jutsu que pode aprender (pela natureza, rank e atributos dele). Paga o ryo de cada jutsu.',
    )}>{scroll} Ensinar todos (${free})</button>
      <button class="btn ${on ? 'primary' : ''}" data-act="auto-teach" ${tipAttr(
        'Ensino automático',
        `Ligado: a Academia manda sozinha quem tiver espaço livre estudar (até ${maxLearners(g)} ao mesmo tempo, para não esvaziar a defesa). Jutsus proibidos ficam de fora.`,
      )}>{refresh} Ensino automático: ${on ? 'ligado' : 'desligado'}</button></div>`;
  }

  /** Mesa de Missões: contratar ninjas mercenários (destino para o ryo). */
  private hireSection() {
    const g = this.app.game;
    let html = `<h4>{ninja} Contratar mercenário</h4><p class="hint">Ninjas errantes servem a vila por ryo. Chegam prontos, mas ocupam uma vaga de casa.</p><div class="btnrow">`;
    for (const r of ['chunin', 'jounin'] as const) {
      const m = MERCS[r];
      const why = hireBlock(g, r);
      html += `<button class="btn primary" data-act="hire" data-arg="${r}" ${blocked(g, [why && !why.startsWith('Custa') && why], m.cost)}>${RANKS[r].name} nível ${m.level} · ${costLabel(m.cost)}</button>`;
    }
    return html + `</div>`;
  }

  /** Mercado: materiais raros (antes só das minas) para os itens lendários. */
  private rareSection() {
    const g = this.app.game;
    let html = `<h4>{crystal} Materiais raros</h4><p class="hint">Mercadores de longe trazem cristal de chakra e aço negro, usados nos itens lendários da Forja e da Farmácia.</p><div class="btnrow">`;
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
    let html = `<div class="ph"><div class="title">{anvil} Oficinas</div></div>`;
    html += `<p class="hint">De ${ninjas.length} ninjas: <b>${lack('weapon')}</b> sem arma · <b>${lack('armor')}</b> sem colete · <b>${lack('item')}</b> sem consumível.</p>`;
    html += this.gearBar() + `<div class="craftgrid">`;
    for (const type of ['forge', 'pharmacy', 'sealshop'] as const) html += this.craftCard(type, t, b);
    return { html: html + `</div>`, t, b };
  }

  private craftCard(type: 'forge' | 'pharmacy' | 'sealshop', t: Record<string, string>, b: Record<string, number>) {
    const g = this.app.game;
    const d = BUILDINGS[type];
    const bd = g.state.buildings.find((x) => x.type === type);
    let html = `<div class="wscard"><div class="wshead"><span class="wsname">${d.icon} ${esc(d.name)}</span>${bd ? `<span class="badge">Nv ${levelOf(bd)}</span>` : ''}</div>`;
    if (!bd) return html + `<p class="why">Ainda não construída. Abra Construir (B) para erguer: ${esc(d.name)}.</p></div>`;
    if (!bd.built) return html + `<p class="hint">{hammer} Em obra…</p></div>`;
    html += bd.workers.length
      ? `<p class="hint">{hammer} Artesão trabalhando</p>`
      : `<p class="why">Sem artesão: nada é fabricado. <button class="btn mini" data-act="ws-worker" data-arg="${bd.id}">{plus} Chamar artesão</button></p>`;
    const q = bd.queue ?? [];
    const used = q.length + (bd.craft ? 1 : 0);
    const max = queueMax(bd);
    if (bd.craft) {
      const it = ITEMS[bd.craft.itemId]!;
      const k = `cr${bd.id}`;
      b[k] = bd.craft.progress / it.craftTime;
      t[k] = `${it.name} ${Math.floor(b[k] * 100)}%`;
      html += `<div class="bar pg"><i data-b="${k}"></i><span data-t="${k}"></span></div>`;
    } else html += `<p class="hint">Nada em produção.</p>`;
    html += `<div class="wsqueue"><span class="hint">Fila ${used}/${max}</span> ${q.map((id) => `<span class="qi">${ITEMS[id]!.icon}</span>`).join('')}${
      used ? ` <button class="btn mini" data-act="ws-cancel" data-arg="${bd.id}" ${tipAttr('Cancelar o último', 'Devolve os recursos do último pedido.')}>{x}</button>` : ''
    }</div>`;
    const auto = canAutoCraft(bd);
    for (const r of recipesOf(type)) {
      const locked = (r.minLevel ?? 0) > g.state.level;
      const keep = bd.keep?.[r.id] ?? 0;
      const time = Math.round(r.craftTime / craftMult(bd));
      html += `<div class="wsrow ${locked ? 'locked' : ''}"><div class="wsr-top"><span class="wsr-name" ${tipAttr(r.name, `${r.desc} (${SLOT_LABEL[r.slot]})`)}>${r.icon} ${esc(r.name)}</span><span class="badge">${stock(g, r.id)} no estoque</span></div>
        <div class="wsr-cost">${costLabel(r.cost)} · ${time}s</div>`;
      if (locked) html += `<div class="why">{lock} Requer ${levelDef(r.minLevel!).name}</div>`;
      else {
        const full = used >= max && `A fila está cheia (máximo ${max}).`;
        html += `<div class="btnrow"><button class="btn mini primary" data-act="ws-craft" data-arg="${bd.id}:${r.id}:1" ${blocked(g, [full], r.cost)}>+1</button><button class="btn mini" data-act="ws-craft" data-arg="${bd.id}:${r.id}:5" ${blocked(g, [full], r.cost)}>+5</button></div>`;
        if (auto)
          html += `<div class="chips wsr-keep"><span class="hint">Manter</span>${[0, 3, 5, 10, 20]
            .map((n) => `<button data-act="ws-keep" data-arg="${bd.id}:${r.id}:${n}" class="${keep === n ? 'on' : ''}">${n || 'não'}</button>`)
            .join('')}</div>`;
      }
      html += `</div>`;
    }
    const lvl = levelOf(bd);
    if (bd.upgrade != null) html += `<p class="hint">{up} Upgrade em obra…</p>`;
    else if (lvl < 3) {
      const st = upgradeStatus(g, bd);
      html += `<div class="wsauto"><p class="hint">${
        auto ? `{up} Nível ${lvl + 1}: ${esc(UPGRADES[type]!.perks[lvl]!)}` : `{refresh} No nível ${AUTO_CRAFT_LEVEL} ela fabrica sozinha para manter o estoque.`
      }</p><button class="btn primary big" data-act="ws-upgrade" data-arg="${bd.id}" ${blocked(g, [st.reason !== 'Recursos insuficientes.' && st.reason], st.cost ?? undefined)}><span>{up} Nível ${lvl + 1}</span><span class="cost">${costLabel(st.cost ?? {})}</span></button></div>`;
    }
    return html + `</div>`;
  }

  /** Proteger novatos: Genins se abrigam de inimigos fortes demais (com veteranos em casa para defender). */
  /** Equipar todos com o estoque agora, e o modo automático (passa sozinho o que for sendo fabricado). */
  private gearBar(compact = false) {
    const on = !!this.app.game.state.flags.autoGear;
    // compacto (painel lateral da oficina): dois botões iguais lado a lado, rótulo curto para não quebrar a linha
    const auto = compact ? `Auto: ${on ? 'ligado' : 'desligado'}` : `Automático: ${on ? 'ligado' : 'desligado'}`;
    return `<div class="btnrow gearbar ${compact ? 'workshop-bar' : ''}"><button class="btn" data-act="gear-all" ${tipAttr('Equipar todos', 'Passa o melhor do estoque para cada ninja; os mais fortes escolhem primeiro.')}>{gear} Equipar todos</button>
      <button class="btn ${on ? 'primary' : ''}" data-act="gear-auto" ${tipAttr('Automático', 'Ligado: a cada poucos segundos o que for fabricado vai sozinho para quem precisa.')}>{refresh} ${auto}</button></div>`;
  }

  /** Escolha da raça do próximo ninken (vale para o Canil e para o botão na ficha do ninja). */
  private breedPicker() {
    // cartão com o cão parado de frente (quadro do meio da linha 2 da folha 4×3)
    let html = `<div class="breeds">`;
    for (const k of BREED_LIST) {
      const d = BREEDS[k];
      const url = artUrl(breedArt(k));
      const pic = url ? `<span class="pic" style="background-image:url('${url}')"></span>` : `<span class="pic none">{paw}</span>`;
      html += `<button data-act="dog-breed" data-arg="${k}" class="breed ${this.dogBreed === k ? 'on' : ''}" ${tipAttr(d.name, d.desc)}>${pic}<span class="n">${esc(d.name)}</span></button>`;
    }
    return html + `</div><p class="hint"><b>${esc(BREEDS[this.dogBreed].name)}:</b> ${esc(BREEDS[this.dogBreed].desc)}</p>`;
  }

  /** Canil: cada ninja pode ter um ninken; lista quem tem e quem pode adotar. */
  private kennelSection() {
    const g = this.app.game;
    const ninjas = g.state.units.filter((u) => !u.dead && u.kind === 'ninja' && u.faction === 'village');
    let html = `<h4>{paw} Ninken</h4><p class="hint">O cão acompanha o dono, luta junto, fareja espiões invisíveis por perto e, fora da vila, acha ervas. Custa ${costLabel(DOG_COST)}.</p>`;
    html += this.breedPicker();
    if (!ninjas.length) return html + `<p class="why">Nenhum ninja na vila.</p>`;
    html += `<div class="roster">`;
    for (const u of ninjas) {
      const dog = dogOf(g, u);
      html += `<div class="cand"><span class="rn">${esc(u.name)}</span><span class="badges"><span class="badge rank">${RANKS[u.ninja!.rank].name}</span></span><span class="btnrow">${
        dog
          ? `<span class="badge">{paw} ${esc(dog.name)}</span>`
          : `<button class="btn mini primary" data-act="dog-for" data-arg="${u.id}" ${blocked(g, [dogBlock(g, u)], DOG_COST)}>{paw} Adotar</button>`
      }</span></div>`;
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
    let html = `<p class="hint">{eye} Alcance: ${r} tiles ao redor (círculo tracejado no mapa)${levelOf(bd) < 3 && UPGRADES[bd.type] ? ', maior a cada nível' : ''}. <b>${ready}</b> ${word} prontas${
      growing ? ` · ${growing} crescendo de volta` : ''
    }.</p>`;
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
    html += `<div class="roster">`;
    for (const u of inside) {
      if (u.ninja) html += this.ninjaRow(u, t, b);
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
      <h4>Selecionados</h4><div class="roster">`;
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
    return this.winTop(GROUP_TITLE[group] ?? '', this.groupChips(group), right, tabs.map(([k, label]) => [k, label, active === k, 'tab']));
  }

  /** Cabeçalho + abas (usado pelas janelas com grupo e pelo quadro de missões). */
  private winTop(title: string, chips: string, right: string, tabs: [string, string, boolean, string][]) {
    return `<div class="wtop"><div class="mhead"><div class="mh-title">${title}</div>${chips}${right ? `<span class="mh-right">${right}</span>` : ''}</div>
      <div class="mtabs">${tabs.map(([k, label, on, act]) => `<button data-act="${act}" data-arg="${k}" class="${on ? 'on' : ''}">${label}</button>`).join('')}</div></div>`;
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
      return chip('{star}', `Nível ${s.level + 1}`, 'gold') + chip('{users}', `População ${g.population()}/${g.popCap()}`) + chip('{smile}', `Felicidade ${Math.round(s.happiness)}`) + chip('{sun}', `Dia ${s.day}`);
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
    let html = `<div class="lvlcard upg"><div class="lvlname">{star} Nível ${lvl} de ${MAX_BUILDING_LEVEL}</div><div class="hint">${esc(def.perks[lvl - 1]!)}</div>`;
    if (bd.upgrade != null) {
      html += `<div class="bar pg"><i data-b="upg"></i><span data-t="upg"></span></div><div class="hint">Moradores sem emprego estão fazendo a obra; o prédio continua funcionando.</div></div>`;
      b.upg = Math.min(1, bd.upgrade / upgradeTime(bd));
      t.upg = `Obra do nível ${lvl + 1}: ${Math.floor(b.upg * 100)}%`;
      return html;
    }
    if (lvl >= MAX_BUILDING_LEVEL) return html + `</div>`;
    const st = upgradeStatus(g, bd);
    html += `<div class="actions"><button class="btn primary big" data-act="upgrade-building" ${blocked(g, [st.reason !== 'Recursos insuficientes.' && st.reason], st.cost ?? undefined)}>
      <span>{up} Nível ${lvl + 1}: ${esc(def.perks[lvl]!)}</span><span class="cost">${costLabel(st.cost ?? {})}</span></button></div>`;
    if (st.reason && st.reason !== 'Recursos insuficientes.') html += `<p class="why">${esc(st.reason)}</p>`;
    return html + `</div>`;
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
    return { html: this.tabs('village') + this.villageSection(), t: {}, b: {} };
  }

  private missionsView(): Built {
    const t: Record<string, string> = {};
    const b: Record<string, number> = {};
    if (!this.app.game.findBuilt('missions'))
      return { html: `<div class="ph"><div class="title">{clipboard} Quadro de missões</div></div><div class="warnbox">Construa a {clipboard} Mesa de Missões (menu Construir) para receber pedidos.</div>`, t, b };
    return { html: this.missionsSection(t, b), t, b };
  }

  /** Números da vila. */
  private statsView(): Built {
    const g = this.app.game;
    const s = g.state;
    const ninjas = s.units.filter((u) => !u.dead && u.kind === 'ninja' && u.faction === 'village');
    const RANK_ICON: Record<string, string> = { genin: 'leaf', chunin: 'medal', jounin: 'star', kage: 'crown' };
    const byRank = Object.entries(RANKS)
      .map(([k, r]) => [r.name, ninjas.filter((u) => u.ninja!.rank === k).length, RANK_ICON[k] ?? 'ninja'] as const)
      .filter(([, n]) => n > 0);
    const cell = (icon: string, label: string, v: string | number, tip: string) =>
      `<div class="statcard" ${tipAttr(label, tip, true)}><span class="si ic-wrap">{${icon}}</span><span>${label}</span><b>${v}</b></div>`;
    let html = this.tabs('stats') + `<div class="statgrid">`;
    html += cell('sun', 'Dia', s.day, 'Dias desde a fundação da vila.');
    html += cell('users', 'População', `${g.population()} / ${g.popCap()}`, 'Moradores e ninjas / vagas nas casas. Construa ou melhore casas para crescer.');
    html += cell('ninja', 'Ninjas', ninjas.length, 'Ninjas da vila (recrutados na Academia).');
    html += cell('star', 'Reputação', s.reputation, 'Sobe com missões, exames, chefes vencidos e o Monte dos Kages; cai quando uma missão fracassa.');
    html += cell('swords', 'Abates', s.stats.kills, 'Inimigos e animais derrotados.');
    html += cell('shield', 'Invasões repelidas', s.stats.raidsRepelled, 'Ataques de renegados que a vila venceu.');
    html += cell('skull', 'Chefes derrotados', s.stats.bossesDefeated, 'Ameaças-chefe vencidas.');
    html += cell('clipboard', 'Missões cumpridas', s.stats.missionsDone, 'Missões da Mesa de Missões concluídas com sucesso.');
    html += cell('baby', 'Nascimentos', s.stats.born, 'Crianças nascidas na vila.');
    html += cell('candle', 'Perdas', s.stats.lost, 'Moradores e ninjas que morreram.');
    html += cell('castle', 'Clãs', s.clans.length, 'Clãs fundados por ninjas da vila.');
    html += cell('flag', 'Equipes', s.teams.length, 'Equipes de ninjas montadas.');
    html += `</div>`;
    if (byRank.length) html += `<h4>Ninjas por patente</h4><div class="statgrid">${byRank.map(([n, c, i]) => cell(i, n, c, `Ninjas com a patente ${n}.`)).join('')}</div>`;
    return { html, t: {}, b: {} };
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
            html += `<button class="btn" data-act="awaken" data-arg="${c.id}" data-k="${k.id}" ${blocked(g, [], AWAKEN_COST)}>${k.kanji} Despertar ${k.name} (${k.pt}) · ${costLabel(AWAKEN_COST)}</button>`;
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
    let html = `<h4>Técnicas básicas <small>(automáticas)</small></h4><div class="btnrow">
      <span class="badge" ${tipAttr('Shunshin no Jutsu', `Corpo cintilante: some num redemoinho de ${style} e aparece até ${SHUNSHIN.maxDist / 32 | 0} tiles adiante. Usa para chegar na luta, recuar quando luta de longe e fugir ferido. Recarga ${flickerCooldown(n.stats).toFixed(1)}s (menor com Velocidade).`, true)}>{run} Shunshin · <b data-t="flick"></b></span>
      <span class="badge" ${tipAttr('Kawarimi no Jutsu', `Substituição: num golpe forte ou fatal, ${Math.round(kawarimiChance(n.stats) * 100)}% de chance de trocar de lugar com um tronco (Velocidade e Inteligência aumentam). ${KAWARIMI.chakra} de chakra, recarga ${KAWARIMI.cooldown}s.`, true)}>{leaf} Kawarimi · <b data-t="kawa"></b></span>`;
    if (n.sannin) {
      const s = SANNIN_PATHS[n.sannin];
      t.sart = ready(u.sanninCd);
      html += `<span class="badge" style="color:${s.color}" ${tipAttr(`${s.title}: ${s.art}`, `${s.desc} Recarga ${s.cooldown}s.`, true)}>{crown} ${esc(s.art)} · <b data-t="sart"></b></span>`;
    }
    if (n.kageArt) {
      const k = KAGE_ARTS[n.kageArt];
      t.kart = ready(u.artCd);
      html += `<span class="badge" style="color:${k.color}" ${tipAttr(k.name, k.desc, true)}>{crown} ${esc(k.name.replace(' no Jutsu', ''))} · <b data-t="kart"></b></span>`;
    }
    return html + `</div>`;
  }

  /** Kage atual ou eleição (cerimônia). */
  private kageSection() {
    const g = this.app.game;
    const k = currentKage(g);
    let html = `<h4>{crown} Kage</h4>`;
    if (k) {
      html += `<p class="hint"><b>${esc(k.name)}</b> governa a vila · ninjas +10% de dano${
        g.state.buildings.some((b) => b.type === 'monument') ? '' : ' · construa o {monument} Monte dos Kages'
      }</p>`;
      const art = k.ninja!.kageArt && KAGE_ARTS[k.ninja!.kageArt];
      if (art) html += `<p class="hint"><b style="color:${art.color}">{crown} ${esc(art.name)}</b> — ${esc(art.desc)}</p>`;
    } else if (g.state.ceremony) {
      html += `<p class="hint">{party} Cerimônia em andamento…</p>`;
    } else {
      const st = electionStatus(g);
      html += `<p class="hint">Um Jounin de nível ${KAGE_MIN_LEVEL}+ pode ser eleito Kage (${costLabel(KAGE_COST)}). Com Kage vivo, todos os ninjas causam +10% de dano.</p>`;
      if (st.candidates.length && st.ready)
        html += `<div class="btnrow">${st.candidates
          .slice(0, 3)
          .map((c) => `<button class="btn primary" data-act="elect" data-arg="${c.id}">{crown} Eleger ${esc(c.name.split(' ').pop()!)} (Nv ${c.ninja!.level})</button>`)
          .join('')}</div>`;
      else html += `<p class="why">${esc(st.reason)}</p>`;
    }
    if (g.state.kageHistory.length)
      html += `<p class="hint">Kages: ${g.state.kageHistory.map((h) => `${esc(h.name)} (dia ${h.day})`).join(' · ')}</p>`;
    return html + this.sanninSection() + this.orgSection();
  }

  /** A Ordem do Eclipse: duplas que caçam a vila, quem já caiu e o covil. */
  private orgSection() {
    const g = this.app.game;
    const o = g.state.org;
    let html = `<h4>{skull} ${ORG.name}</h4>`;
    if (o.done) return html + `<p class="hint">{check} Destruída. A vila é lendária.</p>`;
    html += `<p class="hint">Oito ninjas lendários de capa preta. ${g.state.level < ORG.minVillage ? 'Ainda não sabem da vila (começam a aparecer na Vila Oculta).' : `Atacam em duplas e caçam os seus ninjas mais fortes${o.nextDay ? `; próxima aparição por volta do dia ${o.nextDay}` : ''}.`} Quem cai não volta.</p><div class="btnrow">`;
    for (const pair of [...ORG_PAIRS, ['tsuchigumo', 'yomi'] as const])
      for (const id of pair) {
        const d = ORG_MEMBERS[id];
        const down = o.down.includes(id);
        html += `<span class="badge ${down ? '' : 'enemy'}" ${tipAttr(`${d.name}, ${d.title}`, `${d.art}: ${d.desc}`, true)}>${down ? '{check} ' : ''}${d.name}</span>`;
      }
    html += `</div>`;
    if (o.lairKnown) html += `<p class="hint">{map} O covil foi descoberto: Mundo → Região → Covil do Eclipse.</p>`;
    return html;
  }

  /** Os Três Sannin: um por caminho (sapo, serpente, lesma), escolhidos entre os Jounins fortes. */
  private sanninSection() {
    const g = this.app.game;
    let html = `<h4>{crown} Os Três Sannin</h4><p class="hint">Título lendário para Jounins de nível ${SANNIN.minLevel}+ (${costLabel(SANNIN.cost)} cada): atributos até ${SANNIN.statCap}, o contrato do animal (invoca mais vezes) e uma técnica lendária.</p><div class="sannin">`;
    const cands = sanninCandidates(g);
    for (const path of ['toad', 'snake', 'slug'] as const) {
      const d = SANNIN_PATHS[path];
      const who = sanninOf(g, path);
      html += `<div class="wscard"><div class="wshead"><span class="wsname" style="color:${d.color}">${esc(d.title)}</span></div><p class="hint"><b>${esc(d.art)}:</b> ${esc(d.desc)}</p>`;
      if (who) html += `<button class="rrow" data-act="pick" data-arg="${who.id}"><span class="rn">${esc(who.name)}</span><span class="badge">Nv ${who.ninja!.level}</span></button>`;
      else if (!cands.length) html += `<p class="why">${esc(sanninBlock(g, undefined, path) ?? '')}</p>`;
      else
        for (const c of cands.slice(0, 3)) {
          const why = sanninBlock(g, c, path);
          html += `<button class="btn" data-act="sannin" data-arg="${c.id}:${path}" ${blocked(g, [why && !why.startsWith('Custa') && why], SANNIN.cost)}>{crown} ${esc(c.name.split(' ').pop()!)} (Nv ${c.ninja!.level})</button>`;
        }
      html += `</div>`;
    }
    return html + `</div>`;
  }

  /** Felicidade (com os fatores), estação, clima e festival. */
  private lifeSection() {
    const g = this.app.game;
    const s = g.state;
    const season = SEASONS[seasonOf(s)];
    const w = WEATHERS[s.weather];
    let html = `<div class="cols"><div><h4>{smile} Felicidade ${Math.round(s.happiness)}/100</h4><ul class="reqs">`;
    for (const [l, v] of moodFactors(g)) html += `<li class="${v >= 0 ? 'ok' : ''}">${esc(l)} <b>${v > 0 && l !== 'Base' ? '+' : ''}${v}</b></li>`;
    html += `</ul><p class="hint">Felizes, os moradores trabalham até 25% mais rápido e têm mais filhos. Abaixo de ${MOOD.leave}, um vai embora por dia.</p></div>`;
    html += `<div><h4>${season.icon} ${season.name} · ${w.icon} ${w.name}</h4><p class="hint">${esc(season.desc)} Faltam ${daysToNextSeason(s)} dia(s) para a próxima estação.</p><p class="hint">Hoje: ${esc(w.desc)}</p>`;
    const why = festivalBlock(g);
    html += `<button class="btn primary" data-act="festival" ${blocked(g, [why], FESTIVAL.cost)}>{party} ${season.festival} (${costLabel(FESTIVAL.cost)})</button>
      <p class="hint">${festivalOn(s) ? '{party} Festival acontecendo agora!' : `Festival: +${FESTIVAL.mood} de felicidade até o fim do dia seguinte.`}</p></div></div>`;
    return html;
  }

  /** Nível da vila, benefícios e requisitos do próximo nível (marco). */
  private villageSection() {
    const g = this.app.game;
    const cur = levelDef(g.state.level);
    let html = `<div class="lvlcard"><div class="lvlname">${cur.icon} ${cur.name}</div>
      <div class="hint">Nível ${g.state.level} de ${MAX_VILLAGE_LEVEL} · território ${cur.territory} · impostos ${cur.tax}{ryo}/morador</div></div>`;
    html += this.lifeSection();
    const st = nextLevelStatus(g);
    if (!st) return html + `<p class="hint">{trophy} A vila chegou ao nível máximo!</p>`;
    // duas colunas na janela larga: o que falta (esquerda) e o que se ganha (direita)
    html += `<div class="cols"><div><h4>Próximo: ${st.def.icon} ${st.def.name}</h4><ul class="reqs">`;
    for (const c of st.checks)
      html += `<li class="${c.ok ? 'ok' : ''}">${c.ok ? '{check}' : '{todo}'} ${esc(c.label)} <b>${Math.min(c.have, c.need)}/${c.need}</b></li>`;
    html += `</ul></div><div><h4>Benefícios</h4><ul class="reqs perks">${st.def.perks.map((p) => `<li class="ok">{star} ${esc(p)}</li>`).join('')}</ul></div></div>`;
    html += `<div class="actions"><button class="btn primary big" data-act="upgrade" ${blocked(g, st.checks.filter((c) => !c.ok).map((c) => `{todo} ${c.label}: ${Math.min(c.have, c.need)} de ${c.need}`), st.def.cost, st.ready ? undefined : 'Faltam requisitos')}>
      <span>{up} Elevar a ${st.def.name}</span><span class="cost">${costLabel(st.def.cost)}</span></button></div>`;
    if (st.ready && !st.afford) html += `<p class="hint">Requisitos cumpridos — faltam recursos.</p>`;
    return html;
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
    if (queue.length || bd.craft) html += `<div class="btnrow"><button class="btn" data-act="craft-cancel">{run} Cancelar último (devolve recursos)</button></div>`;
    html += `<h4>Receitas</h4>`;
    for (const r of recipes) {
      const locked = (r.minLevel ?? 0) > g.state.level;
      html += `<div class="jcard ${locked ? 'locked' : ''}"><div class="jn">${r.icon} ${esc(r.name)} <small>· ${SLOT_LABEL[r.slot]}</small></div>
        <div class="jm">${costLabel(r.cost)} · ${r.craftTime}s</div><div class="jd">${esc(r.desc)}</div>
        <div class="jb">${locked ? `<span class="why">{lock} Requer ${levelDef(r.minLevel!).name}</span>` : `<button class="btn primary" data-act="craft" data-arg="${r.id}" ${blocked(g, [queue.length + (bd.craft ? 1 : 0) >= MAX_QUEUE && `A fila está cheia (máximo ${MAX_QUEUE}).`], r.cost)}>Fabricar</button>`}</div></div>`;
    }
    return html;
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
    return `<span class="mseal ${small ? 'sm' : ''}" style="--c:${color}">${small ? '' : `<img src="${missionScrollUrl}" alt="" draggable="false">`}<b>${label}</b></span>`;
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
    const url = unitPortrait(u);
    return url ? `<img class="face" src="${url}" alt="" draggable="false">` : `<span class="face none" style="--c:${u.look?.cloth ?? '#888'}"></span>`;
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
    const tog = (act: string, on: boolean, label: string, title: string, tip: string) =>
      `<button class="btn tog ${on ? 'on' : ''}" data-act="${act}" ${tipAttr(title, tip)}>${label}<i class="sw"></i></button>`;
    return `<div class="wtools">
      <button class="btn primary" data-act="gear-all" ${tipAttr('Equipar todos', 'Passa o melhor do estoque para cada ninja; os mais fortes escolhem primeiro.')}>{kunai} Equipar todos</button>
      ${tog('gear-auto', !!f.autoGear, '{gear} Auto-equipar', 'Equipamento automático', 'Ligado: a cada poucos segundos o que for fabricado vai sozinho para quem precisa.')}
      ${tog('rookies', !!f.shelterRookies, '{shield} Proteger novatos', 'Proteger novatos', `Ligado: Genins fogem para casa (ou para o Hospital) quando chega um inimigo ${CARE.danger}× mais forte que eles, e saem quando o perigo passa. Só vale se houver um Chunin ou acima na vila para defender; uma ordem sua sempre manda.`)}
      <button class="btn" data-act="teach-all" ${blocked(g, [!g.findBuilt('academy') && 'Construa a Academia Ninja.', !free && 'Ninguém com espaço livre para jutsu.'])} ${tipAttr('Ensinar todos agora', 'Cada ninja com espaço livre vai estudar o melhor jutsu que pode aprender (pela natureza, rank e atributos dele). Paga o ryo de cada jutsu.')}>{books} Ensinar todos (${free})</button>
      ${tog('auto-teach', !!f.autoTeach, '{scroll} Ensino automático', 'Ensino automático', `Ligado: a Academia manda sozinha quem tiver espaço livre estudar (até ${maxLearners(g)} ao mesmo tempo, para não esvaziar a defesa). Jutsus proibidos ficam de fora.`)}
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
      <span class="nc-face">${pic ? `<img src="${pic}" alt="" draggable="false">` : `<span class="face none" style="--c:${u.look?.cloth ?? '#888'}"></span>`}</span>
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

  private teamsList(): Built {
    const g = this.app.game;
    let html = this.tabs('teams');
    html += `<p class="hint">Equipes treinam e lutam juntas: membros seguem o líder, focam o mesmo alvo (+10% de dano juntos) e treinam 50% mais rápido com um sensei Chunin+.</p>`;
    html += `<div class="roster">`;
    for (const tm of g.state.teams) {
      const sensei = g.unit(tm.senseiId);
      html += `<button class="rrow" data-act="open-team" data-arg="${tm.id}" style="--c:${tm.color}">
        <span class="rn"><span class="dot"></span>${esc(tm.name)}</span><span class="badge">${tm.memberIds.length}/${MAX_MEMBERS}</span>
        <span class="rm">Sensei: ${sensei ? esc(sensei.name) : '—'} · ${tm.memberIds.map((id) => esc(g.unit(id)?.name.split(' ').pop() ?? '?')).join(', ') || 'sem membros'}</span></button>`;
    }
    const free = g.state.units.filter((u) => !u.dead && u.kind === 'ninja' && u.faction === 'village' && u.ninja!.rank !== 'kage' && !teamOf(g, u)).length;
    html += `</div><div class="actions"><button class="btn primary" data-act="team-auto" ${blocked(g, [!free && 'Todos os ninjas já estão em equipes.'], undefined, 'Ninguém sem equipe')} ${tipAttr(
      'Montar automaticamente',
      'Completa as vagas das equipes que já existem e cria novas com quem está sem equipe, equilibrando a força e dando um sensei Chunin+ a cada uma quando houver.',
    )}>{users} Montar equipes automaticamente${free ? ` (${free} sem equipe)` : ''}</button>
      <button class="btn" data-act="team-new">{plus} Nova equipe vazia</button>
      <button class="btn ${g.state.flags.autoSensei ? 'primary' : ''}" data-act="auto-sensei" ${tipAttr(
        'Senseis automáticos',
        'Ligado: equipe sem sensei recebe um sozinha (um Chunin+ da própria equipe ou o Jounin livre mais forte).',
      )}>{crown} Senseis automáticos: ${g.state.flags.autoSensei ? 'ligado' : 'desligado'}</button></div>`;
    if (!g.state.teams.length) html += `<p class="hint">Nenhuma equipe ainda.</p>`;
    return { html, t: {}, b: {} };
  }

  /** Linha de ninja da equipe com o botão de tirar da equipe ao lado. */
  private memberRow(u: Unit, t: Record<string, string>, b: Record<string, number>, extra = '') {
    return `<div class="trow">${this.ninjaRow(u, t, b, extra)}<button class="btn icon" data-act="team-remove" data-arg="${u.id}" title="Tirar da equipe">{x}</button></div>`;
  }

  /** Ninjas sem equipe que podem entrar nesta: membro (qualquer patente) ou sensei (Chunin+). */
  private teamCandidates(tm: Team) {
    const g = this.app.game;
    const free = g.state.units.filter((u) => !u.dead && u.kind === 'ninja' && u.faction === 'village' && u.ninja!.rank !== 'kage' && !teamOf(g, u));
    const room = tm.memberIds.length < MAX_MEMBERS;
    if (!room && tm.senseiId != null) return '';
    let html = `<h4>Adicionar à equipe</h4>`;
    if (!free.length) return html + `<p class="hint">Todos os ninjas já estão em equipes. Recrute mais na Academia ou tire alguém de outra equipe.</p>`;
    html += `<div class="roster">`;
    for (const u of free) {
      const n = u.ninja!;
      const nat = NATURES[n.nature];
      const lead = n.rank !== 'genin';
      html += `<div class="cand"><span class="rn">${esc(u.name)}</span>
        <span class="badges"><span class="badge rank">${RANKS[n.rank].name}</span><span class="badge nat" style="--c:${nat.color}">${nat.kanji}</span><span class="badge">Nv ${n.level}</span></span>
        <span class="btnrow">${room ? `<button class="btn mini primary" data-act="team-add" data-arg="${u.id}">{plus} Membro</button>` : ''}${
          lead && tm.senseiId == null ? `<button class="btn mini" data-act="team-sensei" data-arg="${u.id}">{crown} Sensei</button>` : ''
        }</span></div>`;
    }
    return html + `</div>`;
  }

  private teamView(tm: Team): Built {
    const g = this.app.game;
    const t: Record<string, string> = {};
    const b: Record<string, number> = {};
    const sensei = g.unit(tm.senseiId);
    const units = teamUnits(g, tm);
    let html = `<div class="ph"><div class="row"><button class="btn icon" data-act="team-back" title="Voltar">{back}</button>
      <div class="title teamtag" style="--c:${tm.color}"><span class="dot"></span>${esc(tm.name)}</div></div></div>`;
    if (!sensei && !tm.memberIds.length)
      html += `<div class="warnbox">Monte a equipe aqui: escolha até ${MAX_MEMBERS} membros e, se quiser, um sensei Chunin ou Jounin (treinam 50% mais rápido).</div>`;
    html += `<h4>Sensei</h4>`;
    html += sensei
      ? `<div class="roster">${this.memberRow(sensei, t, b, '{crown} ')}</div>`
      : `<p class="hint">Sem sensei.</p>`;
    html += `<h4>Membros (${tm.memberIds.length}/${MAX_MEMBERS})</h4><div class="roster">`;
    for (const id of tm.memberIds) {
      const u = g.unit(id);
      if (u) html += this.memberRow(u, t, b);
    }
    html += `</div>`;
    if (!tm.memberIds.length) html += `<p class="hint">Nenhum membro ainda.</p>`;
    html += this.teamCandidates(tm);
    const mission = missionOfTeam(g, tm.id);
    html += `<h4>Missão</h4>` + (mission
      ? `<p class="hint">{clipboard} ${esc(mission.title)} (rank ${MISSION_RANKS[mission.rank]!.label}) · ${this.missionPhase(mission)}</p>`
      : `<p class="hint">Livre · força {swords}${teamPower(g, tm)}. Envie em uma missão pela {clipboard} Mesa de Missões.</p>`);
    if (units.length) {
      const n0 = units[0]!.ninja!;
      html += `<h4>Ordens para a equipe</h4><div class="btnrow">
        <button class="btn primary" data-act="cmd-mode" data-arg="team">{pin} Ordem</button>
        <button class="btn" data-act="cmd-retreat" data-arg="team">{run} Recuar</button>
        <button class="btn" data-act="cmd-clear" data-arg="team">{x} Cancelar</button>
        <button class="btn" data-act="team-autoequip">{gear} Equipar equipe</button></div>
        <h4>Rotina da equipe</h4><div class="seg">`;
      for (const [k, label] of ROUTINES)
        html += `<button data-act="team-mode" data-arg="${k}" class="${n0.order === k ? 'on' : ''}" ${tipAttr(label, ROUTINE_TIP[k])}>${label}</button>`;
      html += `</div>`;
    }
    html += `<div class="actions"><button class="btn danger" data-act="team-disband">${this.armedDemolish ? 'Toque de novo para confirmar' : '{trash} Desfazer equipe'}</button></div>`;
    return { html, t, b };
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
      case 'open-team':
        if (this.mode === 'window') this.show({ kind: 'team', id: Number(arg) });
        else this.onWindow({ kind: 'team', id: Number(arg) });
        return;
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
