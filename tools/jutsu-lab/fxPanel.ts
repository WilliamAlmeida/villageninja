// Painel "Ajuste" do Laboratório: mexe ao vivo no visual dos jutsus (data/jutsu-fx.json) e grava pelo servidor do
// 3011 (/api/fx). Três abas, cada uma em seções que abrem e fecham (o estado fica guardado neste navegador):
//  - Sprite: folha do jutsu (ou a Prisão d'Água); "Pontos" é um inspetor de quadro com zoom (roda do mouse), onde se
//    arrasta a âncora, o pescoço do dragão (onde o corpo encaixa na cabeça), a base da fonte e a faixa do corpo
//    (setas movem 1 px da arte, Shift+setas 0,25 px); tamanho, aparência, peças e trajetória do bote.
//  - Partículas: rastro e explosão; com um jutsu escolhido, cada parte diz o que está EM USO (o estilo, que vale para
//    vários jutsus, ou o próprio deste jutsu) e edita exatamente isso.
//  - Projétil: velocidade, tamanho, raio, quantidade, alcance e leque (mexe na jogabilidade).
// Todo número tem barra, campo e ‹ › de passo fino (Shift no ‹ › = passo ×10). Tudo muda o objeto vivo `FX` (e o
// JutsuDef, nos números), então o próximo disparo já sai com o ajuste.
import { applyIcons, ico } from '../shared/ui';
import { FX, PARTS_DEFAULT, PROJ_KEYS, SHAPES, type DragonParts, type Emitter, type FxData, type JutsuFx, type ProjFx, type Shape, type SpriteFx } from '../../src/data/jutsuFx';
import { JUTSU_BASE, JUTSU_LIST, JUTSUS } from '../../src/data/jutsus';
import { jutsuVfx, type Vfx } from '../../src/data/vfx';
import { art, EFFECT_SHEETS } from '../../src/render/art';

const STYLE_LABEL: Record<string, string> = {
  fire: 'Fogo', water: 'Água', lightning: 'Raio', earth: 'Terra', wind: 'Vento', ice: 'Gelo', lava: 'Lava', heat: 'Calor',
  wood: 'Madeira', storm: 'Tempestade', dark: 'Trevas', blood: 'Sangue', needle: 'Agulha', leaf: 'Folha', genjutsu: 'Genjutsu',
  impact: 'Impacto', metal: 'Metal', gold: 'Ouro', sound: 'Som', bone: 'Osso', web: 'Teia', sand: 'Areia', shadow: 'Sombra', none: 'Sem estilo',
};
const SHAPE_LABEL: Record<Shape, string> = {
  flame: 'Chama', ember: 'Brasa', spark: 'Faísca', flash: 'Clarão', mote: 'Ponto', smoke: 'Fumaça', mist: 'Névoa', drop: 'Gota',
  dust: 'Poeira', chip: 'Lasca', shard: 'Cristal', streak: 'Risco', leaf: 'Folha', needle: 'Agulha', note: 'Nota',
};
const sheetLabel = (s: string) => s.replace(/^(projectile|effect)-/, '');
const styleName = (s: string) => STYLE_LABEL[s] ?? s;

type Tab = 'sprite' | 'particles' | 'proj';
type Part = 'trail' | 'burst';

export interface FxPanelOpts {
  /** Solta de novo a técnica escolhida. */
  fire: () => void;
  /** Liga/desliga o disparo repetido (o laboratório solta de novo quando o campo fica parado). */
  setRepeat: (on: boolean) => void;
}

let opts: FxPanelOpts;
let root: HTMLElement;
let tab: Tab = 'sprite';
let jutsu: string | null = null;
let spriteTarget: 'jutsu' | 'water' = 'jutsu';
/** Peça do dragão no inspetor. */
let piece: 'head' | 'origin' | 'body' = 'head';
/** Estilo editado quando não há jutsu escolhido. */
let style = 'fire';
let repeat = false;
let canSave = false;
/** Há ajuste não salvo; texto e cor do estado (o painel se redesenha, então guarda aqui). */
let dirty = false;
let statusText = '';
let statusKind: '' | 'ok' | 'err' | 'dirty' = '';
/** Cartões de emissor abertos (`parte:índice`). */
const open = new Set<string>();
/** Partículas próprias tiradas nesta sessão: voltar para "Só deste jutsu" recupera o que estava. */
const stash = new Map<string, Emitter[]>();

function showStatus(text: string, kind: typeof statusKind = '') {
  statusText = text;
  statusKind = kind;
  const s = root.querySelector('#status');
  if (s) {
    s.textContent = text;
    s.className = `status${kind ? ` ${kind}` : ''}`;
  }
  root.querySelector('#save')?.classList.toggle('dirty', dirty);
}

// ------------------------------------------------------------------ guardado no navegador (seções abertas)
function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function store(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {}
}
const sections: Record<string, boolean> = load('lab-fx-sections', {});

// ------------------------------------------------------------------ montagem de DOM
function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...kids: (Node | string | null | false | undefined)[]) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else e.setAttribute(k, v);
  }
  for (const c of kids) if (c) e.append(c);
  return e;
}
function btn(label: string, run: (e: MouseEvent) => void, attrs: Record<string, string> = {}) {
  const b = h('button', attrs);
  b.innerHTML = label;
  b.onclick = (e) => {
    e.stopPropagation();
    run(e);
  };
  return b;
}
/** Barra de escolha única (`.seg`). */
function seg<T extends string>(items: [T, string, string?][], cur: T, set: (v: T) => void, cls = 'seg sm') {
  const box = h('div', { class: cls });
  for (const [v, label, tip] of items) box.append(btn(label, () => set(v), { class: v === cur ? 'on' : '', ...(tip ? { 'data-tip': tip } : {}) }));
  return box;
}
function chips<T extends string>(items: [T, string, string?][], cur: T | null, set: (v: T) => void) {
  const box = h('div', { class: 'chips' });
  for (const [v, label, tip] of items) box.append(btn(label, () => set(v), { class: v === cur ? 'on' : '', ...(tip ? { 'data-tip': tip } : {}) }));
  return box;
}
function toggle(label: string, on: boolean, set: (v: boolean) => void, tip?: string, mark = true) {
  const l = h('label', { class: 'tog', ...(tip ? { 'data-tip': tip } : {}) });
  const i = h('input', { type: 'checkbox' });
  i.checked = on;
  i.onchange = () => {
    set(i.checked);
    if (mark) changed();
  };
  l.append(i, label);
  return l;
}
/** Seção que abre e fecha (guardado por `key`); `badge` aparece no título mesmo fechada. */
function section(box: HTMLElement, key: string, title: string, build: (body: HTMLElement) => void, o: { open?: boolean; badge?: string; tip?: string } = {}) {
  const isOpen = sections[key] ?? o.open ?? true;
  const sec = h('div', { class: `sec${isOpen ? ' open' : ''}` });
  const head = h('div', { class: 'sech', ...(o.tip ? { 'data-tip': o.tip } : {}) }, h('span', { class: 'car' }, isOpen ? '▾' : '▸'), h('b', {}, title), o.badge && h('span', { class: 'badge' }, o.badge));
  head.onclick = () => {
    sections[key] = !isOpen;
    store('lab-fx-sections', sections);
    render();
  };
  sec.append(head);
  if (isOpen) {
    const body = h('div', { class: 'secb' });
    build(body);
    sec.append(body);
  }
  box.append(sec);
}
const decimals = (step: number) => Math.max(0, Math.min(4, Math.ceil(-Math.log10(step) - 1e-9)));
const round = (v: number, step: number) => Number((Math.round(v / step) * step).toFixed(decimals(step)));
/** Número com barra, campo e ‹ › de passo fino (Shift = ×10). O campo aceita passar do limite da barra. */
function slider(label: string, value: number, min: number, max: number, step: number, set: (v: number) => void, tip?: string) {
  const row = h('div', { class: 'sl', ...(tip ? { 'data-tip': tip } : {}) });
  const r = h('input', { type: 'range', min: String(Math.min(min, value)), max: String(Math.max(max, value)), step: String(step) });
  const n = h('input', { type: 'number', step: String(step) });
  r.value = String(value);
  n.value = String(round(value, step));
  const put = (v: number) => {
    v = round(v, step);
    if (v > Number(r.max)) r.max = String(v);
    if (v < Number(r.min)) r.min = String(v);
    r.value = String(v);
    n.value = String(v);
    set(v);
    changed();
  };
  r.oninput = () => put(Number(r.value));
  n.onchange = () => {
    const v = Number(n.value);
    if (Number.isFinite(v)) put(v);
  };
  const nudge = (dir: number) => btn(dir < 0 ? '‹' : '›', (e) => put(Number(n.value) + dir * step * (e.shiftKey ? 10 : 1)), { class: 'ghost nud', 'data-tip': `${dir < 0 ? '−' : '+'}${step} (Shift: ×10)` });
  row.append(h('label', {}, label), r, nudge(-1), n, nudge(1));
  return row;
}
/** Faixa sorteada [mín, máx]. */
function pair(label: string, value: [number, number] | undefined, min: number, max: number, step: number, set: (v: [number, number] | undefined) => void, tip?: string) {
  const v: [number, number] = value ? [value[0], value[1]] : [0, 0];
  const box = h('div', { class: 'pair', ...(tip ? { 'data-tip': tip } : {}) }, h('div', { class: 'pl' }, label));
  const put = () => set(v[0] === 0 && v[1] === 0 && !value ? undefined : [v[0], v[1]]);
  box.append(
    slider('mín', v[0], min, max, step, (x) => {
      v[0] = x;
      put();
    }),
    slider('máx', v[1], min, max, step, (x) => {
      v[1] = x;
      put();
    }),
  );
  return box;
}

// ------------------------------------------------------------------ estado e gravação
function changed() {
  dirty = true;
  showStatus('Ajuste não salvo', 'dirty');
}
function entry(id: string): JutsuFx {
  return (FX.jutsus[id] ??= {});
}
/** Tira o que ficou vazio (exceção sem nada, números iguais aos do jutsu) e ordena as faixas. */
function tidy(data: FxData) {
  const sortRanges = (list?: Emitter[]) =>
    list?.forEach((e) => {
      for (const k of ['life', 'size', 'speed', 'rise', 'jump'] as const) {
        const r = e[k];
        if (r && r[0] > r[1]) e[k] = [r[1], r[0]];
      }
    });
  for (const s of Object.values(data.styles)) {
    sortRanges(s.trail);
    sortRanges(s.burst);
  }
  for (const [id, j] of Object.entries(data.jutsus)) {
    sortRanges(j.trail);
    sortRanges(j.burst);
    if (j.proj && !Object.keys(j.proj).length) delete j.proj;
    if (!Object.keys(j).length) delete data.jutsus[id];
  }
}
/** O servidor do 3011 grava? (o /lab do túnel é só leitura; um 3011 antigo, sem a rota, também não grava). */
async function probe() {
  try {
    const r = await fetch('/api/fx', { method: 'GET', cache: 'no-store' });
    canSave = r.ok && (r.headers.get('content-type') ?? '').includes('json');
  } catch {
    canSave = false;
  }
  return canSave;
}
async function save() {
  // testa de novo na hora: o servidor pode ter sido reiniciado depois que a página abriu (o ajuste em memória não se perde)
  if (!canSave && !(await probe())) {
    showStatus(location.port === '3011'
      ? 'Este servidor do 3011 não tem a rota de gravar (processo antigo): pm2 restart villageninja-editor e clique em Salvar de novo'
      : 'Só grava no localhost:3011 (o laboratório pelo túnel é só leitura)', 'err');
    return;
  }
  render();
  tidy(FX);
  showStatus('Salvando…');
  try {
    const r = await fetch('/api/fx', { method: 'PUT', body: JSON.stringify(FX) });
    if (!r.ok) throw new Error(await r.text());
    dirty = false;
    showStatus('Salvo em src/data/jutsu-fx.json', 'ok');
  } catch (e) {
    showStatus(`Não salvou: ${(e as Error).message}`, 'err');
  }
}
/** Volta ao que está gravado (desfaz o que não foi salvo). */
async function revert() {
  try {
    const data = (await (await fetch('/api/fx', { cache: 'no-store' })).json()) as FxData;
    for (const [id, base] of Object.entries(JUTSU_BASE)) {
      const d = JUTSUS[id]!;
      for (const k of PROJ_KEYS) (d as unknown as Record<string, unknown>)[k] = base[k];
      d.vfx = base.vfx;
    }
    FX.styles = data.styles;
    FX.jutsus = data.jutsus;
    FX.status = data.status;
    for (const [id, f] of Object.entries(FX.jutsus)) {
      const d = JUTSUS[id];
      if (!d) continue;
      for (const k of PROJ_KEYS) if (f.proj?.[k] != null) d[k] = f.proj[k];
      if (f.vfx) d.vfx = f.vfx;
    }
    stash.clear();
    dirty = false;
    render();
    showStatus('Voltou ao que está salvo', 'ok');
  } catch {
    showStatus('Não deu para ler o arquivo', 'err');
  }
}

// ------------------------------------------------------------------ inspetor de quadro (pontos com zoom)
/** Ponto ajustável na célula (fração 0–1): `point` (x e y), `hline` (só y) ou `vline` (só x). */
interface Marker {
  label: string;
  color: string;
  kind: 'point' | 'hline' | 'vline';
  tip: string;
  get: () => [number, number];
  set: (x: number, y: number) => void;
}
interface InspectSpec {
  /** Chave do estado da vista (zoom, quadro, ponto ativo) entre um redesenho e outro. */
  key: string;
  sheet: string;
  cols: number;
  rows: number;
  frames: number;
  markers: Marker[];
}
const views = new Map<string, { zoom: number; px: number; py: number; frame: number; anim: boolean; active: number }>();
let inspector: { canvas: HTMLCanvasElement; spec: InspectSpec; readout: HTMLElement } | null = null;

function viewOf(spec: InspectSpec) {
  let v = views.get(spec.key);
  if (!v) {
    v = { zoom: 1, px: 0.5, py: 0.5, frame: 0, anim: false, active: 0 };
    views.set(spec.key, v);
  }
  return v;
}
/** Geometria atual: escala (px de tela por px da arte) e onde fica o canto da célula. */
function geom(canvas: HTMLCanvasElement, spec: InspectSpec, img: HTMLImageElement) {
  const v = viewOf(spec);
  const cw = img.naturalWidth / Math.max(1, spec.cols), ch = img.naturalHeight / Math.max(1, spec.rows);
  const fit = Math.min(canvas.width / cw, canvas.height / ch) * 0.92;
  const scale = fit * v.zoom;
  return { cw, ch, scale, ox: canvas.width / 2 - v.px * cw * scale, oy: canvas.height / 2 - v.py * ch * scale };
}
function drawInspector(t: number) {
  if (!inspector?.canvas.isConnected) {
    inspector = null;
    return;
  }
  const { canvas, spec } = inspector;
  // resolução interna pelo tamanho na tela (o CSS fixa a proporção: mexer aqui não muda o layout)
  const dpr = window.devicePixelRatio || 1;
  const W = Math.round(canvas.clientWidth * dpr);
  if (W > 0 && canvas.width !== W) {
    canvas.width = W;
    canvas.height = Math.round(W * 0.75);
  }
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#1e160f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const img = art(spec.sheet);
  if (!img) return;
  const v = viewOf(spec);
  const frames = Math.max(1, Math.min(spec.frames, spec.cols * spec.rows));
  if (v.anim) v.frame = Math.floor((t / 1000) * 8) % frames;
  const f = Math.min(v.frame, frames - 1);
  const { cw, ch, scale, ox, oy } = geom(canvas, spec, img);
  const W2 = cw * scale, H2 = ch * scale;
  // xadrez da transparência (em px da arte quando o zoom deixa)
  const sq = Math.max(4 * dpr, scale * 4);
  ctx.save();
  ctx.beginPath();
  ctx.rect(ox, oy, W2, H2);
  ctx.clip();
  for (let y = 0; y < H2; y += sq) for (let x = 0; x < W2; x += sq) {
    ctx.fillStyle = (Math.floor(x / sq) + Math.floor(y / sq)) % 2 ? '#3a2a1c' : '#2c2016';
    ctx.fillRect(ox + x, oy + y, sq, sq);
  }
  ctx.restore();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, (f % spec.cols) * cw, Math.floor(f / spec.cols) * ch, cw, ch, ox, oy, W2, H2);
  // grade de pixels com zoom alto
  if (scale >= 7) {
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= cw; x++) {
      ctx.moveTo(Math.round(ox + x * scale) + 0.5, oy);
      ctx.lineTo(Math.round(ox + x * scale) + 0.5, oy + H2);
    }
    for (let y = 0; y <= ch; y++) {
      ctx.moveTo(ox, Math.round(oy + y * scale) + 0.5);
      ctx.lineTo(ox + W2, Math.round(oy + y * scale) + 0.5);
    }
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,220,155,0.35)';
  ctx.strokeRect(ox + 0.5, oy + 0.5, W2 - 1, H2 - 1);
  spec.markers.forEach((m, i) => {
    const [mx, my] = m.get();
    const x = ox + mx * W2, y = oy + my * H2;
    const on = i === v.active;
    ctx.strokeStyle = m.color;
    ctx.fillStyle = m.color;
    ctx.lineWidth = (on ? 2 : 1) * dpr;
    ctx.beginPath();
    if (m.kind === 'hline') {
      ctx.setLineDash(on ? [] : [6 * dpr, 4 * dpr]);
      ctx.moveTo(ox - 8 * dpr, y);
      ctx.lineTo(ox + W2 + 8 * dpr, y);
    } else if (m.kind === 'vline') {
      ctx.setLineDash(on ? [] : [6 * dpr, 4 * dpr]);
      ctx.moveTo(x, oy - 8 * dpr);
      ctx.lineTo(x, oy + H2 + 8 * dpr);
    } else {
      const r = (on ? 9 : 7) * dpr;
      ctx.moveTo(x - r * 1.6, y);
      ctx.lineTo(x - 3 * dpr, y);
      ctx.moveTo(x + 3 * dpr, y);
      ctx.lineTo(x + r * 1.6, y);
      ctx.moveTo(x, y - r * 1.6);
      ctx.lineTo(x, y - 3 * dpr);
      ctx.moveTo(x, y + 3 * dpr);
      ctx.lineTo(x, y + r * 1.6);
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = `${11 * dpr}px system-ui, sans-serif`;
    const lx = m.kind === 'hline' ? ox + W2 - ctx.measureText(m.label).width - 4 * dpr : x + 10 * dpr;
    const ly = m.kind === 'vline' ? oy + 12 * dpr : y - 8 * dpr;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillText(m.label, lx + 1, ly + 1);
    ctx.fillStyle = m.color;
    ctx.fillText(m.label, lx, ly);
  });
}
function inspectorLoop(t: number) {
  if (inspector) drawInspector(t);
  requestAnimationFrame(inspectorLoop);
}
/** Valores dos pontos em px da arte (e fração) embaixo do inspetor. */
function readoutText(spec: InspectSpec, cw: number, ch: number) {
  const v = viewOf(spec);
  return spec.markers
    .map((m, i) => {
      const [x, y] = m.get();
      const val = m.kind === 'hline' ? `y ${(y * ch).toFixed(2)} px` : m.kind === 'vline' ? `x ${(x * cw).toFixed(2)} px` : `${(x * cw).toFixed(2)}, ${(y * ch).toFixed(2)} px`;
      return `<span class="mk${i === v.active ? ' on' : ''}" data-i="${i}" style="--mc:${m.color}"><i></i>${m.label}: ${val}</span>`;
    })
    .join('');
}

function inspectorBox(spec: InspectSpec): HTMLElement {
  const v = viewOf(spec);
  const box = h('div', { class: 'insp' });
  const canvas = h('canvas', { tabindex: '0' });
  const readout = h('div', { class: 'readout' });
  const img = () => art(spec.sheet);
  const refresh = () => {
    const i = img();
    if (i) readout.innerHTML = readoutText(spec, i.naturalWidth / spec.cols, i.naturalHeight / spec.rows);
  };
  readout.onclick = (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-i]');
    if (!el) return;
    v.active = Number(el.dataset.i);
    refresh();
    canvas.focus();
  };
  // posição do ponteiro em fração da célula
  const at = (e: PointerEvent | WheelEvent) => {
    const i = img()!;
    const r = canvas.getBoundingClientRect();
    const dpr = canvas.width / r.width;
    const px = (e.clientX - r.left) * dpr, py = (e.clientY - r.top) * dpr;
    const g = geom(canvas, spec, i);
    return { px, py, fx: (px - g.ox) / (g.cw * g.scale), fy: (py - g.oy) / (g.ch * g.scale), g, dpr };
  };
  /** Arredonda a meio px da arte. */
  const snap = (f: number, c: number) => Math.round(f * c * 2) / (2 * c);
  const move = (m: Marker, fx: number, fy: number, cw: number, ch: number) => {
    const [ox, oy] = m.get();
    const x = m.kind === 'hline' ? ox : Math.max(0, Math.min(1, snap(fx, cw)));
    const y = m.kind === 'vline' ? oy : Math.max(0, Math.min(1, snap(fy, ch)));
    m.set(x, y);
    changed();
    refresh();
  };
  let drag: { mode: 'marker' | 'pan'; sx: number; sy: number; px: number; py: number; moved: boolean } | null = null;
  canvas.onpointerdown = (e) => {
    if (!img()) return;
    canvas.setPointerCapture(e.pointerId);
    canvas.focus();
    const p = at(e);
    const W2 = p.g.cw * p.g.scale, H2 = p.g.ch * p.g.scale;
    let hit = -1;
    let best = 14 * p.dpr;
    spec.markers.forEach((m, i) => {
      const [mx, my] = m.get();
      const x = p.g.ox + mx * W2, y = p.g.oy + my * H2;
      const d = m.kind === 'hline' ? Math.abs(p.py - y) : m.kind === 'vline' ? Math.abs(p.px - x) : Math.hypot(p.px - x, p.py - y);
      if (d < best) {
        best = d;
        hit = i;
      }
    });
    if (hit >= 0) v.active = hit;
    drag = { mode: hit >= 0 ? 'marker' : 'pan', sx: e.clientX, sy: e.clientY, px: v.px, py: v.py, moved: false };
    refresh();
  };
  canvas.onpointermove = (e) => {
    const i = img();
    if (!drag || !i) return;
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 3) drag.moved = true;
    const p = at(e);
    if (drag.mode === 'marker') move(spec.markers[v.active]!, p.fx, p.fy, p.g.cw, p.g.ch);
    else if (drag.moved) {
      v.px = drag.px - ((e.clientX - drag.sx) * p.dpr) / (p.g.cw * p.g.scale);
      v.py = drag.py - ((e.clientY - drag.sy) * p.dpr) / (p.g.ch * p.g.scale);
    }
  };
  canvas.onpointerup = (e) => {
    // clique sem arrastar fora de um ponto: leva o ponto ativo até ali
    if (drag?.mode === 'pan' && !drag.moved && spec.markers[v.active]) {
      const p = at(e);
      move(spec.markers[v.active]!, p.fx, p.fy, p.g.cw, p.g.ch);
    }
    drag = null;
  };
  canvas.onwheel = (e) => {
    e.preventDefault();
    if (!img()) return;
    const p = at(e);
    const z = Math.max(1, Math.min(24, v.zoom * (e.deltaY < 0 ? 1.25 : 0.8)));
    v.zoom = z;
    // o ponto da arte sob o cursor fica parado
    const g2 = geom(canvas, spec, img()!);
    v.px += p.fx - (p.px - g2.ox) / (g2.cw * g2.scale);
    v.py += p.fy - (p.py - g2.oy) / (g2.ch * g2.scale);
    zoomLbl.textContent = `${Math.round(z * 100)}%`;
  };
  canvas.onkeydown = (e) => {
    const m = spec.markers[v.active];
    const i = img();
    if (!m || !i || !e.key.startsWith('Arrow')) return;
    e.preventDefault();
    e.stopPropagation();
    const cw = i.naturalWidth / spec.cols, ch = i.naturalHeight / spec.rows;
    const d = e.shiftKey ? 0.25 : 1;
    const [x, y] = m.get();
    const nx = x + (e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0) / cw;
    const ny = y + (e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0) / ch;
    m.set(m.kind === 'hline' ? x : Math.max(0, Math.min(1, nx)), m.kind === 'vline' ? y : Math.max(0, Math.min(1, ny)));
    changed();
    refresh();
  };
  const frames = Math.max(1, Math.min(spec.frames, spec.cols * spec.rows));
  const frameLbl = h('span', { class: 'fl' }, `${v.frame + 1}/${frames}`);
  const zoomLbl = h('span', { class: 'fl' }, `${Math.round(v.zoom * 100)}%`);
  const step = (d: number) => {
    v.anim = false;
    v.frame = (v.frame + d + frames) % frames;
    frameLbl.textContent = `${v.frame + 1}/${frames}`;
  };
  const zoomBy = (k: number) => {
    v.zoom = Math.max(1, Math.min(24, v.zoom * k));
    zoomLbl.textContent = `${Math.round(v.zoom * 100)}%`;
  };
  const bar = h('div', { class: 'ibar' },
    btn('◀', () => step(-1), { class: 'ghost', 'data-tip': 'Quadro anterior' }), frameLbl, btn('▶', () => step(1), { class: 'ghost', 'data-tip': 'Próximo quadro' }),
    toggle('Animar', v.anim, (on) => (v.anim = on), 'Passa os quadros (para ver se o ponto serve em todos)', false),
    h('span', { class: 'grow' }),
    btn('−', () => zoomBy(0.8), { class: 'ghost', 'data-tip': 'Menos zoom (roda do mouse também)' }), zoomLbl, btn('+', () => zoomBy(1.25), { class: 'ghost', 'data-tip': 'Mais zoom' }),
    btn('Ajustar', () => {
      v.zoom = 1;
      v.px = v.py = 0.5;
      zoomLbl.textContent = '100%';
    }, { class: 'ghost', 'data-tip': 'Volta a célula inteira na tela' }),
    btn('Zoom no ponto', () => {
      const m = spec.markers[v.active];
      if (!m) return;
      const [x, y] = m.get();
      v.zoom = Math.max(v.zoom, 6);
      if (m.kind !== 'hline') v.px = x;
      if (m.kind !== 'vline') v.py = y;
      zoomLbl.textContent = `${Math.round(v.zoom * 100)}%`;
    }, { class: 'ghost', 'data-tip': 'Aproxima no ponto escolhido' }),
  );
  box.append(bar, canvas, readout, h('p', { class: 'hint' }, 'Arraste um ponto (ou clique para levar o ponto escolhido até ali); arraste o vazio para mover a vista; roda = zoom; setas = 1 px da arte, Shift+setas = 0,25 px.'));
  inspector = { canvas, spec, readout };
  refresh();
  return box;
}

// ------------------------------------------------------------------ aba Sprite
function styleOfJutsu(id: string) {
  const d = JUTSUS[id];
  return (d && jutsuVfx(d)) ?? 'none';
}
const styleItems = (): [string, string][] => Object.keys(FX.styles).map((k) => [k, styleName(k)]);

function defaultSprite(sheet: string): SpriteFx {
  return { sheet, cols: 4, rows: 2, frames: 8, fps: 16, size: 40, anchorX: 0.75, anchorY: 0.5, dy: 0, opacity: 1, blend: 'normal', rotate: true, flip: false };
}
const anchorMarker = (s: { anchorX: number; anchorY: number }, label: string, tip: string): Marker => ({
  label, color: '#ff962e', kind: 'point', tip,
  get: () => [s.anchorX, s.anchorY],
  set: (x, y) => {
    s.anchorX = x;
    s.anchorY = y;
  },
});

function spriteTab(box: HTMLElement) {
  const d = jutsu ? JUTSUS[jutsu] : null;
  const cur = spriteTarget === 'water' ? FX.status.water : jutsu ? FX.jutsus[jutsu]?.sprite : undefined;
  section(box, 'sp-sheet', 'Folha', (b) => {
    b.append(chips<'jutsu' | 'water'>([['jutsu', d ? d.name : 'Jutsu escolhido'], ['water', "Prisão d'Água (estado)"]], spriteTarget, (v) => {
      spriteTarget = v;
      render();
    }));
    if (spriteTarget === 'jutsu' && !jutsu) {
      b.append(h('p', { class: 'hint' }, 'Toque num jutsu na lista à esquerda.'));
      return;
    }
    if (spriteTarget === 'jutsu') {
      b.append(chips<string>([['', 'Sem sprite'], ...EFFECT_SHEETS.map((s): [string, string] => [s, sheetLabel(s)])], cur?.sheet ?? '', (v) => {
        const e = entry(jutsu!);
        if (!v) delete e.sprite;
        else e.sprite = cur ? { ...cur, sheet: v } : defaultSprite(v);
        changed();
        render();
      }));
      if (d && d.effect !== 'projectile' && d.effect !== 'multi') b.append(h('p', { class: 'warn' }, 'Este jutsu não solta projétil: a sprite só aparece em projéteis.'));
      if (!cur) b.append(h('p', { class: 'hint' }, 'Sem sprite: o projétil é desenhado pelo código. Folha nova: PNG em src/art/effects registrado no art.ts.'));
    }
  }, { badge: cur ? sheetLabel(cur.sheet) : 'sem sprite' });
  if (!cur || (spriteTarget === 'jutsu' && !jutsu)) return;
  const s = cur;
  const parts = s.motion === 'dragon' ? s.parts : undefined;
  const single = s.motion === 'dragon' && !parts; // dragão de folha única (sequência v2)

  // ---- pontos (inspetor com zoom)
  section(box, 'sp-points', 'Pontos (zoom)', (b) => {
    let spec: InspectSpec;
    if (parts) {
      b.append(seg<'head' | 'origin' | 'body'>([['head', 'Cabeça', 'Ponta e pescoço'], ['origin', 'Fonte', 'Base no chão'], ['body', 'Corpo', 'Faixa da folha que vira o corpo']], piece, (v) => {
        piece = v;
        render();
      }));
      const p = parts as DragonParts;
      if (piece === 'head')
        spec = {
          key: `head:${s.sheet}`, sheet: s.sheet, cols: s.cols, rows: s.rows, frames: s.frames,
          markers: [
            anchorMarker(s, 'Ponta', 'Fica sobre a trajetória (a cabeça segue a curva por aqui)'),
            {
              label: 'Pescoço', color: '#5fd3ff', kind: 'point', tip: 'Onde o corpo encaixa na cabeça',
              get: () => [p.neckX ?? PARTS_DEFAULT.neckX, p.neckY ?? PARTS_DEFAULT.neckY],
              set: (x, y) => {
                p.neckX = x;
                p.neckY = y;
              },
            },
          ],
        };
      else if (piece === 'origin')
        spec = {
          key: `origin:${p.originSheet}`, sheet: p.originSheet, cols: s.cols, rows: s.rows, frames: s.frames,
          markers: [{
            label: 'Base', color: '#ff962e', kind: 'point', tip: 'Ponto da fonte que fica no chão',
            get: () => [p.originX ?? PARTS_DEFAULT.originX, p.originY ?? PARTS_DEFAULT.originY],
            set: (x, y) => {
              p.originX = x;
              p.originY = y;
            },
          }],
        };
      else {
        const top = () => p.bandTop ?? PARTS_DEFAULT.bandTop;
        const hgt = () => p.bandHeight ?? PARTS_DEFAULT.bandHeight;
        spec = {
          key: `body:${p.bodySheet}`, sheet: p.bodySheet, cols: s.cols, rows: s.rows, frames: s.frames,
          markers: [
            { label: 'Topo', color: '#5fd3ff', kind: 'hline', tip: 'Começo da faixa do corpo', get: () => [0, top()], set: (_x, y) => {
              const bottom = top() + hgt();
              p.bandTop = Math.min(y, bottom - 0.01);
              p.bandHeight = bottom - p.bandTop;
            } },
            { label: 'Base', color: '#ff962e', kind: 'hline', tip: 'Fim da faixa do corpo', get: () => [0, top() + hgt()], set: (_x, y) => {
              p.bandHeight = Math.max(0.01, y - top());
            } },
          ],
        };
      }
    } else {
      const markers = [anchorMarker(s, single ? 'Fonte' : 'Âncora', single ? 'Fonte do dragão no chão' : 'Fica sobre o projétil')];
      if (single)
        markers.push({ label: 'Mergulho', color: '#5fd3ff', kind: 'vline', tip: 'Onde o mergulho cai', get: () => [s.targetX ?? 0.75, 0], set: (x) => (s.targetX = x) });
      spec = { key: `sheet:${s.sheet}`, sheet: s.sheet, cols: s.cols, rows: s.rows, frames: s.frames, markers };
    }
    b.append(inspectorBox(spec));
  });

  // ---- tamanho e aparência
  section(box, 'sp-look', 'Tamanho e aparência', (b) => {
    if (spriteTarget === 'jutsu')
      b.append(h('div', { class: 'row' }, h('span', { class: 'lbl' }, 'Movimento'),
        seg<'loop' | 'dragon'>([['loop', 'Loop', 'Os quadros giram em loop sobre o projétil'], ['dragon', 'Bote', 'Dragão da fonte até o alvo']], s.motion === 'dragon' ? 'dragon' : 'loop', (v) => {
          if (v === 'dragon') Object.assign(s, { motion: 'dragon', targetX: s.targetX ?? 0.75, minSize: s.minSize ?? 56, maxSize: s.maxSize ?? 128, shear: s.shear ?? 0.6 });
          else delete s.motion;
          changed();
          render();
        })));
    if (!single) b.append(slider(parts ? 'Tamanho da cabeça' : 'Tamanho', s.size, 4, 200, 0.5, (v) => (s.size = v), 'Largura desenhada (px do mundo; o ninja tem uns 24 de altura)'));
    b.append(
      slider('Altura', s.dy, -40, 40, 0.25, (v) => (s.dy = v), 'Desloca na vertical (px; positivo desce)'),
      slider('Quadros/s', s.fps, 1, 40, 1, (v) => (s.fps = v)),
      slider('Opacidade', s.opacity, 0, 1, 0.01, (v) => (s.opacity = v)),
      h('div', { class: 'row' }, h('span', { class: 'lbl' }, 'Mistura'),
        seg<'normal' | 'add'>([['normal', 'Normal'], ['add', 'Somar luz', 'Brilha sobre o fundo (bom para fogo e raio)']], s.blend, (v) => {
          s.blend = v;
          changed();
          render();
        })),
      h('div', { class: 'row' },
        !single && toggle('Girar com o voo', s.rotate, (v) => (s.rotate = v)),
        !single && !parts && toggle('Nasce da mão', !!s.emerge, (v) => (v ? (s.emerge = true) : delete s.emerge), 'Esconde o que ainda está atrás do ponto de lançamento: o corpo comprido sai do punho (precisa de Girar com o voo)'),
        toggle('Espelhar à esquerda', s.flip, (v) => (s.flip = v), 'Indo para a esquerda, espelha a arte para não ficar de cabeça para baixo')),
    );
  });

  // ---- dragão: peças e trajetória
  if (parts) {
    const p = parts;
    section(box, 'sp-parts', 'Dragão: corpo e fonte', (b) => {
      b.append(
        slider('Espessura do corpo', p.bodyWidth, 2, 40, 0.25, (v) => (p.bodyWidth = v)),
        slider('Espaço entre juntas', p.spacing, 2, 14, 0.25, (v) => (p.spacing = v), 'Menor: mais juntas, curva mais lisa'),
        slider('Tamanho da fonte', p.originSize, 8, 80, 0.5, (v) => (p.originSize = v)),
        h('p', { class: 'hint' }, 'Pescoço, base da fonte e faixa do corpo: em "Pontos (zoom)".'),
      );
    });
  }
  const flight = spriteTarget === 'jutsu' && jutsu ? FX.jutsus[jutsu]?.flight : undefined;
  if (flight)
    section(box, 'sp-flight', 'Dragão: trajetória', (b) => {
      b.append(
        slider('Altura do arco', flight.lift, 0, 140, 0.5, (v) => (flight.lift = v), 'Quanto a cabeça sobe antes de mergulhar no alvo (px)'),
        slider('Saída da fonte', flight.out ?? 1 / 3, 0, 1, 0.01, (v) => (flight.out = v), 'Pequeno: sai quase na vertical da fonte antes de avançar'),
        slider('Chegada no alvo', flight.in ?? 1 / 3, 0, 1, 0.01, (v) => (flight.in = v), 'Pequeno: mergulha quase na vertical no alvo'),
        slider('Altura da fonte', flight.sourceZ ?? 18, 0, 60, 0.5, (v) => (flight.sourceZ = v), 'Altura (px) em que o corpo sai da fonte'),
        slider('Curva lateral', flight.bend, -120, 120, 0.5, (v) => (flight.bend = v), 'Desvio para o lado no meio do caminho; 0 = reto no chão. Chega sempre de frente'),
        h('p', { class: 'hint' }, 'Vale a partir do próximo disparo (use Repetir).'),
      );
    });
  if (single)
    section(box, 'sp-single', 'Dragão de folha única', (b) => {
      b.append(
        slider('Tamanho mín', s.minSize ?? 56, 8, 256, 0.5, (v) => (s.minSize = v), 'Largura mínima do quadro (alvo perto)'),
        slider('Tamanho máx', s.maxSize ?? 128, 8, 400, 0.5, (v) => (s.maxSize = v), 'Mais longe que isso o dragão desliza até o alvo em vez de esticar'),
        slider('Em pé', s.shear ?? 0.6, 0, 2, 0.01, (v) => (s.shear = v), 'Quanto inclina sem girar (alvo acima/abaixo); 0 = só gira'),
      );
    });
  section(box, 'sp-grid', 'Grade da folha', (b) => {
    b.append(
      slider('Colunas', s.cols, 1, 8, 1, (v) => (s.cols = v)),
      slider('Linhas', s.rows, 1, 8, 1, (v) => (s.rows = v)),
      slider('Quadros', s.frames, 1, 64, 1, (v) => (s.frames = v), 'Quantos quadros usar'),
    );
  }, { open: false });
}

// ------------------------------------------------------------------ aba Partículas
function emitterCard(e: Emitter, part: Part, i: number, list: Emitter[], key: string) {
  const isOpen = open.has(key);
  const card = h('div', { class: `em${isOpen ? ' open' : ''}${e.off ? ' off' : ''}` });
  const sw = h('span', { class: 'sw' });
  for (const c of e.colors) sw.append(h('i', { style: `background:${c === '$' ? 'conic-gradient(#f55,#fd5,#5df,#d5f,#f55)' : c}` }));
  const faint = e.under || (e.opacity ?? 1) < 0.5 ? ` · discreto ${Math.round((e.opacity ?? 1) * 100)}%` : '';
  const head = h('div', { class: 'emh' }, h('span', { class: 'car' }, isOpen ? '▾' : '▸'), h('b', {}, SHAPE_LABEL[e.shape]), sw,
    h('small', {}, `${part === 'trail' ? `${e.n}/s` : `${e.n}${e.nR ? ` +${e.nR}/px` : ''}`}${faint}`));
  // liga/desliga sem perder os valores (o clique na chave não abre/fecha o cartão)
  const sw2 = h('label', { class: 'tog mini', 'data-tip': e.off ? 'Desligado: não solta nada (clique para ligar)' : 'Ligado (clique para desligar sem perder os valores)' });
  const chk = h('input', { type: 'checkbox' });
  chk.checked = !e.off;
  chk.onchange = () => {
    if (chk.checked) delete e.off;
    else e.off = true;
    changed();
    render();
  };
  sw2.onclick = (ev) => ev.stopPropagation();
  sw2.append(chk);
  head.prepend(sw2);
  head.append(
    btn(ico('stack'), () => {
      list.splice(i + 1, 0, JSON.parse(JSON.stringify(e)));
      changed();
      render();
    }, { class: 'ghost icon', 'data-tip': 'Duplicar' }),
    btn(ico('trash'), () => {
      list.splice(i, 1);
      open.delete(key);
      changed();
      render();
    }, { class: 'ghost icon danger', 'data-tip': 'Tirar' }),
  );
  head.onclick = () => {
    if (isOpen) open.delete(key);
    else open.add(key);
    render();
  };
  card.append(head);
  if (!isOpen) return card;
  const body = h('div', { class: 'emb' });
  const set = <K extends keyof Emitter>(k: K) => (v: Emitter[K] | undefined) => {
    if (v === undefined || v === 0) delete e[k];
    else e[k] = v as Emitter[K];
  };
  const trail = part === 'trail';
  const group = (title: string, ...kids: (Node | false)[]) => body.append(h('div', { class: 'grp2' }, h('h5', {}, title), ...kids));

  // aparência
  const cols = h('div', { class: 'cols-row' });
  e.colors.forEach((c, ci) => {
    const cell = h('span', { class: 'col' });
    if (c === '$') cell.append(h('span', { class: 'own', 'data-tip': 'A cor do jutsu/efeito' }, 'cor do jutsu'));
    else {
      const inp = h('input', { type: 'color' });
      inp.value = c;
      inp.oninput = () => {
        e.colors[ci] = inp.value;
        changed();
      };
      cell.append(inp);
    }
    if (e.colors.length > 1)
      cell.append(btn('×', () => {
        e.colors.splice(ci, 1);
        changed();
        render();
      }, { class: 'ghost x' }));
    cols.append(cell);
  });
  cols.append(btn(ico('plus'), () => {
    e.colors.push(e.colors.find((c) => c !== '$') ?? '#ffffff');
    changed();
    render();
  }, { class: 'ghost icon', 'data-tip': 'Mais uma cor' }));
  if (!e.colors.includes('$'))
    cols.append(btn('+ cor do jutsu', () => {
      e.colors.push('$');
      changed();
      render();
    }, { class: 'ghost' }));
  group('Aparência',
    chips<Shape>(SHAPES.map((s): [Shape, string] => [s, SHAPE_LABEL[s]]), e.shape, (v) => {
      e.shape = v;
      changed();
      render();
    }),
    cols,
    pair(e.scale ? 'Tamanho (× raio/proj.)' : 'Tamanho (px)', e.size, 0, e.scale ? 3 : 20, e.scale ? 0.01 : 0.05, (v) => (e.size = v ?? [0, 0])),
    slider('Opacidade', e.opacity ?? 1, 0, 1, 0.01, (v) => (v === 1 ? delete e.opacity : (e.opacity = v))),
    h('div', { class: 'row' }, h('span', { class: 'lbl' }, 'Brilho'),
      seg<'auto' | 'on' | 'off'>([['auto', 'Pelo formato'], ['on', 'Soma luz'], ['off', 'Normal']], e.glow == null ? 'auto' : e.glow ? 'on' : 'off', (v) => {
        if (v === 'auto') delete e.glow;
        else e.glow = v === 'on';
        changed();
        render();
      })),
    h('div', { class: 'row' },
      toggle('Proporcional', !!e.scale, (v) => {
        if (v) e.scale = true;
        else delete e.scale;
        render();
      }, trail ? 'Tamanho × tamanho do projétil ÷ 5' : 'Tamanho × raio da explosão'),
      toggle('Atrás da sprite', !!e.under, (v) => {
        if (v) e.under = true;
        else delete e.under;
      }, 'Desenhado antes do projétil, sem somar luz (resíduo discreto)')),
  );
  group('Quantidade e vida',
    slider(trail ? 'Por segundo' : 'Quantidade', e.n, 0, trail ? 300 : 80, 1, (v) => (e.n = v), trail ? 'Partículas por segundo (projétil grande solta o dobro)' : 'Quantas nascem na explosão'),
    !trail && slider('+ por px de raio', e.nR ?? 0, 0, 3, 0.01, set('nR'), 'Explosão maior solta mais'),
    !trail && slider('Teto', e.max ?? 0, 0, 150, 1, set('max'), 'Máximo de partículas (0 = sem teto)'),
    slider('Chance', e.chance ?? 1, 0, 1, 0.01, (v) => (v === 1 ? delete e.chance : (e.chance = v)), 'Chance de cada uma nascer'),
    pair('Vida (s)', e.life, 0, 3, 0.01, (v) => (e.life = v ?? [0, 0])),
  );
  group('Movimento',
    pair('Velocidade', e.speed, 0, 300, 0.5, (v) => (e.speed = v ?? [0, 0]), trail ? 'Em direção sorteada' : 'Para fora (× raio ÷ 20)'),
    pair('Subida', e.rise, -150, 60, 0.5, set('rise'), 'Somada na vertical (negativo sobe)'),
    pair('Pulo', e.jump, 0, 200, 0.5, set('jump'), 'Sobe e cai com gravidade, quicando'),
    trail && slider('Segue o voo', e.follow ?? 0, -1, 1, 0.005, set('follow'), 'Fração da velocidade do projétil (negativo = solta para trás)'),
  );
  group('Onde nasce',
    slider('Espalhar', e.spread ?? 0, 0, 2, 0.01, set('spread'), trail ? '× tamanho do projétil' : '× raio'),
    trail && slider('Atrás (px)', e.back ?? 0, 0, 80, 0.5, set('back'), 'Nasce tantos px atrás do projétil'),
    !trail && slider('Anel', e.ring ?? 0, 0, 1.5, 0.01, set('ring'), 'Nasce num anel em volta (× raio), igualmente espaçadas; 0 = no centro'),
    slider('Altura inicial', e.z ?? 0, 0, 30, 0.25, set('z')),
    slider('Desloca Y', e.dy ?? 0, -40, 40, 0.25, set('dy')),
  );
  card.append(body);
  return card;
}

/** Lista de emissores com o "+ Emissor" no fim. */
function emitterList(b: HTMLElement, list: Emitter[], part: Part, prefix: string) {
  if (!list.length) b.append(h('p', { class: 'hint' }, part === 'trail' ? 'Sem rastro aqui (estilo sem rastro usa o da natureza ou do tipo do projétil).' : 'Nenhum emissor.'));
  list.forEach((e, i) => b.append(emitterCard(e, part, i, list, `${prefix}:${part}:${i}`)));
  b.append(btn(`${ico('plus')} Emissor`, () => {
    list.push({ shape: 'spark', colors: ['$'], n: part === 'trail' ? 30 : 10, life: [0.2, 0.4], size: [2, 4], speed: part === 'trail' ? [0, 20] : [30, 90] });
    open.add(`${prefix}:${part}:${list.length - 1}`);
    changed();
    render();
  }));
}

function particlesTab(box: HTMLElement) {
  if (!jutsu) {
    section(box, 'pt-style', 'Estilo', (b) => {
      b.append(chips<string>(styleItems(), style, (v) => {
        style = v;
        open.clear();
        render();
      }));
    }, { badge: styleName(style) });
    for (const part of ['trail', 'burst'] as Part[]) {
      const list = (FX.styles[style] ??= { trail: [], burst: [] })[part];
      section(box, `pt-${part}`, part === 'trail' ? 'Rastro do projétil' : 'Explosão / impacto', (b) => emitterList(b, list, part, `st:${style}`), { badge: `estilo ${styleName(style)}` });
    }
    return;
  }
  const id = jutsu;
  const st = styleOfJutsu(id);
  section(box, 'pt-jstyle', `Estilo de ${JUTSUS[id]!.name}`, (b) => {
    b.append(chips<string>(styleItems(), st, (v) => {
      const d = JUTSUS[id]!;
      const e = entry(id);
      d.vfx = v === 'none' ? undefined : (v as Vfx);
      if (d.vfx === JUTSU_BASE[id]?.vfx) delete e.vfx;
      else if (d.vfx) e.vfx = d.vfx;
      changed();
      render();
    }));
  }, { badge: styleName(st), open: false });
  // jutsus que usam o mesmo estilo (sem partículas próprias): mexer no estilo muda todos eles
  const sharing = (part: Part) => JUTSU_LIST.filter((j) => j.id !== id && styleOfJutsu(j.id) === st && !FX.jutsus[j.id]?.[part]).map((j) => j.name);
  for (const part of ['trail', 'burst'] as Part[]) {
    const own = FX.jutsus[id]?.[part];
    const others = sharing(part);
    section(box, `pt-${part}`, part === 'trail' ? 'Rastro do projétil' : 'Explosão / impacto', (b) => {
      b.append(h('div', { class: 'row' }, h('span', { class: 'lbl' }, 'Em uso'),
        seg<'style' | 'own'>([
          ['style', `Do estilo ${styleName(st)}`, `Vale também para ${others.length} jutsu(s)`],
          ['own', 'Só deste jutsu', 'Partículas próprias, no lugar das do estilo'],
        ], own ? 'own' : 'style', (v) => {
          const e = entry(id);
          if (v === 'own' && !e[part]) e[part] = stash.get(`${id}:${part}`) ?? JSON.parse(JSON.stringify(FX.styles[st]?.[part] ?? []));
          if (v === 'style' && e[part]) {
            stash.set(`${id}:${part}`, e[part]!);
            delete e[part];
          }
          open.clear();
          changed();
          render();
        })));
      if (own) {
        if (own.some((x) => x.under || (x.opacity ?? 1) < 0.5))
          b.append(h('p', { class: 'hint' }, 'Este rastro é discreto (atrás da sprite e transparente): mudanças pequenas quase não aparecem. Aumente a opacidade ou o tamanho para ver.'));
        emitterList(b, own, part, `j:${id}`);
      } else {
        b.append(h('p', { class: 'warn' }, others.length ? `Mexendo no estilo ${styleName(st)}: muda também ${others.slice(0, 5).join(', ')}${others.length > 5 ? ` e mais ${others.length - 5}` : ''}.` : `Estilo ${styleName(st)} (só este jutsu usa).`));
        emitterList(b, (FX.styles[st] ??= { trail: [], burst: [] })[part], part, `st:${st}`);
      }
    }, { badge: own ? 'próprio' : `estilo ${styleName(st)}` });
  }
}

// ------------------------------------------------------------------ aba Projétil
function projTab(box: HTMLElement) {
  if (!jutsu) {
    box.append(h('p', { class: 'hint' }, 'Toque num jutsu na lista à esquerda.'));
    return;
  }
  const id = jutsu;
  const d = JUTSUS[id]!;
  const base = JUTSU_BASE[id] ?? {};
  section(box, 'pj-nums', 'Números do projétil', (b) => {
    b.append(h('p', { class: 'warn' }, 'Mexe na jogabilidade (alcance, área, quantos acertam): rode as réguas de .perf/ depois.'));
    const multi = d.effect === 'multi';
    const proj = d.effect === 'projectile';
    // o que o combate usa quando o jutsu não diz (combat.ts → releaseJutsu)
    const fallback: Required<ProjFx> = { projSpeed: multi ? 260 : 250, projSize: multi ? 5 : d.radius ? 9 : 6, radius: d.effect === 'aoe' ? 50 : 0, count: 3, range: d.range, spread: 0.6 };
    const fields: [keyof ProjFx, string, number, number, number, string][] = [];
    if (proj || multi) fields.push(['projSpeed', 'Velocidade', 40, 700, 1, 'px/s']);
    if (proj || multi) fields.push(['projSize', 'Tamanho', 1, 24, 0.25, 'Do projétil (o rastro proporcional segue)']);
    if (proj || d.effect === 'aoe') fields.push(['radius', 'Raio da área', 0, 150, 0.5, 'Explosão (0 = só acerta o alvo)']);
    if (multi) fields.push(['count', 'Quantidade', 1, 16, 1, 'Projéteis no leque']);
    if (multi) fields.push(['spread', 'Leque', 0, 3, 0.01, 'Abertura total (rad)']);
    fields.push(['range', 'Alcance', 20, 320, 1, 'Distância em que solta o jutsu']);
    for (const [k, label, min, max, step, tip] of fields) {
      const cur = (d[k] as number | undefined) ?? fallback[k];
      const orig = base[k] ?? fallback[k];
      const row = slider(label, cur, min, max, step, (v) => {
        (d as unknown as Record<string, number>)[k] = v;
        const e = entry(id);
        e.proj ??= {};
        if (v === orig) delete e.proj[k];
        else e.proj[k] = v;
      }, `${tip}. Original: ${orig}`);
      row.append(btn(ico('refresh'), () => {
        (d as unknown as Record<string, number | undefined>)[k] = base[k];
        const e = entry(id);
        if (e.proj) delete e.proj[k];
        changed();
        render();
      }, { class: `ghost icon${cur === orig ? ' same' : ''}`, 'data-tip': `Voltar ao original (${orig})` }));
      b.append(row);
    }
  });
}

// ------------------------------------------------------------------ painel
function render() {
  const scrollTop = root.querySelector('.fxbody')?.scrollTop ?? 0;
  root.innerHTML = '';
  const head = h('div', { class: 'fxhead' },
    h('b', { class: 'title', html: `${ico('gear')} Ajuste` }),
    h('span', { class: 'grow' }),
    btn(ico('refresh'), () => void revert(), { class: 'ghost icon', 'data-tip': 'Desfazer o que não foi salvo', ...(canSave ? {} : { hidden: '' }) }),
    btn(`${ico('save')} Salvar`, () => void save(), { id: 'save', class: 'primary', 'data-tip': canSave ? 'Grava src/data/jutsu-fx.json (Ctrl+S)' : 'Grava pelo localhost:3011 (o laboratório pelo túnel é só leitura)' }),
  );
  const target = h('div', { class: 'row' },
    h('span', { class: 'now' }, jutsu ? JUTSUS[jutsu]!.name : 'Nenhum jutsu escolhido'),
    h('span', { class: 'grow' }),
    btn(`${ico('play')} Soltar`, () => opts.fire(), { class: 'ghost', 'data-tip': 'Solta de novo a técnica escolhida' }),
    toggle('Repetir', repeat, (v) => {
      repeat = v;
      opts.setRepeat(v);
    }, 'Solta de novo sozinho sempre que o campo fica parado', false),
  );
  const status = h('div', { id: 'status', class: 'status' });
  const tabs = seg<Tab>([['sprite', 'Sprite'], ['particles', 'Partículas'], ['proj', 'Projétil']], tab, (v) => {
    tab = v;
    render();
  }, 'seg tabs');
  const body = h('div', { class: 'fxbody' });
  inspector = null;
  if (tab === 'sprite') spriteTab(body);
  else if (tab === 'particles') particlesTab(body);
  else projTab(body);
  root.append(h('div', { class: 'grip', 'data-tip': 'Arraste para mudar a largura do painel' }), head, status, target, tabs, body);
  applyIcons(root);
  body.scrollTop = scrollTop;
  showStatus(statusText, statusKind);
}

/** Jutsu escolhido na lista (null = técnica que não é jutsu: só os estilos dá para ajustar). */
export function selectJutsu(id: string | null) {
  jutsu = id;
  spriteTarget = 'jutsu';
  open.clear();
  if (id) style = styleOfJutsu(id);
  render();
}

/** Largura do painel: arrastar a borda esquerda (fica guardada neste navegador). */
function initGrip(cols: HTMLElement) {
  const apply = (w: number) => cols.style.setProperty('--fx-w', `${Math.max(300, Math.min(760, w))}px`);
  apply(load('lab-fx-w', 380));
  root.addEventListener('pointerdown', (e) => {
    const grip = (e.target as HTMLElement).closest('.grip');
    if (!grip) return;
    e.preventDefault();
    const sx = e.clientX, w0 = root.getBoundingClientRect().width;
    const mv = (ev: PointerEvent) => apply(w0 + (sx - ev.clientX));
    const up = () => {
      window.removeEventListener('pointermove', mv);
      window.removeEventListener('pointerup', up);
      store('lab-fx-w', root.getBoundingClientRect().width);
    };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
  });
}

export function initFxPanel(el: HTMLElement, o: FxPanelOpts) {
  root = el;
  opts = o;
  render();
  initGrip(el.parentElement!);
  requestAnimationFrame(inspectorLoop);
  // grava só pelo servidor do 3011 (o /lab do túnel é só leitura)
  void probe().then(render);
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      void save();
    }
  });
  window.addEventListener('beforeunload', (e) => {
    if (dirty) e.preventDefault();
  });
}
