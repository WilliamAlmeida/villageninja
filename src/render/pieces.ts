// Peças de uma arte (Editor de cenário, data/layout.ts): a máscara pintada separa a imagem em pedaços; cada pedaço
// vira um canvas próprio (o 0 é o "resto", o que não foi pintado) com o contorno dele (para a transparência).
import { artLayout, decodeMask, layoutVersion, type Rect01 } from '../data/layout';

export interface PieceSet {
  /** canvases[0] = resto; [i] = peça i (mesmo tamanho da imagem, transparente fora dela). */
  canvases: (HTMLCanvasElement | null)[];
  /** Contorno 0–1 de cada canvas (null se vazio). */
  bbox: (Rect01 | null)[];
  /** Cobertura grossa de cada canvas (célula de COVER px com algum pixel da peça), para a transparência. */
  cover: (Uint8Array | null)[];
  coverW: number;
  coverH: number;
}

/** Tamanho da célula de cobertura, em px da imagem. */
const COVER = 8;

/** A peça `p` tem pixel em (fx, fy), coordenadas 0–1 da imagem? */
export function pieceCovers(set: PieceSet, p: number, fx: number, fy: number): boolean {
  const c = set.cover[p];
  if (!c || fx < 0 || fy < 0 || fx >= 1 || fy >= 1) return false;
  return c[Math.floor(fy * set.coverH) * set.coverW + Math.floor(fx * set.coverW)] === 1;
}

const cache = new Map<string, { v: number; pic: CanvasImageSource; set: PieceSet | null }>();

/**
 * Máscara da arte (índice da peça por pixel), ou null. Peça com polígono = exatamente o polígono (a pintura dela
 * fora dele volta ao resto e o que estiver dentro passa a ser dela); sem polígono, vale a pintura.
 * `raw`: só a pintura (o Editor de cenário pinta nela).
 */
export function maskOf(name: string, w: number, h: number, raw = false): Uint8Array | null {
  const L = artLayout(name);
  if (!L?.pieces?.length) return null;
  let m: Uint8Array;
  if (!L.mask) m = new Uint8Array(w * h);
  else {
    const mw = L.maskW ?? w;
    const mh = L.maskH ?? h;
    m = decodeMask(L.mask, mw * mh);
    if (mw !== w || mh !== h) {
      // a arte mudou de tamanho: amostra a máscara pelo mais próximo
      const out = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = m[Math.floor((y * mh) / h) * mw + Math.floor((x * mw) / w)]!;
      m = out;
    }
  }
  if (!raw) applyPolys(m, w, h, L.pieces);
  return m;
}

/** Peças com polígono: some a pintura delas e entra o polígono (na ordem das peças). */
export function applyPolys(m: Uint8Array, w: number, h: number, pieces: { poly?: [number, number][] }[]) {
  const withPoly = new Set<number>();
  pieces.forEach((p, i) => p.poly && p.poly.length >= 3 && withPoly.add(i + 1));
  if (!withPoly.size) return;
  for (let i = 0; i < m.length; i++) if (withPoly.has(m[i]!)) m[i] = 0;
  pieces.forEach((p, i) => withPoly.has(i + 1) && fillPoly(m, w, h, p.poly!, i + 1));
}

/** Pinta `v` nos pixels cujo centro fica dentro do polígono (pontos 0–1), linha a linha (par-ímpar). */
export function fillPoly(m: Uint8Array, w: number, h: number, poly: [number, number][], v: number) {
  const pts = poly.map(([u, t]) => [u * w, t * h] as const);
  const ys = pts.map((p) => p[1]);
  const y0 = Math.max(0, Math.floor(Math.min(...ys)));
  const y1 = Math.min(h - 1, Math.ceil(Math.max(...ys)));
  for (let y = y0; y <= y1; y++) {
    const cy = y + 0.5;
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i]!;
      const [bx, by] = pts[(i + 1) % pts.length]!;
      if (ay <= cy !== by <= cy) xs.push(ax + ((cy - ay) / (by - ay)) * (bx - ax));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const a = Math.max(0, Math.ceil(xs[k]! - 0.5));
      const b = Math.min(w - 1, Math.floor(xs[k + 1]! - 0.5));
      for (let x = a; x <= b; x++) m[y * w + x] = v;
    }
  }
}

/** Contorno convexo dos pixels `v` da máscara (opacos), simplificado até `max` pontos; 0–1 da imagem. */
export function hullOf(m: Uint8Array, alpha: Uint8ClampedArray, w: number, h: number, v: number, max = 10): [number, number][] {
  const pts: [number, number][] = [];
  for (let y = 0; y < h; y += 2)
    for (let x = 0; x < w; x += 2) if (m[y * w + x] === v && alpha[y * w + x]) pts.push([x, y]);
  if (pts.length < 3) return [];
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: number[], a: number[], b: number[]) => (a[0]! - o[0]!) * (b[1]! - o[1]!) - (a[1]! - o[1]!) * (b[0]! - o[0]!);
  const lower: [number, number][] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: [number, number][] = [];
  for (const p of pts.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) upper.pop();
    upper.push(p);
  }
  const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
  // tira o ponto que menos muda a forma (menor triângulo com os vizinhos) até sobrar `max`
  while (hull.length > max) {
    let best = 0;
    let ba = Infinity;
    for (let i = 0; i < hull.length; i++) {
      const a = Math.abs(cross(hull[(i + hull.length - 1) % hull.length]!, hull[i]!, hull[(i + 1) % hull.length]!));
      if (a < ba) {
        ba = a;
        best = i;
      }
    }
    hull.splice(best, 1);
  }
  return hull.map(([x, y]) => [+(x / w).toFixed(4), +(y / h).toFixed(4)]);
}

/** Peças da arte `name` (desenhada por `pic`), em cache até o layout mudar. null = sem peças. */
export function pieceSet(name: string, pic: HTMLImageElement | HTMLCanvasElement): PieceSet | null {
  const c = cache.get(name);
  if (c && c.v === layoutVersion && c.pic === pic) return c.set;
  const set = build(name, pic);
  cache.set(name, { v: layoutVersion, pic, set });
  return set;
}

function build(name: string, pic: HTMLImageElement | HTMLCanvasElement): PieceSet | null {
  const w = pic instanceof HTMLImageElement ? pic.naturalWidth : pic.width;
  const h = pic instanceof HTMLImageElement ? pic.naturalHeight : pic.height;
  if (!w || !h) return null;
  const mask = maskOf(name, w, h);
  if (!mask) return null;
  const n = artLayout(name)!.pieces!.length;
  const src = document.createElement('canvas');
  src.width = w;
  src.height = h;
  const sctx = src.getContext('2d')!;
  sctx.drawImage(pic, 0, 0);
  const data = sctx.getImageData(0, 0, w, h).data;
  const canvases: (HTMLCanvasElement | null)[] = [];
  const bbox: (Rect01 | null)[] = [];
  const cover: (Uint8Array | null)[] = [];
  const coverW = Math.ceil(w / COVER);
  const coverH = Math.ceil(h / COVER);
  for (let p = 0; p <= n; p++) {
    const cv0 = new Uint8Array(coverW * coverH);
    const img = new ImageData(w, h);
    let x0 = w;
    let y0 = h;
    let x1 = -1;
    let y1 = -1;
    for (let i = 0; i < w * h; i++) {
      if (mask[i] !== p || data[i * 4 + 3] === 0) continue;
      img.data[i * 4] = data[i * 4]!;
      img.data[i * 4 + 1] = data[i * 4 + 1]!;
      img.data[i * 4 + 2] = data[i * 4 + 2]!;
      img.data[i * 4 + 3] = data[i * 4 + 3]!;
      const x = i % w;
      const y = (i / w) | 0;
      if (data[i * 4 + 3]! > 40) cv0[((y / COVER) | 0) * coverW + ((x / COVER) | 0)] = 1;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    if (x1 < 0) {
      canvases.push(null);
      bbox.push(null);
      cover.push(null);
      continue;
    }
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    cv.getContext('2d')!.putImageData(img, 0, 0);
    canvases.push(cv);
    bbox.push([x0 / w, y0 / h, (x1 + 1) / w, (y1 + 1) / h]);
    cover.push(cv0);
  }
  return { canvases, bbox, cover, coverW, coverH };
}
