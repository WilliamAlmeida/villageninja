// Chão do mapa em BLOCOS (chunks) de CHUNK×CHUNK tiles, como os jogos de mapa grande fazem: cada bloco vira uma imagem
// própria, pintada só quando entra na tela e descartada depois de um tempo fora dela. Assim a memória é a do que se vê
// (não do mapa inteiro) e o mapa pode crescer sem esbarrar no limite de tamanho de imagem do celular. Com o mapa todo à
// vista (zoom baixo) os blocos saem na metade da resolução (16 px por tile): nessa distância não faz diferença.
import { TILE } from '../config';
import type { Camera } from '../core/camera';
import { mulberry32 } from '../core/rng';
import type { GameState } from '../game/types';
import { idx, inBounds, T } from '../game/world';

/** Lado do bloco, em tiles. */
export const CHUNK = 16;
/** Zoom abaixo do qual os blocos são pintados na metade da resolução. */
const HALF_BELOW = 0.75;
/** Segundos fora da tela até um bloco ser descartado. */
const KEEP = 6;

const BASE: Record<number, string> = {
  [T.GRASS]: '#5e9b42',
  [T.GRASS2]: '#54903b',
  [T.DIRT]: '#a88355',
  [T.SAND]: '#d7c38c',
  [T.WATER]: '#2f6fb0',
  [T.ROCK]: '#2e2925',
};

const DEEP = ['#4a93cf', '#3a80c0', '#2f6fb0', '#285fa0', '#225391'];

/** Retângulo de tiles que a câmera vê (o losango da tela, em mundo, com folga). */
export function visibleTiles(cam: Camera, m: { mapW: number; mapH: number }, pad = 1) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [sx, sy] of [[0, 0], [cam.viewW, 0], [0, cam.viewH], [cam.viewW, cam.viewH]] as const) {
    const w = cam.screenToWorld(sx, sy);
    x0 = Math.min(x0, w.x);
    y0 = Math.min(y0, w.y);
    x1 = Math.max(x1, w.x);
    y1 = Math.max(y1, w.y);
  }
  return {
    x0: Math.max(0, Math.floor(x0 / TILE) - pad),
    y0: Math.max(0, Math.floor(y0 / TILE) - pad),
    x1: Math.min(m.mapW - 1, Math.ceil(x1 / TILE) + pad),
    y1: Math.min(m.mapH - 1, Math.ceil(y1 / TILE) + pad),
  };
}

export class Terrain {
  private chunks = new Map<number, { c: HTMLCanvasElement; half: boolean; seen: number }>();
  /** Distância (tiles) de cada tile de água até a margem (0 = terra); também usada pelo gelo. */
  readonly depth: Uint8Array;
  private readonly cols: number;

  constructor(private state: GameState) {
    this.depth = waterDepth(state);
    this.cols = Math.ceil(state.mapW / CHUNK);
  }

  /** (chão, coordenadas de mundo) Desenha os blocos à vista e as ondinhas da água, e descarta os blocos esquecidos. */
  draw(ctx: CanvasRenderingContext2D, cam: Camera, time: number) {
    const s = this.state;
    const v = visibleTiles(cam, s);
    const half = cam.zoom < HALF_BELOW;
    const px = CHUNK * TILE;
    for (let cy = Math.floor(v.y0 / CHUNK); cy <= Math.floor(v.y1 / CHUNK); cy++)
      for (let cx = Math.floor(v.x0 / CHUNK); cx <= Math.floor(v.x1 / CHUNK); cx++) {
        const key = cy * this.cols + cx;
        let e = this.chunks.get(key);
        if (!e || e.half !== half) {
          e = { c: this.paint(cx, cy, half), half, seen: time };
          this.chunks.set(key, e);
        }
        e.seen = time;
        ctx.drawImage(e.c, cx * px, cy * px, px, px);
      }
    for (const [key, e] of this.chunks) if (time - e.seen > KEEP) this.chunks.delete(key);
    drawWaterAnim(ctx, s, this.depth, time, v);
  }

  /** Quantos blocos estão guardados agora (para o medidor). */
  get cached() {
    return this.chunks.size;
  }

  /** Pinta um bloco: os tiles dele e 1 de margem (as transições e a espuma passam da divisa; o canvas corta o resto). */
  private paint(cx: number, cy: number, half: boolean): HTMLCanvasElement {
    const s = this.state;
    const c = document.createElement('canvas');
    const k = half ? 0.5 : 1;
    c.width = CHUNK * TILE * k;
    c.height = CHUNK * TILE * k;
    const ctx = c.getContext('2d')!;
    ctx.scale(k, k);
    ctx.translate(-cx * CHUNK * TILE, -cy * CHUNK * TILE);
    const x0 = Math.max(0, cx * CHUNK - 1);
    const y0 = Math.max(0, cy * CHUNK - 1);
    const x1 = Math.min(s.mapW - 1, (cx + 1) * CHUNK);
    const y1 = Math.min(s.mapH - 1, (cy + 1) * CHUNK);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const t = s.tiles[idx(s, x, y)]!;
        ctx.fillStyle = t === T.WATER ? DEEP[Math.min(DEEP.length - 1, this.depth[idx(s, x, y)]!)]! : (BASE[t] ?? '#000');
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) blendEdges(ctx, s, x, y);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) detail(ctx, s, x, y);
    return c;
  }
}

/** Transições suaves entre tipos de terreno (para o vizinho da direita e o de baixo). */
function blendEdges(ctx: CanvasRenderingContext2D, state: GameState, x: number, y: number) {
  const t = state.tiles[idx(state, x, y)]!;
  for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
    const nx = x + dx;
    const ny = y + dy;
    if (!inBounds(state, nx, ny)) continue;
    const o = state.tiles[idx(state, nx, ny)]!;
    if (o === t) continue;
    const g = ctx.createLinearGradient(
      x * TILE + (dx ? TILE * 0.6 : 0), y * TILE + (dy ? TILE * 0.6 : 0),
      nx * TILE + (dx ? TILE * 0.4 : 0), ny * TILE + (dy ? TILE * 0.4 : 0),
    );
    g.addColorStop(0, BASE[t] + '00');
    g.addColorStop(0.5, blend(BASE[t]!, BASE[o]!));
    g.addColorStop(1, BASE[o] + '00');
    ctx.fillStyle = g;
    if (dx) ctx.fillRect(x * TILE + TILE * 0.6, y * TILE, TILE * 0.8, TILE);
    else ctx.fillRect(x * TILE, y * TILE + TILE * 0.6, TILE, TILE * 0.8);
  }
}

/** Detalhes do tile (tufos, flores, pedras, ondas, espuma), com aleatoriedade fixa por tile: sai igual em qualquer bloco. */
function detail(ctx: CanvasRenderingContext2D, state: GameState, x: number, y: number) {
  const rng = mulberry32((state.seed ^ 0x5bd1e995 ^ ((x * 73856093) ^ (y * 19349663))) >>> 0);
  const t = state.tiles[idx(state, x, y)]!;
  const px = x * TILE;
  const py = y * TILE;
  if (t === T.ROCK) {
    // parede de caverna: blocos de pedra com aresta clara virada para o chão
    for (let k = 0; k < 4; k++) {
      ctx.fillStyle = k % 2 ? '#3a332d' : '#26211d';
      ctx.fillRect(px + rng() * 22, py + rng() * 22, 6 + rng() * 10, 5 + rng() * 8);
    }
    const open = (dx: number, dy: number) => inBounds(state, x + dx, y + dy) && state.tiles[idx(state, x + dx, y + dy)] !== T.ROCK;
    ctx.fillStyle = 'rgba(160,140,120,0.35)';
    if (open(0, 1)) ctx.fillRect(px, py + TILE - 4, TILE, 4);
    if (open(1, 0)) ctx.fillRect(px + TILE - 4, py, 4, TILE);
    return;
  }
  if (t === T.GRASS || t === T.GRASS2) {
    for (let i = 0; i < 5; i++) {
      const gx = px + rng() * TILE;
      const gy = py + rng() * TILE;
      ctx.strokeStyle = rng() < 0.5 ? 'rgba(30,70,20,0.45)' : 'rgba(150,200,90,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx + (rng() - 0.5) * 3, gy - 3 - rng() * 3);
      ctx.stroke();
    }
    if (rng() < 0.06) {
      ctx.fillStyle = ['#f6e05e', '#f7a1c4', '#ffffff', '#b08cff'][Math.floor(rng() * 4)]!;
      for (let i = 0; i < 3; i++) ctx.fillRect(px + rng() * TILE, py + rng() * TILE, 2, 2);
    }
  } else if (t === T.DIRT || t === T.SAND) {
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = rng() < 0.5 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)';
      ctx.fillRect(px + rng() * TILE, py + rng() * TILE, 2, 2);
    }
  } else if (t === T.WATER) {
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 2; i++) {
      const wx = px + rng() * TILE * 0.7;
      const wy = py + rng() * TILE;
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.quadraticCurveTo(wx + 4, wy - 2, wx + 8, wy);
      ctx.stroke();
    }
    // espuma na margem: faixa clara + pontinhos brancos
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(state, nx, ny) || state.tiles[idx(state, nx, ny)] === T.WATER) continue;
      const band = (w: number, color: string) => {
        ctx.fillStyle = color;
        if (dx === 1) ctx.fillRect(px + TILE - w, py, w, TILE);
        if (dx === -1) ctx.fillRect(px, py, w, TILE);
        if (dy === 1) ctx.fillRect(px, py + TILE - w, TILE, w);
        if (dy === -1) ctx.fillRect(px, py, TILE, w);
      };
      band(9, 'rgba(140,210,255,0.35)');
      band(4, 'rgba(235,250,255,0.55)');
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = 0; i < 4; i++) {
        const f = rng() * TILE;
        const g = 4 + rng() * 4;
        ctx.fillRect(dx ? px + (dx > 0 ? TILE - g : g) : px + f, dy ? py + (dy > 0 ? TILE - g : g) : py + f, 2, 2);
      }
    }
  }
  // areia/terra molhada encostada na água
  if (t !== T.WATER)
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(state, nx, ny) || state.tiles[idx(state, nx, ny)] !== T.WATER) continue;
      ctx.fillStyle = 'rgba(60,40,20,0.18)';
      if (dx === 1) ctx.fillRect(px + TILE - 5, py, 5, TILE);
      if (dx === -1) ctx.fillRect(px, py, 5, TILE);
      if (dy === 1) ctx.fillRect(px, py + TILE - 5, TILE, 5);
      if (dy === -1) ctx.fillRect(px, py, TILE, 5);
    }
}

/** Distância (em tiles) de cada tile de água até a margem mais próxima; 0 para terra. */
export function waterDepth(state: GameState): Uint8Array {
  const MAP_W = state.mapW;
  const MAP_H = state.mapH;
  const d = new Uint8Array(MAP_W * MAP_H);
  const q: number[] = [];
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const i = idx(state, x, y);
      if (state.tiles[i] !== T.WATER) continue;
      d[i] = 255;
      const shore = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).some(([dx, dy]) => inBounds(state, x + dx, y + dy) && state.tiles[idx(state, x + dx, y + dy)] !== T.WATER);
      if (shore) {
        d[i] = 1;
        q.push(i);
      }
    }
  for (let h = 0; h < q.length; h++) {
    const i = q[h]!;
    const x = i % MAP_W;
    const y = (i - x) / MAP_W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      if (!inBounds(state, x + dx, y + dy)) continue;
      const j = idx(state, x + dx, y + dy);
      if (d[j] === 255) {
        d[j] = Math.min(254, d[i]! + 1);
        q.push(j);
      }
    }
  }
  for (let i = 0; i < d.length; i++) if (d[i] === 255) d[i] = 6;
  return d;
}

/** (chão) Ondinhas animadas na água à vista: arcos brancos que surgem e somem, mais nas águas fundas. */
export function drawWaterAnim(ctx: CanvasRenderingContext2D, state: GameState, depth: Uint8Array, time: number, v: { x0: number; y0: number; x1: number; y1: number }) {
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.2;
  for (let y = v.y0; y <= v.y1; y++)
    for (let x = v.x0; x <= v.x1; x++) {
      const dep = depth[idx(state, x, y)]!;
      if (!dep) continue;
      const h = ((x * 73856093) ^ (y * 19349663)) >>> 0;
      const ph = (time * 0.45 + (h % 1000) / 1000) % 1;
      const a = Math.sin(ph * Math.PI) * (dep > 1 ? 0.35 : 0.2);
      if (a < 0.03) continue;
      const wx = x * TILE + 6 + (h % 17) + ph * 6;
      const wy = y * TILE + 8 + ((h >> 5) % 16);
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.quadraticCurveTo(wx + 5, wy - 3, wx + 10, wy);
      ctx.stroke();
    }
  ctx.globalAlpha = 1;
}

function blend(a: string, b: string) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = (((pa >> 16) & 255) + ((pb >> 16) & 255)) >> 1;
  const g = (((pa >> 8) & 255) + ((pb >> 8) & 255)) >> 1;
  const bl = ((pa & 255) + (pb & 255)) >> 1;
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`;
}
