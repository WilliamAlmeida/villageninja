import type { App } from '../app';
import { BUILDING_LIST, BUILDINGS, type BuildingType, defOf } from '../data/buildings';
import { canBuild, canMove, costLabel, moveBuilding, placeBuilding, placeError, shoreSpot } from '../game/commands';
import { isShore, toTile } from '../game/world';
import { levelDef } from '../data/villageLevels';
import { plainTokens } from '../core/tokens';
import { MAX_BUILDING_LEVEL, UPGRADES } from '../data/upgrades';
import { lackRows, showAlert, tipAttr } from './popup';
import { el } from './dom';
import { rich } from './icons';
import { artUrl } from '../render/art';
import { isShown, setShown } from './anim';
import { commitRoads, draftPaves, draftRoad, ROAD, roadCost, roadWith } from '../game/roads';
import { CLEAR, markClear, toClear } from '../game/clearing';
import type { ResourceNode } from '../game/types';
import { EARTH, earthworkAt, markEarth, unmarkEarth } from '../game/earthworks';
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
      rich(`<span class="hint" data-t="name"></span><span class="why" data-t="why" hidden></span><button class="btn icon" data-act="cancel" title="Cancelar">{x}</button><button class="btn" data-act="rotate" ${tipAttr('Girar', 'Espelha o prédio: a frente passa para o outro lado (no desktop, tecla R).')}>{refresh} Girar</button><button class="btn primary" data-act="ok">{check} Construir</button>`),
    );
    this.place.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
      if (a === 'cancel') this.cancel();
      if (a === 'rotate') this.rotate();
      if (a === 'ok') this.confirm();
    });
    this.place.addEventListener('pointerdown', (e) => e.stopPropagation());

    this.roadBar = el(
      'div',
      { id: 'roadbar', class: 'placebar', hidden: '' },
      rich(`<span class="hint" data-t="road"></span><button class="btn icon corner" data-act="cancel" ${tipAttr('Cancelar', 'Sai do modo; as ruas pintadas e ainda não confirmadas são descartadas.')}>{x}</button><button class="btn primary" data-act="done">{check} Pronto</button>`),
    );
    this.roadBar.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
      if (a === 'cancel') this.cancel();
      if (a === 'done') {
        // o rascunho da rua só vale aqui: paga e calça (ou tira) de uma vez
        const g = this.app.home;
        if (this.app.roadDraft.size && commitRoads(g, this.app.roadDraft)) g.rev++;
        this.exit();
      }
    });
    this.roadBar.addEventListener('pointerdown', (e) => e.stopPropagation());
  }

  readonly roadBar: HTMLElement;
  /** Último tile pintado no arraste (para preencher o caminho quando o dedo anda rápido). */
  private lastRoad: { tx: number; ty: number } | null = null;
  private roadMsg = '';

  /**
   * Traço atual tira em vez de pôr: decidido no primeiro tile (em cima de rua/marca, tira; senão, põe) e mantido até
   * soltar, para o arraste não ficar alternando. null = nenhum traço em andamento.
   */
  private strokeDel: boolean | null = null;

  /** Entra no modo de pintar ruas (ou de marcar a área a limpar, ou de aterrar/cavar). */
  private startRoad(mode: 'pave' | 'clear' | 'fill' | 'dig' = 'pave') {
    setShown(this.bar, false);
    this.app.roadMode = mode;
    this.lastRoad = null;
    this.strokeDel = null;
    this.roadBar.hidden = false;
    this.roadHint();
  }

  private roadHint() {
    const m = this.app.roadMode;
    const works = this.app.home.state.earthworks ?? [];
    const msg =
      m === 'fill'
        ? `{stone} Toque ou arraste sobre a água para aterrar · ${costLabel(EARTH.fillCost)} por tile · ${works.filter((e) => e.op === 'fill').length} marcados`
        : m === 'dig'
          ? `{drop} Toque ou arraste sobre a terra para cavar · ${works.filter((e) => e.op === 'dig').length} marcados`
          : m === 'clear'
            ? `{axe} Toque ou arraste sobre árvores, tocos e pedras para mandar limpar · ${toClear(this.app.home.state).length} marcados`
            : this.roadDraftHint();
    const raw = this.roadMsg ? `${msg} · <b>${this.roadMsg}</b>` : msg;
    const e = this.roadBar.querySelector<HTMLElement>('[data-t="road"]')!;
    if (e.dataset.raw === raw) return; // o arraste chama a cada movimento
    e.dataset.raw = raw;
    e.innerHTML = rich(raw);
  }

  /** Rua: o que o rascunho tem até agora (nada é pago antes do "Pronto"). */
  private roadDraftHint() {
    const d = this.app.roadDraft;
    const add = draftPaves(d);
    const del = d.size - add;
    const pend = [add && `${add} a calçar · ${costLabel(roadCost(add))}`, del && `${del} a tirar`].filter(Boolean).join(' · ');
    const base = `{road} Toque ou arraste para calçar · ${costLabel(ROAD.cost)} por tile`;
    return pend ? `${base} · ${pend}` : base;
  }

  /** O toque/traço começando aqui tira (já tem rua, marca de limpar ou de terreno) em vez de pôr? */
  private removesAt(tx: number, ty: number, node: ResourceNode | null): boolean {
    const g = this.app.home;
    const m = this.app.roadMode;
    if (m === 'pave') return roadWith(g.state, this.app.roadDraft, tx, ty);
    if (m === 'clear') return !!node?.clear;
    return !!earthworkAt(g.state, tx, ty);
  }

  /**
   * Recurso sob o ponto da tela (limpar área): a arte fica em pé acima do tile, então o toque na copa da árvore conta.
   * Entre os que o ponto toca, o de tronco mais perto na horizontal (empate: o da frente, desenhado por cima).
   */
  pickNode(sx: number, sy: number): ResourceNode | null {
    const cam = this.app.camera;
    const w = cam.screenToWorld(sx, sy);
    const z = cam.zoom;
    let best: ResourceNode | null = null;
    let bestD = Infinity;
    let bestY = -Infinity;
    for (const n of this.app.home.state.nodes) {
      if (n.cleared) continue;
      const cx = n.tx * TILE + TILE / 2;
      const cy = n.ty * TILE + TILE / 2;
      if (Math.abs(cx - w.x) > TILE * 5 || Math.abs(cy - w.y) > TILE * 5) continue;
      const p = cam.worldToScreen(cx, cy);
      // segmento do pé ao alto da arte (árvore ~55 px de cena, o resto ~14), com folga de ~18 px
      const top = p.y - (n.type === 'tree' && n.amount > 0 ? 55 : 14) * z;
      const dy = sy > p.y ? sy - p.y : sy < top ? top - sy : 0;
      const dist = Math.hypot(sx - p.x, dy);
      if (dist > 18 * z) continue;
      if (dist < bestD - 2 * z || (dist <= bestD + 2 * z && p.y > bestY)) {
        bestD = dist;
        bestY = p.y;
        best = n;
      }
    }
    return best;
  }

  /** Mouse sobre o mapa num modo de pintar: o tile (ou o recurso, ao limpar) que o clique vai pegar. */
  hoverPaint(sx: number, sy: number) {
    if (this.app.roadMode === 'clear') {
      const n = this.pickNode(sx, sy);
      this.app.roadHover = n ? { tx: n.tx, ty: n.ty, del: !!n.clear } : null;
      return;
    }
    const w = this.app.camera.screenToWorld(sx, sy);
    const tx = Math.floor(w.x / TILE);
    const ty = Math.floor(w.y / TILE);
    this.app.roadHover = { tx, ty, del: this.removesAt(tx, ty, null) };
  }

  /**
   * Pinta o tile sob o ponto e os do meio desde o último, num arraste. `tap` = toque solto. O primeiro tile decide se
   * o traço põe ou tira (em cima do que já está calçado/marcado, tira). Rua vai para o rascunho (só vale no "Pronto");
   * limpar e aterrar/cavar marcam na hora. `sx, sy` (tela): ao limpar, toque e arraste pegam só os recursos por onde o
   * ponteiro passa de fato (`sx0, sy0` = onde o arraste começou).
   */
  paintRoad(wx: number, wy: number, tap: boolean, done = false, sx?: number, sy?: number, sx0?: number, sy0?: number) {
    const g = this.app.home;
    const tx = Math.floor(wx / TILE);
    const ty = Math.floor(wy / TILE);
    const m = this.app.roadMode;
    // o traço decide pôr/tirar pelo recurso onde começou (o primeiro evento do arraste já vem com o ponteiro andado)
    const picked = m === 'clear' && sx != null && sy != null && (tap || this.strokeDel == null) ? this.pickNode(tap ? sx : (sx0 ?? sx), tap ? sy : (sy0 ?? sy)) : null;
    const del = this.strokeDel ?? this.removesAt(tx, ty, picked);
    this.strokeDel = done || tap ? null : del;
    if (m === 'clear') {
      if (tap || sx == null || sy == null) {
        if (picked) markClear(g, picked.tx, picked.ty, !del, 0);
      } else {
        // arraste: amostra a linha na tela desde o último ponto (ou o começo do traço), a cada ~6 px
        const a = this.lastScreen ?? { x: sx0 ?? sx, y: sy0 ?? sy };
        const k = Math.max(1, Math.ceil(Math.hypot(sx - a.x, sy - a.y) / 6));
        for (let i = 0; i <= k; i++) {
          const nd = this.pickNode(a.x + ((sx - a.x) * i) / k, a.y + ((sy - a.y) * i) / k);
          if (nd) markClear(g, nd.tx, nd.ty, !del, 0);
        }
      }
      this.lastScreen = done || tap || sx == null || sy == null ? null : { x: sx, y: sy };
      this.lastRoad = null;
      this.roadHint();
      g.rev++;
      return;
    }
    const from = tap || !this.lastRoad ? { tx, ty } : this.lastRoad;
    const n = Math.max(Math.abs(tx - from.tx), Math.abs(ty - from.ty), 1);
    let why: string | null = null;
    for (let i = 0; i <= n; i++) {
      const x = Math.round(from.tx + ((tx - from.tx) * i) / n);
      const y = Math.round(from.ty + ((ty - from.ty) * i) / n);
      if ((m === 'fill' || m === 'dig') && del) unmarkEarth(g, x, y);
      else if (m === 'fill' || m === 'dig') {
        const r = markEarth(g, x, y, m);
        if (!r.ok && r.error !== 'Já está marcado.' && r.error !== 'Aqui já é terra.' && r.error !== 'Aqui já é água.') why = r.error;
      } else why = draftRoad(g, this.app.roadDraft, x, y, !del) ?? why;
    }
    this.lastRoad = done || tap ? null : { tx, ty };
    this.roadMsg = why ?? '';
    this.roadHint();
    g.rev++;
  }

  /** Último ponto de tela do arraste ao limpar (para amostrar o caminho). */
  private lastScreen: { x: number; y: number } | null = null;

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
    this.app.ghost = { type: b.type, tx: b.tx, ty: b.ty, valid: false, flip: !!b.flip, level: b.level, moveId: b.id, moveFrom: { tx: b.tx, ty: b.ty, w: d.w, h: d.h } };
    this.showPlacebar(`{refresh} Mover ${d.name} — toque no novo lugar`, '{check} Mover aqui');
  }

  private showPlacebar(label: string, ok: string) {
    setShown(this.bar, false);
    this.place.hidden = false;
    this.place.querySelector('[data-t="name"]')!.innerHTML = rich(label);
    this.place.querySelector('[data-act="ok"]')!.innerHTML = rich(ok);
  }

  /** O lugar vale? Se não, o motivo aparece na barra (antes só saía ao confirmar, e com o mouse nem isso). */
  private validAt(tx: number, ty: number, flip = false) {
    const type = this.app.buildType!;
    const g = this.app.home;
    let why: string | null = null;
    if (this.moveId != null) {
      const r = canMove(g, this.moveId, tx, ty, flip);
      if (!r.ok) why = r.error;
    } else if (!g.world.canPlace(type, tx, ty, flip)) why = placeError(g, type, tx, ty, 1, flip);
    const e = this.place.querySelector<HTMLElement>('[data-t="why"]')!;
    e.hidden = !why;
    if (why && e.textContent !== why) e.textContent = why;
    return !why;
  }

  /** Chamado pelo toque no mapa durante o modo de construção. */
  tapWorld(wx: number, wy: number) {
    const type = this.app.buildType;
    if (!type) return;
    const d = defOf({ type, flip: this.app.ghost?.flip, level: this.app.ghost?.level });
    this.setGhost(toTile(wx) - Math.floor(d.w / 2), toTile(wy) - Math.floor(d.h / 2));
  }

  private setGhost(tx: number, ty: number) {
    const type = this.app.buildType!;
    const gh = this.app.ghost;
    if (gh && gh.type === type && ((gh.tx === tx && gh.ty === ty) || (gh.at?.tx === tx && gh.at?.ty === ty))) return;
    // prédio de margem: gruda na beira da água mais perto, já com o lado (espelhado ou não) que encaixa
    if (isShore({ type, level: gh?.type === type ? gh.level : undefined })) {
      const same = gh?.type === type;
      const spot = shoreSpot(this.app.home, type, tx, ty, this.moveId ?? undefined, 4, same ? (gh.level ?? 1) : 1, same && gh.flipLocked ? !!gh.flip : undefined);
      if (spot) {
        this.app.ghost = { type, tx: spot.tx, ty: spot.ty, flip: spot.flip, level: gh?.level, moveId: gh?.moveId, moveFrom: gh?.moveFrom, flipLocked: gh?.flipLocked, valid: this.validAt(spot.tx, spot.ty, spot.flip), at: { tx, ty } };
        return;
      }
    }
    // mantém o lado escolhido no Girar enquanto o fantasma anda
    const flip = !!gh?.flip && gh.type === type;
    // movendo: o nível do prédio (arte e terreno dele) vai junto com o fantasma
    const same = gh?.type === type;
    this.app.ghost = { type, tx, ty, flip, flipLocked: same ? gh.flipLocked : undefined, level: same ? gh.level : undefined, moveId: same ? gh.moveId : undefined, moveFrom: same ? gh.moveFrom : undefined, valid: this.validAt(tx, ty, flip), at: { tx, ty } };
  }

  /** Espelha o prédio sendo posicionado/movido (o canto fica no lugar; o terreno retangular troca largura e altura). */
  rotate() {
    const gh = this.app.ghost;
    if (!gh) return;
    gh.flip = !gh.flip;
    gh.flipLocked = true; // o lado escolhido fica (o prédio de margem para de escolher sozinho)
    gh.valid = this.validAt(gh.tx, gh.ty, gh.flip);
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
    this.app.roadDraft.clear(); // saiu sem "Pronto": as ruas pintadas não valem
    this.app.roadHover = null;
    this.strokeDel = null;
    this.lastScreen = null;
    this.roadBar.hidden = true;
    this.roadMsg = '';
    this.moveId = null;
    this.place.hidden = true;
    this.onExit();
  }
}
