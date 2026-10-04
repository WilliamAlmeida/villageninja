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
import type { Building, NinjaOrder, Unit } from '../game/types';
import { esc, el } from './dom';
import { JOB_LABEL, STATE_LABEL } from './labels';

type View = { kind: 'unit'; id: number; teach?: boolean } | { kind: 'building'; id: number } | { kind: 'roster' };

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
    else if (this.view.kind === 'unit') {
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
      if (isOwn) html += this.ninjaControls(u);
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

  private ninjaControls(u: Unit) {
    const n = u.ninja!;
    const g = this.app.game;
    let html = `<h4>Ordem</h4><div class="seg">`;
    for (const [k, label] of [['auto', 'Auto'], ['train', 'Treinar'], ['patrol', 'Patrulhar']] as [NinjaOrder, string][])
      html += `<button data-act="order" data-arg="${k}" class="${n.order === k ? 'on' : ''}">${label}</button>`;
    html += `</div><label class="hint">Foco do treino<select data-act="focus"><option value="">Aleatório</option>`;
    for (const k of STAT_KEYS) html += `<option value="${k}" ${n.focus === k ? 'selected' : ''}>${STAT_INFO[k].label}</option>`;
    html += `</select></label><div class="actions">`;
    html += `<button class="btn primary" data-act="teach-open">📜 Ensinar jutsu</button>`;
    const next = nextRank(u);
    if (next) {
      const r = RANKS[next];
      const can = n.level >= r.minLevel && g.canAfford(r.promoteCost);
      html += `<button class="btn" data-act="promote" ${can ? '' : 'disabled'}>🎖 Promover a ${r.name} (${costLabel(r.promoteCost)}) ${n.level < r.minLevel ? `· nível ${r.minLevel}` : ''}</button>`;
    }
    html += `<button class="btn" data-act="focus-cam">🎯 Centralizar câmera</button></div>`;
    html += `<p class="hint">Abates: ${n.kills}</p>`;
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

  private roster(): Built {
    const g = this.app.game;
    const ninjas = g.state.units.filter((u) => !u.dead && u.kind === 'ninja' && u.faction === 'village');
    const t: Record<string, string> = {};
    const b: Record<string, number> = {};
    let html = `<div class="ph"><div class="title">🥷 Ninjas (${ninjas.length})</div></div>`;
    if (!ninjas.length) html += `<p class="hint">Nenhum ninja. Construa a Academia e recrute moradores.</p>`;
    html += `<div class="roster">`;
    for (const u of ninjas) {
      const n = u.ninja!;
      const nat = NATURES[n.nature];
      const js = n.jutsu.filter(Boolean).map((id) => JUTSUS[id!]!.shout.replace('!', '')).join(', ') || 'sem jutsu';
      html += `<button class="rrow" data-act="pick" data-arg="${u.id}"><span class="rn">${esc(u.name)}</span>
        <span class="badges"><span class="badge rank">${RANKS[n.rank].name}</span><span class="badge nat" style="--c:${nat.color}">${nat.kanji}</span><span class="badge">Nv ${n.level}</span></span>
        <span class="rm">${esc(js)} · <span data-t="st${u.id}"></span></span><span class="mini"><i data-b="hp${u.id}"></i></span></button>`;
      t[`st${u.id}`] = STATE_LABEL[u.state] ?? u.state;
      b[`hp${u.id}`] = u.hp / u.maxHp;
    }
    html += `</div>`;
    return { html, t, b };
  }

  // ------------------------------------------------------------------ ações
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
      }
    }
    if (v?.kind === 'building') {
      switch (act) {
        case 'workers':
          return this.report(setDesiredWorkers(g, v.id, Number(arg)));
        case 'recruit':
          return this.report(recruitNinja(g));
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
