// Painel lateral de detalhes. Estrutura HTML só é recriada quando muda;
// valores dinâmicos (barras, números) são atualizados in-place via data-t / data-b.
import type { App } from '../app';
import { ANIMALS } from '../data/animals';
import { BUILDINGS } from '../data/buildings';
import { ROGUE_ROLES } from '../data/enemies';
import { SITES } from '../data/sites';
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
  abandonMission, acceptMission, MISSION_TIME, maxActiveMissions, missionOfTeam, missionPower, missionReward, teamPower, templateOf,
} from '../game/missions';
import { missionFocus } from '../game/missionView';
import { currentKage, electionStatus, electKage, KAGE_COST, KAGE_MIN_LEVEL } from '../game/kage';
import { AWAKEN_COST, awakenKekkei, awakenOptions, canFoundClan, clanMembers, clanOf, FOUND_COST, FOUND_MIN_LEVEL, foundClan, surname } from '../game/clans';
import { KEKKEI, KEKKEI_LIST, type KekkeiId } from '../data/kekkei';
import { arenaSpots, EXAM_MIN_LEVEL, examLabel, examStatus, startExam } from '../game/exam';
import { MISSION_RANKS, MISSION_TYPE_LABEL } from '../data/missions';
import { ITEM_LIST, ITEMS, MAX_QUEUE, SLOT_LABEL, type ItemSlot } from '../data/items';
import { autoEquip, cancelCraft, enqueueCraft, equip, gearBonus, isWorkshop, recipesOf, stock, unequip } from '../game/gear';
import { levelDef, MAX_VILLAGE_LEVEL } from '../data/villageLevels';
import {
  attackersOf, autoTeams, availableFighters, clearCommand, commandLabel, isAttackable, nearestFighters, orderAttack, createTeam, createTeamWith, disbandTeam, joinAsMember, joinAsSensei, leaveTeam, MAX_MEMBERS, orderRetreat,
  setTeamOrder, teamOf, teamUnits,
} from '../game/teams';
import type { Building, Mission, NinjaOrder, Site, Team, Unit } from '../game/types';
import { occupantsOf } from '../game/interior';
import { isNight } from '../game/time';
import { drawInterior } from '../render/interior';
import { esc, el } from './dom';
import { MAX_BUILDING_LEVEL, UPGRADES } from '../data/upgrades';
import { housingOf, levelOf, startUpgrade, upgradeStatus, upgradeTime, workersOf } from '../game/upgrade';
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
  | { kind: 'site'; id: number };

interface Built {
  html: string;
  t: Record<string, string>;
  b: Record<string, number>;
}

/** Abas da janela central: cada grupo de telas de gestão. */
const WINDOW_TABS: Record<string, [View['kind'], string][]> = {
  ninjas: [['roster', '{ninja} Ninjas'], ['teams', '{users} Equipes'], ['clans', '{castle} Clãs']],
  village: [['village', '{castle} Vila'], ['kage', '{crown} Kage'], ['stats', '{trophy} Estatísticas']],
};
const TAB_GROUP: Partial<Record<View['kind'], string>> = { roster: 'ninjas', teams: 'ninjas', clans: 'ninjas', team: 'ninjas', village: 'village', kage: 'village', stats: 'village' };

type BuildingTab = 'main' | 'inside';

type RosterFilter = 'all' | 'free' | 'team' | 'mission' | 'hurt' | 'genin' | 'chunin' | 'jounin';
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
  private view: View | null = null;
  private lastHtml = '';
  private armedDemolish = 0;
  /** Aba do painel do ninja (mantida ao trocar de ninja). */
  private unitTab: UnitTab = 'info';
  /** Lista de ninjas: filtro e ordem escolhidos (mantidos enquanto o jogo está aberto). */
  private rosterFilter: RosterFilter = 'all';
  private rosterSort: RosterSort = 'level';
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
      html += `<h4>Atributos <small>(máx ${RANKS[n.rank].statCap})</small></h4><div class="stats">`;
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
      html += `</div>`;
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

  /** Entrada de mina (expedições entram na etapa das minas). */
  private caveSection(_site: Site) {
    return `<p class="hint">{pickaxe} Expedições às minas chegam em breve.</p>`;
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
    html += `</div><p class="hint">Abates: ${n.kills}</p>`;
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
      if (bd.type === 'missions') html += this.missionsSummary();
      if (isWorkshop(bd.type)) html += this.workshopSection(bd, t, b);
      if (bd.type === 'arena') html += this.arenaSection(b);
      if (bd.type === 'sealshop') html += `<p class="hint">Sem pedidos, o artesão faz 1{paper} com 4{wood} a cada 8 s (se houver 30{wood} ou mais).</p>`;
      if (d.workers) {
        html += `<h4>Trabalhadores</h4><div class="workers"><button class="btn" data-act="workers" data-arg="-1">{minus}</button>
          <b data-t="workers"></b><button class="btn" data-act="workers" data-arg="1">{plus}</button></div>`;
        t.workers = `${bd.workers.length} / ${bd.desired} (máx ${workersOf(bd)})`;
      }
      if (d.housing) {
        const residents = g.villagers().filter((u) => u.homeId === bd.id).length;
        html += `<h4>Moradia</h4><p class="hint"><span data-t="res"></span> moradores</p>`;
        t.res = `${residents} / ${housingOf(bd)}`;
      }
      if (bd.type === 'academy') {
        const villagers = g.state.units.filter((u) => !u.dead && u.kind === 'villager').length;
        html += `<h4>Recrutamento</h4><p class="hint">Transforma um morador em Genin. Alguns já nascem com jutsu, outros precisam estudar aqui.</p>`;
        html += `<div class="actions"><button class="btn primary" data-act="recruit" ${blocked(g, [villagers <= 1 && 'Precisa sobrar pelo menos um morador na vila.'], RECRUIT_COST)}>{ninja} Recrutar ninja (${costLabel(RECRUIT_COST)})</button></div>`;
        html += `<p class="hint">Para ensinar jutsu: selecione um ninja → "Ensinar jutsu".</p>`;
      }
      if (bd.type === 'training') html += `<p class="hint">Ninjas no modo Auto/Treinar vêm aqui de dia e ganham atributos e XP.</p>`;
      if (d.healRate) html += `<p class="hint">Cura ${d.healRate} HP/s de quem descansa aqui.</p>`;
    }
    html += `<div class="actions"><button class="btn" data-act="move">{refresh} Mover de lugar (grátis)</button>`;
    if (bd.type !== 'hokage')
      html += `<button class="btn danger" data-act="demolish">${this.armedDemolish ? 'Toque de novo para confirmar' : `{trash} Demolir (devolve ${bd.built ? '50%' : '100%'})`}</button>`;
    html += `</div>`;
    return { html, t, b };
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
  private tabs(active: View['kind']) {
    const tabs = WINDOW_TABS[TAB_GROUP[active] ?? ''];
    if (!tabs) return '';
    return `<div class="seg tabs">${tabs.map(([k, label]) => `<button data-act="tab" data-arg="${k}" class="${active === k ? 'on' : ''}">${label}</button>`).join('')}</div>`;
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
    let html = `<div class="ph"><div class="title">{clipboard} Quadro de missões</div></div>`;
    if (!this.app.game.findBuilt('missions')) return { html: html + `<div class="warnbox">Construa a {clipboard} Mesa de Missões (menu Construir) para receber pedidos.</div>`, t, b };
    html += this.missionsSection(t, b);
    return { html, t, b };
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
      (kk ? `<span class="badge nat" style="--c:${KEKKEI[kk].color}">${KEKKEI[kk].kanji} ${KEKKEI[kk].name}</span>` : '')
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

  /** Kage atual ou eleição (cerimônia). */
  private kageSection() {
    const g = this.app.game;
    const k = currentKage(g);
    let html = `<h4>{crown} Kage</h4>`;
    if (k) {
      html += `<p class="hint"><b>${esc(k.name)}</b> governa a vila · ninjas +10% de dano${
        g.state.buildings.some((b) => b.type === 'monument') ? '' : ' · construa o {monument} Monte dos Kages'
      }</p>`;
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
    return html;
  }

  /** Nível da vila, benefícios e requisitos do próximo nível (marco). */
  private villageSection() {
    const g = this.app.game;
    const cur = levelDef(g.state.level);
    let html = `<div class="lvlcard"><div class="lvlname">${cur.icon} ${cur.name}</div>
      <div class="hint">Nível ${g.state.level} de ${MAX_VILLAGE_LEVEL} · território ${cur.territory} · impostos ${cur.tax}{ryo}/morador</div></div>`;
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
    let html = `<h4>Estoque</h4><div class="btnrow">`;
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

  /** Quadro de missões: ativas (com progresso), oferecidas (com envio de equipe) e histórico. */
  private missionsSection(t: Record<string, string>, b: Record<string, number>) {
    const g = this.app.game;
    const ms = g.state.missions;
    const active = ms.filter((m) => m.status === 'active');
    const offered = ms.filter((m) => m.status === 'offered');
    const ended = ms.filter((m) => m.status === 'done' || m.status === 'failed').slice(-3).reverse();
    let html = `<div class="lvlcard"><div class="lvlname">{star} Reputação ${g.state.reputation}</div>
      <div class="hint">Missões cumpridas: ${g.state.stats.missionsDone} · em andamento ${active.length}/${maxActiveMissions(g)} · o quadro renova todo dia</div></div>`;
    if (active.length) {
      html += `<h4>Em andamento</h4>`;
      for (const m of active) {
        const team = g.team(m.teamId);
        const r = MISSION_RANKS[m.rank]!;
        html += `<div class="mcard" style="--c:${r.color}"><div class="mt"><span class="mrank">${r.label}</span>${esc(m.title)}</div>
          <div class="hint">${team ? `<span class="dot" style="--c:${team.color}"></span>${esc(team.name)}` : '—'} · ${this.missionPhase(m)} · {hourglass} <span data-t="mt${m.id}"></span></div>
          <div class="bar pg"><i data-b="mp${m.id}"></i><span data-t="mpl${m.id}"></span></div>
          <div class="btnrow"><button class="btn" data-act="m-view" data-arg="${m.id}">{pin} Ver</button><button class="btn" data-act="m-abandon" data-arg="${m.id}">Abandonar</button></div></div>`;
        t[`mt${m.id}`] = `${Math.ceil(m.timeLeft)}s`;
        b[`mp${m.id}`] = m.progress / Math.max(1, m.goal);
        t[`mpl${m.id}`] = `${m.progress}/${m.goal}`;
      }
    }
    html += `<h4>Missões disponíveis</h4>`;
    if (!offered.length) html += `<p class="hint">Nenhuma missão no quadro hoje. Volte amanhã.</p>`;
    const teams = g.state.teams.filter((tm) => teamUnits(g, tm).length && !missionOfTeam(g, tm.id));
    const full = active.length >= maxActiveMissions(g);
    for (const m of offered) {
      const tpl = templateOf(m);
      const r = MISSION_RANKS[m.rank]!;
      html += `<div class="mcard" style="--c:${r.color}"><div class="mt"><span class="mrank">${r.label}</span>${esc(m.title)}</div>
        <div class="jm">${MISSION_TYPE_LABEL[m.type]} · dificuldade {swords}${missionPower(m)} · ${Math.round(MISSION_TIME)}s · recompensa ${costLabel(missionReward(tpl))} + ${r.xp} XP</div>
        <div class="jd">${esc(tpl.desc)}</div><div class="btnrow">`;
      if (full) html += `<span class="why">Limite de missões simultâneas atingido.</span>`;
      else if (!teams.length) html += `<span class="why">Nenhuma equipe livre. Forme uma em {ninja} Ninjas → Equipes.</span>`;
      else
        for (const tm of teams) {
          const p = teamPower(g, tm);
          const risk = p >= missionPower(m) ? 'p-ok' : p >= missionPower(m) * 0.7 ? 'p-risk' : 'p-bad';
          html += `<button class="btn ${risk}" data-act="m-accept" data-arg="${m.id}" data-team="${tm.id}"><span class="dot" style="--c:${tm.color}"></span>${esc(tm.name)} {swords}${p}</button>`;
        }
      html += `</div></div>`;
    }
    if (ended.length) {
      html += `<h4>Recentes</h4><ul class="reqs">`;
      for (const m of ended) html += `<li class="${m.status === 'done' ? 'ok' : ''}">${m.status === 'done' ? '{check}' : '{fail}'} ${esc(m.title)} <b>${esc(m.result ?? '')}</b></li>`;
      html += `</ul>`;
    }
    return html;
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
      jounin: ['Jounin+', (u) => u.ninja!.rank === 'jounin' || u.ninja!.rank === 'kage'],
    };
    // filtros: só mostra os que têm alguém (e o escolhido, mesmo vazio, para poder voltar)
    html += `<div class="rfilters"><div class="chips rchips">`;
    for (const [k, [label, fn]] of Object.entries(tests) as [RosterFilter, [string, (u: Unit) => boolean]][]) {
      const n = ninjas.filter(fn).length;
      if (!n && k !== this.rosterFilter && k !== 'all') continue;
      html += `<button data-act="r-filter" data-arg="${k}" class="${this.rosterFilter === k ? 'on' : ''}">${label} <small>${n}</small></button>`;
    }
    html += `</div><div class="seg rsort"><span class="lbl">Ordenar</span>`;
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
    html += `<p class="hint">${list.length} de ${ninjas.length} ninja(s). Toque para selecionar.</p>`;
    if (!list.length) html += `<p class="hint">Nenhum ninja neste filtro.</p>`;
    html += `<div class="roster">`;
    for (const u of list) html += this.ninjaRow(u, t, b);
    html += `</div>`;
    return { html, t, b };
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
      <button class="btn" data-act="team-new">{plus} Nova equipe vazia</button></div>`;
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
    let html = `<div class="ph"><div class="row"><button class="btn icon" data-act="tab" data-arg="teams" title="Voltar">{back}</button>
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
        // da janela: fecha e abre o ninja no painel lateral, com a câmera nele
        const u = g.unit(Number(arg));
        if (u) {
          if (this.mode === 'window') this.show(null);
          g.select({ kind: 'unit', id: u.id });
          this.app.camera.focus(u.x, u.y);
        }
        return;
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
        return this.report(acceptMission(g, Number(arg), Number(btn.dataset.team)));
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
