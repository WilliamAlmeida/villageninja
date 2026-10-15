import type { App } from './app';
import { AUTOSAVE_INTERVAL, SIM_DT } from './config';
import { Camera } from './core/camera';
import { bus } from './core/events';
import { Input } from './core/input';
import { createDemoGame } from './game/demo';
import { createNewGame } from './game/newGame';
import { clearSave, loadGame, saveGame as writeSave } from './game/save';
import { SYSTEMS } from './game/systems';
import { sceneGame, sceneTeam } from './game/scene';
import { darkness, hourOf } from './game/time';
import { doorPos } from './game/world';
import { preloadArt, warmMips } from './render/art';
import { Renderer } from './render/renderer';
import { SEASON_VIEW } from './render/seasonal';
import { createUI } from './ui';
import { demoMenu } from './ui/demoMenu';
import { applySettings, followCam, occlusion, quality, QUALITY_CFG, simRate } from './ui/settings';
import { warmPortraits } from './ui/warm';
import { FpsMeter } from './ui/fps';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui')!;

applySettings();
const camera = new Camera();
const renderer = new Renderer(canvas);

/**
 * `?demo`: vila de vitrine (game/demo.ts) com tudo liberado, para conferir qualquer tela sem cumprir os requisitos.
 * Não lê nem grava o save. `?demo&tela=crafts` já abre essa tela (ver `ui/demoMenu.ts`).
 */
const DEMO = new URLSearchParams(location.search).has('demo');
const saveGame: typeof writeSave = (g) => (DEMO ? true : writeSave(g));
let home = DEMO ? createDemoGame(SYSTEMS) : (loadGame(SYSTEMS) ?? createNewGame(SYSTEMS));
/** Câmera de cada tela (vila e mapa de missão), para voltar onde estava. */
const cams: { home?: { x: number; y: number; zoom: number }; scene?: { x: number; y: number; zoom: number } } = {};

const app: App = {
  get home() {
    return home;
  },
  get game() {
    return (app.viewScene && sceneGame(home)) || home;
  },
  viewScene: false,
  setView(scene: boolean) {
    const sg = sceneGame(home);
    if (scene && !sg) return;
    if (scene === app.viewScene) return;
    app.game.select(null);
    app.back = null;
    cams[app.viewScene ? 'scene' : 'home'] = { x: camera.x, y: camera.y, zoom: camera.zoom };
    app.viewScene = scene;
    const saved = cams[scene ? 'scene' : 'home'];
    if (scene && (!saved || sg!.state !== sceneOf)) {
      // primeira vez nesta invasão: câmera na equipe
      sceneOf = sg!.state;
      const team = sceneTeam(sg!);
      const p = team[0] ?? sg!.state.sceneInfo!.entry;
      camera.jump(p.x, p.y);
      camera.zoom = 1.6;
    } else if (saved) {
      camera.x = saved.x;
      camera.y = saved.y;
      camera.zoom = saved.zoom;
    }
    bus.emit('view', scene);
  },
  camera,
  ghost: null,
  buildType: null,
  roadMode: null,
  orderMode: null,
  group: [],
  hoverUnitId: null,
  back: null,
  selectBox: null,
  selectTool: false,
  newGame() {
    if (!DEMO) clearSave();
    app.viewScene = false;
    home = DEMO ? createDemoGame(SYSTEMS) : createNewGame(SYSTEMS);
    centerOnVillage();
    bus.emit('newGame', undefined);
    saveGame(home);
  },
  save: () => saveGame(home),
};
let sceneOf: object | null = null;

function centerOnVillage() {
  const hk = home.hokage();
  if (hk) {
    const p = doorPos(hk);
    camera.jump(p.x, p.y);
  }
  camera.zoom = 1.3;
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.resize(w, h);
  camera.resize(w, h);
}
window.addEventListener('resize', resize);
resize();
centerOnVillage();
camera.resize(window.innerWidth, window.innerHeight);

const ui = createUI(app, uiRoot);
if (DEMO) demoMenu(app, ui);
const input = new Input(canvas, camera);
input.onTap = ui.onTap;
input.onContext = ui.onContext;
input.onBox = ui.onBox;
input.onBoxCancel = () => (app.selectBox = null);
input.boxMode = () => !!app.roadMode || (app.selectTool && !app.buildType && !app.orderMode);
input.onHover = (sx, sy) => input.setCursor(ui.onHover(sx, sy));

// salvamento automático
let saveTimer = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) saveGame(home);
});
window.addEventListener('pagehide', () => saveGame(home));

// loop: simulação em passo fixo + render a cada frame
let last = performance.now();
let acc = 0;
let clock = 0;
let winEl: HTMLElement | null = null;
let drawWait = 0;
/**
 * Pausado, o quadro só muda se a tela mudar (o relógio das animações para junto): sem toque/tecla e com a câmera e a
 * seleção paradas, não redesenha (o mapa inteiro à vista custava o mesmo pausado e rodando). A cada 0,5 s redesenha
 * mesmo assim, por garantia.
 */
let drawDirty = true;
let idleWait = 0;
let lastView = '';
for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'wheel', 'keydown', 'keyup', 'resize'])
  window.addEventListener(ev, () => (drawDirty = true), { capture: true, passive: true });
const viewKey = () => {
  const g = app.game;
  const sel = g.selected;
  return `${camera.left}|${camera.top}|${camera.zoom}|${camera.viewW}|${camera.viewH}|${sel?.kind}:${sel && 'id' in sel ? sel.id : ''}|${app.viewScene}|${g.state.effects.length}|${g.state.projectiles.length}|${g.state.units.length}|${g.state.buildings.length}`;
};
/**
 * Câmera segue o ninja (ou bicho, inimigo) selecionado, suave; arrastar o mapa solta. Se ele se perder (caiu, saiu do
 * mapa numa expedição), a câmera volta suave para a Residência. Desligável no menu ("Câmera segue o ninja").
 */
function followSelected() {
  const g = app.game;
  if (camera.trackId != null) {
    const u = g.unit(camera.trackId);
    if (!u || u.dead || u.away != null) {
      camera.trackId = null;
      const hk = g.hokage();
      if (hk) {
        const p = doorPos(hk);
        camera.focus(p.x, p.y);
      }
      return;
    }
  }
  const sel = g.selected;
  const id = followCam() && sel?.kind === 'unit' ? sel.id : null;
  if (id !== camera.trackedOnce) {
    camera.trackedOnce = id;
    camera.trackId = id;
  }
  if (camera.trackId == null) return;
  const u = g.unit(camera.trackId)!;
  camera.track(u.x, u.y);
}

/** Câmera lenta dos momentos especiais: segundos reais e fator da simulação. */
const SLOW_TIME = 0.8;
/** Tempo máximo (ms) da simulação por quadro; o resto é do desenho e da interface. */
const SIM_BUDGET_MS = 8;
const SLOW_FACTOR = 0.3;
let slowT = 0;
const moments = new WeakSet<object>();

/** Qualidade do desenho: teto de resolução, partículas e limite de quadros (Configurações). */
let fpsCap = 0;
function applyQuality() {
  const q = QUALITY_CFG[quality()];
  renderer.maxDpr = q.dpr;
  renderer.particleBase = q.particles;
  fpsCap = q.fpsCap;
  resize();
}
applyQuality();
bus.on('quality', () => {
  applyQuality();
  drawDirty = true;
});
// personagem atrás de prédio: silhueta / esmaecer / furo / pontilhado (Configurações)
renderer.occl = occlusion();
bus.on('occlusion', () => {
  renderer.occl = occlusion();
  drawDirty = true;
});
let lastDraw = 0;
/** Tempo de jogo de cada passo da simulação: SIM_DT, ou o dobro no Processamento Reduzido (Configurações). */
let simStep = simRate() === 'reduced' ? SIM_DT * 2 : SIM_DT;
bus.on('simRate', () => (simStep = simRate() === 'reduced' ? SIM_DT * 2 : SIM_DT));

const fps = new FpsMeter();
// relatório do botão de salvar do medidor: como o jogo e o desenho estão agora
fps.info = () => {
  const s = home.state;
  let seen = 0;
  for (const w of s.explored ?? []) for (let b = w >>> 0; b; b &= b - 1) seen++;
  return {
    day: s.day,
    speed: s.speed,
    view: app.viewScene ? 'cena' : 'vila',
    zoom: +camera.zoom.toFixed(2),
    units: s.units.filter((u) => !u.dead).length,
    nodes: s.nodes.length,
    buildings: s.buildings.length,
    population: home.population(),
    exploredPct: Math.round((100 * seen) / (s.mapW * s.mapH)),
    map: `${s.mapW}x${s.mapH}`,
    // clima e hora: neve e chuva mudam o custo do desenho
    weather: { season: SEASON_VIEW.season, snow: +s.snow.toFixed(2), clouds: s.clouds.length, hour: +hourOf(s).toFixed(1), dark: +darkness(s).toFixed(2) },
    canvas: { w: renderer['canvas'].width, h: renderer['canvas'].height, dpr: renderer['dpr'] },
    windowOpen: !!winEl && !winEl.hidden,
    bench: (window as unknown as { bench: (n?: number) => object }).bench(10),
  };
};
fps.sync();
bus.on('fps', () => fps.sync());

function frame(now: number) {
  // Qualidade Leve: no máximo `fpsCap` quadros por segundo (o resto do tempo o aparelho descansa)
  if (fpsCap && now - lastDraw < 1000 / fpsCap - 1) {
    requestAnimationFrame(frame);
    return;
  }
  lastDraw = now;
  fps.tick(now);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  // momento especial (técnica de Kage, Sannin, chefe, proibido): câmera lenta curta
  for (const e of app.game.state.effects)
    if (e.kind === 'moment' && !moments.has(e)) {
      moments.add(e);
      slowT = SLOW_TIME;
    }
  const slow = slowT > 0 ? SLOW_FACTOR : 1;
  slowT -= dt;
  // relógio das animações: congela junto com a simulação quando o jogo está pausado
  if (home.state.speed > 0) clock += dt * slow;
  // a vila roda sempre (e puxa o mapa de missão junto: sceneRunSystem); a tela mostra o que o jogador olha
  const g = home;
  acc += dt * g.state.speed * slow;
  // orçamento de tempo para a simulação neste quadro: se o aparelho não dá conta (3x num celular fraco, batalha
  // grande), o jogo anda um pouco mais devagar em vez de tentar alcançar o atraso — que fazia cada quadro rodar
  // ainda mais passos e o FPS despencar (bola de neve)
  g.prof = fps.detail ? fps.simProf : null; // medidor detalhado: ms por sistema
  const tSim = performance.now();
  const budget = tSim + SIM_BUDGET_MS;
  let steps = 0;
  // Processamento Reduzido (Configurações): passos com o dobro do tempo, metade das contas
  const stepDt = simStep;
  while (acc >= stepDt && steps < 12) {
    g.step(stepDt);
    acc -= stepDt;
    steps++;
    if (performance.now() > budget) break;
  }
  if (acc >= stepDt) acc = Math.min(acc, stepDt); // o que não coube fica para trás (não acumula)
  const simMs = performance.now() - tSim;

  saveTimer += dt;
  if (saveTimer >= AUTOSAVE_INTERVAL) {
    saveTimer = 0;
    saveGame(g);
  }

  // a invasão acabou enquanto o jogador olhava: volta para a vila
  if (app.viewScene && !home.state.scene) app.setView(false);
  followSelected();
  camera.update(dt);
  // onde a câmera olha, para a simulação poupar quem está longe (Game.view)
  {
    const c = camera.screenToWorld(camera.viewW / 2, camera.viewH / 2);
    const r = Math.hypot(camera.viewW, camera.viewH) / camera.zoom / 2;
    home.view = app.viewScene ? null : { x: c.x, y: c.y, r };
  }
  // janela de gestão aberta cobre quase todo o mapa: desenha o fundo a ~12 quadros/s (a simulação segue igual).
  // Poupa a GPU/CPU para a janela (num save grande, mapa a 60 quadros + janela por cima travava as abas).
  winEl ??= document.getElementById('win');
  drawWait -= dt;
  idleWait -= dt;
  // Qualidade Leve: com a janela aberta o mapa fica parado na última imagem (no celular fraco, o mapa a 12 quadros por
  // baixo da janela deixava as abas lentas)
  let draw = !winEl || winEl.hidden || (drawWait <= 0 && quality() !== 'light');
  if (draw && app.game.state.speed === 0 && home.state.speed === 0) {
    const k = viewKey();
    if (!drawDirty && k === lastView && idleWait > 0) draw = false;
    else {
      lastView = k;
      drawDirty = false;
      idleWait = 0.5;
    }
  }
  let drawMs = 0;
  if (draw) {
    drawWait = 1 / 12;
    const t = performance.now();
    renderer.prof = fps.detail ? fps.prof : null; // medidor detalhado: etapas do desenho
    renderer.render(app.game, camera, app.ghost, clock, app);
    drawMs = performance.now() - t;
  }
  const tUi = performance.now();
  ui.update(dt, clock);
  fps.times(simMs, steps, drawMs, performance.now() - tUi);
  requestAnimationFrame(frame);
}

// só começa a desenhar com as imagens prontas (senão aparece o desenho antigo enquanto elas chegam)
const loading = document.getElementById('loading');
const bar = loading?.querySelector<HTMLElement>('.lbar i');
preloadArt((k) => bar && (bar.style.width = `${Math.round(k * 100)}%`)).then(() => {
  warmMips(); // cópias reduzidas do cenário, fora da thread, antes do primeiro quadro
  last = performance.now();
  requestAnimationFrame(frame);
  warmPortraits(() => app.home); // retratos do Bingo Book e do Kage, aos poucos, com o jogo ocioso
  loading?.classList.add('done');
  setTimeout(() => loading?.remove(), 400);
});

// PWA: manifesto e ícone (de public/, servidos fora do bundle — por isso entram aqui e não no index.html)
// + service worker: tornam o jogo instalável (abre em tela cheia, deitado, sem a barra do navegador)
for (const [rel, href] of [['manifest', '/app.webmanifest'], ['apple-touch-icon', '/app-icons/apple-touch-icon.png']]) {
  const link = document.createElement('link');
  link.rel = rel!;
  link.href = href!;
  document.head.append(link);
}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw-v1.js').catch(() => {});

// útil para depurar no console do navegador
(window as unknown as { vila: App }).vila = app;
/**
 * Medição no console: `bench()` mede quanto custa (ms) desenhar o mapa, um passo da simulação (numa CÓPIA do estado,
 * sem mexer no jogo) e atualizar a interface aberta; `bench(n)` repete n vezes (padrão 30).
 */
(window as unknown as { renderer: Renderer }).renderer = renderer; // inspeção no console
(window as unknown as { bench: (n?: number) => object }).bench = (n = 30) => {
  const time = (f: () => void) => {
    const t = performance.now();
    for (let i = 0; i < n; i++) f();
    return +((performance.now() - t) / n).toFixed(2);
  };
  const prof: Record<string, number> = {};
  renderer.prof = prof;
  const render = time(() => renderer.render(app.game, camera, app.ghost, clock, app));
  renderer.prof = null;
  // ms por etapa do desenho (média dos n quadros)
  const steps = Object.fromEntries(Object.entries(prof).map(([k, v]) => [k, +(v / n).toFixed(2)]));
  const ui1 = time(() => ui.update(1 / 60, clock));
  const copy = new (home.constructor as new (s: unknown, sys: unknown) => typeof home)(JSON.parse(JSON.stringify(home.state)), SYSTEMS);
  const simProf: Record<string, number> = {};
  copy.prof = simProf;
  const sim = time(() => copy.step(SIM_DT));
  // ms por sistema num passo (média dos n), só os que pesam
  const simSteps = Object.fromEntries(
    Object.entries(simProf)
      .map(([k, v]) => [k, +(v / n).toFixed(3)] as const)
      .filter(([, v]) => v >= 0.005)
      .sort((a, b) => b[1] - a[1]),
  );
  return { render, steps, sim, simSteps, ui: ui1, frameAt3x: +(render + sim * 3 + ui1).toFixed(2), units: home.state.units.length, nodes: home.state.nodes.length, zoom: camera.zoom };
};
