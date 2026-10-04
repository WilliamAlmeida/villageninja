import type { App } from '../app';
import { BUILDING_LIST, BUILDINGS, type BuildingType } from '../data/buildings';
import { canBuild, costLabel, placeBuilding } from '../game/commands';
import { toTile } from '../game/world';
import { levelDef } from '../data/villageLevels';
import { el } from './dom';

/** Menu de construção + modo de posicionamento (fantasma no mapa). */
export class BuildUI {
  readonly bar: HTMLElement;
  readonly place: HTMLElement;
  onExit: () => void = () => {};

  constructor(private app: App) {
    this.bar = el('div', { id: 'buildbar', hidden: '' });
    for (const d of BUILDING_LIST) {
      if (!d.buildable) continue;
      this.bar.appendChild(
        el('button', { class: 'bcard', 'data-type': d.type }, `<span class="i">${d.icon}</span><span class="n">${d.name}</span><span class="c">${costLabel(d.cost)}</span><span class="lock"></span>`),
      );
    }
    this.bar.addEventListener('click', (e) => {
      const c = (e.target as HTMLElement).closest<HTMLElement>('[data-type]');
      if (c) this.start(c.dataset.type as BuildingType);
    });
    this.bar.addEventListener('pointerdown', (e) => e.stopPropagation());

    this.place = el(
      'div',
      { id: 'placebar', hidden: '' },
      `<span class="hint" data-t="name"></span><button class="btn" data-act="cancel">✕</button><button class="btn primary" data-act="ok">✓ Construir</button>`,
    );
    this.place.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
      if (a === 'cancel') this.cancel();
      if (a === 'ok') this.confirm();
    });
    this.place.addEventListener('pointerdown', (e) => e.stopPropagation());
  }

  get open() {
    return !this.bar.hidden;
  }

  toggle(show = this.bar.hidden) {
    this.bar.hidden = !show;
    if (show) this.update();
  }

  update() {
    if (this.bar.hidden) return;
    this.bar.querySelectorAll<HTMLElement>('[data-type]').forEach((c) => {
      const r = canBuild(this.app.game, c.dataset.type as BuildingType);
      c.classList.toggle('off', !r.ok);
      c.title = r.ok ? '' : r.error;
      const min = BUILDINGS[c.dataset.type as BuildingType].minLevel ?? 0;
      const lock = min > this.app.game.state.level ? `🔒 ${levelDef(min).name}` : '';
      const le = c.querySelector('.lock')!;
      if (le.textContent !== lock) le.textContent = lock;
    });
  }

  private start(type: BuildingType) {
    const r = canBuild(this.app.game, type);
    if (!r.ok) {
      this.app.game.toast(r.error, 'warn');
      return;
    }
    const cam = this.app.camera;
    const d = BUILDINGS[type];
    this.app.buildType = type;
    this.setGhost(toTile(cam.x) - Math.floor(d.w / 2), toTile(cam.y) - Math.floor(d.h / 2));
    this.bar.hidden = true;
    this.place.hidden = false;
    this.place.querySelector('[data-t="name"]')!.textContent = `${d.icon} ${d.name} — toque no mapa para posicionar`;
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
    this.app.ghost = { type, tx, ty, valid: this.app.game.world.canPlace(type, tx, ty) };
  }

  refreshGhost() {
    const gh = this.app.ghost;
    if (gh) gh.valid = this.app.game.world.canPlace(gh.type, gh.tx, gh.ty);
  }

  private confirm() {
    const gh = this.app.ghost;
    if (!gh) return;
    const r = placeBuilding(this.app.game, gh.type, gh.tx, gh.ty);
    if (!r.ok) {
      this.app.game.toast(r.error, 'warn');
      return;
    }
    this.exit();
  }

  cancel() {
    this.exit();
    this.toggle(true);
  }

  exit() {
    this.app.ghost = null;
    this.app.buildType = null;
    this.place.hidden = true;
    this.onExit();
  }
}
