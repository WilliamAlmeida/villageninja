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

function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  // relógio das animações: congela junto com a simulação quando o jogo está pausado
  if (home.state.speed > 0) clock += dt;
  // a vila roda sempre (e puxa o mapa de missão junto: sceneRunSystem); a tela mostra o que o jogador olha
  const g = home;
  acc += dt * g.state.speed;
  let steps = 0;
  while (acc >= SIM_DT && steps < 12) {
    g.step(SIM_DT);
    acc -= SIM_DT;
    steps++;
  }
  if (steps >= 12) acc = 0;

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
