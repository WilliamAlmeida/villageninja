import type { App } from '../app';
import { BUILDING_LIST, BUILDINGS, type BuildingType, defOf } from '../data/buildings';
import { canBuild, canMove, costLabel, moveBuilding, placeBuilding, shoreSpot } from '../game/commands';
import { toTile } from '../game/world';
import { levelDef } from '../data/villageLevels';
import { plainTokens } from '../core/tokens';
import { MAX_BUILDING_LEVEL, UPGRADES } from '../data/upgrades';
import { lackRows, showAlert, tipAttr } from './popup';
import { el } from './dom';
import { rich } from './icons';
import { artUrl } from '../render/art';
import { isShown, setShown } from './anim';
import { pave, ROAD, unpave } from '../game/roads';
import { CLEAR, markClear, toClear } from '../game/clearing';
import { EARTH, markEarth, unmarkEarth } from '../game/earthworks';
import { TILE } from '../config';
import { DECO_MOOD_MAX } from '../game/mood';

/** Dica do card (texto puro): o que faz e o custo. */
const plainInfo = (d: (typeof BUILDINGS)[BuildingType]) => `${plainTokens(d.desc)}${d.mood ? `
+${d.mood} de felicidade` : ''}
Custo: ${plainTokens(costLabel(d.cost))}`;

/** Menu de construção + modo de posicionamento (fantasma no mapa), usado também para mover prédios prontos. */
export class BuildUI {
  readonly bar: HTMLElement;
  readonly place: HTMLElement;
  onExit: () => void = () => {};
  /** Prédio sendo mudado de lugar (null = construindo um novo). */
  private moveId: number | null = null;

  constructor(private app: App) {
    this.bar = el('div', { id: 'buildbar', hidden: '' });
    // prédios primeiro; depois a seção Decoração, que começa pela rua calçada (pintada arrastando no mapa)
    const list = [...BUILDING_LIST.filter((d) => d.buildable && !d.deco), null, ...BUILDING_LIST.filter((d) => d.buildable && d.deco)];
    for (const d of list) {
      if (!d) {
        this.bar.appendChild(el('div', { class: 'bsep' }, 'Decoração'));
        this.bar.appendChild(
          el(
            'button',
            { class: 'bcard road', 'data-road': '1', 'data-tip-title': 'Rua calçada', 'data-tip': `Arraste no mapa para calçar. Quem anda na rua vai ${Math.round((ROAD.speed - 1) * 100)}% mais rápido e o caminho prefere ela.
Custo: ${plainTokens(costLabel(ROAD.cost))} por tile` },
            rich(`<span class="i">{road}</span><span class="n">Rua calçada</span><span class="c">${costLabel(ROAD.cost)} / tile</span><span class="lock"></span>`),
          ),
        );
        // limpar área: marca árvores, tocos e pedras para os moradores sem obra arrancarem (game/clearing.ts)
        this.bar.appendChild(
          el(
            'button',
            { class: 'bcard road', 'data-clear': '1', 'data-tip-title': 'Limpar área', 'data-tip': `Arraste no mapa sobre árvores, tocos, rochas e veios. Os moradores sem obra vão lá e arrancam: o que ainda estava de pé rende o que sobrava. O lugar fica limpo e só brota de novo depois de ${CLEAR.regrowMult}× o tempo normal.` },
            rich(`<span class="i">{axe}</span><span class="n">Limpar área</span><span class="c">grátis</span><span class="lock"></span>`),
          ),
        );
        // aterrar e cavar: o terreno muda tile a tile pelo trabalho dos moradores (game/earthworks.ts)
        this.bar.appendChild(
          el(
            'button',
            { class: 'bcard road', 'data-earth': 'fill', 'data-tip-title': 'Aterrar', 'data-tip': `Arraste sobre a água para virar terra. Os moradores sem obra aterram da margem para dentro (o meio do lago espera a margem chegar).
Custo: ${plainTokens(costLabel(EARTH.fillCost))} por tile (devolvido se desmarcar)` },
            rich(`<span class="i">{stone}</span><span class="n">Aterrar</span><span class="c">${costLabel(EARTH.fillCost)} / tile</span><span class="lock"></span>`),
          ),
        );
        this.bar.appendChild(
          el(
            'button',
            { class: 'bcard road', 'data-earth': 'dig', 'data-tip-title': 'Cavar', 'data-tip': 'Arraste sobre a terra para virar água (lago, canal, beira para o Porto). Os moradores sem obra cavam. Árvore e pedra no caminho: limpe a área antes.' },
            rich(`<span class="i">{drop}</span><span class="n">Cavar</span><span class="c">grátis</span><span class="lock"></span>`),
          ),
        );
        continue;
      }
      this.bar.appendChild(
        el(
          'button',
          { class: 'bcard', 'data-type': d.type, 'data-tip-title': d.name, 'data-tip': plainInfo(d) },
          rich(`${artUrl(d.type) ? `<img class="bg" src="${artUrl(d.type)}" alt="" draggable="false">` : ''}<span class="i">${d.icon}</span><span class="n">${d.name}</span><span class="c">${costLabel(d.cost)}</span><span class="lock"></span>
            <span class="info" data-info title="Detalhes">{info}</span>`),
        ),
      );
    }
    this.bar.addEventListener('click', (e) => {
      if (this.dragged) return; // foi um arraste, não um clique no card
      if ((e.target as HTMLElement).closest('[data-road]')) {
        this.startRoad();
        return;
      }
      if ((e.target as HTMLElement).closest('[data-clear]')) {
        this.startRoad('clear');
        return;
      }
      const earth = (e.target as HTMLElement).closest<HTMLElement>('[data-earth]')?.dataset.earth as 'fill' | 'dig' | undefined;
      if (earth) {
        this.earthOp = earth;
        this.startRoad(earth);
        return;
      }
      const c = (e.target as HTMLElement).closest<HTMLElement>('[data-type]');
      if (!c) return;
      const type = c.dataset.type as BuildingType;
      if ((e.target as HTMLElement).closest('[data-info]')) this.info(type);
      else this.start(type);
    });
    this.enableMouseScroll();
    this.bar.addEventListener('pointerdown', (e) => e.stopPropagation());

    this.place = el(
      'div',
      { id: 'placebar', hidden: '' },
      rich(`<span class="hint" data-t="name"></span><button class="btn icon" data-act="cancel" title="Cancelar">{x}</button><button class="btn primary" data-act="ok">{check} Construir</button>`),
    );
    this.place.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
      if (a === 'cancel') this.cancel();
      if (a === 'ok') this.confirm();
    });
    this.place.addEventListener('pointerdown', (e) => e.stopPropagation());

    this.roadBar = el(
      'div',
      { id: 'roadbar', class: 'placebar', hidden: '' },
      rich(`<span class="hint" data-t="road"></span><button class="btn tog" data-act="erase">{eraser} Tirar</button><button class="btn primary" data-act="done">{check} Pronto</button>`),
    );
    this.roadBar.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
      if (a === 'erase') {
        const m = this.app.roadMode;
        this.app.roadMode =
          m === 'erase' ? 'pave' : m === 'pave' ? 'erase' : m === 'clear' ? 'unclear' : m === 'unclear' ? 'clear' : m === 'unearth' ? this.earthOp : 'unearth';
        this.roadHint();
      }
      if (a === 'done') this.exit();
    });
    this.roadBar.addEventListener('pointerdown', (e) => e.stopPropagation());
  }

  readonly roadBar: HTMLElement;
  /** Último tile pintado no arraste (para preencher o caminho quando o dedo anda rápido). */
  private lastRoad: { tx: number; ty: number } | null = null;
  private roadMsg = '';

  /** Última obra de terreno escolhida (o "Desmarcar" volta para ela). */
  private earthOp: 'fill' | 'dig' = 'fill';

  /** Entra no modo de pintar ruas (ou de marcar a área a limpar, ou de aterrar/cavar). */
  private startRoad(mode: 'pave' | 'clear' | 'fill' | 'dig' = 'pave') {
    setShown(this.bar, false);
    this.app.roadMode = mode;
    this.lastRoad = null;
    this.roadBar.hidden = false;
    this.roadHint();
  }

  private roadHint() {
    const m = this.app.roadMode;
    const clearing = m === 'clear' || m === 'unclear';
    const earth = m === 'fill' || m === 'dig' || m === 'unearth';
    const erase = m === 'erase' || m === 'unclear' || m === 'unearth';
    const btn = this.roadBar.querySelector('[data-act="erase"]')!;
    btn.classList.toggle('on', erase);
    btn.innerHTML = rich(clearing || earth ? '{eraser} Desmarcar' : '{eraser} Tirar');
    const works = this.app.home.state.earthworks ?? [];
    const msg = earth
      ? m === 'unearth'
        ? '{eraser} Arraste no mapa para desmarcar'
        : m === 'fill'
          ? `{stone} Arraste sobre a água para aterrar · ${costLabel(EARTH.fillCost)} por tile · ${works.filter((e) => e.op === 'fill').length} marcados`
          : `{drop} Arraste sobre a terra para cavar · ${works.filter((e) => e.op === 'dig').length} marcados`
      : clearing
      ? m === 'unclear'
        ? '{axe} Arraste no mapa para desmarcar'
        : `{axe} Arraste sobre árvores, tocos e pedras para mandar limpar · ${toClear(this.app.home.state).length} marcados`
      : erase
        ? '{road} Arraste no mapa para tirar a rua'
        : `{road} Arraste no mapa para calçar · ${costLabel(ROAD.cost)} por tile`;
    this.roadBar.querySelector('[data-t="road"]')!.innerHTML = rich(this.roadMsg ? `${msg} · <b>${this.roadMsg}</b>` : msg);
  }

  /** Calça (ou tira) o tile sob o ponto e os do meio desde o último, num arraste. `tap` = toque solto. */
  paintRoad(wx: number, wy: number, tap: boolean, done = false) {
    const g = this.app.home;
    const tx = Math.floor(wx / TILE);
    const ty = Math.floor(wy / TILE);
    const from = tap || !this.lastRoad ? { tx, ty } : this.lastRoad;
    const n = Math.max(Math.abs(tx - from.tx), Math.abs(ty - from.ty), 1);
    let why: string | null = null;
    for (let i = 0; i <= n; i++) {
      const x = Math.round(from.tx + ((tx - from.tx) * i) / n);
      const y = Math.round(from.ty + ((ty - from.ty) * i) / n);
      const m = this.app.roadMode;
      if (m === 'clear' || m === 'unclear') markClear(g, x, y, m === 'clear');
      else if (m === 'unearth') unmarkEarth(g, x, y);
      else if (m === 'fill' || m === 'dig') {
        const r = markEarth(g, x, y, m);
        if (!r.ok && r.error !== 'Já está marcado.' && r.error !== 'Aqui já é terra.' && r.error !== 'Aqui já é água.') why = r.error;
      }
      else if (this.app.roadMode === 'erase') unpave(g, x, y);
      else {
        const r = pave(g, x, y);
        if (!r.ok && r.error !== 'Já é rua.') why = r.error;
      }
    }
    this.lastRoad = done || tap ? null : { tx, ty };
    const msg = why ?? '';
    if (msg !== this.roadMsg || (this.app.roadMode !== 'pave' && this.app.roadMode !== 'erase')) {
      this.roadMsg = msg;
      this.roadHint();
    }
    g.rev++;
  }

  private dragged = false;

  /** No desktop: arrastar com o mouse e a roda do mouse rolam a barra na horizontal (no toque o navegador já faz). */
  private enableMouseScroll() {
    const bar = this.bar;
    let startX = 0;
    let startScroll = 0;
    let down = false;
    bar.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = true;
      this.dragged = false;
      startX = e.clientX;
      startScroll = bar.scrollLeft;
    });
    window.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (!this.dragged && Math.abs(dx) > 6) {
        this.dragged = true;
        bar.classList.add('dragging');
      }
      if (this.dragged) bar.scrollLeft = startScroll - dx;
    });
    window.addEventListener('pointerup', () => {
      if (!down) return;
      down = false;
      bar.classList.remove('dragging');
      // o click vem logo depois do pointerup: só libera o próximo clique depois dele
      setTimeout(() => (this.dragged = false));
    });
    bar.addEventListener(
      'wheel',
      (e) => {
        if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
        e.preventDefault();
        bar.scrollLeft += e.deltaY;
      },
      { passive: false },
    );
  }

  get open() {
    return isShown(this.bar);
  }

  toggle(show = !isShown(this.bar)) {
    setShown(this.bar, show);
    if (show) this.update();
  }

  update() {
    if (this.bar.hidden) return;
    const road = this.bar.querySelector('[data-road]');
    if (road) road.classList.toggle('off', !this.app.home.canAfford(ROAD.cost));
    const g = this.app.home;
    this.bar.querySelectorAll<HTMLElement>('[data-type]').forEach((c) => {
      const type = c.dataset.type as BuildingType;
      // prédio único que a vila já tem (pronto ou em obra) sai da lista; volta se for demolido
      const have = !!BUILDINGS[type].unique && g.state.buildings.some((b) => b.type === type);
      if (c.hidden !== have) c.hidden = have;
      if (have) return;
      const r = canBuild(g, type);
      c.classList.toggle('off', !r.ok);
      const min = BUILDINGS[c.dataset.type as BuildingType].minLevel ?? 0;
      const lock = min > this.app.home.state.level ? `{lock} ${levelDef(min).name}` : '';
      const le = c.querySelector('.lock')!;
      if (le.getAttribute('data-raw') !== lock) {
        le.setAttribute('data-raw', lock);
        le.innerHTML = rich(lock);
      }
    });
  }

  /** Cartão com o que o prédio faz, antes de construir (o "i" do card). */
  info(type: BuildingType) {
    const g = this.app.home;
    const d = BUILDINGS[type];
    const r = canBuild(g, type);
    const up = UPGRADES[type];
    const facts = [
      d.workers && `${d.workers} trabalhador(es)`,
      `Tamanho ${d.w}×${d.h}`,
      `Obra: ${d.buildTime}s`,
      d.unique && 'Só um por vila',
      d.walkable && 'Dá para andar por cima',
      d.mood && `+${d.mood} de felicidade (decorações somam até ${DECO_MOOD_MAX})`,
    ].filter(Boolean);
    const lack = lackRows(g, d.cost);
    const rows = [`<span class="lbl">Custo</span> ${costLabel(d.cost)}`];
    // só o que o prédio faz ao ficar pronto; os níveis seguintes aparecem no cartão de melhoria dele depois de construído
    if (up) rows.push(`<span class="lbl">Nível 1</span><span class="perk">${up.perks[0]}</span><span class="lvtag" ${tipAttr('Melhorias', `Depois de pronto, o prédio sobe até o nível ${MAX_BUILDING_LEVEL} (cartão de melhoria no painel dele).`, true)}>até Nv ${MAX_BUILDING_LEVEL}</span>`);
    if (!r.ok) rows.push(...(lack.length ? lack : [`{lock} ${r.error}`]));
    const img = artUrl(type);
    const summary = `${d.desc}<br><small>${facts.join(' · ')}</small>`;
    showAlert({
      kind: 'info',
      title: `${d.name}`,
      extra: `<div class="binfo">${img ? `<div class="aimg build"><img src="${img}" alt=""></div>` : ''}<div class="ainfo"><p>${summary}</p></div></div>`,
      rows,
      action: { label: '{hammer} Construir', run: () => this.start(type), disabled: !r.ok },
    });
  }

  private start(type: BuildingType) {
    const r = canBuild(this.app.home, type);
    if (!r.ok) {
      // mesmo aviso com o que falta (em vez de um toast que some)
      this.info(type);
      return;
    }
    const cam = this.app.camera;
    const d = BUILDINGS[type];
    this.moveId = null;
    this.app.buildType = type;
    const c = cam.centerWorld();
    this.setGhost(toTile(c.x) - Math.floor(d.w / 2), toTile(c.y) - Math.floor(d.h / 2));
    this.showPlacebar(`${d.icon} ${d.name} — toque no mapa para posicionar`, '{check} Construir');
  }

  /** Entra no modo de mover um prédio já existente. */
  startMove(id: number) {
    const b = this.app.home.building(id);
    if (!b) return;
    const d = defOf(b);
    this.moveId = id;
    this.app.buildType = b.type;
    this.app.ghost = { type: b.type, tx: b.tx, ty: b.ty, valid: false, flip: !!b.flip };
    this.showPlacebar(`{refresh} Mover ${d.name} — toque no novo lugar`, '{check} Mover aqui');
  }

  private showPlacebar(label: string, ok: string) {
    setShown(this.bar, false);
    this.place.hidden = false;
    this.place.querySelector('[data-t="name"]')!.innerHTML = rich(label);
    this.place.querySelector('[data-act="ok"]')!.innerHTML = rich(ok);
  }

  private validAt(tx: number, ty: number, flip = false) {
    const type = this.app.buildType!;
    return this.moveId != null ? canMove(this.app.home, this.moveId, tx, ty, flip).ok : this.app.home.world.canPlace(type, tx, ty, flip);
  }

  /** Chamado pelo toque no mapa durante o modo de construção. */
  tapWorld(wx: number, wy: number) {
    const type = this.app.buildType;
    if (!type) return;
    const d = BUILDINGS[type];
    this.setGhost(toTile(wx) - Math.floor(d.w / 2), toTile(wy) - Math.floor(d.h / 2));
  }

  private setGhost(tx: number, ty: number) {
    const type = this.app.buildType!;
    const gh = this.app.ghost;
    if (gh && gh.type === type && ((gh.tx === tx && gh.ty === ty) || (gh.at?.tx === tx && gh.at?.ty === ty))) return;
    // prédio de margem: gruda na beira da água mais perto, já com o lado (espelhado ou não) que encaixa
    if (BUILDINGS[type].shore) {
      const spot = shoreSpot(this.app.home, type, tx, ty, this.moveId ?? undefined);
      if (spot) {
        this.app.ghost = { type, tx: spot.tx, ty: spot.ty, flip: spot.flip, valid: this.validAt(spot.tx, spot.ty, spot.flip), at: { tx, ty } };
        return;
      }
    }
    this.app.ghost = { type, tx, ty, valid: this.validAt(tx, ty), at: { tx, ty } };
  }

  refreshGhost() {
    const gh = this.app.ghost;
    if (gh) gh.valid = this.validAt(gh.tx, gh.ty, gh.flip);
  }

  confirm() {
    const gh = this.app.ghost;
    if (!gh) return;
    const r = this.moveId != null ? moveBuilding(this.app.home, this.moveId, gh.tx, gh.ty, gh.flip) : placeBuilding(this.app.home, gh.type, gh.tx, gh.ty, gh.flip);
    if (!r.ok) {
      this.app.home.toast(r.error, 'warn');
      return;
    }
    this.exit();
  }

  cancel() {
    if (this.app.roadMode) {
      this.exit();
      this.toggle(true);
      return;
    }
    const moving = this.moveId != null;
    this.exit();
    if (!moving) this.toggle(true);
  }

  exit() {
    this.app.ghost = null;
    this.app.buildType = null;
    this.app.roadMode = null;
    this.roadBar.hidden = true;
    this.roadMsg = '';
    this.moveId = null;
    this.place.hidden = true;
    this.onExit();
  }
}
