import { MAP_H, MAP_W, TILE, WORLD_H, WORLD_W } from '../config';
import { mulberry32 } from '../core/rng';
import type { GameState } from '../game/types';
import { idx, inBounds, T } from '../game/world';

const BASE: Record<number, string> = {
  [T.GRASS]: '#5e9b42',
  [T.GRASS2]: '#54903b',
  [T.DIRT]: '#a88355',
  [T.SAND]: '#d7c38c',
  [T.WATER]: '#2f6fb0',
};

/** Desenha o terreno uma única vez num canvas offscreen. */
export function renderTerrain(state: GameState): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = WORLD_W;
  c.height = WORLD_H;
  const ctx = c.getContext('2d')!;
  const rng = mulberry32(state.seed ^ 0x5bd1e995);

  const depth = waterDepth(state);
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const t = state.tiles[idx(x, y)]!;
      // água fica mais escura longe da margem
      ctx.fillStyle = t === T.WATER ? DEEP[Math.min(DEEP.length - 1, depth[idx(x, y)]!)]! : (BASE[t] ?? '#000');
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    }

  // transições suaves entre tipos de terreno
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const t = state.tiles[idx(x, y)]!;
      for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(nx, ny)) continue;
        const o = state.tiles[idx(nx, ny)]!;
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

  // detalhes
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const t = state.tiles[idx(x, y)]!;
      const px = x * TILE;
      const py = y * TILE;
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
          if (!inBounds(nx, ny) || state.tiles[idx(nx, ny)] === T.WATER) continue;
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
          if (!inBounds(nx, ny) || state.tiles[idx(nx, ny)] !== T.WATER) continue;
          ctx.fillStyle = 'rgba(60,40,20,0.18)';
          if (dx === 1) ctx.fillRect(px + TILE - 5, py, 5, TILE);
          if (dx === -1) ctx.fillRect(px, py, 5, TILE);
          if (dy === 1) ctx.fillRect(px, py + TILE - 5, TILE, 5);
          if (dy === -1) ctx.fillRect(px, py, TILE, 5);
        }
    }
  return c;
}

const DEEP = ['#4a93cf', '#3a80c0', '#2f6fb0', '#285fa0', '#225391'];

/** Distância (em tiles) de cada tile de água até a margem mais próxima; 0 para terra. */
export function waterDepth(state: GameState): Uint8Array {
  const d = new Uint8Array(MAP_W * MAP_H);
  const q: number[] = [];
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const i = idx(x, y);
      if (state.tiles[i] !== T.WATER) continue;
      d[i] = 255;
      const shore = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).some(([dx, dy]) => inBounds(x + dx, y + dy) && state.tiles[idx(x + dx, y + dy)] !== T.WATER);
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
      if (!inBounds(x + dx, y + dy)) continue;
      const j = idx(x + dx, y + dy);
      if (d[j] === 255) {
        d[j] = Math.min(254, d[i]! + 1);
        q.push(j);
      }
    }
  }
  for (let i = 0; i < d.length; i++) if (d[i] === 255) d[i] = 6;
  return d;
}

/** (chão) Ondinhas animadas na água: arcos brancos que surgem e somem, mais nas águas fundas. */
export function drawWaterAnim(ctx: CanvasRenderingContext2D, state: GameState, depth: Uint8Array, time: number) {
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < depth.length; i++) {
    const dep = depth[i]!;
    if (!dep) continue;
    const x = i % MAP_W;
    const y = (i - x) / MAP_W;
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
