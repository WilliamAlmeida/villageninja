import { MAP_H, MAP_W, TILE, VILLAGE_MARGIN } from '../config';
import { lerp } from '../core/math';
import { mulberry32 } from '../core/rng';
import { BUILDINGS, type BuildingType } from '../data/buildings';
import type { Building, GameState, ResourceNode } from './types';

export const T = { GRASS: 0, GRASS2: 1, DIRT: 2, SAND: 3, WATER: 4 } as const;

export const CENTER_TX = Math.floor(MAP_W / 2);
export const CENTER_TY = Math.floor(MAP_H / 2);

export const idx = (tx: number, ty: number) => ty * MAP_W + tx;
export const inBounds = (tx: number, ty: number) => tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H;
export const toTile = (v: number) => Math.floor(v / TILE);
export const tileCenter = (t: number) => t * TILE + TILE / 2;

export function doorTile(b: Building) {
  const d = BUILDINGS[b.type];
  return { tx: b.tx + Math.floor(d.w / 2), ty: b.ty + d.h };
}
/** Ponto (px) logo em frente à porta. */
export function doorPos(b: Building) {
  const t = doorTile(b);
  return { x: tileCenter(t.tx), y: t.ty * TILE + 10 };
}
export function buildingCenter(b: Building) {
  const d = BUILDINGS[b.type];
  return { x: (b.tx + d.w / 2) * TILE, y: (b.ty + d.h / 2) * TILE };
}

/** Dados derivados do estado (grade de colisão etc.). Não é salvo. */
export class World {
  readonly blocked = new Uint8Array(MAP_W * MAP_H);
  readonly occupied = new Int32Array(MAP_W * MAP_H);
  private villageRects: { x0: number; y0: number; x1: number; y1: number }[] = [];

  constructor(public state: GameState) {
    this.rebuild();
  }

  rebuild() {
    const s = this.state;
    this.blocked.fill(0);
    this.occupied.fill(0);
    for (let i = 0; i < s.tiles.length; i++) if (s.tiles[i] === T.WATER) this.blocked[i] = 1;
    this.villageRects = [];
    for (const b of s.buildings) {
      const d = BUILDINGS[b.type];
      for (let y = b.ty; y < b.ty + d.h; y++)
        for (let x = b.tx; x < b.tx + d.w; x++) {
          const i = idx(x, y);
          this.occupied[i] = b.id;
          if (!d.walkable) this.blocked[i] = 1;
        }
      const m = VILLAGE_MARGIN * TILE;
      this.villageRects.push({ x0: b.tx * TILE - m, y0: b.ty * TILE - m, x1: (b.tx + d.w) * TILE + m, y1: (b.ty + d.h) * TILE + m });
    }
  }

  walkable(tx: number, ty: number) {
    return inBounds(tx, ty) && this.blocked[idx(tx, ty)] === 0;
  }
  walkablePx(x: number, y: number) {
    return this.walkable(toTile(x), toTile(y));
  }
  buildingIdAt(tx: number, ty: number) {
    return inBounds(tx, ty) ? this.occupied[idx(tx, ty)]! : 0;
  }

  inVillage(x: number, y: number) {
    for (const r of this.villageRects) if (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) return true;
    return false;
  }

  canPlace(type: BuildingType, tx: number, ty: number): boolean {
    const d = BUILDINGS[type];
    if (tx < 1 || ty < 1 || tx + d.w > MAP_W - 1 || ty + d.h > MAP_H - 2) return false;
    // 1 tile de folga entre prédios garante que sempre exista caminho.
    for (let y = ty - 1; y <= ty + d.h; y++)
      for (let x = tx - 1; x <= tx + d.w; x++) if (inBounds(x, y) && this.occupied[idx(x, y)] !== 0) return false;
    for (let y = ty; y <= ty + d.h; y++)
      for (let x = tx; x < tx + d.w; x++) if (this.state.tiles[idx(x, y)] === T.WATER) return false;
    for (const n of this.state.nodes)
      if (n.type === 'rock' && n.tx >= tx && n.tx < tx + d.w && n.ty >= ty && n.ty < ty + d.h) return false;
    return true;
  }
}

function makeNoise(rng: () => number, cell: number) {
  const gw = Math.ceil(MAP_W / cell) + 2;
  const gh = Math.ceil(MAP_H / cell) + 2;
  const g = new Float32Array(gw * gh);
  for (let i = 0; i < g.length; i++) g[i] = rng();
  return (x: number, y: number) => {
    const fx = x / cell;
    const fy = y / cell;
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    const tx = fx - ix;
    const ty = fy - iy;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const a = g[iy * gw + ix]!;
    const b = g[iy * gw + ix + 1]!;
    const c = g[(iy + 1) * gw + ix]!;
    const d = g[(iy + 1) * gw + ix + 1]!;
    return lerp(lerp(a, b, sx), lerp(c, d, sx), sy);
  };
}

/** Gera terreno e recursos a partir de uma seed. O centro fica livre para a vila. */
export function generateMap(seed: number, nextId: () => number): { tiles: number[]; nodes: ResourceNode[] } {
  const rng = mulberry32(seed);
  const n1 = makeNoise(rng, 9);
  const n2 = makeNoise(rng, 6);
  const n3 = makeNoise(rng, 5);
  const n4 = makeNoise(rng, 3);
  const tiles = new Array<number>(MAP_W * MAP_H).fill(T.GRASS);
  const dc = (x: number, y: number) => Math.hypot(x - CENTER_TX, (y - CENTER_TY) * 1.2);

  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const i = idx(x, y);
      const w = n1(x, y) * 0.75 + n4(x, y) * 0.25;
      if (w > 0.64 && dc(x, y) > 13) tiles[i] = T.WATER;
      else if (dc(x, y) < 3.3) tiles[i] = T.DIRT;
      else if (n2(x + 50, y) > 0.55) tiles[i] = T.GRASS2;
    }
  // areia nas margens
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const i = idx(x, y);
      if (tiles[i] === T.WATER) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (inBounds(nx, ny) && tiles[idx(nx, ny)] === T.WATER) {
          tiles[i] = T.SAND;
          break;
        }
      }
    }

  const nodes: ResourceNode[] = [];
  for (let y = 1; y < MAP_H - 1; y++)
    for (let x = 1; x < MAP_W - 1; x++) {
      const t = tiles[idx(x, y)];
      if (t !== T.GRASS && t !== T.GRASS2) continue;
      const d = dc(x, y);
      const forest = n2(x, y) * 0.7 + n3(x, y) * 0.3;
      if (d > 9 && forest > 0.56 && rng() < 0.65) {
        nodes.push({ id: nextId(), type: 'tree', tx: x, ty: y, amount: 25, max: 25, variant: Math.floor(rng() * 4) });
      } else if (d > 7 && rng() < 0.025) {
        nodes.push({ id: nextId(), type: 'tree', tx: x, ty: y, amount: 25, max: 25, variant: Math.floor(rng() * 4) });
      } else if (d > 9 && ((n3(x + 31, y + 17) > 0.7 && rng() < 0.5) || rng() < 0.006)) {
        nodes.push({ id: nextId(), type: 'rock', tx: x, ty: y, amount: 40, max: 40, variant: Math.floor(rng() * 4) });
      }
    }
  return { tiles, nodes };
}
