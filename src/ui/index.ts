import type { App } from '../app';
import { bus } from '../core/events';
import { BUILDINGS } from '../data/buildings';
import { toTile } from '../game/world';
import { BuildUI } from './build';
import { el } from './dom';
import { Hud } from './hud';
import { Menu } from './menu';
import { Panel } from './panel';

/** Monta a interface DOM sobre o canvas e conecta os toques no mapa. */
export function createUI(app: App, root: HTMLElement) {
  const hud = new Hud(app);
  const panel = new Panel(app);
  const build = new BuildUI(app);
  const menu = new Menu(app);

  const dock = el(
    'div',
    { id: 'dock' },
    `<button class="bigbtn" data-act="build">🔨<span>Construir</span></button><button class="bigbtn" data-act="roster">🥷<span>Ninjas</span></button>`,
  );
  const btnBuild = dock.querySelector<HTMLElement>('[data-act="build"]')!;
  const btnRoster = dock.querySelector<HTMLElement>('[data-act="roster"]')!;
  dock.addEventListener('pointerdown', (e) => e.stopPropagation());
  dock.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
    if (a === 'build') {
      if (app.buildType) build.exit();
      build.toggle();
      if (build.open) panel.show(null);
    }
    if (a === 'roster') {
      build.toggle(false);
      if (panel.kind === 'roster') panel.show(null);
      else {
        app.game.select(null);
        panel.show({ kind: 'roster' });
      }
    }
  });

  hud.onMenu = () => menu.open();
  root.append(hud.top, hud.alert, hud.toasts, dock, build.bar, build.place, panel.root, menu.root);

  bus.on('select', (sel) => {
    if (sel) {
      build.toggle(false);
      panel.show(sel.kind === 'unit' ? { kind: 'unit', id: sel.id } : { kind: 'building', id: sel.id });
    } else if (panel.kind !== 'roster') panel.show(null);
  });
  bus.on('newGame', () => {
    build.exit();
    build.toggle(false);
    panel.show(null);
  });

  /** Toque no mapa (coordenadas de tela). */
  function onTap(sx: number, sy: number) {
    const g = app.game;
    const w = app.camera.screenToWorld(sx, sy);
    if (app.buildType) {
      build.tapWorld(w.x, w.y);
      return;
    }
    if (build.open) build.toggle(false);
    // unidade mais próxima do toque (tolerância maior em zoom baixo)
    const tol = 18 / Math.min(1, app.camera.zoom);
    let best = null;
    let bd = tol;
    for (const u of g.state.units) {
      if (u.dead || u.hidden) continue;
      const d = Math.hypot(u.x - w.x, u.y - 4 - w.y);
      if (d < bd) {
        bd = d;
        best = u;
      }
    }
    if (best) {
      g.select({ kind: 'unit', id: best.id });
      return;
    }
    const bid = g.world.buildingIdAt(toTile(w.x), toTile(w.y));
    if (bid) {
      g.select({ kind: 'building', id: bid });
      return;
    }
    // telhados ficam um pouco acima do footprint
    const above = g.world.buildingIdAt(toTile(w.x), toTile(w.y + 12));
    const b = g.building(above);
    if (b && BUILDINGS[b.type]) {
      g.select({ kind: 'building', id: b.id });
      return;
    }
    g.select(null);
    panel.show(null);
  }

  let acc = 0;
  function update(dt: number) {
    acc += dt;
    if (acc < 0.2) return;
    acc = 0;
    hud.update();
    panel.update();
    build.update();
    build.refreshGhost();
    btnBuild.classList.toggle('on', build.open || !!app.buildType);
    btnRoster.classList.toggle('on', panel.kind === 'roster');
  }

  return { onTap, update };
}
