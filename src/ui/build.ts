import type { App } from '../app';
import { BUILDING_LIST, BUILDINGS, type BuildingType } from '../data/buildings';
import { canBuild, canMove, costLabel, moveBuilding, placeBuilding, shoreSpot } from '../game/commands';
import { toTile } from '../game/world';
import { levelDef } from '../data/villageLevels';
import { plainTokens } from '../core/tokens';
import { UPGRADES } from '../data/upgrades';
import { lackRows, showAlert } from './popup';
import { el } from './dom';
import { rich } from './icons';
import { artUrl } from '../render/art';
import { isShown, setShown } from './anim';

/** Dica do card (texto puro): o que faz e o custo. */
const plainInfo = (d: (typeof BUILDINGS)[BuildingType]) => `${plainTokens(d.desc)}
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
    for (const d of BUILDING_LIST) {
      if (!d.buildable) continue;
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
    ].filter(Boolean);
    const lack = lackRows(g, d.cost);
    const rows = [`<span class="lbl">Custo</span> ${costLabel(d.cost)}`];
    if (up) rows.push(`<span class="lbl">Upgrades</span> ${up.perks.map((p, i) => `Nv ${i + 1}: ${p}`).join(' · ')}`);
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
    const d = BUILDINGS[b.type];
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
    const moving = this.moveId != null;
    this.exit();
    if (!moving) this.toggle(true);
  }

  exit() {
    this.app.ghost = null;
    this.app.buildType = null;
    this.moveId = null;
    this.place.hidden = true;
    this.onExit();
  }
}
