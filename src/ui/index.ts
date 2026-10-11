import type { App } from '../app';
import { alertOpen, closeAlert, installTips, showAlert } from './popup';
import { isShown } from './anim';
import { bus } from '../core/events';
import { BUILDINGS } from '../data/buildings';
import { buildingTip } from './maptip';
import { SceneBar } from './scene';
import { orderAttack, orderMove, teamUnits } from '../game/teams';
import type { Building, Site, Unit } from '../game/types';
import { isExploredPx } from '../game/explore';
import { tileCenter, toTile } from '../game/world';
import { BuildUI } from './build';
import { el } from './dom';
import { Hud } from './hud';
import { pxIco, rich } from './icons';
import { Menu } from './menu';
import { BattleCam } from './battle';
import { Panel, type View } from './panel';
import { applyKit } from './kit';
import dockBarUrl from '../art/ui/frame/dock-bar.png';
import windowFrameUrl from '../art/ui/frame/window-frame.png';
import kitDialog from '../art/ui/frame/dialog.png';
import kitDialogTitle from '../art/ui/frame/dialog-title.png';
import kitBanner from '../art/ui/frame/banner.png';
import kitTrack from '../art/ui/frame/bar-track.png';
import kitOrange from '../art/ui/frame/bar-orange.png';
import kitRed from '../art/ui/frame/bar-red.png';
import kitBlue from '../art/ui/frame/bar-blue.png';

const isOwnNinja = (u: Unit) => !u.dead && u.kind === 'ninja' && u.faction === 'village';

/** Monta a interface DOM sobre o canvas e conecta os toques no mapa. */
export function createUI(app: App, root: HTMLElement) {
  // molduras 9-slice (scripts/prepare-frames.py): o CSS usa por variável (border-image)
  document.documentElement.style.setProperty('--frame-dock', `url(${dockBarUrl})`);
  document.documentElement.style.setProperty('--frame-win', `url(${windowFrameUrl})`);
  // kit de interface (scripts/prepare-kit.py, das peças limpas em src/art/ui/kit)
  const kit = { dialog: kitDialog, 'dialog-title': kitDialogTitle, banner: kitBanner, track: kitTrack, orange: kitOrange, red: kitRed, blue: kitBlue };
  for (const [k, url] of Object.entries(kit)) document.documentElement.style.setProperty(`--kit-${k}`, `url(${url})`);
  applyKit();
  installTips();
  const hud = new Hud(app);
  const panel = new Panel(app);
  /** Janela central (telas de gestão com abas). */
  const win = new Panel(app, 'window');
  const build = new BuildUI(app);
  const NINJA_VIEWS = ['roster', 'teams', 'clans', 'team'];
  const VILLAGE_VIEWS = ['village', 'kage', 'bingo', 'stats'];
  const WORLD_VIEWS = ['expeditions', 'region'];
  /** Abre (ou fecha, se já estiver nela) uma tela da janela central. */
  function toggleWindow(view: View, group: string[]) {
    build.toggle(false);
    if (win.kind && group.includes(win.kind)) win.show(null);
    else win.show(view);
  }
  panel.onWindow = (v) => win.show(v);
  win.onWindow = (v) => win.show(v);
  const menu = new Menu(app);
  const sceneBar = new SceneBar(app);
  root.appendChild(sceneBar.root);
  const battle = new BattleCam(app);
  root.appendChild(battle.root);
  bus.on('view', () => {
    win.show(null);
    panel.show(null);
    build.toggle(false);
    if (app.buildType) build.exit();
  });

  const dock = el(
    'div',
    { id: 'dock' },
    rich(
      `<button class="bigbtn" data-act="build" title="Construir (B)">${pxIco('hammer')}<span>Construir</span></button><button class="bigbtn" data-act="roster" title="Ninjas, equipes e clãs (N)">${pxIco('ninja')}<span>Ninjas</span></button><button class="bigbtn" data-act="village" title="Vila: nível, Kage e estatísticas (V)">${pxIco('castle')}<span>Vila</span></button><button class="bigbtn" data-act="missions" title="Quadro de missões (M)">${pxIco('scroll')}<span>Missões</span></button><button class="bigbtn" data-act="world" title="Mundo: expedições e região (R)">${pxIco('map')}<span>Mundo</span></button><button class="bigbtn" data-act="crafts" title="Oficinas: forja, farmácia e selos (F)">${pxIco('anvil')}<span>Oficinas</span></button><button class="bigbtn" data-act="select" title="Arraste no mapa para selecionar vários ninjas (S ou Shift + arrastar)">${pxIco('select')}<span>Selecionar</span></button>`,
    ),
  );
  const btnBuild = dock.querySelector<HTMLElement>('[data-act="build"]')!;
  const btnRoster = dock.querySelector<HTMLElement>('[data-act="roster"]')!;
  const btnVillage = dock.querySelector<HTMLElement>('[data-act="village"]')!;
  const btnMissions = dock.querySelector<HTMLElement>('[data-act="missions"]')!;
  const btnWorld = dock.querySelector<HTMLElement>('[data-act="world"]')!;
  const btnCrafts = dock.querySelector<HTMLElement>('[data-act="crafts"]')!;
  const btnSelect = dock.querySelector<HTMLElement>('[data-act="select"]')!;
  dock.addEventListener('pointerdown', (e) => e.stopPropagation());
  dock.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
    if (a) dockAction(a);
  });

  function dockAction(a: string) {
    if (a !== 'select') app.selectTool = false;
    // gestão e construção são da vila: olhando a invasão, volta para a vila primeiro
    if (a !== 'select' && app.viewScene) app.setView(false);
    if (a === 'build') {
      if (app.buildType) build.exit();
      build.toggle();
      if (build.open) {
        panel.show(null);
        win.show(null);
      }
    }
    if (a === 'village') toggleWindow({ kind: 'village' }, VILLAGE_VIEWS);
    if (a === 'missions') {
      if (!app.game.findBuilt('missions')) {
        showAlert({
          title: BUILDINGS.missions.name,
          text: 'Construa a {scroll} Mesa de Missões (menu Construir) para abrir este quadro.',
          kind: 'info',
        });
        return;
      }
      toggleWindow({ kind: 'missions' }, ['missions']);
    }
    if (a === 'world') {
      if (!app.game.findBuilt('port')) {
        showAlert({
          title: BUILDINGS.port.name,
          text: 'Construa o {ship} Porto (menu Construir) para abrir a janela Mundo.',
          kind: 'info',
        });
        return;
      }
      toggleWindow({ kind: 'region' }, WORLD_VIEWS);
    }
    if (a === 'roster') toggleWindow({ kind: 'roster' }, NINJA_VIEWS);
    if (a === 'crafts') {
      const hasAnyCraft = ['forge', 'pharmacy', 'sealshop'].some((k) => app.game.state.buildings.some((b) => b.type === k));
      if (!hasAnyCraft) {
        showAlert({
          title: 'Oficinas indisponíveis',
          text: 'Construa ao menos uma oficina para abrir esta janela.',
          rows: [`${BUILDINGS.forge.icon} ${BUILDINGS.forge.name}`, `${BUILDINGS.pharmacy.icon} ${BUILDINGS.pharmacy.name}`, `${BUILDINGS.sealshop.icon} ${BUILDINGS.sealshop.name}`],
          kind: 'info',
        });
        return;
      }
      toggleWindow({ kind: 'crafts' }, ['crafts']);
    }
    if (a === 'select') {
      app.selectTool = !app.selectTool;
      if (app.selectTool) {
        build.exit();
        build.toggle(false);
        setOrderMode(false);
        app.game.toast('Arraste no mapa para marcar os ninjas.', 'info');
      }
    }
  }

  // atalhos de teclado (desktop)
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || (e.target as HTMLElement).closest('input, textarea')) return;
    const k = e.key.toLowerCase();
    if (k === 'escape') {
      // fecha a camada mais de cima: aviso → janela → modos de mapa → painel lateral
      if (alertOpen()) closeAlert();
      else if (!win.root.hidden) win.show(null);
      else if (app.buildType) build.cancel();
      else if (app.orderMode || app.selectTool) {
        setOrderMode(false);
        app.selectTool = false;
      } else if (build.open) build.toggle(false);
      else {
        app.game.select(null);
        panel.show(null);
      }
      return;
    }
    const map: Record<string, string> = { b: 'build', n: 'roster', v: 'village', m: 'missions', r: 'world', f: 'crafts', s: 'select' };
    if (map[k]) dockAction(map[k]);
    if (k === ' ') {
      // espaço: pausa/continua
      e.preventDefault();
      const s = app.game.state;
      s.speed = s.speed ? 0 : 1;
    }
  });

  // barra do modo "dar ordem"
  const orderBar = el(
    'div',
    { id: 'orderbar', hidden: '' },
    rich(`<span class="hint" data-t="label"></span><button class="btn icon" data-act="cancel" title="Cancelar">{x}</button>`),
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
      app.selectTool = false;
      orderBar.querySelector('[data-t="label"]')!.innerHTML = rich(
        `{pin} Ordem (${app.orderMode.label}): toque no chão para mover/defender ou num inimigo para atacar`,
      );
    }
  }
  panel.onOrderMode = () => setOrderMode(true);
  let lastPointerMouse = false;
  window.addEventListener('pointerdown', (e) => (lastPointerMouse = e.pointerType === 'mouse'), true);
  panel.onMove = (id) => {
    setOrderMode(false);
    app.selectTool = false;
    app.game.select(null);
    panel.show(null);
    build.startMove(id);
  };

  hud.onMenu = () => menu.open();
  root.append(hud.top, hud.alert, hud.toasts, dock, build.bar, build.place, orderBar, panel.root, win.root, menu.root);
  hud.update(); // valores já no primeiro quadro (antes a barra de cima nascia vazia por 0,2 s)

  bus.on('select', (sel) => {
    if (sel) {
      build.toggle(false);
      panel.show({ kind: sel.kind, id: sel.id });
    } else if (panel.kind !== 'roster' && panel.kind !== 'teams' && panel.kind !== 'clans' && panel.kind !== 'group') panel.show(null);
  });
  bus.on('newGame', () => {
    setOrderMode(false);
    app.selectTool = false;
    build.exit();
    build.toggle(false);
    panel.show(null);
  });

  // ------------------------------------------------------------------ mapa
  /**
   * Unidade visível mais próxima do ponto da tela. A comparação é feita na tela, com o corpo
   * (um pouco acima dos pés), porque na vista isométrica o sprite fica em pé sobre o chão.
   */
  function unitAt(sx: number, sy: number, tolPx: number, filter: (u: Unit) => boolean = () => true): Unit | null {
    const zoom = app.camera.zoom;
    let best: Unit | null = null;
    let bd = tolPx * Math.max(1, zoom);
    for (const u of app.game.state.units) {
      if (u.dead || u.hidden || !filter(u)) continue;
      if (u.faction !== 'village' && !isExploredPx(app.game.state, u.x, u.y)) continue; // escondido na névoa
      const p = app.camera.worldToScreen(u.x, u.y);
      const d = Math.hypot(p.x - sx, p.y - 10 * zoom - sy);
      if (d < bd) {
        bd = d;
        best = u;
      }
    }
    return best;
  }

  /** Prédio sob o ponto da tela: a base ou, descendo na tela, o corpo do prédio que fica em pé sobre ela. */
  function buildingAt(sx: number, sy: number): Building | undefined {
    const g = app.game;
    for (const lift of [0, 14, 28, 42]) {
      const w = app.camera.screenToWorld(sx, sy + lift * app.camera.zoom);
      const b = g.building(g.world.buildingIdAt(toTile(w.x), toTile(w.y)));
      if (b && (lift === 0 || !BUILDINGS[b.type].walkable)) return b;
    }
    return undefined;
  }

  /** Local especial (já descoberto) sob o ponto da tela. */
  function siteAt(sx: number, sy: number): Site | undefined {
    const zoom = app.camera.zoom;
    let best: Site | undefined;
    let bd = 26 * Math.max(1, zoom);
    for (const site of app.game.state.sites) {
      if (!site.found || site.done) continue;
      const p = app.camera.worldToScreen(tileCenter(site.tx), tileCenter(site.ty));
      const d = Math.hypot(p.x - sx, p.y - 12 * zoom - sy);
      if (d < bd) {
        bd = d;
        best = site;
      }
    }
    return best;
  }

  /** Ordem no ponto da tela: atacar se houver inimigo ali, senão mover/defender no chão. */
  function issueOrder(ids: number[], sx: number, sy: number) {
    const g = app.game;
    const enemy = unitAt(sx, sy, 20, (u) => u.faction !== 'village');
    const w = app.camera.screenToWorld(sx, sy);
    const r = enemy ? orderAttack(g, ids, enemy.id) : orderMove(g, ids, w.x, w.y);
    if (!r.ok) g.toast(r.error, 'warn');
  }

  /** Ninjas que recebem ordens agora: grupo, ninja selecionado ou equipe aberta. */
  function commandableIds(): number[] {
    const g = app.game;
    if (app.group.length) return app.group;
    const sel = g.selected;
    if (sel?.kind === 'unit') {
      const u = g.unit(sel.id);
      return u && isOwnNinja(u) ? [u.id] : [];
    }
    if (sel?.kind === 'team') {
      const tm = g.team(sel.id);
      return tm ? teamUnits(g, tm).map((u) => u.id) : [];
    }
    return [];
  }

  /** Toque no mapa (coordenadas de tela). */
  function onTap(sx: number, sy: number) {
    const g = app.game;
    const w = app.camera.screenToWorld(sx, sy);
    if (app.buildType) {
      build.tapWorld(w.x, w.y);
      // com mouse o fantasma já segue o cursor: o clique confirma (no toque, toca e depois confirma no botão)
      if (lastPointerMouse && app.ghost?.valid) build.confirm();
      return;
    }
    if (app.orderMode) {
      issueOrder(app.orderMode.ids, sx, sy);
      setOrderMode(false);
      return;
    }
    if (build.open) build.toggle(false);
    const u = unitAt(sx, sy, 16);
    if (u) {
      g.select({ kind: 'unit', id: u.id });
      return;
    }
    const site = siteAt(sx, sy);
    if (site) {
      g.select({ kind: 'site', id: site.id });
      return;
    }
    const b = buildingAt(sx, sy);
    if (b) {
      g.select({ kind: 'building', id: b.id });
      return;
    }
    g.select(null);
    panel.show(null);
  }

  /** Botão direito no mapa: ordem imediata para quem está selecionado. */
  function onContext(sx: number, sy: number) {
    if (app.buildType) return;
    if (app.orderMode) {
      setOrderMode(false);
      return;
    }
    const ids = commandableIds();
    if (!ids.length) return;
    issueOrder(ids, sx, sy);
  }

  /** Caixa de seleção (tela): marca os ninjas da vila dentro dela. */
  function onBox(x0: number, y0: number, x1: number, y1: number, done: boolean) {
    if (!done) {
      app.selectBox = { x0, y0, x1, y1 };
      return;
    }
    app.selectBox = null;
    app.selectTool = false;
    const [ax, bx, ay, by] = [Math.min(x0, x1), Math.max(x0, x1), Math.min(y0, y1), Math.max(y0, y1)];
    const ids = app.game.state.units
      .filter((u) => {
        if (!isOwnNinja(u) || u.hidden) return false;
        const p = app.camera.worldToScreen(u.x, u.y);
        const y = p.y - 10 * app.camera.zoom;
        return p.x >= ax && p.x <= bx && y >= ay && y <= by;
      })
      .map((u) => u.id);
    if (!ids.length) {
      app.game.toast('Nenhum ninja da vila dentro da caixa.', 'info');
      return;
    }
    build.toggle(false);
    if (ids.length === 1) {
      app.game.select({ kind: 'unit', id: ids[0]! });
      return;
    }
    app.game.select(null);
    app.group = ids;
    panel.show({ kind: 'group' });
  }

  /** Dica de prédio (desktop): qual prédio está sob o mouse, desde quando e onde. */
  const tip = { id: null as number | null, since: 0, x: 0, y: 0, shown: false };
  const tipEl = el('div', { id: 'maptip', hidden: '' });
  document.body.appendChild(tipEl);
  const tipAt = (id: number | null, sx: number, sy: number) => {
    if (id !== tip.id) {
      tip.id = id;
      tip.since = performance.now();
      tip.shown = false;
    }
    // já aparecendo, a dica fica onde surgiu; antes disso, mexer o mouse recomeça a espera
    if (tip.shown) return;
    if (Math.hypot(sx - tip.x, sy - tip.y) > 4) tip.since = performance.now();
    tip.x = sx;
    tip.y = sy;
  };

  /** Mouse sobre o mapa: destaca a unidade e devolve o cursor adequado. */
  function onHover(sx: number, sy: number): string {
    if (sx < 0) {
      app.hoverUnitId = panel.hoverId;
      tipAt(null, 0, 0);
      return 'grab';
    }
    if (app.buildType) {
      // no desktop o fantasma do prédio acompanha o mouse; o clique confirma
      const w = app.camera.screenToWorld(sx, sy);
      build.tapWorld(w.x, w.y);
      return 'cell';
    }
    if (app.selectTool) return 'crosshair';
    const u = unitAt(sx, sy, 16);
    app.hoverUnitId = u?.id ?? panel.hoverId;
    if (app.orderMode) return 'crosshair';
    const bh = u ? undefined : buildingAt(sx, sy);
    tipAt(bh?.id ?? null, sx, sy);
    return u || siteAt(sx, sy) || bh ? 'pointer' : 'grab';
  }
  panel.onHover = (id) => (app.hoverUnitId = id);

  /**
   * Drawer aberto: a barra de baixo vai para o meio do espaço livre à esquerda dele (o drawer cobria a ponta direita);
   * se não couber (celular), encolhe até caber (no mínimo 60%), sem passar da borda esquerda da tela.
   */
  function shiftDock() {
    const open = isShown(panel.root);
    const free = open ? panel.root.getBoundingClientRect().left : window.innerWidth;
    const fit = open ? Math.max(0.6, Math.min(1, (free - 16) / dock.offsetWidth)) : 1;
    const sv = fit.toFixed(3);
    if (dock.style.getPropertyValue('--dock-scale') !== sv) dock.style.setProperty('--dock-scale', sv);
    const r = dock.getBoundingClientRect();
    const tx = parseFloat(getComputedStyle(dock).translate) || 0; // o deslocamento atual (pode estar em transição)
    const base = r.left - tx;
    const shift = open ? Math.min(0, Math.max(8, free / 2 - r.width / 2) - base) : 0;
    const v = `${Math.round(shift)}px`;
    if (dock.style.getPropertyValue('--dock-shift') !== v) dock.style.setProperty('--dock-shift', v);
  }

  let acc = 0;
  function update(dt: number, time: number) {
    panel.frame(time);
    acc += dt;
    if (acc < 0.2) return;
    acc = 0;
    hud.update();
    panel.update();
    win.update();
    build.update();
    build.refreshGhost();
    shiftDock();
    btnBuild.classList.toggle('on', build.open || !!app.buildType);
    btnRoster.classList.toggle('on', NINJA_VIEWS.includes(win.kind ?? ''));
    btnVillage.classList.toggle('on', VILLAGE_VIEWS.includes(win.kind ?? ''));
    btnMissions.classList.toggle('on', win.kind === 'missions');
    btnWorld.classList.toggle('on', WORLD_VIEWS.includes(win.kind ?? ''));
    btnCrafts.classList.toggle('on', win.kind === 'crafts');
    sceneBar.update();
    battle.update(dt);
    // dica do prédio: aparece depois de o mouse ficar parado sobre ele um instante
    const hb = tip.id != null ? app.game.building(tip.id) : undefined;
    if (hb && performance.now() - tip.since > 550 && win.root.hidden && !app.buildType) {
      tipEl.innerHTML = buildingTip(app.game, hb);
      tipEl.hidden = false;
      if (!tip.shown) {
        tip.shown = true;
        const r = tipEl.getBoundingClientRect();
        tipEl.style.left = `${Math.min(window.innerWidth - r.width - 8, tip.x + 16)}px`;
        tipEl.style.top = `${Math.min(window.innerHeight - r.height - 8, tip.y + 16)}px`;
      }
    } else {
      tipEl.hidden = true;
      tip.shown = false;
    }
    btnSelect.classList.toggle('on', app.selectTool);
    if (!orderBar.hidden && !app.orderMode) setOrderMode(false);
  }

  /** Abre uma tela pelo código (vitrine `?demo`): o que é tocado no mapa vira seleção (drawer), o resto a janela. */
  function show(v: View) {
    const group = app.group; // fechar a janela limpa a seleção em grupo
    build.toggle(false);
    win.show(null);
    app.group = group;
    if (v.kind === 'unit' || v.kind === 'building' || v.kind === 'site') {
      app.game.select({ kind: v.kind, id: v.id });
      const t = v.kind === 'unit' ? app.game.unit(v.id) : null;
      if (t) app.camera.jump(t.x, t.y);
    } else if (v.kind === 'group') panel.show(v);
    else {
      app.game.select(null);
      win.show(v);
    }
  }

  return { onTap, onContext, onBox, onHover, update, show, build, menu };
}
