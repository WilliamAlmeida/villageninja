// Editor de sprites da Vila Ninja: monta o ninja em camadas igual ao jogo (src/render/doll.ts), anima e deixa editar
// pixel a pixel (lápis, borracha, conta-gotas) e mover uma camada num quadro ou na vista inteira. Também abre qualquer
// PNG de src/art. Salvar grava em src/art pelo servidor local (scripts/editor.ts).
import { ANBU_MASKS, DOLL_FRAME_PAD, DOLL_GRID, DOLL_HAIR, SWORDS, type DollPart, dollParts, tintPixels } from '../../src/render/doll';

type Layer = { name: string; canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; dirty: boolean; ver: number };
type Tool = 'pencil' | 'eraser' | 'line' | 'fill' | 'picker' | 'select' | 'move';
type Rect = { x: number; y: number; w: number; h: number };

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const layers = new Map<string, Layer>();
let edited = new Set<string>();
let files: string[] = [];

// ------------------------------------------------------------------ estado
const RANK_OPTS: [string, string][] = [
  ['genin', 'Genin'], ['chunin', 'Chunin'], ['jounin', 'Jounin'],
  ['sannin:toad', 'Sannin Sapo'], ['sannin:snake', 'Sannin Serpente'], ['sannin:slug', 'Sannin Lesma'], ['kage', 'Kage'], ['anbu', 'ANBU'],
];
const SWORD_NAMES: Record<string, string> = {
  zabuza: 'Kubikiribōchō', samehada: 'Samehada', kiba: 'Kiba', hiramekarei: 'Hiramekarei', nuibari: 'Nuibari', kabutowari: 'Kabutowari',
  shibuki: 'Shibuki', kusanagi: 'Kusanagi', sakumo: 'Sabre de Chakra', asuma: 'Lâminas do Asuma', raijin: 'Raijin', bee: 'Sete espadas', tanto: 'Tantō ANBU',
};
const MASK_NAMES: Record<string, string> = { fox: 'Raposa (Nin)', tiger: 'Tigre (Tai)', crow: 'Corvo (Gen)', owl: 'Coruja (Int)', boar: 'Javali (For)', hawk: 'Falcão (Vel)', bear: 'Urso (Sta)', monkey: 'Macaco (Sel)' };
const HAIR_NAMES: Record<string, string> = { spiky: 'Espetado', bald: 'Careca', ponytail: 'Rabo de cavalo', short: 'Curto', long: 'Longo', buns: 'Coques' };
const PART_NAMES: Record<string, string> = {
  'ninja-body': 'Corpo-base', 'layer-outfit-genin': 'Roupa de Genin', 'layer-hair-spiky': 'Cabelo espetado', 'layer-hair-ponytail': 'Rabo de cavalo', 'layer-hair-short': 'Cabelo curto',
  'layer-hair-long': 'Cabelo longo', 'layer-hair-buns': 'Coques', 'layer-headband': 'Bandana',
  'layer-vest-chunin': 'Colete de Chunin', 'layer-vest-jounin': 'Colete de Jounin', 'layer-coat-sannin': 'Sobretudo de Sannin',
  'layer-cloak-kage': 'Manto de Kage', 'layer-hat-kage': 'Chapéu de Kage', 'layer-outfit-anbu': 'Uniforme ANBU',
};
for (const [k, n] of Object.entries(SWORD_NAMES)) PART_NAMES[`layer-sword-${k}`] = `Espada: ${n}`;
for (const [k, n] of Object.entries(MASK_NAMES)) PART_NAMES[`layer-mask-${k}`] = `Máscara: ${n}`;
const SHEET_RE = /^(ninja|villager|rogue|org-|layer-|dog|boar|wolf|bear|snake|crow|monkey|spider|tiger|rhino|hydra|golem|puppet|toad|slug|tower-guard)/;
const KEY_SWATCHES = [
  ['#ff8cff', '#ff00ff', '#a0009f'], ['#fff799', '#ffee00', '#b0a000'], ['#9ff6ff', '#00e5ff', '#0090a0'], ['#7dff8a', '#2ecc40', '#1e8a2b'], ['#18101c'],
];

let mode: 'doll' | 'file' = 'doll';
let rankSel = 'genin';
let style = 'spiky';
let swordSel = 'auto';
let maskSel = 'fox';
const look = { cloth: '#2d4a9a', hair: '#f2c94c', skin: '#f1c79a' };
const hiddenParts = new Set<string>();
let active = 'layer-headband';
let fileName: string | null = null;
let row = 1;
let col = DOLL_GRID.idle;
let tool: Tool = 'pencil';
let color = '#ff00ff';
let zoom = 10;
let pan = { x: 0, y: 0 };
let anim: 'walk' | 'idle' = 'walk';
/** Retângulo selecionado no quadro (coordenadas do quadro); Mover/setas mexem só nele. */
let sel: Rect | null = null;
let clip: ImageData | null = null;
const recent: string[] = [];
const undoStack: { name: string; data: ImageData }[] = [];
const redoStack: { name: string; data: ImageData }[] = [];

// ------------------------------------------------------------------ arquivos
async function loadLayer(name: string): Promise<Layer | null> {
  const hit = layers.get(name);
  if (hit) return hit;
  const img = new Image();
  img.src = `/art/${name}.png?t=${Date.now()}`;
  try {
    await img.decode();
  } catch {
    return null;
  }
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const l = { name, canvas, ctx, dirty: false, ver: 0 };
  layers.set(name, l);
  return l;
}

async function refreshList() {
  const r = await fetch('/api/art').then((x) => x.json());
  files = r.files;
  edited = new Set<string>(r.edited.map((f: string) => f.replace(/\.png$/, '')));
}

// ------------------------------------------------------------------ montagem
function who() {
  const [rank, sannin] = rankSel.split(':');
  const anbu = rank === 'anbu';
  const stat = Object.keys(ANBU_MASKS).find((k) => ANBU_MASKS[k] === maskSel)!;
  return {
    style, rank: rank === 'sannin' || anbu ? 'jounin' : rank, sannin, spec: anbu ? 'spy' : undefined, stats: { [stat]: 1 },
    sword: swordSel === 'auto' ? undefined : swordSel === 'none' ? null : swordSel, look: { ...look },
  };
}

function parts(): DollPart[] {
  if (mode === 'file') return fileName ? [{ name: fileName }] : [];
  return dollParts(who()) ?? [{ name: 'ninja-body' }];
}

function grid() {
  const first = layers.get(parts()[0]?.name ?? '');
  const W = first?.canvas.width ?? 1;
  const H = first?.canvas.height ?? 1;
  const cols = mode === 'doll' ? DOLL_GRID.cols : Math.max(1, Number($<HTMLInputElement>('fCols').value) || 1);
  const rows = mode === 'doll' ? DOLL_GRID.rows : Math.max(1, Number($<HTMLInputElement>('fRows').value) || 1);
  return { cols, rows, fw: Math.floor(W / cols), fh: Math.floor(H / rows), W, H };
}

const tintCache = new Map<string, { key: string; canvas: HTMLCanvasElement }>();
/** A camada recolorida como no jogo (ou crua, com "cores-chave" ligado e no modo arquivo). */
function shown(p: DollPart, index: number): HTMLCanvasElement | null {
  const l = layers.get(p.name);
  if (!l) return null;
  if (mode === 'file' || $<HTMLInputElement>('raw').checked) return l.canvas;
  const key = `${l.ver}|${p.color}|${p.color2}|${look.skin}`;
  const hit = tintCache.get(p.name);
  if (hit && hit.key === key) return hit.canvas;
  const c = hit?.canvas ?? document.createElement('canvas');
  c.width = l.canvas.width;
  c.height = l.canvas.height;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  const data = l.ctx.getImageData(0, 0, c.width, c.height);
  tintPixels(data.data, p, index === 0, look.skin);
  ctx.putImageData(data, 0, 0);
  tintCache.set(p.name, { key, canvas: c });
  return c;
}

/** Desenha o quadro (c, r) da montagem em (x, y) na escala `k`. `flip` espelha (andando para a esquerda). */
function drawFrame(ctx: CanvasRenderingContext2D, c: number, r: number, x: number, y: number, k: number, opt: { focus?: boolean; alpha?: number; flip?: boolean } = {}) {
  const { fw, fh } = grid();
  ctx.imageSmoothingEnabled = false;
  for (const [i, p] of parts().entries()) {
    if (hiddenParts.has(p.name)) continue;
    const src = shown(p, i);
    if (!src) continue;
    ctx.globalAlpha = (opt.alpha ?? 1) * (opt.focus && p.name !== active ? 0.3 : 1);
    if (opt.flip) {
      ctx.save();
      ctx.translate(x + fw * k, y);
      ctx.scale(-1, 1);
      ctx.drawImage(src, c * fw, r * fh, fw, fh, 0, 0, fw * k, fh * k);
      ctx.restore();
    } else ctx.drawImage(src, c * fw, r * fh, fw, fh, x, y, fw * k, fh * k);
  }
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------------ palco (edição)
const stage = $<HTMLCanvasElement>('stage');
const sctx = stage.getContext('2d')!;
let needDraw = true;
const redraw = () => (needDraw = true);

function origin() {
  const { fw, fh } = grid();
  return { ox: Math.floor((stage.width - fw * zoom) / 2) + pan.x, oy: Math.floor((stage.height - fh * zoom) / 2) + pan.y };
}

function drawStage() {
  const wrap = $('stageWrap');
  if (stage.width !== wrap.clientWidth || stage.height !== wrap.clientHeight) {
    stage.width = wrap.clientWidth;
    stage.height = wrap.clientHeight;
  }
  const { fw, fh, cols } = grid();
  const { ox, oy } = origin();
  sctx.clearRect(0, 0, stage.width, stage.height);
  sctx.fillStyle = 'rgba(58,92,48,0.55)';
  sctx.fillRect(ox, oy, fw * zoom, fh * zoom);
  if ($<HTMLInputElement>('onion').checked) drawFrame(sctx, (col + cols - 1) % cols, row, ox, oy, zoom, { alpha: 0.25 });
  drawFrame(sctx, col, row, ox, oy, zoom, { focus: $<HTMLInputElement>('focus').checked });
  if ($<HTMLInputElement>('grid').checked && zoom >= 5) {
    sctx.strokeStyle = 'rgba(255,255,255,0.07)';
    sctx.lineWidth = 1;
    sctx.beginPath();
    for (let x = 0; x <= fw; x++) {
      sctx.moveTo(ox + x * zoom + 0.5, oy);
      sctx.lineTo(ox + x * zoom + 0.5, oy + fh * zoom);
    }
    for (let y = 0; y <= fh; y++) {
      sctx.moveTo(ox, oy + y * zoom + 0.5);
      sctx.lineTo(ox + fw * zoom, oy + y * zoom + 0.5);
    }
    sctx.stroke();
  }
  sctx.strokeStyle = '#ff9a3c';
  sctx.strokeRect(ox - 0.5, oy - 0.5, fw * zoom + 1, fh * zoom + 1);
  if (sel) {
    // seleção: tracejado claro e escuro (fácil de ver em qualquer cor)
    const r = [ox + sel.x * zoom, oy + sel.y * zoom, sel.w * zoom, sel.h * zoom] as const;
    sctx.fillStyle = 'rgba(120,190,255,0.12)';
    sctx.fillRect(...r);
    sctx.lineWidth = 2;
    sctx.setLineDash([5, 5]);
    sctx.strokeStyle = '#000';
    sctx.lineDashOffset = 0;
    sctx.strokeRect(...r);
    sctx.strokeStyle = '#fff';
    sctx.lineDashOffset = 5;
    sctx.strokeRect(...r);
    sctx.setLineDash([]);
    sctx.lineDashOffset = 0;
  }
  if (mode === 'doll') {
    // altura do corpo (o que o jogo considera os 56 px do boneco) e a linha dos pés
    const body = Math.round(fh / DOLL_FRAME_PAD);
    sctx.strokeStyle = 'rgba(255,154,60,0.35)';
    sctx.setLineDash([4, 4]);
    sctx.beginPath();
    sctx.moveTo(ox, oy + (fh - body) * zoom + 0.5);
    sctx.lineTo(ox + fw * zoom, oy + (fh - body) * zoom + 0.5);
    sctx.stroke();
    sctx.setLineDash([]);
  }
}

function toPixel(e: PointerEvent | MouseEvent) {
  const r = stage.getBoundingClientRect();
  const { ox, oy } = origin();
  return { x: Math.floor((e.clientX - r.left - ox) / zoom), y: Math.floor((e.clientY - r.top - oy) / zoom) };
}

function activeLayer() {
  return layers.get(mode === 'file' ? (fileName ?? '') : active) ?? null;
}

function pushUndo(l: Layer) {
  undoStack.push({ name: l.name, data: l.ctx.getImageData(0, 0, l.canvas.width, l.canvas.height) });
  if (undoStack.length > 200) undoStack.shift();
  redoStack.length = 0;
}

function touched(l: Layer) {
  l.dirty = true;
  l.ver++;
  redraw();
  updateStatus();
}

function setPixel(l: Layer, x: number, y: number, erase: boolean) {
  const { fw, fh } = grid();
  if (x < 0 || y < 0 || x >= fw || y >= fh) return;
  const px = col * fw + x;
  const py = row * fh + y;
  if (erase) l.ctx.clearRect(px, py, 1, 1);
  else {
    l.ctx.clearRect(px, py, 1, 1);
    l.ctx.fillStyle = color;
    l.ctx.fillRect(px, py, 1, 1);
  }
}

function line(l: Layer, a: { x: number; y: number }, b: { x: number; y: number }, erase: boolean) {
  let { x, y } = a;
  const dx = Math.abs(b.x - x);
  const dy = -Math.abs(b.y - y);
  const sx = x < b.x ? 1 : -1;
  const sy = y < b.y ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    setPixel(l, x, y, erase);
    if (x === b.x && y === b.y) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

/** Cor do pixel: da camada ativa; se ali for transparente, da camada visível mais de cima que tiver pixel. */
function pick(x: number, y: number) {
  const { fw, fh } = grid();
  const px = col * fw + x;
  const py = row * fh + y;
  const order = [activeLayer(), ...parts().map((p) => layers.get(p.name)).reverse()];
  for (const l of order) {
    if (!l) continue;
    const d = l.ctx.getImageData(px, py, 1, 1).data;
    if (d[3]! > 10) {
      setColor(`#${[d[0], d[1], d[2]].map((v) => v!.toString(16).padStart(2, '0')).join('')}`);
      return;
    }
  }
}

/** Balde: a área contínua (4 vizinhos) da mesma cor do pixel clicado, só dentro do quadro, vira a cor (ou some). */
function flood(l: Layer, x: number, y: number, erase: boolean) {
  const { fw, fh } = grid();
  if (x < 0 || y < 0 || x >= fw || y >= fh) return;
  const img = l.ctx.getImageData(col * fw, row * fh, fw, fh);
  const d = img.data;
  const at = (i: number) => (d[i + 3]! < 10 ? 0 : ((d[i]! << 24) | (d[i + 1]! << 16) | (d[i + 2]! << 8) | 255) >>> 0);
  const target = at((y * fw + x) * 4);
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16)) as [number, number, number];
  const paint = erase ? 0 : (((r << 24) | (g << 16) | (b << 8) | 255) >>> 0);
  if (target === paint) return;
  const stack = [x, y];
  const seen = new Uint8Array(fw * fh);
  while (stack.length) {
    const py = stack.pop()!;
    const px = stack.pop()!;
    if (px < 0 || py < 0 || px >= fw || py >= fh) continue;
    const k = py * fw + px;
    if (seen[k] || at(k * 4) !== target) continue;
    seen[k] = 1;
    const i = k * 4;
    if (erase) d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0;
    else [d[i], d[i + 1], d[i + 2], d[i + 3]] = [r, g, b, 255];
    stack.push(px + 1, py, px - 1, py, px, py + 1, px, py - 1);
  }
  l.ctx.putImageData(img, col * fw, row * fh);
}

/** Linha com Shift: presa na horizontal, vertical ou 45°. */
function snapLine(a: { x: number; y: number }, b: { x: number; y: number }, on: boolean) {
  if (!on) return b;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) > Math.abs(dy) * 2) return { x: b.x, y: a.y };
  if (Math.abs(dy) > Math.abs(dx) * 2) return { x: a.x, y: b.y };
  const m = Math.max(Math.abs(dx), Math.abs(dy));
  return { x: a.x + Math.sign(dx) * m, y: a.y + Math.sign(dy) * m };
}
let lineBase: ImageData | null = null;
const erasing = (e: PointerEvent | MouseEvent) => tool === 'eraser' || e.button === 2 || (e.buttons & 2) !== 0 || $<HTMLInputElement>('eraseMode').checked;

// mover: a camada ativa no quadro atual (ou nos 4 quadros da vista), recortada no quadro; com seleção, só o retângulo
let moveSnap: { cells: number[]; rect: Rect; base: HTMLCanvasElement[]; piece: HTMLCanvasElement[] } | null = null;
function moveStart(l: Layer) {
  const { fw, fh, cols } = grid();
  const cells = $<HTMLInputElement>('moveRow').checked ? [...Array(cols).keys()] : [col];
  const rect = sel ?? { x: 0, y: 0, w: fw, h: fh };
  const base: HTMLCanvasElement[] = [];
  const piece: HTMLCanvasElement[] = [];
  for (const c of cells) {
    const b = document.createElement('canvas');
    b.width = fw;
    b.height = fh;
    const bx = b.getContext('2d')!;
    bx.drawImage(l.canvas, c * fw, row * fh, fw, fh, 0, 0, fw, fh);
    const p = document.createElement('canvas');
    p.width = rect.w;
    p.height = rect.h;
    p.getContext('2d')!.drawImage(b, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
    bx.clearRect(rect.x, rect.y, rect.w, rect.h); // o que fica para trás: o quadro sem o pedaço
    base.push(b);
    piece.push(p);
  }
  moveSnap = { cells, rect, base, piece };
}
function moveApply(l: Layer, dx: number, dy: number) {
  if (!moveSnap) return;
  const { fw, fh } = grid();
  const { rect } = moveSnap;
  moveSnap.cells.forEach((c, i) => {
    l.ctx.save();
    l.ctx.beginPath();
    l.ctx.rect(c * fw, row * fh, fw, fh);
    l.ctx.clip();
    l.ctx.clearRect(c * fw, row * fh, fw, fh);
    l.ctx.drawImage(moveSnap!.base[i]!, c * fw, row * fh);
    l.ctx.drawImage(moveSnap!.piece[i]!, c * fw + rect.x + dx, row * fh + rect.y + dy);
    l.ctx.restore();
  });
  if (sel) sel = { ...rect, x: rect.x + dx, y: rect.y + dy };
  touched(l);
}

const inSel = (p: { x: number; y: number }) => !!sel && p.x >= sel.x && p.y >= sel.y && p.x < sel.x + sel.w && p.y < sel.y + sel.h;
function rectOf(a: { x: number; y: number }, b: { x: number; y: number }): Rect {
  const { fw, fh } = grid();
  const x0 = Math.max(0, Math.min(a.x, b.x));
  const y0 = Math.max(0, Math.min(a.y, b.y));
  const x1 = Math.min(fw - 1, Math.max(a.x, b.x));
  const y1 = Math.min(fh - 1, Math.max(a.y, b.y));
  return { x: x0, y: y0, w: Math.max(1, x1 - x0 + 1), h: Math.max(1, y1 - y0 + 1) };
}

let drag: { kind: 'paint' | 'move' | 'pan' | 'select' | 'line'; last: { x: number; y: number }; start: { x: number; y: number }; client: { x: number; y: number } } | null = null;
let spaceDown = false;

stage.addEventListener('pointerdown', (e) => {
  stage.setPointerCapture(e.pointerId);
  const p = toPixel(e);
  if (e.button === 1 || spaceDown) {
    drag = { kind: 'pan', last: p, start: p, client: { x: e.clientX - pan.x, y: e.clientY - pan.y } };
    return;
  }
  const l = activeLayer();
  if (!l) return;
  if (e.altKey || tool === 'picker') {
    pick(p.x, p.y);
    return;
  }
  if (tool === 'select' && !inSel(p)) {
    drag = { kind: 'select', last: p, start: p, client: { x: e.clientX, y: e.clientY } };
    sel = rectOf(p, p);
    redraw();
    return;
  }
  pushUndo(l);
  if (tool === 'move' || tool === 'select') {
    moveStart(l);
    drag = { kind: 'move', last: p, start: p, client: { x: e.clientX, y: e.clientY } };
    return;
  }
  if (tool === 'fill') {
    flood(l, p.x, p.y, erasing(e));
    if (!erasing(e)) remember(color);
    touched(l);
    return;
  }
  if (tool === 'line') {
    lineBase = l.ctx.getImageData(0, 0, l.canvas.width, l.canvas.height);
    setPixel(l, p.x, p.y, erasing(e));
    touched(l);
    drag = { kind: 'line', last: p, start: p, client: { x: e.clientX, y: e.clientY } };
    return;
  }
  setPixel(l, p.x, p.y, erasing(e));
  if (tool === 'pencil' && !erasing(e)) remember(color);
  touched(l);
  drag = { kind: 'paint', last: p, start: p, client: { x: e.clientX, y: e.clientY } };
});
stage.addEventListener('pointermove', (e) => {
  const p = toPixel(e);
  const { fw, fh } = grid();
  $('pos').textContent = p.x >= 0 && p.y >= 0 && p.x < fw && p.y < fh ? `x ${p.x} · y ${p.y}` : '';
  if (!drag) return;
  if (drag.kind === 'pan') {
    pan = { x: e.clientX - drag.client.x, y: e.clientY - drag.client.y };
    redraw();
    return;
  }
  const l = activeLayer();
  if (!l) return;
  if (drag.kind === 'select') {
    sel = rectOf(drag.start, p);
    redraw();
    return;
  }
  if (drag.kind === 'move') {
    moveApply(l, p.x - drag.start.x, p.y - drag.start.y);
    return;
  }
  if (drag.kind === 'line' && lineBase) {
    // prévia: volta ao que era antes da linha e desenha até o ponteiro
    l.ctx.putImageData(lineBase, 0, 0);
    line(l, drag.start, snapLine(drag.start, p, e.shiftKey), erasing(e));
    if (!erasing(e)) remember(color);
    touched(l);
    return;
  }
  line(l, drag.last, p, erasing(e));
  drag.last = p;
  touched(l);
});
const endDrag = () => {
  drag = null;
  lineBase = null;
  moveSnap = null;
};
stage.addEventListener('pointerup', endDrag);
stage.addEventListener('pointercancel', endDrag);
stage.addEventListener('contextmenu', (e) => e.preventDefault());
stage.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    const nz = Math.max(1, Math.min(40, zoom + (e.deltaY < 0 ? 1 : -1) * Math.max(1, Math.round(zoom / 6))));
    if (nz === zoom) return;
    // zoom em volta do cursor
    const r = stage.getBoundingClientRect();
    const mx = e.clientX - r.left - stage.width / 2 - pan.x;
    const my = e.clientY - r.top - stage.height / 2 - pan.y;
    pan.x -= Math.round(mx * (nz / zoom - 1));
    pan.y -= Math.round(my * (nz / zoom - 1));
    zoom = nz;
    redraw();
  },
  { passive: false },
);

function nudge(dx: number, dy: number) {
  const l = activeLayer();
  if (!l) return;
  pushUndo(l);
  moveStart(l);
  moveApply(l, dx, dy);
  moveSnap = null;
}

// ------------------------------------------------------------------ área de transferência (também a do sistema)
/** Ctrl+C: além da cópia interna, põe o pedaço como PNG na área de transferência (cola no Photoshop etc.). */
async function copyToSystem(data: ImageData) {
  const t = document.createElement('canvas');
  t.width = data.width;
  t.height = data.height;
  t.getContext('2d')!.putImageData(data, 0, 0);
  try {
    const blob = await new Promise<Blob | null>((ok) => t.toBlob(ok, 'image/png'));
    if (blob) await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    setStatus('Seleção copiada (também para outros programas)');
  } catch {
    setStatus('Seleção copiada (Ctrl+V cola no quadro atual)');
  }
}

/**
 * Cola no quadro atual, onde está a seleção (ou no canto do quadro), recortado no quadro, e deixa o colado
 * selecionado para mover. A imagem vem da área de transferência do sistema (Photoshop, print…) ou da cópia interna.
 */
function pasteImage(src: CanvasImageSource & { width: number; height: number }) {
  const l = activeLayer();
  if (!l) return;
  const { fw, fh } = grid();
  pushUndo(l);
  const at = sel ?? { x: 0, y: 0 };
  l.ctx.save();
  l.ctx.beginPath();
  l.ctx.rect(col * fw, row * fh, fw, fh);
  l.ctx.clip();
  l.ctx.drawImage(src, col * fw + at.x, row * fh + at.y);
  l.ctx.restore();
  sel = { x: at.x, y: at.y, w: Math.max(1, Math.min(src.width, fw - at.x)), h: Math.max(1, Math.min(src.height, fh - at.y)) };
  setTool('select');
  touched(l);
  if (src.width > fw || src.height > fh) setStatus(`Colado ${src.width}×${src.height}; o quadro tem ${fw}×${fh}, o que passou ficou de fora`);
}

window.addEventListener('paste', async (e) => {
  if ((e.target as HTMLElement).tagName === 'INPUT' && (e.target as HTMLInputElement).type !== 'checkbox') return;
  e.preventDefault();
  const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'));
  const file = item?.getAsFile();
  if (file) {
    pasteImage(await createImageBitmap(file));
    return;
  }
  if (clip) {
    const t = document.createElement('canvas');
    t.width = clip.width;
    t.height = clip.height;
    t.getContext('2d')!.putImageData(clip, 0, 0);
    pasteImage(t);
  } else setStatus('Nada para colar (copie uma imagem ou uma seleção)');
});

// ------------------------------------------------------------------ desfazer, salvar
function undo(from: typeof undoStack, to: typeof undoStack) {
  const step = from.pop();
  if (!step) return;
  const l = layers.get(step.name);
  if (!l) return;
  to.push({ name: l.name, data: l.ctx.getImageData(0, 0, l.canvas.width, l.canvas.height) });
  l.ctx.putImageData(step.data, 0, 0);
  touched(l);
}

async function save() {
  const dirty = [...layers.values()].filter((l) => l.dirty);
  if (!dirty.length) return setStatus('Nada para salvar');
  setStatus('Salvando…');
  for (const l of dirty) {
    const blob = await new Promise<Blob | null>((ok) => l.canvas.toBlob(ok, 'image/png'));
    if (!blob) continue;
    const r = await fetch(`/art/${l.name}.png`, { method: 'PUT', body: blob });
    if (!r.ok) return setStatus(`Erro ao salvar ${l.name}: ${await r.text()}`);
    l.dirty = false;
  }
  await refreshList();
  renderLeft();
  setStatus(`Salvo: ${dirty.map((l) => l.name).join(', ')}`);
}

function setStatus(t: string) {
  const s = $('status');
  s.textContent = t;
  s.classList.remove('dirty');
}
function updateStatus() {
  const n = [...layers.values()].filter((l) => l.dirty).length;
  const s = $('status');
  s.textContent = n ? `${n} camada(s) não salva(s)` : '';
  s.classList.toggle('dirty', n > 0);
  renderLayerList();
}

// ------------------------------------------------------------------ painéis
function chips(el: HTMLElement, opts: [string, string][], cur: string, set: (v: string) => void) {
  el.innerHTML = '';
  for (const [v, label] of opts) {
    const b = document.createElement('button');
    b.textContent = label;
    b.classList.toggle('on', v === cur);
    b.onclick = () => set(v);
    el.appendChild(b);
  }
}

function renderLayerList() {
  const ul = $('layers');
  ul.innerHTML = '';
  for (const p of parts()) {
    const l = layers.get(p.name);
    const li = document.createElement('li');
    li.classList.toggle('on', p.name === active);
    const eye = document.createElement('button');
    eye.className = 'eye';
    eye.textContent = hiddenParts.has(p.name) ? '–' : '●';
    eye.title = 'Mostrar/esconder';
    eye.onclick = (e) => {
      e.stopPropagation();
      if (hiddenParts.has(p.name)) hiddenParts.delete(p.name);
      else hiddenParts.add(p.name);
      renderLayerList();
      redraw();
    };
    li.appendChild(eye);
    const nm = document.createElement('span');
    nm.className = 'nm';
    nm.textContent = PART_NAMES[p.name] ?? p.name;
    nm.title = p.name;
    li.appendChild(nm);
    for (const c of [p.color, p.color2].filter(Boolean)) {
      const d = document.createElement('i');
      d.className = 'dot';
      d.style.background = c!;
      li.appendChild(d);
    }
    if (l?.dirty) li.insertAdjacentHTML('beforeend', '<span class="tag">não salva</span>');
    else if (edited.has(p.name)) li.insertAdjacentHTML('beforeend', '<span class="tag" title="Editada à mão: o prepare-layers.py não a refaz">editada</span>');
    li.onclick = () => {
      active = p.name;
      renderLayerList();
      redraw();
    };
    ul.appendChild(li);
  }
  const w = who();
  $('call').textContent = `dollParts(${JSON.stringify({ style: w.style, rank: w.rank, sannin: w.sannin, spec: w.spec, sword: w.sword })})\n${parts()
    .map((p, i) => `${i + 1}. ${p.name}${p.color ? `  ${p.color}` : ''}${p.color2 ? ` / ${p.color2}` : ''}`)
    .join('\n')}`;
}

function renderFiles() {
  const q = $<HTMLInputElement>('filter').value.trim().toLowerCase();
  const ul = $('files');
  ul.innerHTML = '';
  for (const f of files) {
    const name = f.replace(/\.png$/, '');
    if (q && !name.includes(q)) continue;
    const li = document.createElement('li');
    li.textContent = name + (edited.has(name) ? ' (editada)' : '');
    li.classList.toggle('on', name === fileName);
    li.onclick = async () => {
      fileName = name;
      const sheet = SHEET_RE.test(name);
      $<HTMLInputElement>('fCols').value = String(sheet ? 4 : 1);
      $<HTMLInputElement>('fRows').value = String(sheet ? 3 : 1);
      await loadLayer(name);
      col = sheet ? DOLL_GRID.idle : 0;
      row = sheet ? 1 : 0;
      zoom = fitZoom();
      pan = { x: 0, y: 0 };
      renderFiles();
      renderFrames();
      redraw();
    };
    ul.appendChild(li);
  }
}

function renderPalette() {
  const el = $('palette');
  el.innerHTML = '';
  const sw = (c: string) => {
    const b = document.createElement('button');
    b.className = 'sw';
    b.style.background = c;
    b.title = c;
    b.classList.toggle('on', c === color);
    b.onclick = () => setColor(c);
    el.appendChild(b);
  };
  if (mode === 'doll') {
    el.insertAdjacentHTML('beforeend', '<span class="hint">Cores-chave:</span>');
    KEY_SWATCHES.flat().forEach(sw);
  }
  if (recent.length) {
    el.insertAdjacentHTML('beforeend', '<span class="hint">Recentes:</span>');
    recent.forEach(sw);
  }
  const inp = document.createElement('input');
  inp.type = 'color';
  inp.value = color;
  inp.title = 'Outra cor';
  inp.oninput = () => setColor(inp.value);
  el.appendChild(inp);
}

function remember(c: string) {
  if (KEY_SWATCHES.flat().includes(c)) return;
  const i = recent.indexOf(c);
  if (i >= 0) recent.splice(i, 1);
  recent.unshift(c);
  recent.length = Math.min(recent.length, 12);
}

function setColor(c: string) {
  color = c;
  if (tool !== 'pencil') setTool('pencil');
  renderPalette();
}

function setTool(t: Tool) {
  tool = t;
  for (const b of $('tools').querySelectorAll('button')) b.classList.toggle('on', b.dataset.tool === t);
  stage.style.cursor = t === 'move' ? 'move' : t === 'picker' ? 'copy' : t === 'select' ? 'cell' : 'crosshair';
}

function renderFrames() {
  const { cols, rows } = grid();
  const names = mode === 'doll' || rows === 3 ? ['Lado', 'Frente', 'Costas'] : [];
  const r = $('rows');
  r.innerHTML = '';
  for (let i = 0; i < rows; i++) {
    const b = document.createElement('button');
    b.textContent = names[i] ?? `Linha ${i + 1}`;
    b.classList.toggle('on', i === row);
    b.onclick = () => {
      row = i;
      renderFrames();
      redraw();
    };
    r.appendChild(b);
  }
  const c = $('colsSel');
  c.innerHTML = '';
  for (let i = 0; i < cols; i++) {
    const b = document.createElement('button');
    b.textContent = mode === 'doll' && i === DOLL_GRID.idle ? `${i + 1} (parado)` : `${i + 1}`;
    b.classList.toggle('on', i === col);
    b.onclick = () => {
      col = i;
      renderFrames();
      redraw();
    };
    c.appendChild(b);
  }
}

function renderLeft() {
  $('dollPanel').hidden = mode !== 'doll';
  $('filePanel').hidden = mode !== 'file';
  chips($('rank'), RANK_OPTS, rankSel, (v) => {
    rankSel = v;
    afterDollChange();
  });
  chips($('hair'), Object.keys(DOLL_HAIR).map((h) => [h, HAIR_NAMES[h] ?? h]), style, (v) => {
    style = v;
    afterDollChange();
  });
  chips($('sword'), [['auto', 'Pela patente'], ['none', 'Nenhuma'], ...Object.keys(SWORDS).map((s): [string, string] => [s, SWORD_NAMES[s] ?? s])], swordSel, (v) => {
    swordSel = v;
    afterDollChange();
  });
  $('maskBox').hidden = rankSel !== 'anbu';
  chips($('mask'), Object.entries(MASK_NAMES), maskSel, (v) => {
    maskSel = v;
    afterDollChange();
  });
  renderLayerList();
  renderFiles();
  renderPalette();
  renderFrames();
}

async function afterDollChange() {
  for (const p of parts()) await loadLayer(p.name);
  if (!parts().some((p) => p.name === active)) active = parts().at(-1)?.name ?? 'ninja-body';
  renderLeft();
  redraw();
}

function fitZoom() {
  const { fw, fh } = grid();
  const wrap = $('stageWrap');
  return Math.max(2, Math.floor(Math.min((wrap.clientWidth - 40) / fw, (wrap.clientHeight - 40) / fh)));
}

// ------------------------------------------------------------------ prévias (animação, tamanho do jogo, folha)
const animC = $<HTMLCanvasElement>('anim');
const ingameC = $<HTMLCanvasElement>('ingame');
const sheetC = $<HTMLCanvasElement>('sheet');

function drawPreviews(t: number) {
  const { fw, fh, W, H, cols, rows } = grid();
  if (!fw || !fh) return;
  const frame = anim === 'walk' ? Math.floor(t * 8) % cols : mode === 'doll' ? DOLL_GRID.idle : col;
  // animação: lado (→ e ←), frente e costas, 2×
  const k = 2;
  const views: [number, boolean][] = rows >= 3 ? [[0, false], [0, true], [1, false], [2, false]] : [[row, false]];
  const per = Math.min(2, views.length);
  animC.width = fw * k * per;
  animC.height = fh * k * Math.ceil(views.length / per);
  const actx = animC.getContext('2d')!;
  actx.clearRect(0, 0, animC.width, animC.height);
  views.forEach(([r, flip], i) => drawFrame(actx, frame, r, (i % per) * fw * k, Math.floor(i / per) * fh * k, k, { flip }));
  // tamanho do jogo: o ninja tem 30 px de corpo no zoom 1 (o quadro com folga fica maior)
  if (mode === 'doll') {
    const body = fh / DOLL_FRAME_PAD;
    const scales = [30 / body, (30 * 2.5) / body];
    ingameC.width = Math.ceil(fw * (scales[0]! + scales[1]!)) + 30;
    ingameC.height = Math.ceil(fh * scales[1]!) + 10;
    const ictx = ingameC.getContext('2d')!;
    ictx.clearRect(0, 0, ingameC.width, ingameC.height);
    let x = 10;
    for (const s of scales) {
      drawFrame(ictx, frame, 1, x, ingameC.height - 5 - fh * s, s);
      x += fw * s + 10;
    }
    ingameC.hidden = false;
  } else ingameC.hidden = true;
  $('ingameTitle').hidden = ingameC.hidden;
  // folha inteira com o quadro atual marcado
  const sk = Math.min(1.5, 276 / W);
  sheetC.width = Math.ceil(W * sk);
  sheetC.height = Math.ceil(H * sk);
  const shctx = sheetC.getContext('2d')!;
  shctx.clearRect(0, 0, sheetC.width, sheetC.height);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) drawFrame(shctx, c, r, c * fw * sk, r * fh * sk, sk);
  shctx.strokeStyle = '#ff9a3c';
  shctx.lineWidth = 2;
  shctx.strokeRect(col * fw * sk + 1, row * fh * sk + 1, fw * sk - 2, fh * sk - 2);
}

sheetC.addEventListener('click', (e) => {
  const { fw, fh, cols, rows, W } = grid();
  const sk = Math.min(1.5, 276 / W);
  const r = sheetC.getBoundingClientRect();
  const scale = sheetC.width / r.width;
  const c = Math.floor(((e.clientX - r.left) * scale) / (fw * sk));
  const rr = Math.floor(((e.clientY - r.top) * scale) / (fh * sk));
  if (c >= 0 && c < cols && rr >= 0 && rr < rows) {
    col = c;
    row = rr;
    renderFrames();
    redraw();
  }
});

function loop(ms: number) {
  if (needDraw) {
    needDraw = false;
    drawStage();
  }
  drawPreviews(ms / 1000);
  requestAnimationFrame(loop);
}

// ------------------------------------------------------------------ teclado e controles
window.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).tagName === 'INPUT' && (e.target as HTMLInputElement).type !== 'checkbox') return;
  const k = e.key.toLowerCase();
  if (e.ctrlKey && k === 's') {
    e.preventDefault();
    void save();
  } else if (e.ctrlKey && k === 'a') {
    e.preventDefault();
    const { fw, fh } = grid();
    sel = { x: 0, y: 0, w: fw, h: fh };
    setTool('select');
    redraw();
  } else if (e.ctrlKey && k === 'c' && sel) {
    const l = activeLayer();
    const { fw, fh } = grid();
    if (!l) return;
    clip = l.ctx.getImageData(col * fw + sel.x, row * fh + sel.y, sel.w, sel.h);
    void copyToSystem(clip);
  } else if ((e.key === 'Delete' || e.key === 'Backspace') && sel) {
    const l = activeLayer();
    const { fw, fh } = grid();
    if (!l) return;
    pushUndo(l);
    l.ctx.clearRect(col * fw + sel.x, row * fh + sel.y, sel.w, sel.h);
    touched(l);
  } else if (e.key === 'Escape') {
    sel = null;
    redraw();
  } else if (e.ctrlKey && k === 'z') {
    e.preventDefault();
    undo(undoStack, redoStack);
  } else if (e.ctrlKey && k === 'y') {
    e.preventDefault();
    undo(redoStack, undoStack);
  } else if (k === 'b') setTool('pencil');
  else if (k === 'e') setTool('eraser');
  else if (k === 'l') setTool('line');
  else if (k === 'g') setTool('fill');
  else if (k === 'x') {
    const c = $<HTMLInputElement>('eraseMode');
    c.checked = !c.checked;
  }
  else if (k === 'i') setTool('picker');
  else if (k === 'm') setTool('move');
  else if (k === 's' && !e.ctrlKey) setTool('select');
  else if (k === ' ') {
    spaceDown = true;
    e.preventDefault();
  } else if (['1', '2', '3'].includes(k) && Number(k) <= grid().rows) {
    row = Number(k) - 1;
    renderFrames();
    redraw();
  } else if (k === ',' || k === '.') {
    const { cols } = grid();
    col = (col + (k === '.' ? 1 : cols - 1)) % cols;
    renderFrames();
    redraw();
  } else if (e.key.startsWith('Arrow') && (tool === 'move' || tool === 'select')) {
    e.preventDefault();
    nudge(e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0, e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0);
  }
});
window.addEventListener('keyup', (e) => {
  if (e.key === ' ') spaceDown = false;
});
window.addEventListener('beforeunload', (e) => {
  if ([...layers.values()].some((l) => l.dirty)) e.preventDefault();
});
window.addEventListener('resize', redraw);

for (const b of $('tools').querySelectorAll<HTMLButtonElement>('button')) b.onclick = () => setTool(b.dataset.tool as Tool);
for (const b of $('mode').querySelectorAll<HTMLButtonElement>('button'))
  b.onclick = async () => {
    mode = b.dataset.mode as 'doll' | 'file';
    for (const x of $('mode').querySelectorAll('button')) x.classList.toggle('on', x === b);
    if (mode === 'doll') {
      row = 1;
      col = DOLL_GRID.idle;
    }
    zoom = fitZoom();
    pan = { x: 0, y: 0 };
    renderLeft();
    redraw();
  };
for (const b of $('animMode').querySelectorAll<HTMLButtonElement>('button'))
  b.onclick = () => {
    anim = b.dataset.anim as 'walk' | 'idle';
    for (const x of $('animMode').querySelectorAll('button')) x.classList.toggle('on', x === b);
  };
for (const id of ['grid', 'focus', 'onion', 'raw']) $(id).addEventListener('change', redraw);
for (const [id, k] of [['cCloth', 'cloth'], ['cHair', 'hair'], ['cSkin', 'skin']] as const)
  $<HTMLInputElement>(id).oninput = (e) => {
    look[k] = (e.target as HTMLInputElement).value;
    renderLayerList();
    redraw();
  };
$('randomize').onclick = () => {
  const rnd = () => `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`;
  look.cloth = rnd();
  look.hair = rnd();
  $<HTMLInputElement>('cCloth').value = look.cloth;
  $<HTMLInputElement>('cHair').value = look.hair;
  renderLayerList();
  redraw();
};
$('undo').onclick = () => undo(undoStack, redoStack);
$('redo').onclick = () => undo(redoStack, undoStack);
$('save').onclick = () => void save();
$('filter').oninput = renderFiles;
for (const id of ['fCols', 'fRows'])
  $(id).oninput = () => {
    const { cols, rows } = grid();
    col = Math.min(col, cols - 1);
    row = Math.min(row, rows - 1);
    renderFrames();
    redraw();
  };

// ------------------------------------------------------------------ início
await refreshList();
for (const f of files) if (f.startsWith('layer-') || f === 'ninja-body.png') await loadLayer(f.replace(/\.png$/, ''));
zoom = fitZoom();
await afterDollChange();
setTool('pencil');
requestAnimationFrame(loop);
