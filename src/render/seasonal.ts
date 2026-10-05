// Visual das estações. Só desenho: do estado do jogo vem apenas a quantidade de neve (`state.snow`), a estação e o
// clima. Aqui ficam a neve no chão (com trilhas pisadas, pegadas e o derretimento do Katon), as poças congeladas do
// Suiton, o gelo na água, a neve no alto de prédios/árvores/rochas, as árvores de outono e de inverno, os montes de
// neve, os bonecos de neve e as lanternas do festival.
import { DAY_LENGTH, MAP_H, MAP_W, TILE, WORLD_H, WORLD_W } from '../config';
import { mulberry32 } from '../core/rng';
import { BUILDINGS } from '../data/buildings';
import { SEASON_DAYS, type Season } from '../data/seasons';
import { festivalOn, isSnowing, seasonOf } from '../game/mood';
import type { GameState } from '../game/types';
import { doorPos, idx, T } from '../game/world';

type Ctx = CanvasRenderingContext2D;
type Pic = HTMLImageElement | HTMLCanvasElement;
const TAU = Math.PI * 2;

/** Lado (px de mundo) de cada célula da camada de neve. */
const CELL = 8;
const GW = WORLD_W / CELL;
const GH = WORLD_H / CELL;
/** Segundos entre atualizações da textura de neve (trilhas e derretimento mudam devagar). */
const REFRESH = 0.5;

// ------------------------------------------------------------------ preferências e estado do quadro
/** Efeitos de clima leves (menu): sem pegadas, bafo, fumaça das chaminés e a névoa da nevasca. Poupa bateria. */
let light = false;
export const setLightWeatherFx = (v: boolean) => {
  light = v;
};
export const lightWeatherFx = () => light;

/** Estação e neve do quadro atual: o desenho de árvores e rochas (sprites.ts) consulta isto. */
export const SEASON_VIEW: { season: Season; snow: number } = { season: 'spring', snow: 0 };

/** Gelo na água (0–1): forma da margem para o meio nos primeiros dias do inverno e derrete no começo da primavera. */
export function iceLevel(s: GameState) {
  const dayIn = ((s.day - 1) % SEASON_DAYS) + (s.time % DAY_LENGTH) / DAY_LENGTH;
  const season = seasonOf(s);
  if (season === 'winter') return Math.min(1, dayIn / 2);
  if (season === 'spring') return Math.max(0, 1 - dayIn / 1.5);
  return 0;
}

/** Decoração em pé (boneco de neve, lanterna do festival), em px de mundo. */
export interface Deco {
  kind: 'snowman' | 'lantern';
  x: number;
  y: number;
  id: number;
}

interface Print {
  x: number;
  y: number;
  a: number;
  side: number;
  t: number;
}

const PRINT_LIFE = 8;
const PATCH_LIFE = 25;

export class Seasonal {
  private seed = -1;
  private noise = new Float32Array(GW * GH);
  private water = new Uint8Array(GW * GH);
  private trample = new Float32Array(GW * GH);
  private melt = new Float32Array(GW * GH);
  private snowCanvas: HTMLCanvasElement | null = null;
  private img: ImageData | null = null;
  private since = REFRESH;
  private shown = 0;
  private prints: Print[] = [];
  private steps = new Map<number, { x: number; y: number; side: number }>();
  private patches: { x: number; y: number; r: number; t: number }[] = [];
  private iceCanvas: HTMLCanvasElement | null = null;
  private iceShown = -1;
  private seen = new WeakSet<object>();

  /** Ruído estável por mapa (manchas de neve) e onde é água (sem neve). */
  private setup(s: GameState) {
    this.seed = s.seed;
    const rnd = mulberry32(s.seed ^ 0x2f6b9e1d);
    const octave = (step: number) => {
      const w = Math.ceil(GW / step) + 2;
      const h = Math.ceil(GH / step) + 2;
      const v = Float32Array.from({ length: w * h }, () => rnd());
      return (x: number, y: number) => {
        const fx = x / step;
        const fy = y / step;
        const ix = Math.floor(fx);
        const iy = Math.floor(fy);
        const tx = fx - ix;
        const ty = fy - iy;
        const sx = tx * tx * (3 - 2 * tx);
        const sy = ty * ty * (3 - 2 * ty);
        const a = v[iy * w + ix]!;
        const b = v[iy * w + ix + 1]!;
        const c = v[(iy + 1) * w + ix]!;
        const d = v[(iy + 1) * w + ix + 1]!;
        return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
      };
    };
    const big = octave(10);
    const small = octave(3);
    for (let y = 0; y < GH; y++)
      for (let x = 0; x < GW; x++) {
        const i = y * GW + x;
        this.noise[i] = big(x, y) * 0.7 + small(x, y) * 0.3;
        const tx = Math.floor((x * CELL) / TILE);
        const ty = Math.floor((y * CELL) / TILE);
        this.water[i] = s.tiles[idx(tx, ty)] === T.WATER ? 1 : 0;
      }
    this.trample.fill(0);
    this.melt.fill(0);
    this.prints.length = 0;
    this.patches.length = 0;
    this.iceShown = -1;
    this.since = REFRESH;
  }

  /** Avança um quadro: estação para os desenhos, trilhas e pegadas de quem anda, poças e pegadas somem. */
  frame(s: GameState, dt: number) {
    if (this.seed !== s.seed) this.setup(s);
    SEASON_VIEW.season = seasonOf(s);
    SEASON_VIEW.snow = s.snow;
    this.since += dt;
    if (dt > 0) {
      for (const p of this.prints) p.t += dt;
      while (this.prints.length && this.prints[0]!.t > PRINT_LIFE) this.prints.shift();
      for (const p of this.patches) p.t += dt;
      this.patches = this.patches.filter((p) => p.t < PATCH_LIFE);
    }
    if (s.snow < 0.05 || dt <= 0) return;
    for (const u of s.units) {
      if (u.dead || u.hidden || u.away != null || !u.moving || u.kind === 'clone') continue;
      const cx = Math.floor(u.x / CELL);
      const cy = Math.floor((u.y + 6) / CELL);
      if (cx < 0 || cy < 0 || cx >= GW || cy >= GH) continue;
      const i = cy * GW + cx;
      // cada passagem pisa ~15%: caminho usado sempre vira trilha
      this.trample[i] = Math.min(1, this.trample[i]! + dt * 1.2);
      if (cx + 1 < GW) this.trample[i + 1] = Math.min(1, this.trample[i + 1]! + dt * 0.5);
      if (light || this.cover(i, s.snow) < 0.35) continue;
      // pegadas: um passo a cada ~7 px, alternando o pé
      const last = this.steps.get(u.id);
      if (last && Math.hypot(u.x - last.x, u.y - last.y) < 7) continue;
      const side = last ? -last.side : 1;
      this.steps.set(u.id, { x: u.x, y: u.y, side });
      this.prints.push({ x: u.x, y: u.y + 6, a: u.facing, side, t: 0 });
      if (this.prints.length > 600) this.prints.shift();
    }
    if (this.steps.size > 400) this.steps.clear();
  }

  /** Pegadas na tela e o quanto o chão em (x, y) está pisado / derretido (0–1). Para testes. */
  stats(x: number, y: number) {
    const i = Math.floor(y / CELL) * GW + Math.floor(x / CELL);
    return { prints: this.prints.length, patches: this.patches.length, trample: this.trample[i] ?? 0, melt: this.melt[i] ?? 0 };
  }

  /** Quanto de neve há numa célula (0–1), sem contar trilhas e derretimento. */
  private cover(i: number, snow: number) {
    if (this.water[i]) return 0;
    const t = snow * 1.4 - 0.2;
    return Math.max(0, Math.min(1, (t - this.noise[i]!) * 6));
  }

  /** Bola de fogo (Katon) derrete a neve em volta; a neve volta aos poucos. */
  meltAt(x: number, y: number, r: number) {
    this.paint(this.melt, x, y, r, 1);
  }

  /** Jutsu de água (Suiton) sobre a neve deixa uma poça congelada. */
  freezeAt(x: number, y: number, r: number) {
    this.patches.push({ x, y, r: Math.min(40, Math.max(12, r)), t: 0 });
    if (this.patches.length > 30) this.patches.shift();
  }

  private paint(arr: Float32Array, x: number, y: number, r: number, v: number) {
    const c = Math.ceil(r / CELL);
    const cx = Math.floor(x / CELL);
    const cy = Math.floor(y / CELL);
    for (let dy = -c; dy <= c; dy++)
      for (let dx = -c; dx <= c; dx++) {
        const gx = cx + dx;
        const gy = cy + dy;
        if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) continue;
        const d = Math.hypot(dx, dy) * CELL;
        if (d > r) continue;
        const i = gy * GW + gx;
        arr[i] = Math.max(arr[i]!, v * (1 - (d / r) * 0.5));
      }
    this.since = REFRESH; // mostra já
  }

  /** Efeito novo do jogo (uma vez por efeito): fogo derrete, água congela. */
  onEffect(s: GameState, e: { kind: string; x: number; y: number; r?: number }, nature: string | null) {
    if (this.seen.has(e)) return;
    this.seen.add(e);
    if (e.kind !== 'burst') return;
    if (nature === 'katon' && s.snow > 0.05) this.meltAt(e.x, e.y, (e.r ?? 14) * 1.3);
    else if (nature === 'suiton' && (s.snow > 0.15 || seasonOf(s) === 'winter')) this.freezeAt(e.x, e.y, e.r ?? 14);
  }

  /** Textura da neve (refeita a cada meio segundo): manchas que crescem com a neve, trilhas pisadas e derretimento. */
  private snowTexture(s: GameState) {
    if (!this.snowCanvas) {
      this.snowCanvas = document.createElement('canvas');
      this.snowCanvas.width = GW;
      this.snowCanvas.height = GH;
      this.img = this.snowCanvas.getContext('2d')!.createImageData(GW, GH);
    }
    if (this.since >= REFRESH) {
      const k = this.since;
      this.since = 0;
      // neve nova cobre as trilhas e o derretido; sem nevar, as trilhas somem bem devagar
      const snowing = isSnowing(s);
      const back = k * (snowing ? 0.02 : 0.004);
      const regrow = k * (snowing ? 0.03 : 0.004);
      const px = this.img!.data;
      for (let i = 0; i < GW * GH; i++) {
        const tr = (this.trample[i] = Math.max(0, this.trample[i]! - back));
        const me = (this.melt[i] = Math.max(0, this.melt[i]! - regrow));
        const a = this.cover(i, s.snow) * (1 - 0.65 * tr) * (1 - me);
        const n = this.noise[i]!;
        const o = i * 4;
        // pisada vira neve suja (cinza amarronzada)
        px[o] = 238 - n * 18 - tr * 60;
        px[o + 1] = 244 - n * 14 - tr * 62;
        px[o + 2] = 252 - n * 6 - tr * 70;
        px[o + 3] = a * 245;
      }
      this.snowCanvas.getContext('2d')!.putImageData(this.img!, 0, 0);
      this.shown = s.snow;
    }
    return this.snowCanvas;
  }

  /** Gelo na água: textura com placas e rachaduras, das margens (pouca profundidade) para o meio. */
  drawIce(ctx: Ctx, s: GameState, depth: Uint8Array) {
    const level = Math.round(iceLevel(s) * 10) / 10;
    if (level <= 0) return;
    if (!this.iceCanvas) {
      this.iceCanvas = document.createElement('canvas');
      this.iceCanvas.width = MAP_W * 8;
      this.iceCanvas.height = MAP_H * 8;
    }
    if (level !== this.iceShown) {
      this.iceShown = level;
      let max = 1;
      for (const d of depth) if (d && d < 255) max = Math.max(max, d);
      const c = this.iceCanvas.getContext('2d')!;
      c.clearRect(0, 0, this.iceCanvas.width, this.iceCanvas.height);
      const rnd = mulberry32(s.seed ^ 0x1ce);
      for (let i = 0; i < depth.length; i++) {
        const d = depth[i]!;
        if (!d || d > Math.max(1, level * max)) continue;
        const x = (i % MAP_W) * 8;
        const y = Math.floor(i / MAP_W) * 8;
        c.fillStyle = d <= 1 ? 'rgba(222,238,248,0.92)' : 'rgba(200,226,244,0.86)';
        c.fillRect(x, y, 8, 8);
        // brilho e rachaduras
        c.fillStyle = 'rgba(255,255,255,0.55)';
        if (rnd() < 0.5) c.fillRect(x + 1 + rnd() * 4, y + 1 + rnd() * 4, 3, 1);
        if (rnd() < 0.35) {
          c.strokeStyle = 'rgba(120,160,190,0.7)';
          c.lineWidth = 0.6;
          c.beginPath();
          c.moveTo(x + rnd() * 8, y + rnd() * 8);
          c.lineTo(x + rnd() * 8, y + rnd() * 8);
          c.lineTo(x + rnd() * 8, y + rnd() * 8);
          c.stroke();
        }
      }
    }
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.iceCanvas, 0, 0, WORLD_W, WORLD_H);
    ctx.restore();
  }

  /** (chão, coordenadas de mundo) Neve, montes perto das casas, pegadas e poças congeladas. */
  drawGround(ctx: Ctx, s: GameState) {
    if (s.snow > 0.003 || this.shown > 0.003) {
      const tex = this.snowTexture(s);
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(tex, 0, 0, WORLD_W, WORLD_H);
      ctx.restore();
    }
    if (s.snow > 0.3) {
      // montes de neve encostados nas casas
      const a = Math.min(1, (s.snow - 0.3) * 2.5);
      for (const b of s.buildings) {
        if (!b.built || BUILDINGS[b.type].walkable) continue;
        const d = BUILDINGS[b.type];
        const r = mulberry32(b.id * 7919);
        for (let k = 0; k < 2; k++) {
          const x = (b.tx + (k ? d.w : 0)) * TILE + (k ? 4 : -4) + r() * 6;
          const y = (b.ty + d.h * r()) * TILE;
          this.mound(ctx, x, y, 7 + r() * 5, a);
        }
      }
    }
    for (const p of this.prints) {
      const a = 0.45 * (1 - p.t / PRINT_LIFE);
      const ox = Math.cos(p.a + Math.PI / 2) * 2.2 * p.side;
      const oy = Math.sin(p.a + Math.PI / 2) * 2.2 * p.side;
      ctx.fillStyle = `rgba(110,128,156,${a})`;
      ctx.beginPath();
      ctx.ellipse(p.x + ox, p.y + oy, 2.4, 1.4, p.a, 0, TAU);
      ctx.fill();
    }
    for (const p of this.patches) {
      const a = p.t < PATCH_LIFE - 4 ? 0.8 : (0.8 * (PATCH_LIFE - p.t)) / 4;
      ctx.fillStyle = `rgba(190,224,246,${a})`;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.r, p.r * 0.8, 0.4, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${a})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(p.x - p.r * 0.5, p.y - p.r * 0.2);
      ctx.lineTo(p.x + p.r * 0.2, p.y - p.r * 0.45);
      ctx.stroke();
    }
  }

  private mound(ctx: Ctx, x: number, y: number, r: number, a: number) {
    ctx.fillStyle = `rgba(150,170,200,${0.35 * a})`;
    ctx.beginPath();
    ctx.ellipse(x + 1, y + 1.5, r, r * 0.7, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = `rgba(244,248,255,${a})`;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.7, 0, 0, TAU);
    ctx.fill();
  }

  /** Decorações em pé: bonecos de neve na praça (neve alta) e lanternas do festival. */
  decorations(s: GameState, walkable: (x: number, y: number) => boolean): Deco[] {
    const out: Deco[] = [];
    const hk = s.buildings.find((b) => b.type === 'hokage');
    if (s.snow > 0.45 && hk) {
      const p = doorPos(hk);
      const r = mulberry32(s.seed ^ 0x5a0);
      const n = 1 + Math.floor(r() * 2);
      for (let i = 0; i < n; i++) {
        const x = p.x + (i ? 58 : -52) + r() * 16;
        const y = p.y + 34 + r() * 24;
        if (walkable(x, y)) out.push({ kind: 'snowman', x, y, id: i });
      }
    }
    if (festivalOn(s)) {
      let id = 10;
      for (const b of s.buildings) {
        if (!b.built || (b.type !== 'house' && b.type !== 'hokage' && b.type !== 'market')) continue;
        const p = doorPos(b);
        for (const dx of b.type === 'hokage' ? [-36, 36] : [16]) {
          const x = p.x + dx;
          const y = p.y + 8;
          if (walkable(x, y)) out.push({ kind: 'lantern', x, y, id: id++ });
        }
      }
    }
    return out;
  }
}

// ------------------------------------------------------------------ desenho das decorações (coordenadas de cena)
export function drawDeco(ctx: Ctx, d: Deco, x: number, y: number, time: number) {
  if (d.kind === 'snowman') {
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(x, y, 8, 3, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#8fa4bd';
    ctx.lineWidth = 1;
    for (const [cy, r] of [[-6, 6.5], [-16, 5], [-24, 3.8]] as const) {
      ctx.fillStyle = '#f6f9ff';
      ctx.beginPath();
      ctx.arc(x, y + cy, r, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = '#c0392b'; // cachecol
    ctx.fillRect(x - 4, y - 20.5, 8, 2);
    ctx.fillRect(x + 1.5, y - 20, 2, 5);
    ctx.fillStyle = '#222';
    ctx.fillRect(x - 2, y - 25.5, 1.2, 1.2);
    ctx.fillRect(x + 0.8, y - 25.5, 1.2, 1.2);
    ctx.fillRect(x - 0.5, y - 17, 1, 1);
    ctx.fillRect(x - 0.5, y - 14, 1, 1);
    ctx.fillStyle = '#ff8a2b'; // nariz de cenoura
    ctx.beginPath();
    ctx.moveTo(x, y - 24);
    ctx.lineTo(x + 4.5, y - 23);
    ctx.lineTo(x, y - 22.5);
    ctx.fill();
    ctx.strokeStyle = '#5a3b22'; // braços de galho
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 4.5, y - 16);
    ctx.lineTo(x - 10, y - 20);
    ctx.moveTo(x + 4.5, y - 16);
    ctx.lineTo(x + 10, y - 19);
    ctx.stroke();
    return;
  }
  // lanterna de papel num poste, balançando de leve
  const sway = Math.sin(time * 1.6 + d.id) * 1.2;
  ctx.strokeStyle = '#4a3020';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - 28);
  ctx.lineTo(x + 6, y - 28);
  ctx.stroke();
  const lx = x + 6 + sway;
  const ly = y - 21;
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, 12);
  g.addColorStop(0, 'rgba(255,170,80,0.45)');
  g.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(lx - 12, ly - 12, 24, 24);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#d8402a';
  ctx.beginPath();
  ctx.ellipse(lx, ly, 3.6, 5, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ffd36b';
  ctx.fillRect(lx - 3, ly - 1.8, 6, 1);
  ctx.fillRect(lx - 3, ly + 1.2, 6, 1);
  ctx.fillStyle = '#2a1a10';
  ctx.fillRect(lx - 1.5, ly - 5.8, 3, 1.2);
  ctx.fillRect(lx - 1.5, ly + 4.8, 3, 1.2);
}

// ------------------------------------------------------------------ neve no alto dos desenhos e árvores por estação
const hash = (x: number, y: number) => {
  const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return v - Math.floor(v);
};
const caps = new Map<string, HTMLCanvasElement>();
const trees = new Map<string, HTMLCanvasElement>();

function pixels(pic: Pic) {
  const w = pic instanceof HTMLImageElement ? pic.naturalWidth : pic.width;
  const h = pic instanceof HTMLImageElement ? pic.naturalHeight : pic.height;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(pic, 0, 0);
  return { c, ctx, w, h, data: ctx.getImageData(0, 0, w, h) };
}

/**
 * Camada de neve do desenho (mesmo tamanho): por baixo de cada borda de cima (telhado, copa, pedra) pinta umas linhas
 * de branco, mantendo o contorno escuro por cima. Feita uma vez por imagem.
 */
export function snowCap(pic: Pic, key: string, roof = false): HTMLCanvasElement {
  const hit = caps.get(key);
  if (hit) return hit;
  const { c, ctx, w, h, data } = pixels(pic);
  const src = data.data;
  const out = ctx.createImageData(w, h);
  const o = out.data;
  const alpha = (x: number, y: number) => (y < 0 ? 0 : src[(y * w + x) * 4 + 3]!);
  const base = Math.max(3, Math.round(h * 0.065));
  // prédios: o contorno de cima de cada coluna é o telhado, que fica coberto bem mais fundo (deixando ver um pouco
  // da textura por baixo); o fim da camada é pontilhado, como neve escorrendo
  if (roof) {
    const deep = Math.round(h * 0.15);
    for (let x = 0; x < w; x++) {
      let y = 0;
      while (y < h && alpha(x, y) <= 40) y++;
      if (y >= h * 0.7) continue;
      for (let k = 1; k <= deep; k++) {
        const yy = y + k;
        if (yy >= h || alpha(x, yy) <= 40) break;
        if (k > deep * 0.65 && (x + yy) % 2 === 0 && hash(x, yy) < (k - deep * 0.65) / (deep * 0.35)) continue;
        const i = (yy * w + x) * 4;
        o[i] = 244;
        o[i + 1] = 248;
        o[i + 2] = 255;
        o[i + 3] = k === 1 ? 255 : 228;
      }
    }
  }
  for (let y = 0; y < h * 0.85; y++)
    for (let x = 0; x < w; x++) {
      if (alpha(x, y) <= 40 || alpha(x, y - 1) > 40) continue;
      // borda de baixo irregular, como neve acumulada
      const thick = base + Math.round(hash(x >> 1, y) * 2) - 1;
      for (let k = 1; k <= thick; k++) {
        const yy = y + k;
        if (yy >= h || alpha(x, yy) <= 40) break;
        const i = (yy * w + x) * 4;
        const edge = k === thick;
        o[i] = edge ? 200 : 246;
        o[i + 1] = edge ? 216 : 250;
        o[i + 2] = edge ? 234 : 255;
        o[i + 3] = 255;
      }
    }
  ctx.clearRect(0, 0, w, h);
  ctx.putImageData(out, 0, 0);
  c.dataset.name = `${key}-snow`;
  caps.set(key, c);
  return c;
}


function hsv(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let hh = 0;
  if (d) hh = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (hh * 60 + 360) % 360, s: max ? d / max : 0, v: max / 255 };
}

const fields = new Map<string, HTMLCanvasElement>();

/**
 * Camada de neve de um canteiro (fazenda, horta), no formato do próprio desenho: a terra fica branca, as folhas
 * ganham neve em tufos e a cerca, os contornos e as cores vivas (cenoura, trigo, flores) continuam aparecendo.
 */
export function snowField(pic: Pic, key: string): HTMLCanvasElement {
  const hit = fields.get(key);
  if (hit) return hit;
  const { c, ctx, w, h, data } = pixels(pic);
  const px = data.data;
  const out = ctx.createImageData(w, h);
  const o = out.data;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (px[i + 3]! < 40) continue;
      const { h: hue, s, v } = hsv(px[i]!, px[i + 1]!, px[i + 2]!);
      if (v < 0.3) continue; // contorno
      const soil = hue >= 5 && hue <= 50 && v < 0.62 && s > 0.2;
      const leaf = hue >= 60 && hue <= 175 && s > 0.2;
      const stone = s < 0.2 && v > 0.4; // caminhos de pedra da horta
      if (!soil && !leaf && !stone) continue;
      if (leaf && hash(x >> 1, (y >> 1) + 7) > 0.5) continue; // neve em tufos sobre as plantas
      const shade = soil && hash(x >> 2, y >> 2) < 0.25 ? 14 : 0;
      o[i] = 244 - shade;
      o[i + 1] = 248 - shade;
      o[i + 2] = 255 - shade * 0.5;
      o[i + 3] = leaf ? 235 : 250;
    }
  ctx.clearRect(0, 0, w, h);
  ctx.putImageData(out, 0, 0);
  c.dataset.name = `${key}-field`;
  fields.set(key, c);
  return c;
}

/**
 * Árvore folhosa da estação: outono pinta as folhas de laranja, amarelo e vermelho (em manchas); inverno deixa a copa
 * rala, seca e acinzentada (o tronco e os galhos aparecem). Primavera e verão: a arte original.
 */
export function seasonalTree(pic: Pic, key: string, season: Season): Pic {
  if (season !== 'autumn' && season !== 'winter') return pic;
  const k = `${key}|${season}`;
  const hit = trees.get(k);
  if (hit) return hit;
  const { c, ctx, w, h, data } = pixels(pic);
  const px = data.data;
  const FALL = [[232, 128, 40], [244, 186, 56], [204, 72, 42], [222, 150, 46]];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (px[i + 3]! < 10) continue;
      const { h: hue, s, v } = hsv(px[i]!, px[i + 1]!, px[i + 2]!);
      if (hue < 60 || hue > 175 || s < 0.2) continue; // só as folhas (verdes)
      const blob = hash(x >> 2, y >> 2);
      if (season === 'autumn') {
        const col = FALL[Math.floor(blob * FALL.length)]!;
        const k2 = Math.min(1.25, v / 0.62);
        px[i] = Math.min(255, col[0]! * k2);
        px[i + 1] = Math.min(255, col[1]! * k2);
        px[i + 2] = Math.min(255, col[2]! * k2);
      } else if (hash(x >> 1, y >> 1) < 0.55 && blob < 0.8) {
        px[i + 3] = 0; // copa rala: a maior parte das folhas caiu
      } else {
        const g = 70 + v * 70;
        px[i] = g * 0.95;
        px[i + 1] = g * 0.88;
        px[i + 2] = g * 0.72;
      }
    }
  ctx.putImageData(data, 0, 0);
  c.dataset.name = k;
  trees.set(k, c);
  return c;
}
