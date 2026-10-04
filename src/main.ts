import type { App } from './app';
import { AUTOSAVE_INTERVAL, SIM_DT } from './config';
import { Camera } from './core/camera';
import { bus } from './core/events';
import { Input } from './core/input';
import { createNewGame } from './game/newGame';
import { clearSave, loadGame, saveGame } from './game/save';
import { SYSTEMS } from './game/systems';
import { doorPos } from './game/world';
import { Renderer } from './render/renderer';
import { createUI } from './ui';
import { applySettings } from './ui/settings';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui')!;

applySettings();
const camera = new Camera();
const renderer = new Renderer(canvas);

const app: App = {
  game: loadGame(SYSTEMS) ?? createNewGame(SYSTEMS),
  camera,
  ghost: null,
  buildType: null,
  orderMode: null,
  group: [],
  hoverUnitId: null,
  selectBox: null,
  selectTool: false,
  newGame() {
    clearSave();
    app.game = createNewGame(SYSTEMS);
    centerOnVillage();
    bus.emit('newGame', undefined);
    saveGame(app.game);
  },
  save: () => saveGame(app.game),
};

function centerOnVillage() {
  const hk = app.game.hokage();
  if (hk) {
    const p = doorPos(hk);
    camera.x = p.x;
    camera.y = p.y;
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
  if (document.hidden) saveGame(app.game);
});
window.addEventListener('pagehide', () => saveGame(app.game));

// loop: simulação em passo fixo + render a cada frame
let last = performance.now();
let acc = 0;
let clock = 0;
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  // relógio das animações: congela junto com a simulação quando o jogo está pausado
  if (app.game.state.speed > 0) clock += dt;
  const g = app.game;
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

  camera.update(dt);
  renderer.render(g, camera, app.ghost, clock, app);
  ui.update(dt, clock);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// útil para depurar no console do navegador
(window as unknown as { vila: App }).vila = app;
