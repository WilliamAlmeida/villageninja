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

/** Máscara da arte (índice da peça por pixel), ou null. */
export function maskOf(name: string, w: number, h: number): Uint8Array | null {
  const L = artLayout(name);
  if (!L?.mask || !L.pieces?.length) return null;
  const mw = L.maskW ?? w;
  const mh = L.maskH ?? h;
  const m = decodeMask(L.mask, mw * mh);
  if (mw === w && mh === h) return m;
  // a arte mudou de tamanho: amostra a máscara pelo mais próximo
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = m[Math.floor((y * mh) / h) * mw + Math.floor((x * mw) / w)]!;
  return out;
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
