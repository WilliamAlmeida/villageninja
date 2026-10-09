// Editor de sprites da Vila Ninja: monta o ninja em camadas igual ao jogo (src/render/doll.ts), anima e deixa editar
// pixel a pixel (lápis, borracha, conta-gotas) e mover uma camada num quadro ou na vista inteira. Também abre qualquer
// PNG de src/art, inclusive os de interface (src/art/ui: atlas de ícones e selos, ilustrações). Salvar grava em src/art
// pelo servidor local (scripts/editor.ts).
import { DOLL_FRAME_PAD, DOLL_GRID, DOLL_HAIR, SWORDS, type DollPart, dollParts, tintPixels } from '../../src/render/doll';
import { type Atlas, BADGE_RANKS, ICONS } from '../../src/ui/pxicons';
import { shadowFrac, worldHeight } from '../../src/render/unitShape';
import { applyIcons, helpDialog, ico } from '../shared/ui';
import type { Layout } from '../../src/data/layout';

type Layer = { name: string; canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; dirty: boolean; ver: number };
type Tool = 'pencil' | 'eraser' | 'line' | 'fill' | 'picker' | 'select' | 'wand' | 'move' | 'point' | 'origin';
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
/** Atlas de interface: abrem divididos nas casas (cada quadro = um ícone/selo); o nome de cada casa vem do pxicons.ts. */
const ATLASES: Record<string, Atlas> = { 'ui/icons': ICONS, 'ui/badge-ranks': BADGE_RANKS };
const SHEET_RE = /^(ninja|villager|rogue|org-|layer-|dog|boar|wolf|bear|snake|crow|monkey|spider|tiger|rhino|hydra|golem|puppet|toad|slug|tower-guard)/;
const KEY_SWATCHES = [
  ['#ff8cff', '#ff00ff', '#a0009f'], ['#fff799', '#ffee00', '#b0a000'], ['#9ff6ff', '#00e5ff', '#0090a0'], ['#7dff8a', '#2ecc40', '#1e8a2b'], ['#18101c'],
];

let mode: 'doll' | 'file' = 'doll';
let rankSel = 'genin';
let style = 'spiky';
let swordSel = 'none';
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
/** Forma livre dentro do retângulo (varinha mágica): 1 = selecionado, do tamanho sel.w × sel.h. null = o retângulo todo. */
let selMask: Uint8Array | null = null;
const inMask = (x: number, y: number) => !!sel && (!selMask || selMask[(y - sel.y) * sel.w + (x - sel.x)] === 1);
/** Canvas com os pixels selecionados opacos (para recortar o pedaço e apagar só a forma). */
function maskCanvas(): HTMLCanvasElement | null {
  if (!sel || !selMask) return null;
  const c = document.createElement('canvas');
  c.width = sel.w;
  c.height = sel.h;
  const d = c.getContext('2d')!.createImageData(sel.w, sel.h);
  for (let i = 0; i < selMask.length; i++) if (selMask[i]) d.data[i * 4 + 3] = 255;
  c.getContext('2d')!.putImageData(d, 0, 0);
  return c;
}
/** Pixels de um quadro (ImageData) que ficam de fora da seleção viram transparentes. */
function applyMask(data: ImageData) {
  if (!selMask) return data;
  for (let i = 0; i < selMask.length; i++) if (!selMask[i]) data.data[i * 4 + 3] = 0;
  return data;
}
let clip: ImageData | null = null;
const recent: string[] = [];
const undoStack: { name: string; data: ImageData }[] = [];
const redoStack: { name: string; data: ImageData }[] = [];
/** Pontos nomeados por quadro (src/data/layout.json, `arts[nome].points`): mão do ninja, cabo das espadas soltas. */
let layoutData: Layout = { arts: {}, types: {} };
let layoutDirty = false;

// ------------------------------------------------------------------ pontos (layout.json)
/** Arte que recebe os pontos: no ninja montado é sempre o corpo-base (a mão); no modo arquivo, o próprio arquivo. */
const pointArt = () => (mode === 'doll' ? 'ninja-body' : fileName);
const frameIndex = () => row * grid().cols + col;
function pointsOf(key: string, create = false): ([number, number] | null)[] | null {
  const name = pointArt();
  if (!name) return null;
  const a = (layoutData.arts[name] ??= {});
  if (!a.points?.[key] && !create) return null;
  a.points ??= {};
  return (a.points[key] ??= []);
}
const pointKey = () => ($<HTMLInputElement>('pointKey').value.trim() || 'hand').toLowerCase();
function setPoint(p: [number, number] | null, at = frameIndex()) {
  const pts = pointsOf(pointKey(), true)!;
  while (pts.length <= at) pts.push(null);
  pts[at] = p;
  layoutDirty = true;
  updateStatus();
  redraw();
}
function currentPoint(): [number, number] | null {
  return pointsOf(pointKey())?.[frameIndex()] ?? null;
}

// ------------------------------------------------------------------ origem, corpo e sombra (layout.json)
/** Folha de personagem/bicho (tem origem e sombra no jogo)? */
const unitSheet = () => mode === 'doll' || (!!fileName && SHEET_RE.test(fileName));
/** Origem (pés), altura do corpo e sombra da arte aberta, em px do quadro (o padrão quando o layout não diz). */
function originOf() {
  const { fw, fh } = grid();
  const name = pointArt() ?? '';
  const a = layoutData.arts[name];
  const body = a?.body ?? (name === 'ninja-body' ? fh / DOLL_FRAME_PAD : fh);
  const foot = a?.foot ?? [fw / 2, fh];
  const mult = a?.shadow ?? [1, 1];
  const [rx, ry] = shadowFrac(name);
  return { name, body, foot, mult, shadow: [body * rx * mult[0], body * ry * mult[1]] as [number, number] };
}
function setOrigin(patch: { body?: number; foot?: [number, number]; shadow?: [number, number] } | null) {
  const name = pointArt();
  if (!name) return;
  const a = (layoutData.arts[name] ??= {});
  if (!patch) {
    delete a.body;
    delete a.foot;
    delete a.shadow;
  } else Object.assign(a, patch);
  layoutDirty = true;
  syncOriginBox();
  updateStatus();
  redraw();
}
function syncOriginBox() {
  const o = originOf();
  $<HTMLInputElement>('oBody').value = String(Math.round(o.body * 10) / 10);
  $<HTMLInputElement>('oShW').value = String(o.mult[0]);
  $<HTMLInputElement>('oShH').value = String(o.mult[1]);
}
/** Sombra como no jogo (centrada na origem, 1,5 px de mundo acima), em px do quadro → tela pela escala `k`. */
function drawShadow(ctx: CanvasRenderingContext2D, ox: number, oy: number, k: number) {
  const o = originOf();
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(ox + o.foot[0] * k, oy + (o.foot[1] - (1.5 * o.body) / worldHeight(o.name)) * k, o.shadow[0] * k, o.shadow[1] * k, 0, 0, Math.PI * 2);
  ctx.fill();
}
/** Cruz na origem e linha tracejada no alto do corpo. */
function drawOriginMarks(ctx: CanvasRenderingContext2D, ox: number, oy: number, k: number, fw: number) {
  const o = originOf();
  const fx = ox + o.foot[0] * k;
  const fy = oy + o.foot[1] * k;
  const top = oy + (o.foot[1] - o.body) * k;
  ctx.save();
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = 'rgba(255,120,220,0.9)';
  ctx.beginPath();
  ctx.moveTo(ox, top + 0.5);
  ctx.lineTo(ox + fw * k, top + 0.5);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = 'bold 11px system-ui';
  ctx.fillStyle = 'rgba(255,120,220,0.95)';
  ctx.fillText(`corpo ${Math.round(o.body)} px`, ox + 4, top - 4);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(fx - 9, fy);
  ctx.lineTo(fx + 9, fy);
  ctx.moveTo(fx, fy - 9);
  ctx.lineTo(fx, fy + 9);
  ctx.stroke();
  ctx.strokeStyle = '#5ff2ff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#5ff2ff';
  ctx.fillText('origem', fx + 10, fy + 14);
  ctx.restore();
}

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
  return {
    style, rank: rank === 'sannin' || anbu ? 'jounin' : rank, sannin, anbu, mask: maskSel,
    sword: swordSel === 'none' ? null : swordSel, look: { ...look },
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
  syncFloat();
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
  // origem e sombra (folhas de personagem/bicho): a sombra embaixo do desenho, as marcas por cima
  const showO = unitSheet() && (tool === 'origin' || $<HTMLInputElement>('showOrigin').checked);
  if (showO) drawShadow(sctx, ox, oy, zoom);
  if ($<HTMLInputElement>('onion').checked) drawFrame(sctx, (col + cols - 1) % cols, row, ox, oy, zoom, { alpha: 0.25 });
  drawFrame(sctx, col, row, ox, oy, zoom, { focus: $<HTMLInputElement>('focus').checked });
  if (showO) drawOriginMarks(sctx, ox, oy, zoom, fw);
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
    if (selMask) {
      // forma livre: escurece o que ficou de fora do retângulo e traça o contorno dos pixels selecionados
      sctx.fillStyle = 'rgba(0,0,0,0.35)';
      for (let yy = 0; yy < sel.h; yy++) for (let xx = 0; xx < sel.w; xx++) if (!selMask[yy * sel.w + xx]) sctx.fillRect(ox + (sel.x + xx) * zoom, oy + (sel.y + yy) * zoom, zoom, zoom);
      sctx.lineWidth = 1;
      sctx.strokeStyle = '#7fd8ff';
      sctx.beginPath();
      const on = (xx: number, yy: number) => xx >= 0 && yy >= 0 && xx < sel!.w && yy < sel!.h && selMask![yy * sel!.w + xx] === 1;
      for (let yy = 0; yy < sel.h; yy++)
        for (let xx = 0; xx < sel.w; xx++) {
          if (!on(xx, yy)) continue;
          const px = ox + (sel.x + xx) * zoom + 0.5;
          const py = oy + (sel.y + yy) * zoom + 0.5;
          if (!on(xx, yy - 1)) sctx.moveTo(px, py), sctx.lineTo(px + zoom, py);
          if (!on(xx, yy + 1)) sctx.moveTo(px, py + zoom), sctx.lineTo(px + zoom, py + zoom);
          if (!on(xx - 1, yy)) sctx.moveTo(px, py), sctx.lineTo(px, py + zoom);
          if (!on(xx + 1, yy)) sctx.moveTo(px + zoom, py), sctx.lineTo(px + zoom, py + zoom);
        }
      sctx.stroke();
    }
  }
  const pt = currentPoint();
  if (pt && (tool === 'point' || $<HTMLInputElement>('showPoints').checked)) {
    // ponto nomeado do quadro (mão / cabo): cruz com o nome
    const px = ox + (pt[0] + 0.5) * zoom;
    const py = oy + (pt[1] + 0.5) * zoom;
    sctx.strokeStyle = '#000';
    sctx.lineWidth = 3;
    sctx.beginPath();
    sctx.moveTo(px - 8, py);
    sctx.lineTo(px + 8, py);
    sctx.moveTo(px, py - 8);
    sctx.lineTo(px, py + 8);
    sctx.stroke();
    sctx.strokeStyle = '#7dff9a';
    sctx.lineWidth = 1.5;
    sctx.stroke();
    sctx.fillStyle = '#7dff9a';
    sctx.font = 'bold 11px system-ui';
    sctx.fillText(pointKey(), px + 10, py - 6);
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

/**
 * Seleção FLUTUANTE (como nos editores de imagem): ao mover uma seleção (ou colar), o pedaço é levantado da camada e
 * fica solto por cima dela (`base` = o quadro sem o pedaço, `piece` = o pedaço). Cada arrasto ou seta só muda a posição
 * e recompõe base + pedaço; nada do que está embaixo é cortado. Fixa (vira pixel de verdade) ao mudar de ferramenta,
 * quadro, camada ou arquivo, com Enter, Esc, nova seleção ou ao salvar. Ctrl+arrastar levanta uma CÓPIA (duplica).
 */
let float: { layer: Layer; row: number; col: number; cells: number[]; rect: Rect; pos: { x: number; y: number }; base: HTMLCanvasElement[]; piece: HTMLCanvasElement[] } | null = null;
/** O flutuante só vale no quadro/camada em que nasceu: se mudou, ele já está fixado (a camada tem a composição). */
function syncFloat() {
  if (float && (float.row !== row || float.col !== col || float.layer !== activeLayer() || (tool !== 'select' && tool !== 'move' && tool !== 'wand'))) float = null;
}
function commitFloat() {
  if (!float) return;
  float = null;
  updateStatus();
}
/** Levanta a seleção (ou o quadro inteiro) da camada; `copy` deixa o original no lugar (duplica). */
function liftFloat(l: Layer, copy = false) {
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
    const px = p.getContext('2d')!;
    px.drawImage(b, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
    const m = sel ? maskCanvas() : null;
    if (m) {
      // forma livre: o pedaço só tem os pixels selecionados; o resto do retângulo fica no lugar
      px.globalCompositeOperation = 'destination-in';
      px.drawImage(m, 0, 0);
      if (!copy) {
        bx.globalCompositeOperation = 'destination-out';
        bx.drawImage(m, rect.x, rect.y);
        bx.globalCompositeOperation = 'source-over';
      }
    } else if (!copy) bx.clearRect(rect.x, rect.y, rect.w, rect.h); // o que fica para trás: o quadro sem o pedaço
    base.push(b);
    piece.push(p);
  }
  float = { layer: l, row, col, cells, rect, pos: { x: rect.x, y: rect.y }, base, piece };
  sel = { ...rect };
  setStatus(copy ? 'Cópia flutuando: arraste ou use as setas; Enter fixa' : 'Seleção flutuando: arraste ou use as setas; Enter fixa');
}
/** Começa um arrasto: usa o flutuante que já existe ou levanta um novo. */
function moveStart(l: Layer, copy = false) {
  syncFloat();
  if (!float || copy) liftFloat(l, copy);
}
/** Recompõe o quadro com o pedaço na posição nova (deslocamento em relação ao início do arrasto ou à posição atual). */
function floatTo(x: number, y: number) {
  if (!float) return;
  const { fw, fh } = grid();
  const { layer: l, rect } = float;
  float.pos = { x, y };
  float.cells.forEach((c, i) => {
    l.ctx.save();
    l.ctx.beginPath();
    l.ctx.rect(c * fw, row * fh, fw, fh);
    l.ctx.clip();
    l.ctx.clearRect(c * fw, row * fh, fw, fh);
    l.ctx.drawImage(float!.base[i]!, c * fw, row * fh);
    l.ctx.drawImage(float!.piece[i]!, c * fw + x, row * fh + y);
    l.ctx.restore();
  });
  sel = { ...rect, x, y };
  touched(l);
}
let moveFrom = { x: 0, y: 0 };
function moveApply(_l: Layer, dx: number, dy: number) {
  floatTo(moveFrom.x + dx, moveFrom.y + dy);
}

const inSel = (p: { x: number; y: number }) => !!sel && p.x >= sel.x && p.y >= sel.y && p.x < sel.x + sel.w && p.y < sel.y + sel.h && inMask(p.x, p.y);

/**
 * Varinha mágica: a área da mesma cor (diferença máxima por canal ≤ tolerância, contando a transparência), contínua a
 * partir do clique ("Adjacente") ou no quadro inteiro. `add` soma à seleção, `sub` tira; senão substitui.
 */
function wandSelect(l: Layer, x: number, y: number, how: 'new' | 'add' | 'sub') {
  const { fw, fh } = grid();
  const img = l.ctx.getImageData(col * fw, row * fh, fw, fh).data;
  const tol = Math.max(0, Math.min(255, Number($<HTMLInputElement>('wTol').value) || 0));
  const i0 = (y * fw + x) * 4;
  const ref = [img[i0]!, img[i0 + 1]!, img[i0 + 2]!, img[i0 + 3]!];
  const like = (i: number) => {
    const a = img[i + 3]!;
    if (ref[3]! < 40 || a < 40) return (ref[3]! < 40) === (a < 40); // transparente só casa com transparente
    return Math.abs(img[i]! - ref[0]!) <= tol && Math.abs(img[i + 1]! - ref[1]!) <= tol && Math.abs(img[i + 2]! - ref[2]!) <= tol && Math.abs(a - ref[3]!) <= tol;
  };
  const hit = new Uint8Array(fw * fh);
  if ($<HTMLInputElement>('wAdj').checked) {
    const q = [y * fw + x];
    hit[y * fw + x] = 1;
    while (q.length) {
      const k = q.pop()!;
      const kx = k % fw;
      const ky = (k - kx) / fw;
      for (const [nx, ny] of [[kx + 1, ky], [kx - 1, ky], [kx, ky + 1], [kx, ky - 1]] as const) {
        if (nx < 0 || ny < 0 || nx >= fw || ny >= fh) continue;
        const n = ny * fw + nx;
        if (!hit[n] && like(n * 4)) {
          hit[n] = 1;
          q.push(n);
        }
      }
    }
  } else for (let i = 0; i < fw * fh; i++) if (like(i * 4)) hit[i] = 1;
  // combina com a seleção que já existe (no quadro inteiro) e volta ao retângulo que envolve o resultado
  const cur = new Uint8Array(fw * fh);
  if (sel && how !== 'new') for (let yy = sel.y; yy < sel.y + sel.h; yy++) for (let xx = sel.x; xx < sel.x + sel.w; xx++) if (inMask(xx, yy)) cur[yy * fw + xx] = 1;
  const out = new Uint8Array(fw * fh);
  let n = 0;
  let x0 = fw, y0 = fh, x1 = -1, y1 = -1;
  for (let i = 0; i < fw * fh; i++) {
    const v = how === 'new' ? hit[i]! : how === 'add' ? (cur[i]! | hit[i]!) : cur[i]! && !hit[i] ? 1 : 0;
    if (!v) continue;
    out[i] = 1;
    n++;
    const xx = i % fw;
    const yy = (i - xx) / fw;
    if (xx < x0) x0 = xx;
    if (xx > x1) x1 = xx;
    if (yy < y0) y0 = yy;
    if (yy > y1) y1 = yy;
  }
  if (!n) {
    sel = null;
    selMask = null;
    setStatus('Nada selecionado');
    return;
  }
  sel = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  selMask = new Uint8Array(sel.w * sel.h);
  for (let yy = 0; yy < sel.h; yy++) for (let xx = 0; xx < sel.w; xx++) selMask[yy * sel.w + xx] = out[(sel.y + yy) * fw + sel.x + xx]!;
  setStatus(`${n} px selecionado(s)`);
}
function rectOf(a: { x: number; y: number }, b: { x: number; y: number }): Rect {
  const { fw, fh } = grid();
  const x0 = Math.max(0, Math.min(a.x, b.x));
  const y0 = Math.max(0, Math.min(a.y, b.y));
  const x1 = Math.min(fw - 1, Math.max(a.x, b.x));
  const y1 = Math.min(fh - 1, Math.max(a.y, b.y));
  return { x: x0, y: y0, w: Math.max(1, x1 - x0 + 1), h: Math.max(1, y1 - y0 + 1) };
}

let drag: { kind: 'paint' | 'move' | 'pan' | 'select' | 'line' | 'origin'; last: { x: number; y: number }; start: { x: number; y: number }; client: { x: number; y: number } } | null = null;
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
  if (tool === 'point') {
    const { fw, fh } = grid();
    if (p.x >= 0 && p.y >= 0 && p.x < fw && p.y < fh) setPoint(e.button === 2 ? null : [p.x, p.y]);
    return;
  }
  if (tool === 'origin') {
    if (!unitSheet()) return setStatus('Origem e sombra só nas folhas de personagem e bicho');
    if (e.shiftKey) setOrigin({ body: Math.max(4, originOf().foot[1] - p.y) }); // alto do corpo
    else {
      setOrigin({ foot: [p.x + 0.5, p.y + 1] }); // os pés pisam no pixel clicado
      drag = { kind: 'origin', last: p, start: p, client: { x: e.clientX, y: e.clientY } };
    }
    return;
  }
  // varinha: clique fora da seleção (ou com Shift/Ctrl) seleciona; dentro dela, arrasta como a Seleção
  if (tool === 'wand' && (!inSel(p) || e.shiftKey || e.ctrlKey)) {
    const { fw, fh } = grid();
    if (p.x < 0 || p.y < 0 || p.x >= fw || p.y >= fh) return;
    commitFloat();
    wandSelect(l, p.x, p.y, e.shiftKey ? 'add' : e.ctrlKey ? 'sub' : 'new');
    redraw();
    return;
  }
  if (tool === 'select' && !inSel(p)) {
    commitFloat(); // clicou fora: o que flutuava fica onde está
    drag = { kind: 'select', last: p, start: p, client: { x: e.clientX, y: e.clientY } };
    sel = rectOf(p, p);
    selMask = null;
    redraw();
    return;
  }
  pushUndo(l);
  if (tool === 'move' || tool === 'select' || tool === 'wand') {
    moveStart(l, e.ctrlKey); // Ctrl+arrastar duplica (na varinha o Ctrl já virou "tirar" acima)
    moveFrom = { ...float!.pos };
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
  if (drag.kind === 'origin') {
    setOrigin({ foot: [p.x + 0.5, p.y + 1] });
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
  syncFloat();
  if (!float) {
    pushUndo(l);
    liftFloat(l);
  }
  floatTo(float!.pos.x + dx, float!.pos.y + dy);
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
  setTool('select');
  commitFloat();
  pushUndo(l);
  const at = sel ?? { x: 0, y: 0 };
  // o colado nasce flutuando: a camada fica como está por baixo (base) e o pedaço vai por cima até fixar
  const b = document.createElement('canvas');
  b.width = fw;
  b.height = fh;
  b.getContext('2d')!.drawImage(l.canvas, col * fw, row * fh, fw, fh, 0, 0, fw, fh);
  const p = document.createElement('canvas');
  p.width = src.width;
  p.height = src.height;
  p.getContext('2d')!.drawImage(src, 0, 0);
  selMask = null;
  float = { layer: l, row, col, cells: [col], rect: { x: at.x, y: at.y, w: src.width, h: src.height }, pos: { x: at.x, y: at.y }, base: [b], piece: [p] };
  floatTo(at.x, at.y);
  setStatus(src.width > fw || src.height > fh ? `Colado ${src.width}×${src.height} flutuando (o quadro tem ${fw}×${fh}: o que passar da borda fica de fora ao fixar)` : 'Colado flutuando: arraste ou use as setas; Enter fixa');
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
  float = null; // o flutuante guardava a composição antiga
  const l = layers.get(step.name);
  if (!l) return;
  to.push({ name: l.name, data: l.ctx.getImageData(0, 0, l.canvas.width, l.canvas.height) });
  l.ctx.putImageData(step.data, 0, 0);
  touched(l);
}

async function save() {
  commitFloat(); // salvar fixa o que flutuava
  const dirty = [...layers.values()].filter((l) => l.dirty);
  if (!dirty.length && !layoutDirty) return setStatus('Nada para salvar');
  setStatus('Salvando…');
  if (layoutDirty) {
    const r = await fetch('/api/layout', { method: 'PUT', body: JSON.stringify(layoutData) });
    if (!r.ok) return setStatus(`Erro ao salvar os pontos: ${await r.text()}`);
    layoutDirty = false;
    if (!dirty.length) return setStatus('Pontos salvos em src/data/layout.json');
  }
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
  s.className = `status${/^Erro|Não carregou|Nada para/.test(t) ? ' err' : /^Salvo|salvos/.test(t) ? ' ok' : ''}`;
  $('save').classList.remove('dirty');
}
function updateStatus() {
  const n = [...layers.values()].filter((l) => l.dirty).length;
  const dirty = n > 0 || layoutDirty;
  const s = $('status');
  s.textContent = n ? `${n} camada(s) não salva(s)` : layoutDirty ? 'origem/pontos não salvos' : '';
  s.className = `status${dirty ? ' dirty' : ''}`;
  $('save').classList.toggle('dirty', dirty);
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
    eye.innerHTML = hiddenParts.has(p.name) ? ico('minus') : ico('eye');
    eye.dataset.tip = hiddenParts.has(p.name) ? 'Mostrar' : 'Esconder';
    eye.dataset.tipPos = 'right';
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
    else if (edited.has(p.name)) li.insertAdjacentHTML('beforeend', '<span class="tag" data-tip="Editada à mão: o prepare-layers.py não a refaz" data-tip-pos="right">editada</span>');
    li.onclick = () => {
      active = p.name;
      renderLayerList();
      redraw();
    };
    ul.appendChild(li);
  }
  const w = who();
  $('call').textContent = `dollParts(${JSON.stringify({ style: w.style, rank: w.rank, sannin: w.sannin, anbu: w.anbu, sword: w.sword })})\n${parts()
    .map((p, i) => `${i + 1}. ${p.name}${p.color ? `  ${p.color}` : ''}${p.color2 ? ` / ${p.color2}` : ''}`)
    .join('\n')}`;
}

/** Pastas abertas na árvore de arquivos (lembradas no navegador). */
const openDirs = new Set<string>(JSON.parse(localStorage.getItem('spr-dirs') ?? '[]'));

/**
 * Lista de arquivos em árvore (src/art na raiz; ui/ e ui/art/ como pastas que abrem e fecham). Com filtro, a busca
 * vale para todas as pastas e mostra os achados numa lista só, com o caminho.
 */
/** Filtro por tipo na lista de arquivos: tudo, folhas (grade 4×3), imagens únicas ou só as editadas à mão. */
let fileKind: 'all' | 'sheet' | 'single' | 'edited' = 'all';
const kindOk = (name: string) => fileKind === 'all' || (fileKind === 'sheet' ? SHEET_RE.test(name) : fileKind === 'single' ? !SHEET_RE.test(name) : edited.has(name));
function renderFiles() {
  const q = $<HTMLInputElement>('filter').value.trim().toLowerCase();
  const ul = $('files');
  ul.innerHTML = '';
  const names = files.map((f) => f.replace(/\.png$/, '')).filter(kindOk);
  if (q || fileKind !== 'all') {
    // com busca ou filtro, uma lista só, com o caminho
    for (const n of names) if (n.includes(q)) ul.appendChild(fileItem(n, n, 0));
    return;
  }
  // pastas antes dos arquivos, em cada nível
  const walk = (dir: string, depth: number) => {
    const pre = dir ? `${dir}/` : '';
    const inside = names.filter((n) => n.startsWith(pre)).map((n) => n.slice(pre.length));
    const dirs = [...new Set(inside.filter((n) => n.includes('/')).map((n) => n.split('/')[0]!))].sort();
    for (const d of dirs) {
      const path = pre + d;
      const open = openDirs.has(path);
      const count = inside.filter((n) => n.startsWith(`${d}/`)).length;
      const li = document.createElement('li');
      li.className = 'dir';
      li.style.paddingLeft = `${6 + depth * 14}px`;
      li.innerHTML = `${ico('folder')}<span class="nm">${d}/</span><small>${count}</small>`;
      li.onclick = () => {
        if (open) openDirs.delete(path);
        else openDirs.add(path);
        try {
          localStorage.setItem('spr-dirs', JSON.stringify([...openDirs]));
        } catch {}
        renderFiles();
      };
      ul.appendChild(li);
      if (open) walk(path, depth + 1);
    }
    for (const n of inside) if (!n.includes('/')) ul.appendChild(fileItem(pre + n, n, depth));
  };
  walk('', 0);
}

function fileItem(name: string, label: string, depth: number) {
  const li = document.createElement('li');
  li.innerHTML = `${ico(SHEET_RE.test(name) ? 'person' : 'image')}<span class="nm">${label}</span>${edited.has(name) ? '<span class="tag">editada</span>' : ''}`;
  li.style.paddingLeft = `${8 + depth * 14}px`;
  li.classList.toggle('on', name === fileName);
  li.onclick = async () => {
    fileName = name;
    const sheet = SHEET_RE.test(name);
    const atlas = ATLASES[name];
    $<HTMLInputElement>('fCols').value = String(atlas?.cols ?? (sheet ? 4 : 1));
    $<HTMLInputElement>('fRows').value = String(atlas?.rows ?? (sheet ? 3 : 1));
    await loadLayer(name);
    col = sheet ? DOLL_GRID.idle : 0;
    row = sheet ? 1 : 0;
    zoom = fitZoom();
    pan = { x: 0, y: 0 };
    renderFiles();
    renderFrames();
    if (tool === 'origin') syncOriginBox();
    redraw();
  };
  return li;
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

/** Dica curta de cada ferramenta, na barra de baixo do palco. */
const TOOL_HINT: Record<Tool, string> = {
  pencil: 'Clique ou arraste para pintar · botão direito apaga · Alt+clique pega a cor',
  eraser: 'Clique ou arraste para apagar',
  line: 'Arraste do início ao fim · Shift prende na horizontal, vertical ou 45°',
  fill: 'Clique na área contínua da mesma cor · botão direito deixa transparente',
  picker: 'Clique numa cor para usá-la no lápis',
  select: 'Arraste um retângulo · arraste dentro dele para mover (fica flutuando até Enter) · Ctrl+arrastar duplica · setas 1 px · Delete apaga · Ctrl+C/V · Esc tira',
  wand: 'Clique numa cor: seleciona a área parecida (tolerância acima) · Shift soma · Ctrl tira · arraste dentro da seleção para mover · setas 1 px · Delete apaga',
  move: 'Arraste para mover a seleção ou a camada inteira (flutua até Enter) · Ctrl+arrastar duplica · setas 1 px · "Vista toda" leva os 4 quadros',
  origin: 'Clique ou arraste: origem (os pés) · Shift+clique: alto do corpo · campos acima: sombra · vale para a folha toda',
  point: 'Clique marca o ponto deste quadro · botão direito tira · "Aplicar" copia para a vista ou para todos',
};
function setTool(t: Tool) {
  tool = t;
  syncFloat(); // outra ferramenta fixa o que flutuava
  for (const b of $('tools').querySelectorAll('button')) b.classList.toggle('on', b.dataset.tool === t);
  $('toolHint').textContent = TOOL_HINT[t];
  const slot = document.querySelector<SVGElement>('.hintbar [data-ico-slot]');
  if (slot) slot.outerHTML = ico($('tools').querySelector<HTMLElement>(`[data-tool="${t}"]`)?.dataset.ico ?? 'info').replace('class="ic"', 'class="ic" data-ico-slot');
  stage.style.cursor = t === 'move' ? 'move' : t === 'picker' ? 'copy' : t === 'select' ? 'cell' : 'crosshair';
  $('pointBox').hidden = t !== 'point';
  $('wandBox').hidden = t !== 'wand';
  $('originBox').hidden = t !== 'origin';
  if (t === 'origin') syncOriginBox();
  if (t === 'point' && mode === 'file' && fileName?.startsWith('sword-') && $<HTMLInputElement>('pointKey').value === 'hand') $<HTMLInputElement>('pointKey').value = 'grip';
  if (t === 'point' && mode === 'doll') $<HTMLInputElement>('pointKey').value = 'hand';
  redraw();
}

/** Nome do ícone/selo na casa aberta de um atlas. */
function cellName() {
  const atlas = mode === 'file' && fileName ? ATLASES[fileName] : undefined;
  if (!atlas) return '';
  const hit = Object.entries(atlas.pos).find(([, [c, r]]) => c === col && r === row);
  return hit ? `Ícone: ${hit[0]}` : 'Casa vazia';
}

function renderFrames() {
  const { cols, rows } = grid();
  $('cellName').textContent = cellName();
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
  chips($('sword'), [['none', 'Nenhuma'], ...Object.keys(SWORDS).map((s): [string, string] => [s, SWORD_NAMES[s] ?? s])], swordSel, (v) => {
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
  // tamanho do jogo (zoom 1 e 2,5): o QUADRO EM EDIÇÃO (vista e coluna escolhidas), parado; o corpo vale a altura no
  // mundo (ninja 30 px; bicho pelo tamanho dele), com a origem na mesma linha e a sombra embaixo, como o jogo desenha
  if (unitSheet()) {
    const o = originOf();
    const h = mode === 'doll' ? 30 : worldHeight(o.name);
    const scales = [h / o.body, (h * 2.5) / o.body];
    const below = Math.max(...scales.map((s) => (fh - o.foot[1]) * s));
    ingameC.width = Math.ceil(fw * (scales[0]! + scales[1]!)) + 30;
    ingameC.height = Math.ceil(o.foot[1] * scales[1]! + below) + 10;
    const ictx = ingameC.getContext('2d')!;
    ictx.clearRect(0, 0, ingameC.width, ingameC.height);
    const baseY = ingameC.height - 5 - below;
    let x = 10;
    for (const s of scales) {
      const top = baseY - o.foot[1] * s;
      if ($<HTMLInputElement>('showOrigin').checked) drawShadow(ictx, x, top, s);
      drawFrame(ictx, col, row, x, top, s);
      x += fw * s + 10;
    }
    ingameC.hidden = false;
  } else ingameC.hidden = true;
  $('ingameCard').hidden = ingameC.hidden;
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
    commitFloat();
    const { fw, fh } = grid();
    sel = { x: 0, y: 0, w: fw, h: fh };
    selMask = null;
    setTool('select');
    redraw();
  } else if (e.ctrlKey && k === 'c' && sel) {
    const l = activeLayer();
    const { fw, fh } = grid();
    if (!l) return;
    clip = applyMask(l.ctx.getImageData(col * fw + sel.x, row * fh + sel.y, sel.w, sel.h));
    void copyToSystem(clip);
  } else if ((e.key === 'Delete' || e.key === 'Backspace') && sel) {
    const l = activeLayer();
    const { fw, fh } = grid();
    if (!l) return;
    pushUndo(l);
    const m = maskCanvas();
    if (m) {
      l.ctx.save();
      l.ctx.globalCompositeOperation = 'destination-out';
      l.ctx.drawImage(m, col * fw + sel.x, row * fh + sel.y);
      l.ctx.restore();
    } else l.ctx.clearRect(col * fw + sel.x, row * fh + sel.y, sel.w, sel.h);
    touched(l);
  } else if (e.key === 'Escape') {
    commitFloat();
    sel = null;
    selMask = null;
    redraw();
  } else if (e.key === 'Enter' && float) {
    commitFloat();
    setStatus('Fixado');
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
  else if (k === 'w') setTool('wand');
  else if (k === 'm') setTool('move');
  else if (k === 'p') setTool('point');
  else if (k === 'o') setTool('origin');
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
  if ([...layers.values()].some((l) => l.dirty) || layoutDirty) e.preventDefault();
});
$('pointKey').addEventListener('input', redraw);
$('showPoints').addEventListener('change', redraw);
$('pointDel').onclick = () => setPoint(null);
$('pointRow').onclick = () => {
  const p = currentPoint();
  if (!p) return setStatus('Marque o ponto neste quadro primeiro');
  const { cols } = grid();
  for (let c = 0; c < cols; c++) setPoint([p[0], p[1]], row * cols + c);
};
$('pointAll').onclick = () => {
  const p = currentPoint();
  if (!p) return setStatus('Marque o ponto neste quadro primeiro');
  const { cols, rows } = grid();
  for (let i = 0; i < cols * rows; i++) setPoint([p[0], p[1]], i);
};
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
for (const b of $('fileKind').querySelectorAll<HTMLButtonElement>('button'))
  b.onclick = () => {
    fileKind = b.dataset.kind as typeof fileKind;
    for (const x of $('fileKind').querySelectorAll('button')) x.classList.toggle('on', x === b);
    renderFiles();
  };
// cartões recolhíveis lembram se estavam abertos
for (const d of document.querySelectorAll<HTMLDetailsElement>('details[data-remember]')) {
  const key = `spr-${d.dataset.remember}`;
  try {
    const v = localStorage.getItem(key);
    if (v != null) d.open = v === '1';
  } catch {}
  d.addEventListener('toggle', () => {
    try {
      localStorage.setItem(key, d.open ? '1' : '0');
    } catch {}
  });
}
$('oBody').onchange = () => setOrigin({ body: Math.max(4, Number($<HTMLInputElement>('oBody').value) || originOf().body) });
for (const [id, i] of [['oShW', 0], ['oShH', 1]] as const)
  $(id).onchange = () => {
    const m = [...originOf().mult] as [number, number];
    m[i] = Math.max(0, Number($<HTMLInputElement>(id).value) || 0);
    setOrigin({ shadow: m });
  };
$('oReset').onclick = () => setOrigin(null);
$('showOrigin').onchange = redraw;
for (const id of ['fCols', 'fRows'])
  $(id).oninput = () => {
    const { cols, rows } = grid();
    col = Math.min(col, cols - 1);
    row = Math.min(row, rows - 1);
    renderFrames();
    redraw();
  };

// ------------------------------------------------------------------ início
applyIcons();
helpDialog('Editor de sprites: atalhos', [
  ['Ferramentas', [
    ['B', 'Lápis'], ['E', 'Borracha'], ['L', 'Linha (Shift: reta ou 45°)'], ['G', 'Balde'], ['I | Alt+clique', 'Conta-gotas'],
    ['S', 'Seleção'], ['W', 'Varinha mágica (Shift soma, Ctrl tira; tolerância e "Adjacente" acima do palco)'], ['M', 'Mover'], ['O', 'Origem e sombra'], ['P', 'Ponto nomeado (mão, cabo)'], ['X | botão direito', 'Apagar com lápis, linha e balde'],
  ]],
  ['Seleção', [
    ['Ctrl+A', 'Seleciona o quadro inteiro'], ['Delete', 'Apaga o selecionado'], ['Ctrl+C', 'Copia (também para a área de transferência do sistema)'],
    ['Ctrl+V', 'Cola (inclusive uma imagem do Photoshop); o colado fica flutuando'], ['Setas', 'Move 1 px a seleção ou a camada'],
    ['Arrastar dentro', 'Levanta e move: fica flutuando por cima, sem cortar o que está embaixo'], ['Ctrl+arrastar', 'Move uma cópia (duplica)'],
    ['Enter', 'Fixa o que está flutuando'], ['Esc', 'Fixa e tira a seleção'],
  ]],
  ['Vista e quadros', [
    ['Roda', 'Zoom em volta do cursor'], ['Espaço+arrastar | botão do meio', 'Rolar o palco'], ['1 | 2 | 3', 'Vista: lado, frente, costas'],
    [', | .', 'Quadro anterior / próximo'], ['Clique na folha', 'Escolhe o quadro'],
  ]],
  ['Arquivo', [
    ['Ctrl+S', 'Salvar em src/art (e os pontos/origem no layout.json)'], ['Ctrl+Z | Ctrl+Y', 'Desfazer / refazer'], ['?', 'Esta ajuda'],
  ]],
]);
await refreshList();
try {
  layoutData = await fetch('/api/layout').then((r) => r.json());
} catch {
  setStatus('Não carregou src/data/layout.json (pontos desligados)');
}
for (const f of files) if (f.startsWith('layer-') || f === 'ninja-body.png') await loadLayer(f.replace(/\.png$/, ''));
zoom = fitZoom();
await afterDollChange();
setTool('pencil');
requestAnimationFrame(loop);
