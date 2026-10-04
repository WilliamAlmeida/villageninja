import type { App } from '../app';
import { bus } from '../core/events';
import { BUILDINGS } from '../data/buildings';
import { orderAttack, orderMove } from '../game/teams';
import { doorPos, toTile } from '../game/world';
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
    `<button class="bigbtn" data-act="build">🔨<span>Construir</span></button><button class="bigbtn" data-act="roster">🥷<span>Ninjas</span></button><button class="bigbtn" data-act="village">🏯<span>Vila</span></button><button class="bigbtn" data-act="missions">📋<span>Missões</span></button>`,
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
    if (a === 'village') {
      const hk = app.game.hokage();
      if (hk) {
        app.game.select({ kind: 'building', id: hk.id });
        const c = doorPos(hk);
        app.camera.focus(c.x, c.y - 40);
      }
    }
    if (a === 'missions') {
      const desk = app.game.state.buildings.find((b) => b.type === 'missions');
      if (!desk) app.game.toast('Construa a 📋 Mesa de Missões (menu Construir).', 'warn');
      else {
        app.game.select({ kind: 'building', id: desk.id });
        if (!desk.built) app.game.toast('A Mesa de Missões ainda está em construção.', 'info');
      }
    }
    if (a === 'roster') {
      build.toggle(false);
      if (panel.kind === 'roster' || panel.kind === 'teams') panel.show(null);
      else {
        app.game.select(null);
        panel.show({ kind: 'roster' });
      }
    }
  });

  // barra do modo "dar ordem"
  const orderBar = el(
    'div',
    { id: 'orderbar', hidden: '' },
    `<span class="hint" data-t="label"></span><button class="btn" data-act="cancel">✕</button>`,
  );
  orderBar.addEventListener('pointerdown', (e) => e.stopPropagation());
  orderBar.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-act="cancel"]')) setOrderMode(false);
  });
  function setOrderMode(on: boolean) {
    if (!on) app.orderMode = null;
    orderBar.hidden = !app.orderMode;
    if (app.orderMode) {
      build.exit();
      build.toggle(false);
      orderBar.querySelector('[data-t="label"]')!.textContent =
        `📍 Ordem (${app.orderMode.label}): toque no chão para mover/defender ou num inimigo para atacar`;
    }
  }
  panel.onOrderMode = () => setOrderMode(true);

  hud.onMenu = () => menu.open();
  root.append(hud.top, hud.alert, hud.toasts, dock, build.bar, build.place, orderBar, panel.root, menu.root);

  bus.on('select', (sel) => {
    if (sel) {
      build.toggle(false);
      panel.show({ kind: sel.kind, id: sel.id });
    } else if (panel.kind !== 'roster' && panel.kind !== 'teams') panel.show(null);
  });
  bus.on('newGame', () => {
    setOrderMode(false);
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
    if (app.orderMode) {
      const ids = app.orderMode.ids;
      const tol = 22 / Math.min(1, app.camera.zoom);
      const enemy = g.state.units
        .filter((u) => !u.dead && !u.hidden && u.faction !== 'village')
        .map((u) => ({ u, d: Math.hypot(u.x - w.x, u.y - 4 - w.y) }))
        .filter((e) => e.d < tol)
        .sort((a, b) => a.d - b.d)[0]?.u;
      const r = enemy ? orderAttack(g, ids, enemy.id) : orderMove(g, ids, w.x, w.y);
      if (!r.ok) g.toast(r.error, 'warn');
      setOrderMode(false);
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
    btnRoster.classList.toggle('on', panel.kind === 'roster' || panel.kind === 'teams');
    if (!orderBar.hidden && !app.orderMode) setOrderMode(false);
  }

  return { onTap, update };
}
