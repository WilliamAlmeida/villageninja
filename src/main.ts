import type { App } from './app';
import { AUTOSAVE_INTERVAL, SIM_DT } from './config';
import { Camera } from './core/camera';
import { bus } from './core/events';
import { Input } from './core/input';
import { createNewGame } from './game/newGame';
import { clearSave, loadGame, saveGame } from './game/save';
import { SYSTEMS } from './game/systems';
import { sceneGame, sceneTeam } from './game/scene';
import { doorPos } from './game/world';
import { preloadArt } from './render/art';
import { Renderer } from './render/renderer';
import { createUI } from './ui';
import { applySettings, followCam } from './ui/settings';
import { FpsMeter } from './ui/fps';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui')!;

applySettings();
const camera = new Camera();
const renderer = new Renderer(canvas);

let home = loadGame(SYSTEMS) ?? createNewGame(SYSTEMS);
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
  orderMode: null,
  group: [],
  hoverUnitId: null,
  back: null,
  selectBox: null,
  selectTool: false,
  newGame() {
    clearSave();
    app.viewScene = false;
    home = createNewGame(SYSTEMS);
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
const input = new Input(canvas, camera);
input.onTap = ui.onTap;
input.onContext = ui.onContext;
input.onBox = ui.onBox;
input.onBoxCancel = () => (app.selectBox = null);
input.boxMode = () => app.selectTool && !app.buildType && !app.orderMode;
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

const fps = new FpsMeter();
fps.sync();
bus.on('fps', () => fps.sync());

function frame(now: number) {
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
  const budget = performance.now() + SIM_BUDGET_MS;
  let steps = 0;
  while (acc >= SIM_DT && steps < 12) {
    g.step(SIM_DT);
    acc -= SIM_DT;
    steps++;
    if (performance.now() > budget) break;
  }
  if (acc >= SIM_DT) acc = Math.min(acc, SIM_DT); // o que não coube fica para trás (não acumula)

  saveTimer += dt;
  if (saveTimer >= AUTOSAVE_INTERVAL) {
    saveTimer = 0;
    saveGame(g);
  }

  // a invasão acabou enquanto o jogador olhava: volta para a vila
  if (app.viewScene && !home.state.scene) app.setView(false);
  followSelected();
  camera.update(dt);
  // janela de gestão aberta cobre quase todo o mapa: desenha o fundo a ~12 quadros/s (a simulação segue igual).
  // Poupa a GPU/CPU para a janela (num save grande, mapa a 60 quadros + janela por cima travava as abas).
  winEl ??= document.getElementById('win');
  drawWait -= dt;
  if (!winEl || winEl.hidden || drawWait <= 0) {
    drawWait = 1 / 12;
    renderer.render(app.game, camera, app.ghost, clock, app);
  }
  ui.update(dt, clock);
  requestAnimationFrame(frame);
}

// só começa a desenhar com as imagens prontas (senão aparece o desenho antigo enquanto elas chegam)
const loading = document.getElementById('loading');
const bar = loading?.querySelector<HTMLElement>('.lbar i');
preloadArt((k) => bar && (bar.style.width = `${Math.round(k * 100)}%`)).then(() => {
  last = performance.now();
  requestAnimationFrame(frame);
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
  const render = time(() => renderer.render(app.game, camera, app.ghost, clock, app));
  const ui1 = time(() => ui.update(1 / 60, clock));
  const copy = new (home.constructor as new (s: unknown, sys: unknown) => typeof home)(JSON.parse(JSON.stringify(home.state)), SYSTEMS);
  const sim = time(() => copy.step(SIM_DT));
  return { render, sim, ui: ui1, frameAt3x: +(render + sim * 3 + ui1).toFixed(2), units: home.state.units.length, nodes: home.state.nodes.length };
};
