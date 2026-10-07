// Editor de cenário (ferramenta de desenvolvimento, http://localhost:3011/cenario): ajuste fino das construções e do
// cenário, salvo em src/data/layout.json (o jogo lê de lá — data/layout.ts). Mostra a peça escolhida num campo limpo
// com o renderer do jogo (o que se vê é o que o jogo desenha) e deixa:
// - Peças: pintar com pincel as partes da arte (muro da frente, postes, telhado do portão…) e dar a cada uma a âncora
//   (onde toca o chão: define quem fica na frente de quem) e a área de transparência;
// - Terreno: tamanho em tiles e quais tiles são muro (#) ou portão (g);
// - Arte: escala e deslocamento do desenho;
// - Pontos: porta, lugares do Exame, guarda da torre, chaminé;
// - Bonecos: vários ninjas de teste para arrastar ou mandar andar (caminho de verdade, respeitando muros e portão).
import { TILE } from '../../src/config';
import { Camera } from '../../src/core/camera';
import { project, unproject } from '../../src/core/iso';
import { BUILDING_LIST, BUILDINGS, type BuildingType } from '../../src/data/buildings';
import { encodeMask, layout, setLayout, touchLayout, type ArtLayout, type Layout, type TypeLayout } from '../../src/data/layout';
import { createNinja } from '../../src/game/entities';
import { Game } from '../../src/game/game';
import { followPath, setDestination } from '../../src/game/movement';
import { createNewGame } from '../../src/game/newGame';
import { statusSystem } from '../../src/game/systems/status';
import type { Building, ResourceNode, Site, Unit } from '../../src/game/types';
import { CENTER_TX, CENTER_TY, doorPos, T } from '../../src/game/world';
import { art, preloadArt } from '../../src/render/art';
import { maskOf } from '../../src/render/pieces';
import { Renderer } from '../../src/render/renderer';

// ------------------------------------------------------------------ itens
type Item = { kind: 'building' | 'site' | 'node'; type: string; artName: string; label: string; level: number };
const ITEMS: Item[] = [];
for (const d of BUILDING_LIST) {
  const maxLv = d.type === 'hokage' ? 4 : 3;
  for (let lv = 1; lv <= maxLv; lv++) {
    const artName = lv === 1 ? d.type : `${d.type}-${lv}`;
    if (lv > 1 && !art(artName)) continue;
    ITEMS.push({ kind: 'building', type: d.type, artName, label: lv === 1 ? d.name : `${d.name} · nível ${lv}`, level: lv });
  }
}
for (const [type, artName, label] of [['ruin', 'ruin', 'Ruínas'], ['cave', 'cave', 'Entrada de mina'], ['chest', 'chest', 'Baú'], ['chest', 'chest-open', 'Baú aberto']] as const)
  ITEMS.push({ kind: 'site', type, artName, label, level: 1 });
for (const [artName, label] of [['tree0', 'Árvore folhosa'], ['tree1', 'Pinheiro'], ['stump', 'Toco'], ['rock', 'Rocha'], ['rock-cracked', 'Rocha rachada'], ['ore', 'Veio de ferro'], ['herb', 'Erva']] as const)
  ITEMS.push({ kind: 'node', type: artName, artName, label, level: 1 });

const PIECE_COLORS = ['#ff5a5a', '#4da6ff', '#7ddc6b', '#ffd34d', '#e05ad1', '#5ad1c8', '#ff8a2b', '#b39cff', '#ffffff'];

// ------------------------------------------------------------------ o campo
const base = createNewGame([], 777);
const s = base.state;
s.buildings = [];
s.nodes = [];
s.units = [];
s.sites = [];
s.tiles = s.tiles.map(() => T.GRASS);
s.explored = s.explored.map(() => -1);
s.time = 50;
const dummies: Unit[] = [];
function dummySystem(g: Game, dt: number) {
  for (const u of dummies) {
    u.dead = false;
    if (u.hasGoal && followPath(g, u, dt)) u.hasGoal = false;
    if (!u.hasGoal) u.moving = false;
  }
}
const g = new Game(s, [statusSystem, dummySystem]);

let item: Item = ITEMS.find((i) => i.artName === 'arena') ?? ITEMS[0]!;
type Mode = 'pieces' | 'tiles' | 'art' | 'points' | 'dummies';
let mode: Mode = 'pieces' as Mode;
let building: Building | null = null;
let site: Site | null = null;
let activePiece = 1;
let brush = 12;
let erase = false;
let pending: { kind: 'anchor' | 'fade' | 'point'; piece?: number; name?: string } | null = null;
let selDummy: Unit | null = null;
let dirty = false;

const L = (): Layout => layout();
const artL = (): ArtLayout => (L().arts[item.artName] ??= {});
const typeL = (): TypeLayout => (L().types[item.type] ??= {});
const clean = () => {
  // tira entradas vazias para o JSON ficar enxuto
  for (const k of Object.keys(L().arts)) if (!Object.keys(L().arts[k]!).length) delete L().arts[k];
  for (const k of Object.keys(L().types)) if (!Object.keys(L().types[k]!).length) delete L().types[k];
};

function place() {
  s.buildings = [];
  s.sites = [];
  s.nodes = [];
  building = null;
  site = null;
  if (item.kind === 'building') {
    const d = BUILDINGS[item.type as BuildingType];
    building = { id: 1, type: item.type as BuildingType, tx: CENTER_TX - Math.floor(d.w / 2), ty: CENTER_TY - Math.floor(d.h / 2), built: true, progress: d.buildTime, desired: 0, workers: [], cd: 0, level: item.type === 'hokage' ? undefined : item.level };
    s.level = item.type === 'hokage' ? item.level - 1 : 1;
    s.buildings.push(building);
  } else if (item.kind === 'site') {
    site = { id: 2, kind: item.type as Site['kind'], tx: CENTER_TX, ty: CENTER_TY, found: true, done: item.artName === 'chest-open' };
    s.sites.push(site);
  } else {
    const n: ResourceNode = { id: 3, type: 'tree', tx: CENTER_TX, ty: CENTER_TY, amount: 25, max: 25, variant: 0 };
    if (item.artName === 'tree1') n.variant = 1;
    if (item.artName === 'stump') n.amount = 2;
    if (item.artName.startsWith('rock') || item.artName === 'ore') Object.assign(n, { type: item.artName === 'ore' ? 'ore' : 'rock', amount: item.artName === 'rock-cracked' ? 10 : 40, max: 40 });
    if (item.artName === 'herb') Object.assign(n, { type: 'herb', amount: 10, max: 10 });
    s.nodes.push(n);
  }
  g.reindex();
  g.world.rebuild();
}

// ------------------------------------------------------------------ máscara (peças)
const masks = new Map<string, Uint8Array>();
let overlay: { canvas: HTMLCanvasElement; img: ImageData; alpha: Uint8ClampedArray } | null = null;

function pic() {
  return art(item.artName);
}
function canPaint() {
  return (item.kind === 'building' || (item.kind === 'site' && item.type !== 'chest')) && !!pic()?.naturalWidth;
}
/** Máscara de trabalho da arte atual (cria vazia). */
function mask(): Uint8Array | null {
  const p = pic();
  if (!p?.naturalWidth) return null;
  let m = masks.get(item.artName);
  if (!m) {
    m = maskOf(item.artName, p.naturalWidth, p.naturalHeight) ?? new Uint8Array(p.naturalWidth * p.naturalHeight);
    masks.set(item.artName, m);
  }
  return m;
}
function buildOverlay() {
  const p = pic();
  const m = mask();
  if (!p || !m) return (overlay = null);
  const W = p.naturalWidth;
  const H = p.naturalHeight;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const cx = c.getContext('2d')!;
  cx.drawImage(p, 0, 0);
  const alpha = new Uint8ClampedArray(W * H);
  const src = cx.getImageData(0, 0, W, H).data;
  for (let i = 0; i < W * H; i++) alpha[i] = src[i * 4 + 3]!;
  const img = cx.createImageData(W, H);
  overlay = { canvas: c, img, alpha };
  for (let i = 0; i < W * H; i++) paintPx(i, m[i]!);
  cx.putImageData(img, 0, 0);
}
function paintPx(i: number, v: number) {
  const o = overlay!;
  const d = o.img.data;
  if (!v || !o.alpha[i]) {
    d[i * 4 + 3] = 0;
    return;
  }
  const c = parseInt(PIECE_COLORS[(v - 1) % PIECE_COLORS.length]!.slice(1), 16);
  d[i * 4] = (c >> 16) & 255;
  d[i * 4 + 1] = (c >> 8) & 255;
  d[i * 4 + 2] = c & 255;
  d[i * 4 + 3] = 120;
}
function commitMask() {
  const m = mask();
  const p = pic();
  if (!m || !p) return;
  const a = artL();
  a.mask = encodeMask(m);
  a.maskW = p.naturalWidth;
  a.maskH = p.naturalHeight;
  touchLayout();
  changed();
}

// ------------------------------------------------------------------ desfazer
const undo: string[] = [];
function snapshot() {
  undo.push(JSON.stringify({ name: item.artName, type: item.type, art: L().arts[item.artName] ?? null, typeL: L().types[item.type] ?? null, mask: masks.has(item.artName) ? encodeMask(masks.get(item.artName)!) : null, w: item.kind === 'building' ? BUILDINGS[item.type as BuildingType].w : null, h: item.kind === 'building' ? BUILDINGS[item.type as BuildingType].h : null }));
  if (undo.length > 40) undo.shift();
}
function doUndo() {
  const raw = undo.pop();
  if (!raw) return;
  const u = JSON.parse(raw);
  if (u.art) L().arts[u.name] = u.art;
  else delete L().arts[u.name];
  if (u.typeL) L().types[u.type] = u.typeL;
  else delete L().types[u.type];
  if (u.w && u.h) Object.assign(BUILDINGS[u.type as BuildingType], { w: u.w, h: u.h });
  masks.delete(u.name);
  if (u.name === item.artName) buildOverlay();
  touchLayout();
  place();
  changed();
  renderProps();
}

// ------------------------------------------------------------------ coordenadas
const view = document.getElementById('view') as HTMLCanvasElement;
const over = document.getElementById('over') as HTMLCanvasElement;
const octx = over.getContext('2d')!;
const renderer = new Renderer(view);
const camera = new Camera();
let dpr = 1;
function resize() {
  const r = view.parentElement!.getBoundingClientRect();
  renderer.resize(r.width, r.height);
  camera.resize(r.width, r.height);
  dpr = Math.min(2, window.devicePixelRatio || 1);
  over.width = Math.round(r.width * dpr);
  over.height = Math.round(r.height * dpr);
}
window.addEventListener('resize', resize);
resize();
camera.maxZoom = 16; // bem mais perto que o jogo, para pintar pixel a pixel
camera.zoom = 2.2;
const cx0 = CENTER_TX * TILE + TILE / 2;
const cy0 = CENTER_TY * TILE + TILE / 2;
camera.jump(cx0, cy0);

const sceneToScreen = (x: number, y: number) => ({ x: (x - camera.left) * camera.zoom, y: (y - camera.top) * camera.zoom });
const screenToScene = (x: number, y: number) => ({ x: x / camera.zoom + camera.left, y: y / camera.zoom + camera.top });
const worldToScreen = (wx: number, wy: number) => {
  const p = project(wx, wy);
  return sceneToScreen(p.x, p.y);
};
const screenToWorld = (x: number, y: number) => {
  const p = screenToScene(x, y);
  return unproject(p.x, p.y);
};
/** Retângulo da arte na cena. */
function box() {
  if (building) {
    const b = renderer.artBox(building, s.level);
    return b ? { left: b.left, top: b.top, w: b.w, h: b.h, x: b.x, baseY: b.baseY } : null;
  }
  if (site) {
    const p = project(site.tx * TILE + TILE / 2, site.ty * TILE + TILE / 2);
    const b = renderer.siteBox(site, p.x, p.y);
    return b ? { left: b.left, top: b.top, w: b.w, h: b.h, x: b.x, baseY: b.y } : null;
  }
  return null;
}
/** Tela → pixel da imagem (e 0–1). */
function toImage(sx: number, sy: number) {
  const b = box();
  const p = pic();
  if (!b || !p) return null;
  const sc = screenToScene(sx, sy);
  const u = (sc.x - b.left) / b.w;
  const v = (sc.y - b.top) / b.h;
  return { u, v, ix: Math.floor(u * p.naturalWidth), iy: Math.floor(v * p.naturalHeight) };
}
const imgToScreen = (u: number, v: number) => {
  const b = box()!;
  return sceneToScreen(b.left + u * b.w, b.top + v * b.h);
};

// ------------------------------------------------------------------ terreno (tiles)
function gridInfo() {
  if (building) {
    const d = BUILDINGS[building.type];
    return { x0: building.tx, y0: building.ty, w: d.w, h: d.h };
  }
  if (site) {
    const t = typeL();
    const h = t.tiles?.length ?? 3;
    const w = t.tiles ? Math.max(...t.tiles.map((r) => r.length)) : 3;
    const [ox, oy] = t.origin ?? [Math.floor(w / 2), Math.floor(h / 2)];
    return { x0: site.tx - ox, y0: site.ty - oy, w, h };
  }
  return null;
}
function tileRows(): string[] {
  const gi = gridInfo()!;
  const t = typeL().tiles;
  const def = building && !BUILDINGS[building.type].walkable ? '#' : '.';
  return Array.from({ length: gi.h }, (_, y) => Array.from({ length: gi.w }, (_, x) => t?.[y]?.[x] ?? def).join(''));
}

// ------------------------------------------------------------------ pontos
type PointDef = { name: string; label: string; scene?: boolean };
function pointDefs(): PointDef[] {
  if (!building) return [];
  const out: PointDef[] = [{ name: 'door', label: 'Porta (onde entram e saem)' }];
  if (building.type === 'arena')
    out.push({ name: 'center', label: 'Centro do chão de luta' }, { name: 'edge', label: 'Borda do chão de luta (raio)' }, { name: 'left', label: 'Lutador 1' }, { name: 'right', label: 'Lutador 2' }, { name: 'stands', label: 'Começo da plateia' });
  if (building.type === 'tower') out.push({ name: 'guard', label: 'Guarda (no alto, nesta arte)', scene: true });
  if (building.type === 'house') out.push({ name: 'chimney', label: 'Chaminé (nesta arte)', scene: true });
  return out;
}
function pointPos(pd: PointDef): { x: number; y: number } | null {
  if (!building) return null;
  if (pd.scene) {
    const m = artL().marks?.[pd.name];
    const b = box();
    return m && b ? sceneToScreen(b.x + m[0], b.baseY + m[1]) : null;
  }
  const p = typeL().points?.[pd.name];
  if (p) return worldToScreen(building.tx * TILE + p[0], building.ty * TILE + p[1]);
  if (pd.name === 'door') {
    const d = doorPos(building);
    return worldToScreen(d.x, d.y);
  }
  return null;
}

// ------------------------------------------------------------------ painel da direita
const props = document.getElementById('props')!;
const help = document.getElementById('help')!;
const statusEl = document.getElementById('status')!;
function changed() {
  dirty = true;
  statusEl.textContent = 'Alterado (não salvo)';
}
const HELP: Record<Mode, string> = {
  pieces: 'Pinte arrastando com o botão esquerdo · Borracha devolve ao "resto" · "Âncora": clique onde a peça toca o chão · roda do mouse: zoom · Alt+arrastar ou botão do meio: mover a vista',
  tiles: 'Clique num tile para trocar: livre → muro → portão. Muro bloqueia todo mundo; portão é por onde se entra.',
  art: 'Ajuste a escala e o deslocamento do desenho (também dá para arrastar a arte com o botão esquerdo).',
  points: 'Escolha o ponto à direita e clique no lugar dele na cena.',
  dummies: 'Botão esquerdo: escolher/arrastar boneco · Botão direito: o boneco escolhido anda até lá pelo caminho de verdade.',
};

function renderProps() {
  help.textContent = HELP[mode];
  document.getElementById('title')!.textContent = item.label;
  let h = '';
  if (mode === 'pieces') {
    if (!canPaint()) h += `<p class="hint">${item.kind === 'node' ? 'Objetos simples (árvore, rocha) não têm peças: ajuste em "Arte".' : 'Sem arte para pintar.'}</p>`;
    else {
      const a = artL();
      const pieces = a.pieces ?? [];
      h += `<h3>Peças</h3><p class="hint">O que não for pintado é o "resto". Cada peça é desenhada na profundidade da sua âncora.</p>`;
      h += `<div class="row"><label><input type="checkbox" id="ground" ${(a.ground ?? !!(building && BUILDINGS[building.type].walkable)) ? 'checked' : ''}> Resto no chão (sob todos)</label></div>`;
      h += `<div class="row"><button id="restfade">${pending?.kind === 'fade' && pending.piece === 0 ? 'Arraste na cena…' : 'Transparência do resto'}</button>${a.fade ? '<button id="restfadeclr">limpar</button>' : ''}</div>`;
      pieces.forEach((p, i) => {
        const n = i + 1;
        h += `<div class="piece ${activePiece === n ? 'on' : ''}" style="--c:${PIECE_COLORS[i % PIECE_COLORS.length]}" data-piece="${n}">
          <div class="row"><input type="text" data-name="${n}" value="${p.name.replace(/"/g, '&quot;')}"><button data-del="${n}" title="Apagar peça">✕</button></div>
          <div class="row"><button data-anchor="${n}" class="${pending?.kind === 'anchor' && pending.piece === n ? 'on' : ''}">Âncora</button><button data-fade="${n}" class="${pending?.kind === 'fade' && pending.piece === n ? 'on' : ''}">Transparência</button>${p.fade ? `<button data-fadeclr="${n}">sem área</button>` : ''}</div></div>`;
      });
      h += `<div class="row"><button id="addpiece">+ Nova peça</button></div>`;
      h += `<h3>Pincel</h3><div class="row"><button id="brushpaint" class="${!erase ? 'on' : ''}">Pincel</button><button id="brusherase" class="${erase ? 'on' : ''}">Borracha</button></div>
        <div class="row"><label>Tamanho</label><input type="range" id="brush" min="1" max="80" value="${brush}"><span>${brush}px</span></div>
        <div class="row"><button id="clearmask">Limpar pintura</button></div>`;
    }
  } else if (mode === 'tiles') {
    const gi = gridInfo();
    if (!gi) h += `<p class="hint">Objetos simples não ocupam tiles.</p>`;
    else {
      h += `<h3>Terreno</h3><div class="legend"><span><i style="background:rgba(125,220,107,.6)"></i>livre</span><span><i style="background:rgba(255,90,90,.7)"></i>muro</span><span><i style="background:rgba(255,211,77,.8)"></i>portão</span></div>`;
      h += `<div class="row"><label>Largura</label><input type="number" id="tw" min="1" max="10" value="${gi.w}"><label>Altura</label><input type="number" id="th" min="1" max="10" value="${gi.h}"></div>`;
      if (building) h += `<p class="warn">Mudar o tamanho de um prédio muda o jogo: saves com ele construído podem ficar encostados em outro prédio.</p>`;
      if (site) h += `<p class="hint">Locais: Shift+clique escolhe o tile onde o local fica (origem).</p>`;
      h += `<div class="row"><button id="tilesreset">Voltar ao padrão</button></div>`;
    }
  } else if (mode === 'art') {
    const a = artL();
    h += `<h3>Arte</h3><div class="row"><label>Escala</label><input type="range" id="scale" min="0.4" max="2" step="0.01" value="${a.scale ?? 1}"><span>${(a.scale ?? 1).toFixed(2)}</span></div>
      <div class="row"><label>X</label><input type="number" id="dx" step="1" value="${a.dx ?? 0}"><label>Y</label><input type="number" id="dy" step="1" value="${a.dy ?? 0}"></div>
      <div class="row"><button id="artreset">Voltar ao padrão</button></div>`;
  } else if (mode === 'points') {
    const defs = pointDefs();
    if (!defs.length) h += `<p class="hint">Sem pontos especiais para este item.</p>`;
    for (const pd of defs) {
      const has = pd.scene ? !!artL().marks?.[pd.name] : !!typeL().points?.[pd.name];
      h += `<div class="row"><button data-point="${pd.name}" class="${pending?.kind === 'point' && pending.name === pd.name ? 'on' : ''}">${pd.label}</button>${has ? `<button data-pointclr="${pd.name}">padrão</button>` : '<small class="hint">padrão</small>'}</div>`;
    }
  } else {
    h += `<h3>Bonecos de teste</h3><p class="hint">${dummies.length} boneco(s). Eles não são salvos.</p><div class="row"><button id="adddummy">+ Boneco</button><button id="cleardummy">Tirar todos</button></div>`;
  }
  props.innerHTML = h;
}

props.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const a = artL();
  const id = t.id;
  const num = (k: string) => Number(t.dataset[k]);
  if (t.closest('[data-piece]') && !t.closest('button') && !t.closest('input')) activePiece = Number(t.closest<HTMLElement>('[data-piece]')!.dataset.piece);
  if (id === 'addpiece') {
    snapshot();
    a.pieces = [...(a.pieces ?? []), { name: `Peça ${(a.pieces?.length ?? 0) + 1}`, ax: 0.5, ay: 0.9 }];
    activePiece = a.pieces.length;
    commitMask();
  }
  if (t.dataset.del) {
    snapshot();
    const n = num('del');
    a.pieces!.splice(n - 1, 1);
    const m = mask()!;
    for (let i = 0; i < m.length; i++) if (m[i] === n) m[i] = 0;
    else if (m[i]! > n) m[i]!--;
    if (!a.pieces!.length) {
      delete a.pieces;
      delete a.mask;
      delete a.maskW;
      delete a.maskH;
    }
    activePiece = Math.max(1, Math.min(activePiece, a.pieces?.length ?? 1));
    buildOverlay();
    if (a.pieces) commitMask();
    else {
      touchLayout();
      changed();
    }
  }
  if (t.dataset.anchor) pending = { kind: 'anchor', piece: num('anchor') };
  if (t.dataset.fade) pending = { kind: 'fade', piece: num('fade') };
  if (t.dataset.fadeclr) {
    snapshot();
    delete a.pieces![num('fadeclr') - 1]!.fade;
    touchLayout();
    changed();
  }
  if (id === 'restfade') pending = { kind: 'fade', piece: 0 };
  if (id === 'restfadeclr') {
    snapshot();
    delete a.fade;
    touchLayout();
    changed();
  }
  if (id === 'brushpaint') erase = false;
  if (id === 'brusherase') erase = true;
  if (id === 'clearmask') {
    snapshot();
    mask()!.fill(0);
    buildOverlay();
    commitMask();
  }
  if (id === 'tilesreset') {
    snapshot();
    const tl = typeL();
    delete tl.tiles;
    delete tl.origin;
    if (building) {
      delete tl.w;
      delete tl.h;
    }
    clean();
    place();
    changed();
  }
  if (id === 'artreset') {
    snapshot();
    delete a.scale;
    delete a.dx;
    delete a.dy;
    touchLayout();
    changed();
  }
  if (t.dataset.point) pending = { kind: 'point', name: t.dataset.point };
  if (t.dataset.pointclr) {
    snapshot();
    delete typeL().points?.[t.dataset.pointclr];
    delete artL().marks?.[t.dataset.pointclr];
    clean();
    changed();
  }
  if (id === 'adddummy') addDummy();
  if (id === 'cleardummy') {
    for (const u of dummies) u.dead = true;
    s.units = [];
    dummies.length = 0;
    selDummy = null;
    g.reindex();
  }
  renderProps();
});
props.addEventListener('input', (e) => {
  const t = e.target as HTMLInputElement;
  const a = artL();
  if (t.dataset.name) {
    a.pieces![Number(t.dataset.name) - 1]!.name = t.value;
    changed();
    return;
  }
  if (t.id === 'ground') {
    snapshot();
    a.ground = t.checked;
    touchLayout();
    changed();
  }
  if (t.id === 'brush') {
    brush = Number(t.value);
    (t.nextElementSibling as HTMLElement).textContent = `${brush}px`;
  }
  if (t.id === 'scale' || t.id === 'dx' || t.id === 'dy') {
    if (t.id === 'scale') {
      a.scale = Number(t.value);
      (t.nextElementSibling as HTMLElement).textContent = a.scale.toFixed(2);
    } else a[t.id as 'dx' | 'dy'] = Number(t.value);
    touchLayout();
    changed();
  }
  if (t.id === 'tw' || t.id === 'th') {
    snapshot();
    const gi = gridInfo()!;
    const w = t.id === 'tw' ? Math.max(1, Number(t.value)) : gi.w;
    const h = t.id === 'th' ? Math.max(1, Number(t.value)) : gi.h;
    const rows = tileRows();
    const def = building && !BUILDINGS[building.type].walkable ? '#' : '.';
    typeL().tiles = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => rows[y]?.[x] ?? def).join(''));
    if (building) {
      typeL().w = w;
      typeL().h = h;
      Object.assign(BUILDINGS[building.type], { w, h });
    }
    place();
    changed();
  }
});

// ------------------------------------------------------------------ cena: mouse
let drag: { kind: 'paint' | 'pan' | 'art' | 'dummy' | 'fade'; x: number; y: number; ox?: number; oy?: number; u0?: number; v0?: number } | null = null;
let mouse = { x: 0, y: 0 };

function paintAt(sx: number, sy: number) {
  const im = toImage(sx, sy);
  const p = pic();
  const m = mask();
  if (!im || !p || !m || !overlay) return;
  const W = p.naturalWidth;
  const H = p.naturalHeight;
  const r = Math.max(1, Math.round((brush * W) / (box()!.w * camera.zoom))); // pincel em px de tela
  const v = erase ? 0 : activePiece;
  for (let y = im.iy - r; y <= im.iy + r; y++)
    for (let x = im.ix - r; x <= im.ix + r; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H || (x - im.ix) ** 2 + (y - im.iy) ** 2 > r * r) continue;
      const i = y * W + x;
      m[i] = v;
      paintPx(i, v);
    }
  overlay.canvas.getContext('2d')!.putImageData(overlay.img, 0, 0);
}

over.addEventListener('contextmenu', (e) => e.preventDefault());
over.addEventListener('wheel', (e) => {
  e.preventDefault();
  camera.zoomAt(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.offsetX, e.offsetY);
}, { passive: false });
over.addEventListener('pointerdown', (e) => {
  over.setPointerCapture(e.pointerId);
  const x = e.offsetX;
  const y = e.offsetY;
  if (e.button === 1 || (e.button === 0 && e.altKey)) {
    drag = { kind: 'pan', x, y };
    return;
  }
  if (e.button === 2) {
    if (selDummy) {
      const w = screenToWorld(x, y);
      setDestination(g, selDummy, w.x, w.y);
    }
    return;
  }
  // ações pendentes (âncora, área, ponto)
  if (pending?.kind === 'anchor') {
    const im = toImage(x, y);
    if (im) {
      snapshot();
      const pc = artL().pieces![pending.piece! - 1]!;
      pc.ax = +im.u.toFixed(4);
      pc.ay = +im.v.toFixed(4);
      touchLayout();
      changed();
    }
    pending = null;
    renderProps();
    return;
  }
  if (pending?.kind === 'fade') {
    const im = toImage(x, y);
    if (im) {
      snapshot();
      drag = { kind: 'fade', x, y, u0: im.u, v0: im.v };
    }
    return;
  }
  if (pending?.kind === 'point' && building) {
    const pd = pointDefs().find((p) => p.name === pending!.name)!;
    snapshot();
    if (pd.scene) {
      const b = box()!;
      const sc = screenToScene(x, y);
      (artL().marks ??= {})[pd.name] = [Math.round(sc.x - b.x), Math.round(sc.y - b.baseY)];
    } else {
      const w = screenToWorld(x, y);
      (typeL().points ??= {})[pd.name] = [Math.round(w.x - building.tx * TILE), Math.round(w.y - building.ty * TILE)];
    }
    pending = null;
    changed();
    renderProps();
    return;
  }
  if (mode === 'dummies' || (mode !== 'pieces' && mode !== 'tiles' && mode !== 'art')) {
    const w = screenToWorld(x, y);
    selDummy = dummies.reduce<Unit | null>((best, u) => (Math.hypot(u.x - w.x, u.y - w.y) < 24 && (!best || Math.hypot(u.x - w.x, u.y - w.y) < Math.hypot(best.x - w.x, best.y - w.y)) ? u : best), null);
    if (selDummy) drag = { kind: 'dummy', x, y };
    return;
  }
  if (mode === 'pieces' && canPaint()) {
    if (!artL().pieces?.length) {
      snapshot();
      artL().pieces = [{ name: 'Peça 1', ax: 0.5, ay: 0.9 }];
      activePiece = 1;
      renderProps();
    } else snapshot();
    drag = { kind: 'paint', x, y };
    paintAt(x, y);
    return;
  }
  if (mode === 'tiles') {
    const gi = gridInfo();
    if (!gi) return;
    const w = screenToWorld(x, y);
    const tx = Math.floor(w.x / TILE) - gi.x0;
    const ty = Math.floor(w.y / TILE) - gi.y0;
    if (tx < 0 || ty < 0 || tx >= gi.w || ty >= gi.h) return;
    snapshot();
    if (site && e.shiftKey) {
      typeL().origin = [tx, ty];
      typeL().tiles = tileRows();
    } else {
      const rows = tileRows().map((r) => r.split(''));
      const cur = rows[ty]![tx]!;
      rows[ty]![tx] = cur === '.' ? '#' : cur === '#' ? 'g' : '.';
      typeL().tiles = rows.map((r) => r.join(''));
    }
    place();
    changed();
    return;
  }
  if (mode === 'art' && box()) {
    snapshot();
    drag = { kind: 'art', x, y, ox: artL().dx ?? 0, oy: artL().dy ?? 0 };
  }
});
over.addEventListener('pointermove', (e) => {
  mouse = { x: e.offsetX, y: e.offsetY };
  if (!drag) return;
  if (drag.kind === 'pan') {
    camera.x -= (e.offsetX - drag.x) / camera.zoom;
    camera.y -= (e.offsetY - drag.y) / camera.zoom;
    drag.x = e.offsetX;
    drag.y = e.offsetY;
  } else if (drag.kind === 'paint') paintAt(e.offsetX, e.offsetY);
  else if (drag.kind === 'art') {
    const a = artL();
    a.dx = Math.round(drag.ox! + (e.offsetX - drag.x) / camera.zoom);
    a.dy = Math.round(drag.oy! + (e.offsetY - drag.y) / camera.zoom);
    touchLayout();
    changed();
  } else if (drag.kind === 'dummy' && selDummy) {
    const w = screenToWorld(e.offsetX, e.offsetY);
    selDummy.x = w.x;
    selDummy.y = w.y;
    selDummy.hasGoal = false;
  }
});
over.addEventListener('pointerup', (e) => {
  if (drag?.kind === 'paint') commitMask();
  if (drag?.kind === 'art') renderProps();
  if (drag?.kind === 'fade' && pending) {
    const im = toImage(e.offsetX, e.offsetY);
    if (im) {
      const r: [number, number, number, number] = [Math.min(drag.u0!, im.u), Math.min(drag.v0!, im.v), Math.max(drag.u0!, im.u), Math.max(drag.v0!, im.v)].map((v) => +v.toFixed(4)) as [number, number, number, number];
      if (pending.piece === 0) artL().fade = r;
      else artL().pieces![pending.piece! - 1]!.fade = r;
      touchLayout();
      changed();
    }
    pending = null;
    renderProps();
  }
  drag = null;
});

function addDummy() {
  const u = createNinja(g, cx0 + (dummies.length % 4) * 18 - 27, cy0 + 120 + Math.floor(dummies.length / 4) * 18, 'genin', 0);
  u.name = `Boneco ${dummies.length + 1}`;
  dummies.push(u);
  selDummy = u;
}

// ------------------------------------------------------------------ desenho das sobreposições
function drawOverlay() {
  octx.setTransform(dpr, 0, 0, dpr, 0, 0);
  octx.clearRect(0, 0, over.width, over.height);
  const b = box();
  // máscara pintada
  if (mode === 'pieces' && b && overlay) {
    const tl = sceneToScreen(b.left, b.top);
    octx.imageSmoothingEnabled = false;
    octx.drawImage(overlay.canvas, tl.x, tl.y, b.w * camera.zoom, b.h * camera.zoom);
  }
  // âncoras e áreas de transparência
  if (mode === 'pieces' && b) {
    const a = artL();
    (a.pieces ?? []).forEach((p, i) => {
      const c = PIECE_COLORS[i % PIECE_COLORS.length]!;
      const q = imgToScreen(p.ax, p.ay);
      octx.strokeStyle = '#000';
      octx.lineWidth = 4;
      cross(q.x, q.y, 9);
      octx.strokeStyle = c;
      octx.lineWidth = 2;
      cross(q.x, q.y, 9);
      octx.fillStyle = c;
      octx.font = 'bold 11px system-ui';
      octx.fillText(p.name, q.x + 8, q.y - 6);
      if (p.fade) rect01(p.fade, c);
    });
    if (a.fade) rect01(a.fade, '#ffffff');
  }
  // tiles
  if (mode === 'tiles') {
    const gi = gridInfo();
    if (gi) {
      const rows = tileRows();
      for (let y = 0; y < gi.h; y++)
        for (let x = 0; x < gi.w; x++) {
          const c = rows[y]![x]!;
          const tx = gi.x0 + x;
          const ty = gi.y0 + y;
          const p = [worldToScreen(tx * TILE, ty * TILE), worldToScreen((tx + 1) * TILE, ty * TILE), worldToScreen((tx + 1) * TILE, (ty + 1) * TILE), worldToScreen(tx * TILE, (ty + 1) * TILE)];
          octx.beginPath();
          p.forEach((q, i) => (i ? octx.lineTo(q.x, q.y) : octx.moveTo(q.x, q.y)));
          octx.closePath();
          octx.fillStyle = c === '#' ? 'rgba(255,90,90,0.45)' : c === 'g' ? 'rgba(255,211,77,0.55)' : 'rgba(125,220,107,0.25)';
          octx.fill();
          octx.strokeStyle = 'rgba(0,0,0,0.5)';
          octx.lineWidth = 1;
          octx.stroke();
        }
      if (site) {
        const [ox, oy] = typeL().origin ?? [Math.floor(gi.w / 2), Math.floor(gi.h / 2)];
        const q = worldToScreen((gi.x0 + ox + 0.5) * TILE, (gi.y0 + oy + 0.5) * TILE);
        octx.strokeStyle = '#fff';
        octx.lineWidth = 2;
        cross(q.x, q.y, 7);
      }
    }
  }
  // pontos
  if (mode === 'points') {
    for (const pd of pointDefs()) {
      const q = pointPos(pd);
      if (!q) continue;
      octx.fillStyle = typeL().points?.[pd.name] || artL().marks?.[pd.name] ? '#ffd34d' : '#a89070';
      octx.beginPath();
      octx.arc(q.x, q.y, 5, 0, Math.PI * 2);
      octx.fill();
      octx.strokeStyle = '#000';
      octx.stroke();
      octx.font = 'bold 11px system-ui';
      octx.fillText(pd.label, q.x + 8, q.y - 6);
    }
  }
  // bonecos: anel de quem está escolhido e destino
  for (const u of dummies) {
    const q = worldToScreen(u.x, u.y);
    if (u === selDummy) {
      octx.strokeStyle = '#ffd34d';
      octx.lineWidth = 2;
      octx.beginPath();
      octx.ellipse(q.x, q.y + 7 * camera.zoom, 11 * camera.zoom, 5 * camera.zoom, 0, 0, Math.PI * 2);
      octx.stroke();
      if (u.hasGoal) {
        const t = worldToScreen(u.goalX, u.goalY);
        octx.fillStyle = '#ffd34d';
        octx.beginPath();
        octx.arc(t.x, t.y, 4, 0, Math.PI * 2);
        octx.fill();
      }
    }
  }
  // pincel
  if (mode === 'pieces' && canPaint() && !pending) {
    octx.strokeStyle = erase ? '#fff' : PIECE_COLORS[(activePiece - 1) % PIECE_COLORS.length]!;
    octx.lineWidth = 1;
    octx.beginPath();
    octx.arc(mouse.x, mouse.y, brush, 0, Math.PI * 2);
    octx.stroke();
  }
}
function cross(x: number, y: number, r: number) {
  octx.beginPath();
  octx.moveTo(x - r, y);
  octx.lineTo(x + r, y);
  octx.moveTo(x, y - r);
  octx.lineTo(x, y + r);
  octx.stroke();
}
function rect01(r: [number, number, number, number], c: string) {
  const a = imgToScreen(r[0], r[1]);
  const b = imgToScreen(r[2], r[3]);
  octx.setLineDash([5, 4]);
  octx.strokeStyle = c;
  octx.lineWidth = 1.5;
  octx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
  octx.setLineDash([]);
}

// ------------------------------------------------------------------ lista, modos, salvar
const list = document.getElementById('list')!;
const filter = document.getElementById('filter') as HTMLInputElement;
function renderList() {
  const q = filter.value.toLowerCase();
  let h = '';
  let last = '';
  for (const it of ITEMS) {
    if (q && !it.label.toLowerCase().includes(q) && !it.artName.includes(q)) continue;
    const grp = it.kind === 'building' ? 'Construções' : it.kind === 'site' ? 'Locais' : 'Cenário';
    if (grp !== last) h += `<h4>${grp}</h4>`;
    last = grp;
    const done = !!L().arts[it.artName] || !!L().types[it.type];
    h += `<button data-art="${it.artName}" class="${it === item ? 'on' : ''}">${it.label}${done ? ' <span class="dot">●</span>' : ''}</button>`;
  }
  list.innerHTML = h;
}
list.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-art]');
  if (!b) return;
  select(ITEMS.find((i) => i.artName === b.dataset.art)!);
});
filter.addEventListener('input', renderList);
function select(it: Item) {
  item = it;
  pending = null;
  activePiece = 1;
  place();
  buildOverlay();
  const b = box();
  camera.jump(cx0, cy0 - (b ? 0 : 0));
  renderList();
  renderProps();
}
document.getElementById('modes')!.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-mode]');
  if (!b) return;
  mode = b.dataset.mode as Mode;
  pending = null;
  document.querySelectorAll('#modes button').forEach((x) => x.classList.toggle('on', x === b));
  if (mode === 'dummies' && !dummies.length) addDummy();
  renderProps();
});
async function save() {
  clean();
  statusEl.textContent = 'Salvando…';
  const r = await fetch('/api/layout', { method: 'PUT', body: JSON.stringify(L(), null, 1) });
  statusEl.textContent = r.ok ? 'Salvo em src/data/layout.json (o jogo se refaz sozinho)' : `Erro: ${await r.text()}`;
  if (r.ok) dirty = false;
  renderList();
}
document.getElementById('save')!.addEventListener('click', save);
document.getElementById('undo')!.addEventListener('click', doUndo);
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    save();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault();
    doUndo();
  }
  if (e.key === 'Escape') {
    pending = null;
    renderProps();
  }
});
window.addEventListener('beforeunload', (e) => {
  if (dirty) e.preventDefault();
});

// ------------------------------------------------------------------ começa
async function start() {
  // o layout em uso é o do arquivo salvo (recarregado do servidor, sem cache do bundle)
  try {
    const r = await fetch('/api/layout');
    if (r.ok) {
      setLayout((await r.json()) as Layout);
      // tamanho do terreno salvo (o do bundle pode estar velho)
      for (const [t, tl] of Object.entries(L().types)) if (t in BUILDINGS && tl.w && tl.h) Object.assign(BUILDINGS[t as BuildingType], { w: tl.w, h: tl.h });
    }
  } catch {
    /* fica o do bundle */
  }
  await preloadArt();
  select(item);
  let last = performance.now();
  let clock = 0;
  const frame = (t: number) => {
    const dt = Math.min(0.1, (t - last) / 1000);
    last = t;
    clock += dt;
    g.step(dt);
    renderer.render(g, camera, null, clock);
    drawOverlay();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
start();
