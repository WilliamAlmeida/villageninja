import type { App } from '../app';
import { bus, type ToastKind } from '../core/events';
import { clockLabel, isNight } from '../game/time';
import { arenaSpots, examLabel } from '../game/exam';
import { BOSSES } from '../data/bosses';
import { el, esc, fmt } from './dom';
import { rich } from './icons';
import { MOOD, SEASONS, WEATHERS } from '../data/seasons';
import { daysToNextSeason, moodFactors, seasonOf } from '../game/mood';
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
        <span class="chip" data-tip-tap data-tip-title="Madeira" data-tip="Cortada pelos lenhadores e moradores nas árvores. Usada em quase todas as construções.">{wood} <b data-r="wood"></b></span>
        <span class="chip" data-tip-tap data-tip-title="Pedra" data-tip="Quebrada na pedreira e nas rochas do mapa. Usada em construções e upgrades.">{stone} <b data-r="stone"></b></span>
        <span class="chip" data-tip-tap data-tip-title="Comida" data-tip="Colhida nas fazendas. A população come todo dia e nascimentos gastam comida; sem ela a vila passa fome.">{food} <b data-r="food"></b></span>
        <span class="chip" data-tip-tap data-tip-title="Ryo" data-tip="Dinheiro: impostos dos moradores, mercado, missões e caças. Paga recrutamento, promoções e upgrades.">{ryo} <b data-r="ryo"></b></span>
        <span class="chip adv" data-tip-tap data-tip-title="Ferro" data-tip="Extraído na mina de ferro. Usado na forja para armas e coletes.">{iron} <b data-r="iron"></b></span>
        <span class="chip adv" data-tip-tap data-tip-title="Ervas" data-tip="Colhidas na horta e nas ervas do mapa. Viram remédios na farmácia.">{herbs} <b data-r="herbs"></b></span>
        <span class="chip adv" data-tip-tap data-tip-title="Papel de selo" data-tip="Feito na oficina de selos a partir de madeira. Usado nos papéis-bomba.">{paper} <b data-r="paper"></b></span>
        <span class="chip adv" data-tip-tap data-tip-title="Cristal de chakra" data-tip="Só se acha nas minas (expedições). Usado em equipamentos lendários.">{crystal} <b data-r="crystal"></b></span>
        <span class="chip adv" data-tip-tap data-tip-title="Ouro" data-tip="Achado nas partes fundas das minas. Vale muito: o mercado troca por ryo, e serve em itens lendários.">{gold} <b data-r="gold"></b></span>
        <span class="chip adv" data-tip-tap data-tip-title="Aço negro" data-tip="O metal mais raro, no fundo das minas. A forja faz armas lendárias com ele.">{darksteel} <b data-r="darksteel"></b></span>
        <span class="chip" data-tip-tap data-tip-title="População" data-tip="Moradores e ninjas / vagas de moradia. Construa ou melhore casas para a vila crescer.">{users} <b data-r="pop"></b></span>
        <span class="chip" data-tip-tap data-tip-title="Ninjas" data-tip="Ninjas da vila. Recrute moradores na Academia.">{ninja} <b data-r="ninjas"></b></span>
        <span class="chip mood" data-r="moodchip" data-tip-tap data-tip-title="Felicidade" data-tip=""><span data-r="moodicon"></span> <b data-r="mood"></b></span>
      </div>
      <div class="spacer"></div>
      <div class="clock"><span class="lbl">Dia </span><b data-r="day"></b> · <b data-r="clock"></b> <span data-r="sun"></span> <span class="season" data-r="season" data-tip-tap data-tip-title="Estação e clima" data-tip=""></span></div>
      <div class="speed">
        <button data-speed="0" aria-label="Pausar" data-tip-title="Pausar" data-tip="Pausa o jogo (Espaço).">{pause}</button><button data-speed-cycle class="on" aria-label="Velocidade" data-tip-title="Velocidade" data-tip="Toque para alternar entre 1×, 2× e 3×."><span data-r="speed">1×</span></button>
      </div>
      <button class="iconbtn" data-act="full" aria-label="Tela cheia" data-tip-title="Tela cheia" data-tip="Joga em tela cheia.">{fullscreen}</button>
      <button class="iconbtn" data-act="menu" aria-label="Menu" data-tip-title="Menu" data-tip="Pausa, salvar e configurações (Esc).">{menu}</button>`),
    );
    this.top.querySelectorAll<HTMLElement>('[data-r]').forEach((e) => this.vals.set(e.dataset.r!, e));
    this.top.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('button');
      if (!t) return;
      const s = this.app.home.state;
      if (t.dataset.speed) s.speed = Number(t.dataset.speed);
      // um botão só para a velocidade: 1× → 2× → 3× → 1× (pausado, volta a 1×)
      if (t.hasAttribute('data-speed-cycle')) s.speed = s.speed === 0 ? 1 : (s.speed % 3) + 1;
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
    // alerta de inimigos: a faixa leva a câmera até um inimigo (cada toque, o próximo); "Ficha" ao lado abre o painel dele.
    // A Ficha só aparece no alerta tocado por último (uma por vez: duas faixas com botão poluem a tela)
    const threatRow = el('div', { class: 'threatrow', 'data-b': 'alert', hidden: '' });
    const threat = el('button', { class: 'banner danger', 'data-t': 'threat' }, rich('Inimigos na sua vila — toque para ver'));
    // os avisos de baixo são da vila: olhando a invasão, volta para a vila antes de levar a câmera
    const toHome = () => this.app.viewScene && this.app.setView(false);
    threat.addEventListener('click', () => {
      toHome();
      this.sheetFor = 'threat';
      this.focusFoe('threat', true);
    });
    const sheetBtn = (which: 'threat' | 'boss') => {
      const b = el('button', { class: 'btn danger mini bsheet', 'data-sheet': which, hidden: '', 'data-tip-title': 'Ficha do inimigo', 'data-tip': 'Abre o painel do inimigo em foco (vida, golpes, mandar atacar). A faixa ao lado passa para o próximo.' }, rich('{skull} Ficha'));
      b.addEventListener('click', () => {
        toHome();
        this.openFoe(which);
      });
      return b;
    };
    threatRow.append(threat, sheetBtn('threat'));
    const exam = el('button', { class: 'banner exam', 'data-b': 'exam', hidden: '' });
    exam.addEventListener('click', () => {
      toHome();
      this.focusArena();
    });
    const warn = el('button', { class: 'banner danger', 'data-b': 'bosswarn', hidden: '' });
    warn.addEventListener('click', () => {
      toHome();
      const p = this.app.home.state.pendingBoss;
      if (p) this.app.camera.focus(p.x, p.y);
    });
    const boss = el('button', { class: 'banner boss', 'data-b': 'boss', hidden: '' }, '<span data-t="name"></span><span class="bossbar"><i></i></span>');
    boss.addEventListener('click', () => {
      toHome();
      this.sheetFor = 'boss';
      this.focusFoe('boss', true);
    });
    const bossRow = el('div', { class: 'threatrow', 'data-b': 'bossrow', hidden: '' });
    bossRow.append(boss, sheetBtn('boss'));
    this.alert.append(threatRow, exam, warn, bossRow);

    this.toasts = el('div', { id: 'toasts' });
    bus.on('toast', (t) => this.toast(t.text, t.kind, t.x, t.y, !!t.scene));
  }

  update() {
    const s = this.app.home.state;
    const g = this.app.home;
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
    // raros das minas: só aparecem depois do primeiro achado
    for (const k of ['crystal', 'gold', 'darksteel'] as const) {
      set(k, fmt(s.res[k]));
      this.vals.get(k)!.parentElement!.hidden = s.res[k] <= 0;
    }
    const pop = g.population();
    const cap = g.popCap();
    set('pop', `${pop}/${cap}`);
    set('ninjas', String(s.units.filter((u) => !u.dead && u.kind === 'ninja' && u.faction === 'village').length));
    set('day', String(s.day));
    set('clock', clockLabel(s));
    this.html(this.vals.get('sun')!, isNight(s) ? '{moon}' : '{sun}');
    // felicidade e estação/clima (dicas com o detalhe)
    const mood = Math.round(s.happiness);
    set('mood', String(mood));
    this.html(this.vals.get('moodicon')!, mood >= MOOD.happy ? '{smile}' : mood < 40 ? '{frown}' : '{smile}');
    const chip = this.vals.get('moodchip')!;
    chip.classList.toggle('low', mood < 40);
    chip.classList.toggle('good', mood >= MOOD.happy);
    chip.dataset.tip = `${moodFactors(g).map(([l, v]) => `${l}: ${v > 0 && l !== 'Base' ? '+' : ''}${v}`).join(' · ')}. Feliz: trabalham mais rápido e têm mais filhos; abaixo de ${MOOD.leave}, moradores vão embora.`;
    const season = SEASONS[seasonOf(s)];
    const w = WEATHERS[s.weather];
    this.html(this.vals.get('season')!, `${season.icon}${s.weather !== 'clear' && w.icon !== season.icon ? w.icon : ''}`);
    this.vals.get('season')!.dataset.tip = `${season.name} (faltam ${daysToNextSeason(s)} dia(s)): ${season.desc} Hoje: ${w.name}. ${w.desc}`;
    this.vals.get('food')!.parentElement!.classList.toggle('low', s.res.food < 15);
    this.vals.get('pop')!.parentElement!.classList.toggle('low', pop >= cap);
    this.top.querySelectorAll<HTMLElement>('[data-speed]').forEach((b) => b.classList.toggle('on', Number(b.dataset.speed) === s.speed));
    set('speed', `${s.speed || 1}×`);
    this.top.querySelector('[data-speed-cycle]')!.classList.toggle('on', s.speed > 0);
    this.alert.querySelector<HTMLElement>('[data-b="alert"]')!.hidden = !s.flags.alert;
    if (s.flags.alert) {
      const n = this.threats().length;
      this.html(this.alert.querySelector<HTMLElement>('[data-t="threat"]')!, n > 1 ? `${n} inimigos na sua vila — toque para ver` : 'Inimigos na sua vila — toque para ver');
    }
    const warn = this.alert.querySelector<HTMLElement>('[data-b="bosswarn"]')!;
    warn.hidden = !s.pendingBoss;
    if (s.pendingBoss) {
      const d = BOSSES[s.pendingBoss.kind];
      const label = `${d.name} chega em ${Math.ceil(s.pendingBoss.t)}s — ver`; // a faixa já tem o desenho de alerta
      this.html(warn, label);
    }
    const bosses = s.units.filter((u) => u.boss && !u.dead);
    const bossEl = this.alert.querySelector<HTMLElement>('[data-b="boss"]')!;
    bossEl.hidden = !bosses.length;
    this.alert.querySelector<HTMLElement>('[data-b="bossrow"]')!.hidden = !bosses.length;
    // a Ficha some junto com o alerta dela
    if ((this.sheetFor === 'threat' && !s.flags.alert) || (this.sheetFor === 'boss' && !bosses.length)) this.sheetFor = null;
    this.alert.querySelectorAll<HTMLElement>('[data-sheet]').forEach((b) => (b.hidden = b.dataset.sheet !== this.sheetFor));
    if (bosses.length) {
      const hp = bosses.reduce((a, u) => a + u.hp, 0) / bosses.reduce((a, u) => a + u.maxHp, 0);
      const name = bosses.length > 1 ? `${bosses[0]!.name.split(' ')[0]} ×${bosses.length}` : bosses[0]!.name;
      const heads = bosses.length === 1 && bosses[0]!.heads ? ` · ${bosses[0]!.heads} cabeça(s)` : '';
      this.html(bossEl.querySelector<HTMLElement>('[data-t="name"]')!, `{skull} ${name}${heads}`);
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
    const a = this.app.home.findBuilt('arena');
    if (a) {
      const c = arenaSpots(a).center;
      this.app.camera.focus(c.x, c.y);
      this.app.camera.zoom = Math.max(this.app.camera.zoom, 1.3);
    }
  }

  /** Inimigos dentro da vila agora. */
  private threats() {
    const g = this.app.home;
    return g.state.units.filter((u) => !u.dead && u.faction !== 'village' && g.world.inVillage(u.x, u.y));
  }
  /** Alerta com a Ficha à vista (o tocado por último); null = nenhuma. */
  private sheetFor: 'threat' | 'boss' | null = null;
  /** Em foco em cada alerta: inimigo na vila / chefe. */
  private foeId: Record<'threat' | 'boss', number | null> = { threat: null, boss: null };
  /** O inimigo em foco no alerta: o último mostrado, se ainda vale (senão o primeiro); `next` passa para o seguinte. */
  private foe(which: 'threat' | 'boss', next = false) {
    const list = which === 'threat' ? this.threats() : this.app.home.state.units.filter((u) => u.boss && !u.dead);
    if (!list.length) return null;
    let i = list.findIndex((u) => u.id === this.foeId[which]);
    if (i < 0) i = 0;
    else if (next) i = (i + 1) % list.length;
    this.foeId[which] = list[i]!.id;
    return list[i]!;
  }
  private focusFoe(which: 'threat' | 'boss', next = false) {
    const t = this.foe(which, next);
    if (t) this.app.camera.focus(t.x, t.y);
  }
  /** Abre o painel do inimigo em foco no alerta (e leva a câmera até ele). */
  private openFoe(which: 'threat' | 'boss') {
    const t = this.foe(which);
    if (!t) return;
    this.app.camera.focus(t.x, t.y);
    this.app.home.select({ kind: 'unit', id: t.id });
  }

  toast(text: string, kind: ToastKind, x?: number, y?: number, scene = false) {
    const t = el('div', { class: `toast ${kind}` }, rich(esc(text)));
    if (x != null && y != null) {
      t.classList.add('go');
      t.title = 'Ir até o local';
      // aviso de outro mapa (vila ↔ invasão): troca a tela antes de ir até o local
      t.addEventListener('click', () => {
        if (scene !== this.app.viewScene) this.app.setView(scene);
        this.app.camera.focus(x, y);
      });
    }
    this.toasts.prepend(t);
    while (this.toasts.children.length > MAX_TOASTS) this.toasts.lastElementChild!.remove();
    setTimeout(() => t.classList.add('out'), 3600);
    setTimeout(() => t.remove(), 4000);
  }
}
