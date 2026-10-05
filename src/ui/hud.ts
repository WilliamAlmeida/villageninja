import type { App } from '../app';
import { bus, type ToastKind } from '../core/events';
import { clockLabel, isNight } from '../game/time';
import { levelDef } from '../data/villageLevels';
import { arenaSpots, examLabel } from '../game/exam';
import { BOSSES } from '../data/bosses';
import { el, esc, fmt } from './dom';
import { rich } from './icons';
import { canFullscreen, IOS_HINT, isFullscreen, isIOS, isStandalone, toggleFullscreen, watchFullscreen } from './fullscreen';

const MAX_TOASTS = 4;

/** Barra superior (recursos, relógio, velocidade), alerta e notificações. */
export class Hud {
  readonly top: HTMLElement;
  readonly alert: HTMLElement;
  readonly toasts: HTMLElement;
  onMenu: () => void = () => {};
  private vals = new Map<string, HTMLElement>();

  constructor(private app: App) {
    this.top = el(
      'div',
      { id: 'topbar' },
      rich(`<div class="res">
        <span class="chip" title="Madeira">{wood} <b data-r="wood"></b></span>
        <span class="chip" title="Pedra">{stone} <b data-r="stone"></b></span>
        <span class="chip" title="Comida">{food} <b data-r="food"></b></span>
        <span class="chip" title="Ryo">{ryo} <b data-r="ryo"></b></span>
        <span class="chip adv" title="Ferro">{iron} <b data-r="iron"></b></span>
        <span class="chip adv" title="Ervas">{herbs} <b data-r="herbs"></b></span>
        <span class="chip adv" title="Papel de selo">{paper} <b data-r="paper"></b></span>
        <span class="chip" title="População / moradia">{users} <b data-r="pop"></b></span>
        <span class="chip" title="Ninjas">{ninja} <b data-r="ninjas"></b></span>
      </div>
      <div class="spacer"></div>
      <div class="clock"><span data-r="lvl"></span> <span class="lbl">Dia </span><b data-r="day"></b> · <b data-r="clock"></b> <span data-r="sun"></span></div>
      <div class="speed">
        <button data-speed="0" title="Pausar">{pause}</button><button data-speed="1">1×</button><button data-speed="2">2×</button><button data-speed="3">3×</button>
      </div>
      <button class="iconbtn" data-act="full" title="Tela cheia">{fullscreen}</button>
      <button class="iconbtn" data-act="menu" title="Menu">{menu}</button>`),
    );
    this.top.querySelectorAll<HTMLElement>('[data-r]').forEach((e) => this.vals.set(e.dataset.r!, e));
    this.top.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('button');
      if (!t) return;
      if (t.dataset.speed) this.app.game.state.speed = Number(t.dataset.speed);
      if (t.dataset.act === 'menu') this.onMenu();
      if (t.dataset.act === 'full') {
        if (isIOS() && !canFullscreen()) this.toast(IOS_HINT, 'info');
        else toggleFullscreen();
      }
    });
    this.top.addEventListener('pointerdown', (e) => e.stopPropagation());
    // botão de tela cheia: some quando já está em tela cheia ou aberto como app instalado
    const fullBtn = this.top.querySelector<HTMLElement>('[data-act="full"]')!;
    const syncFull = () => (fullBtn.hidden = isStandalone() || isFullscreen());
    watchFullscreen(syncFull);
    syncFull();
    // no celular pelo navegador, avisa uma vez por sessão que dá para esconder a barra
    if (matchMedia('(pointer: coarse)').matches && !isStandalone()) {
      try {
        if (!sessionStorage.getItem('vn.fullHint')) {
          sessionStorage.setItem('vn.fullHint', '1');
          setTimeout(() => this.toast(isIOS() ? IOS_HINT : 'Toque em {fullscreen} (no alto, à direita) para jogar em tela cheia. No menu dá para instalar como app.', 'info'), 1500);
        }
      } catch {
        /* sem sessionStorage: só não avisa */
      }
    }

    this.alert = el('div', { id: 'banners' });
    const threat = el('button', { class: 'banner danger', 'data-b': 'alert', hidden: '' }, rich('{alert} Inimigos na vila — toque para ver'));
    threat.addEventListener('click', () => this.focusThreat());
    const exam = el('button', { class: 'banner exam', 'data-b': 'exam', hidden: '' });
    exam.addEventListener('click', () => this.focusArena());
    const warn = el('button', { class: 'banner danger', 'data-b': 'bosswarn', hidden: '' });
    warn.addEventListener('click', () => {
      const p = this.app.game.state.pendingBoss;
      if (p) this.app.camera.focus(p.x, p.y);
    });
    const boss = el('button', { class: 'banner boss', 'data-b': 'boss', hidden: '' }, '<span data-t="name"></span><span class="bossbar"><i></i></span>');
    boss.addEventListener('click', () => {
      const b = this.app.game.state.units.find((u) => u.boss && !u.dead);
      if (b) this.app.camera.focus(b.x, b.y);
    });
    this.alert.append(threat, exam, warn, boss);

    this.toasts = el('div', { id: 'toasts' });
    bus.on('toast', (t) => this.toast(t.text, t.kind, t.x, t.y));
  }

  update() {
    const s = this.app.game.state;
    const g = this.app.game;
    const set = (k: string, v: string) => {
      const e = this.vals.get(k);
      if (e && e.textContent !== v) e.textContent = v;
    };
    set('wood', fmt(s.res.wood));
    set('stone', fmt(s.res.stone));
    set('food', fmt(s.res.food));
    set('ryo', fmt(s.res.ryo));
    // recursos avançados só aparecem quando a vila já os usa
    for (const k of ['iron', 'herbs', 'paper'] as const) {
      set(k, fmt(s.res[k]));
      this.vals.get(k)!.parentElement!.hidden = s.res[k] <= 0 && s.level < 1;
    }
    const pop = g.population();
    const cap = g.popCap();
    set('pop', `${pop}/${cap}`);
    set('ninjas', String(s.units.filter((u) => !u.dead && u.kind === 'ninja' && u.faction === 'village').length));
    set('day', String(s.day));
    this.html(this.vals.get('lvl')!, levelDef(s.level).icon);
    this.vals.get('lvl')!.title = levelDef(s.level).name;
    set('clock', clockLabel(s));
    this.html(this.vals.get('sun')!, isNight(s) ? '{moon}' : '{sun}');
    this.vals.get('food')!.parentElement!.classList.toggle('low', s.res.food < 15);
    this.vals.get('pop')!.parentElement!.classList.toggle('low', pop >= cap);
    this.top.querySelectorAll<HTMLElement>('[data-speed]').forEach((b) => b.classList.toggle('on', Number(b.dataset.speed) === s.speed));
    this.alert.querySelector<HTMLElement>('[data-b="alert"]')!.hidden = !s.flags.alert;
    const warn = this.alert.querySelector<HTMLElement>('[data-b="bosswarn"]')!;
    warn.hidden = !s.pendingBoss;
    if (s.pendingBoss) {
      const d = BOSSES[s.pendingBoss.kind];
      const label = `{bell} ${d.icon} ${d.name} chega em ${Math.ceil(s.pendingBoss.t)}s — ver`;
      this.html(warn, label);
    }
    const bosses = s.units.filter((u) => u.boss && !u.dead);
    const bossEl = this.alert.querySelector<HTMLElement>('[data-b="boss"]')!;
    bossEl.hidden = !bosses.length;
    if (bosses.length) {
      const hp = bosses.reduce((a, u) => a + u.hp, 0) / bosses.reduce((a, u) => a + u.maxHp, 0);
      const name = bosses.length > 1 ? `${bosses[0]!.name.split(' ')[0]} ×${bosses.length}` : bosses[0]!.name;
      this.html(bossEl.querySelector<HTMLElement>('[data-t="name"]')!, `{skull} ${name}`);
      bossEl.querySelector<HTMLElement>('.bossbar i')!.style.width = `${Math.max(0, hp) * 100}%`;
    }
    const examBtn = this.alert.querySelector<HTMLElement>('[data-b="exam"]')!;
    examBtn.hidden = !s.exam;
    if (s.exam) {
      const label = `{arena} Exame Chunin — ${examLabel(g)} · assistir`;
      this.html(examBtn, label);
    }
  }

  /** Texto com ícones ({token}); só mexe no DOM quando o texto muda. */
  private html(e: HTMLElement, text: string) {
    if (e.dataset.raw === text) return;
    e.dataset.raw = text;
    e.innerHTML = rich(esc(text));
  }

  private focusArena() {
    const a = this.app.game.findBuilt('arena');
    if (a) {
      const c = arenaSpots(a).center;
      this.app.camera.focus(c.x, c.y);
      this.app.camera.zoom = Math.max(this.app.camera.zoom, 1.3);
    }
  }

  private focusThreat() {
    const g = this.app.game;
    const t = g.state.units.find((u) => !u.dead && u.faction !== 'village' && g.world.inVillage(u.x, u.y));
    if (t) this.app.camera.focus(t.x, t.y);
  }

  toast(text: string, kind: ToastKind, x?: number, y?: number) {
    const t = el('div', { class: `toast ${kind}` }, rich(esc(text)));
    if (x != null && y != null) {
      t.classList.add('go');
      t.title = 'Ir até o local';
      t.addEventListener('click', () => this.app.camera.focus(x, y));
    }
    this.toasts.prepend(t);
    while (this.toasts.children.length > MAX_TOASTS) this.toasts.lastElementChild!.remove();
    setTimeout(() => t.classList.add('out'), 3600);
    setTimeout(() => t.remove(), 4000);
  }
}
