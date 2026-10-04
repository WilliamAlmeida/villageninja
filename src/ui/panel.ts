// Painel lateral de detalhes. Estrutura HTML só é recriada quando muda;
// valores dinâmicos (barras, números) são atualizados in-place via data-t / data-b.
import type { App } from '../app';
import { ANIMALS } from '../data/animals';
import { BUILDINGS } from '../data/buildings';
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
import { MISSION_RANKS, MISSION_TYPE_LABEL } from '../data/missions';
import { ITEM_LIST, ITEMS, MAX_QUEUE, SLOT_LABEL, type ItemSlot } from '../data/items';
import { autoEquip, cancelCraft, enqueueCraft, equip, gearBonus, isWorkshop, recipesOf, stock, unequip } from '../game/gear';
import { levelDef, MAX_VILLAGE_LEVEL } from '../data/villageLevels';
import {
  clearCommand, commandLabel, createTeam, createTeamWith, disbandTeam, joinAsMember, joinAsSensei, leaveTeam, MAX_MEMBERS, orderRetreat,
  setTeamOrder, teamOf, teamUnits,
} from '../game/teams';
import type { Building, Mission, NinjaOrder, Team, Unit } from '../game/types';
import { esc, el } from './dom';
import { JOB_LABEL, STATE_LABEL } from './labels';

type View =
  | { kind: 'unit'; id: number; teach?: boolean }
  | { kind: 'building'; id: number }
  | { kind: 'team'; id: number }
  | { kind: 'roster' }
  | { kind: 'teams' };

interface Built {
  html: string;
  t: Record<string, string>;
  b: Record<string, number>;
}

export class Panel {
  readonly root: HTMLElement;
  private body: HTMLElement;
  private view: View | null = null;
  private lastHtml = '';
  private armedDemolish = 0;
  /** Chamado quando o jogador entra no modo "dar ordem". */
  onOrderMode: () => void = () => {};

  constructor(private app: App) {
    this.root = el('aside', { id: 'panel', hidden: '' }, '<button class="close" data-act="close">✕</button><div class="body"></div>');
    this.body = this.root.querySelector('.body')!;
    this.root.addEventListener('click', (e) => this.onClick(e));
    this.root.addEventListener('change', (e) => this.onChange(e));
    this.root.addEventListener('pointerdown', (e) => e.stopPropagation());
  }

  get isOpen() {
    return this.view !== null;
  }
  get kind() {
    return this.view?.kind ?? null;
  }

  show(view: View | null) {
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
    else if (this.view.kind === 'team') {
      const tm = g.team(this.view.id);
      if (tm) built = this.teamView(tm);
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
      this.body.innerHTML = built.html;
      this.lastHtml = built.html;
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
        <span class="badge ${u.faction === 'enemy' ? 'enemy' : 'rank'}">${u.faction === 'enemy' ? 'Renegado · ' : ''}${RANKS[n.rank].name}</span>
        <span class="badge nat" style="--c:${nat.color}">${nat.kanji} ${nat.name}</span></div></div>`;
      html += `<div class="sub">Nível ${n.level} · <span data-t="state"></span></div>`;
      html += `<div class="bar hp"><i data-b="hp"></i><span data-t="hp"></span></div>`;
      html += `<div class="bar ck"><i data-b="ck"></i><span data-t="ck"></span></div>`;
      t.ck = `Chakra ${Math.floor(u.chakra)} / ${u.maxChakra}`;
      b.ck = u.chakra / Math.max(1, u.maxChakra);
      if (isOwn) {
        html += `<div class="bar xp"><i data-b="xp"></i><span data-t="xp"></span></div>`;
        t.xp = `XP ${Math.floor(n.xp)} / ${xpToNext(n.level)}`;
        b.xp = n.xp / xpToNext(n.level);
        html += this.ninjaQuick(u);
      }
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
          html += `<div class="slot empty">Slot ${i + 1} — vazio${isOwn ? ' (ensine na Academia)' : ''}</div>`;
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
      if (isOwn) {
        html += this.ninjaControls(u);
        t.cmd = commandLabel(u);
      }
      else if (u.kind === 'clone') html += `<p class="hint">Clone das sombras. Some em <span data-t="life"></span>s.</p>`;
      if (u.kind === 'clone') t.life = String(Math.ceil(u.life ?? 0));
      return { html, t, b };
    }

    if (u.animal) {
      const d = ANIMALS[u.animal];
      html += `<div class="ph"><div class="title">${d.name}</div><div class="badges"><span class="badge enemy">Animal selvagem</span></div></div>`;
      html += `<div class="sub"><span data-t="state"></span></div><div class="bar hp"><i data-b="hp"></i><span data-t="hp"></span></div>`;
      html += `<p class="hint">Ataca moradores que chegam perto. Ao ser abatido rende ${costLabel(d.reward)} e XP.</p>`;
      html += `<p class="hint">Dano ${d.damage} · Velocidade ${d.speed}</p>`;
      return { html, t, b };
    }

    // morador
    const job = this.app.game.building(u.jobId);
    const jobDef = job ? BUILDINGS[job.type] : null;
    html += `<div class="ph"><div class="title">${esc(u.name)}</div><div class="badges"><span class="badge">Morador(a)</span></div></div>`;
    html += `<div class="sub">${jobDef?.job ? JOB_LABEL[jobDef.job] : 'Sem emprego (ajuda nas obras)'} · <span data-t="state"></span></div>`;
    html += `<div class="bar hp"><i data-b="hp"></i><span data-t="hp"></span></div>`;
    html += `<p class="hint">Moradores trabalham de dia, dormem à noite e fogem para casa quando há perigo. Recrute-os como ninjas na Academia.</p>`;
    return { html, t, b };
  }

  /** Equipe + ordens: o que mais importa em combate, logo abaixo das barras. */
  private ninjaQuick(u: Unit) {
    const team = teamOf(this.app.game, u);
    let html = `<h4>Ordens</h4><p class="hint">Atual: <b data-t="cmd"></b></p><div class="btnrow">
      <button class="btn primary" data-act="cmd-mode" data-arg="self">📍 Ordem</button>`;
    if (team) html += `<button class="btn primary" data-act="cmd-mode" data-arg="team">📍 Equipe</button>`;
    html += `<button class="btn" data-act="cmd-retreat" data-arg="self">🏃 Recuar</button>`;
    if (u.command) html += `<button class="btn" data-act="cmd-clear" data-arg="self">✕ Cancelar</button>`;
    html += `</div>`;
    return html + this.teamSection(u, team) + this.equipSection(u);
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
      if (cur) html += `<button class="btn mini" data-act="unequip" data-arg="${slot}">✕</button>`;
      html += `</div>`;
      const opts = ITEM_LIST.filter((d) => d.slot === slot && d.id !== e[slot] && stock(g, d.id) > 0);
      if (opts.length)
        html += `<div class="btnrow eqopts">${opts.map((d) => `<button class="btn mini" data-act="equip" data-arg="${d.id}">${d.icon} ${esc(d.name)} ×${stock(g, d.id)}</button>`).join('')}</div>`;
    }
    const gb = gearBonus(u);
    if (gb.melee || gb.defense || gb.hp) html += `<p class="hint">Bônus: +${gb.melee} dano · +${gb.kunai} kunai · ${Math.round(gb.defense * 100)}% defesa · +${gb.hp} vida</p>`;
    if (!ITEM_LIST.some((d) => stock(g, d.id) > 0)) html += `<p class="hint">Estoque vazio. Fabrique na Forja, Farmácia ou Oficina de Selos.</p>`;
    else html += `<div class="btnrow"><button class="btn" data-act="autoequip">⚙ Equipar o melhor</button></div>`;
    return html;
  }

  private ninjaControls(u: Unit) {
    const n = u.ninja!;
    const g = this.app.game;
    const team = teamOf(g, u);
    let html = `<h4>Rotina</h4><div class="seg">`;
    for (const [k, label] of [['auto', 'Auto'], ['train', 'Treinar'], ['patrol', 'Patrulhar']] as [NinjaOrder, string][])
      html += `<button data-act="order" data-arg="${k}" class="${n.order === k ? 'on' : ''}">${label}</button>`;
    html += `</div><label class="hint">Foco do treino<select data-act="focus"><option value="">${team?.senseiId != null && team.senseiId !== u.id ? 'Sensei decide / aleatório' : 'Aleatório'}</option>`;
    for (const k of STAT_KEYS) html += `<option value="${k}" ${n.focus === k ? 'selected' : ''}>${STAT_INFO[k].label}</option>`;
    html += `</select></label><div class="actions">`;
    html += `<button class="btn primary" data-act="teach-open">📜 Ensinar jutsu</button>`;
    const next = nextRank(u);
    if (next) {
      const r = RANKS[next];
      const villageOk = (r.minVillageLevel ?? 0) <= g.state.level;
      const can = n.level >= r.minLevel && villageOk && g.canAfford(r.promoteCost);
      const why = n.level < r.minLevel ? `· nível ${r.minLevel}` : !villageOk ? `· requer ${levelDef(r.minVillageLevel!).name}` : '';
      html += `<button class="btn" data-act="promote" ${can ? '' : 'disabled'}>🎖 Promover a ${r.name} (${costLabel(r.promoteCost)}) ${why}</button>`;
    }
    html += `<button class="btn" data-act="focus-cam">🎯 Centralizar câmera</button></div>`;
    html += `<p class="hint">Abates: ${n.kills}</p>`;
    return html;
  }

  private teamSection(u: Unit, team: Team | undefined) {
    const g = this.app.game;
    let html = `<h4>Equipe</h4>`;
    if (team) {
      const role = team.senseiId === u.id ? 'Sensei' : 'Membro';
      html += `<div class="teamtag" style="--c:${team.color}"><span class="dot"></span><b>${esc(team.name)}</b> · ${role}</div>
        <div class="btnrow"><button class="btn" data-act="open-team" data-arg="${team.id}">👥 Ver equipe</button><button class="btn" data-act="team-leave">Sair</button></div>`;
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
    html += `<button class="btn" data-act="team-create-with">＋ Nova equipe</button></div>`;
    return html;
  }

  private teach(u: Unit): Built {
    const n = u.ninja!;
    const g = this.app.game;
    const academy = g.findBuilt('academy');
    const nat = NATURES[n.nature];
    let html = `<div class="ph"><div class="row"><button class="btn" data-act="teach-back">←</button><div class="title">Ensinar jutsu</div></div></div>`;
    html += `<p class="hint">${esc(u.name)} · ${nat.kanji} ${nat.name} · rank máx ${JUTSU_RANK_LABEL[RANKS[n.rank].maxJutsuRank]}. Só aprende jutsus da sua natureza ou neutros.</p>`;
    if (!academy) html += `<div class="warnbox">Construa a <b>Academia Ninja</b> para ensinar jutsus.</div>`;
    if (n.learning) html += `<div class="warnbox">Já está estudando ${esc(JUTSUS[n.learning.jutsuId]!.name)}.</div>`;
    const free = n.jutsu[0] === null ? 0 : n.jutsu[1] === null ? 1 : -1;
    for (const o of jutsuOptions(u)) {
      const d = o.def;
      const afford = g.canAfford(d.cost);
      const enabled = o.ok && afford && !!academy && !n.learning;
      html += `<div class="jcard ${o.ok ? '' : 'locked'}" style="--c:${d.color}"><div class="jn">${esc(d.name)}</div>
        <div class="jm">Rank ${JUTSU_RANK_LABEL[d.rank]} · ${JUTSU_TYPE_LABEL[d.type]} · ${d.chakra} chakra · ${costLabel(d.cost)} · ${d.learnTime}s</div>
        <div class="jd">${esc(d.desc)}</div>`;
      if (!o.ok) html += `<div class="why">${esc(o.reason ?? '')}</div>`;
      else {
        html += `<div class="jb">`;
        if (free >= 0) html += `<button class="btn primary" data-act="learn" data-arg="${d.id}" data-slot="${free}" ${enabled ? '' : 'disabled'}>Aprender (slot ${free + 1})</button>`;
        else
          for (const s of [0, 1])
            html += `<button class="btn" data-act="learn" data-arg="${d.id}" data-slot="${s}" ${enabled ? '' : 'disabled'}>Substituir ${esc(JUTSUS[n.jutsu[s]!]!.shout.replace('!', ''))}</button>`;
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
    if (!bd.built) {
      html += `<h4>Em construção</h4><div class="bar pg"><i data-b="prog"></i><span data-t="prog"></span></div>`;
      html += `<p class="hint">Moradores sem emprego vão até a obra para construir.</p>`;
      b.prog = Math.min(1, bd.progress / d.buildTime);
      t.prog = `${Math.floor(b.prog * 100)}%`;
    } else {
      if (bd.type === 'hokage') html += this.villageSection();
      if (bd.type === 'missions') html += this.missionsSection(t, b);
      if (isWorkshop(bd.type)) html += this.workshopSection(bd, t, b);
      if (bd.type === 'sealshop') html += `<p class="hint">Sem pedidos, o artesão faz 1🏷️ com 4🪵 a cada 8 s (se houver 30🪵 ou mais).</p>`;
      if (d.workers) {
        html += `<h4>Trabalhadores</h4><div class="workers"><button class="btn" data-act="workers" data-arg="-1">−</button>
          <b data-t="workers"></b><button class="btn" data-act="workers" data-arg="1">+</button></div>`;
        t.workers = `${bd.workers.length} / ${bd.desired} (máx ${d.workers})`;
      }
      if (d.housing) {
        const residents = g.villagers().filter((u) => u.homeId === bd.id).length;
        html += `<h4>Moradia</h4><p class="hint"><span data-t="res"></span> moradores</p>`;
        t.res = `${residents} / ${d.housing}`;
      }
      if (bd.type === 'academy') {
        const villagers = g.state.units.filter((u) => !u.dead && u.kind === 'villager').length;
        html += `<h4>Recrutamento</h4><p class="hint">Transforma um morador em Genin. Alguns já nascem com jutsu, outros precisam estudar aqui.</p>`;
        html += `<div class="actions"><button class="btn primary" data-act="recruit" ${g.canAfford(RECRUIT_COST) && villagers > 1 ? '' : 'disabled'}>🥷 Recrutar ninja (${costLabel(RECRUIT_COST)})</button></div>`;
        html += `<p class="hint">Para ensinar jutsu: selecione um ninja → "Ensinar jutsu".</p>`;
      }
      if (bd.type === 'training') html += `<p class="hint">Ninjas no modo Auto/Treinar vêm aqui de dia e ganham atributos e XP.</p>`;
      if (d.healRate) html += `<p class="hint">Cura ${d.healRate} HP/s de quem descansa aqui.</p>`;
    }
    if (bd.type !== 'hokage') {
      html += `<div class="actions"><button class="btn danger" data-act="demolish">${this.armedDemolish ? 'Toque de novo para confirmar' : `🗑 Demolir (devolve ${bd.built ? '50%' : '100%'})`}</button></div>`;
    }
    return { html, t, b };
  }

  private tabs(active: 'roster' | 'teams') {
    return `<div class="seg tabs"><button data-act="tab" data-arg="roster" class="${active === 'roster' ? 'on' : ''}">🥷 Ninjas</button>
      <button data-act="tab" data-arg="teams" class="${active === 'teams' ? 'on' : ''}">👥 Equipes</button></div>`;
  }

  /** Nível da vila, benefícios e requisitos do próximo nível (marco). */
  private villageSection() {
    const g = this.app.game;
    const cur = levelDef(g.state.level);
    let html = `<div class="lvlcard"><div class="lvlname">${cur.icon} ${cur.name}</div>
      <div class="hint">Nível ${g.state.level} de ${MAX_VILLAGE_LEVEL} · território ${cur.territory} · impostos ${cur.tax}💰/morador</div></div>`;
    const st = nextLevelStatus(g);
    if (!st) return html + `<p class="hint">🏆 A vila chegou ao nível máximo!</p>`;
    html += `<h4>Próximo: ${st.def.icon} ${st.def.name}</h4><ul class="reqs">`;
    for (const c of st.checks)
      html += `<li class="${c.ok ? 'ok' : ''}">${c.ok ? '✅' : '⬜'} ${esc(c.label)} <b>${Math.min(c.have, c.need)}/${c.need}</b></li>`;
    html += `</ul><p class="hint">Benefícios: ${st.def.perks.map(esc).join(' · ')}</p>`;
    html += `<div class="actions"><button class="btn primary" data-act="upgrade" ${st.ready && st.afford ? '' : 'disabled'}>
      ⬆ Elevar a ${st.def.name} (${costLabel(st.def.cost)})</button></div>`;
    if (st.ready && !st.afford) html += `<p class="hint">Requisitos cumpridos — faltam recursos.</p>`;
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
    if (queue.length || bd.craft) html += `<div class="btnrow"><button class="btn" data-act="craft-cancel">↩ Cancelar último (devolve recursos)</button></div>`;
    html += `<h4>Receitas</h4>`;
    for (const r of recipes) {
      const locked = (r.minLevel ?? 0) > g.state.level;
      const can = !locked && g.canAfford(r.cost) && queue.length + (bd.craft ? 1 : 0) < MAX_QUEUE;
      html += `<div class="jcard ${locked ? 'locked' : ''}"><div class="jn">${r.icon} ${esc(r.name)} <small>· ${SLOT_LABEL[r.slot]}</small></div>
        <div class="jm">${costLabel(r.cost)} · ${r.craftTime}s</div><div class="jd">${esc(r.desc)}</div>
        <div class="jb">${locked ? `<span class="why">🔒 Requer ${levelDef(r.minLevel!).name}</span>` : `<button class="btn primary" data-act="craft" data-arg="${r.id}" ${can ? '' : 'disabled'}>Fabricar</button>`}</div></div>`;
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
    let html = `<div class="lvlcard"><div class="lvlname">⭐ Reputação ${g.state.reputation}</div>
      <div class="hint">Missões cumpridas: ${g.state.stats.missionsDone} · em andamento ${active.length}/${maxActiveMissions(g)} · o quadro renova todo dia</div></div>`;
    if (active.length) {
      html += `<h4>Em andamento</h4>`;
      for (const m of active) {
        const team = g.team(m.teamId);
        const r = MISSION_RANKS[m.rank]!;
        html += `<div class="mcard" style="--c:${r.color}"><div class="mt"><span class="mrank">${r.label}</span>${esc(m.title)}</div>
          <div class="hint">${team ? `<span class="dot" style="--c:${team.color}"></span>${esc(team.name)}` : '—'} · ${this.missionPhase(m)} · ⏳ <span data-t="mt${m.id}"></span></div>
          <div class="bar pg"><i data-b="mp${m.id}"></i><span data-t="mpl${m.id}"></span></div>
          <div class="btnrow"><button class="btn" data-act="m-view" data-arg="${m.id}">📍 Ver</button><button class="btn" data-act="m-abandon" data-arg="${m.id}">Abandonar</button></div></div>`;
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
        <div class="jm">${MISSION_TYPE_LABEL[m.type]} · dificuldade ⚔${missionPower(m)} · ${Math.round(MISSION_TIME)}s · recompensa ${costLabel(missionReward(tpl))} + ${r.xp} XP</div>
        <div class="jd">${esc(tpl.desc)}</div><div class="btnrow">`;
      if (full) html += `<span class="why">Limite de missões simultâneas atingido.</span>`;
      else if (!teams.length) html += `<span class="why">Nenhuma equipe livre. Forme uma em 🥷 Ninjas → Equipes.</span>`;
      else
        for (const tm of teams) {
          const p = teamPower(g, tm);
          const risk = p >= missionPower(m) ? 'p-ok' : p >= missionPower(m) * 0.7 ? 'p-risk' : 'p-bad';
          html += `<button class="btn ${risk}" data-act="m-accept" data-arg="${m.id}" data-team="${tm.id}"><span class="dot" style="--c:${tm.color}"></span>${esc(tm.name)} ⚔${p}</button>`;
        }
      html += `</div></div>`;
    }
    if (ended.length) {
      html += `<h4>Recentes</h4><ul class="reqs">`;
      for (const m of ended) html += `<li class="${m.status === 'done' ? 'ok' : ''}">${m.status === 'done' ? '✅' : '❌'} ${esc(m.title)} <b>${esc(m.result ?? '')}</b></li>`;
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
    html += `<p class="hint">${ninjas.length} ninja(s). Toque para selecionar.</p>`;
    if (!ninjas.length) html += `<p class="hint">Nenhum ninja. Construa a Academia e recrute moradores.</p>`;
    html += `<div class="roster">`;
    for (const u of ninjas) html += this.ninjaRow(u, t, b);
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
    html += `</div><div class="actions"><button class="btn primary" data-act="team-new">＋ Nova equipe</button></div>`;
    if (!g.state.teams.length) html += `<p class="hint">Nenhuma equipe ainda.</p>`;
    return { html, t: {}, b: {} };
  }

  private teamView(tm: Team): Built {
    const g = this.app.game;
    const t: Record<string, string> = {};
    const b: Record<string, number> = {};
    const sensei = g.unit(tm.senseiId);
    const units = teamUnits(g, tm);
    let html = `<div class="ph"><div class="row"><button class="btn" data-act="tab" data-arg="teams">←</button>
      <div class="title teamtag" style="--c:${tm.color}"><span class="dot"></span>${esc(tm.name)}</div></div></div>`;
    html += `<h4>Sensei</h4>`;
    html += sensei ? `<div class="roster">${this.ninjaRow(sensei, t, b, '👑 ')}</div>` : `<p class="hint">Sem sensei. Selecione um Chunin/Jounin e toque em "Sensei de ${esc(tm.name)}".</p>`;
    html += `<h4>Membros (${tm.memberIds.length}/${MAX_MEMBERS})</h4><div class="roster">`;
    for (const id of tm.memberIds) {
      const u = g.unit(id);
      if (u) html += this.ninjaRow(u, t, b);
    }
    html += `</div>`;
    if (tm.memberIds.length < MAX_MEMBERS) html += `<p class="hint">Para adicionar: selecione um ninja → seção Equipe.</p>`;
    const mission = missionOfTeam(g, tm.id);
    html += `<h4>Missão</h4>` + (mission
      ? `<p class="hint">📋 ${esc(mission.title)} (rank ${MISSION_RANKS[mission.rank]!.label}) · ${this.missionPhase(mission)}</p>`
      : `<p class="hint">Livre · força ⚔${teamPower(g, tm)}. Envie em uma missão pela 📋 Mesa de Missões.</p>`);
    if (units.length) {
      const n0 = units[0]!.ninja!;
      html += `<h4>Ordens para a equipe</h4><div class="btnrow">
        <button class="btn primary" data-act="cmd-mode" data-arg="team">📍 Ordem</button>
        <button class="btn" data-act="cmd-retreat" data-arg="team">🏃 Recuar</button>
        <button class="btn" data-act="cmd-clear" data-arg="team">✕ Cancelar</button>
        <button class="btn" data-act="team-autoequip">⚙ Equipar equipe</button></div>
        <h4>Rotina da equipe</h4><div class="seg">`;
      for (const [k, label] of [['auto', 'Auto'], ['train', 'Treinar'], ['patrol', 'Patrulhar']] as [NinjaOrder, string][])
        html += `<button data-act="team-mode" data-arg="${k}" class="${n0.order === k ? 'on' : ''}">${label}</button>`;
      html += `</div>`;
    }
    html += `<div class="actions"><button class="btn danger" data-act="team-disband">${this.armedDemolish ? 'Toque de novo para confirmar' : '🗑 Desfazer equipe'}</button></div>`;
    return { html, t, b };
  }

  // ------------------------------------------------------------------ ações
  private commandIds(v: View, arg: string): number[] {
    const g = this.app.game;
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

  private onChange(e: Event) {
    const t = e.target as HTMLSelectElement;
    if (t.dataset.act === 'focus' && this.view?.kind === 'unit') {
      this.report(setFocus(this.app.game, this.view.id, (t.value || null) as StatKey | null));
    }
  }

  private onClick(e: Event) {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!btn || btn.tagName === 'SELECT') return;
    const g = this.app.game;
    const act = btn.dataset.act;
    const arg = btn.dataset.arg ?? '';
    const v = this.view;
    switch (act) {
      case 'close':
        g.select(null);
        this.show(null);
        return;
      case 'pick': {
        const u = g.unit(Number(arg));
        if (u) {
          g.select({ kind: 'unit', id: u.id });
          this.app.camera.focus(u.x, u.y);
        }
        return;
      }
      case 'tab':
        g.select(null);
        this.show({ kind: arg === 'teams' ? 'teams' : 'roster' });
        return;
      case 'open-team':
        g.select({ kind: 'team', id: Number(arg) });
        return;
      case 'team-new': {
        const tm = createTeam(g);
        g.select({ kind: 'team', id: tm.id });
        return;
      }
    }
    // ordens valem tanto para a tela do ninja quanto para a da equipe
    if ((v?.kind === 'unit' || v?.kind === 'team') && act?.startsWith('cmd-')) {
      const ids = this.commandIds(v, arg);
      if (act === 'cmd-mode') {
        if (!ids.length) return this.report({ ok: false, error: 'Nenhum ninja para receber a ordem.' });
        this.app.orderMode = { ids, label: arg === 'team' || v.kind === 'team' ? 'equipe' : 'ninja' };
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
        case 'upgrade':
          return this.report(upgradeVillage(g));
        case 'craft':
          return this.report(enqueueCraft(g, v.id, arg));
        case 'craft-cancel':
          return this.report(cancelCraft(g, v.id));
        case 'm-accept':
          return this.report(acceptMission(g, Number(arg), Number(btn.dataset.team)));
        case 'm-abandon':
          return this.report(abandonMission(g, Number(arg)));
        case 'm-view': {
          const m = g.state.missions.find((x) => x.id === Number(arg));
          if (m) {
            const p = missionFocus(g, m);
            this.app.camera.focus(p.x, p.y);
          }
          return;
        }
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
