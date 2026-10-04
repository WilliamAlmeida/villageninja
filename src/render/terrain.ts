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

  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const t = state.tiles[idx(x, y)]!;
      ctx.fillStyle = BASE[t] ?? '#000';
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
        // borda mais clara perto da margem
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = x + dx;
          const ny = y + dy;
          if (inBounds(nx, ny) && state.tiles[idx(nx, ny)] !== T.WATER) {
            ctx.fillStyle = 'rgba(160,220,255,0.25)';
            if (dx === 1) ctx.fillRect(px + TILE - 4, py, 4, TILE);
            if (dx === -1) ctx.fillRect(px, py, 4, TILE);
            if (dy === 1) ctx.fillRect(px, py + TILE - 4, TILE, 4);
            if (dy === -1) ctx.fillRect(px, py, TILE, 4);
          }
        }
      }
    }
  return c;
}

function blend(a: string, b: string) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = (((pa >> 16) & 255) + ((pb >> 16) & 255)) >> 1;
  const g = (((pa >> 8) & 255) + ((pb >> 8) & 255)) >> 1;
  const bl = ((pa & 255) + (pb & 255)) >> 1;
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`;
}
