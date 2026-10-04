import { MAP_H, MAP_W } from '../config';
import { idx, inBounds, type World } from './world';

// A* em grade 8-direções com buffers reaproveitados (zero alocação por busca).
const N = MAP_W * MAP_H;
const gScore = new Float32Array(N);
const fScore = new Float32Array(N);
const came = new Int32Array(N);
const seen = new Uint32Array(N);
const closed = new Uint32Array(N);
const heap: number[] = [];
let gen = 0;
const SQ2 = Math.SQRT2;

const DIRS: [number, number, number][] = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, SQ2], [1, -1, SQ2], [-1, 1, SQ2], [-1, -1, SQ2],
];

function heapPush(i: number) {
  heap.push(i);
  let c = heap.length - 1;
  while (c > 0) {
    const p = (c - 1) >> 1;
    if (fScore[heap[p]!]! <= fScore[heap[c]!]!) break;
    [heap[p], heap[c]] = [heap[c]!, heap[p]!];
    c = p;
  }
}
function heapPop(): number {
  const top = heap[0]!;
  const last = heap.pop()!;
  if (heap.length) {
    heap[0] = last;
    let c = 0;
    for (;;) {
      const l = c * 2 + 1;
      const r = l + 1;
      let m = c;
      if (l < heap.length && fScore[heap[l]!]! < fScore[heap[m]!]!) m = l;
      if (r < heap.length && fScore[heap[r]!]! < fScore[heap[m]!]!) m = r;
      if (m === c) break;
      [heap[m], heap[c]] = [heap[c]!, heap[m]!];
      c = m;
    }
  }
  return top;
}

const octile = (ax: number, ay: number, bx: number, by: number) => {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return dx + dy + (SQ2 - 2) * Math.min(dx, dy);
};

export function nearestWalkable(w: World, tx: number, ty: number, maxR = 8): [number, number] | null {
  if (w.walkable(tx, ty)) return [tx, ty];
  for (let r = 1; r <= maxR; r++) {
    let best: [number, number] | null = null;
    let bd = Infinity;
    for (let y = ty - r; y <= ty + r; y++)
      for (let x = tx - r; x <= tx + r; x++) {
        if (Math.max(Math.abs(x - tx), Math.abs(y - ty)) !== r || !w.walkable(x, y)) continue;
        const d = (x - tx) ** 2 + (y - ty) ** 2;
        if (d < bd) {
          bd = d;
          best = [x, y];
        }
      }
    if (best) return best;
  }
  return null;
}

/** Retorna a lista de índices de tiles (sem o tile inicial) ou null. */
export function findPath(w: World, sx: number, sy: number, gx: number, gy: number, maxIter = 6000): number[] | null {
  sx = Math.max(0, Math.min(MAP_W - 1, sx));
  sy = Math.max(0, Math.min(MAP_H - 1, sy));
  const g = nearestWalkable(w, Math.max(0, Math.min(MAP_W - 1, gx)), Math.max(0, Math.min(MAP_H - 1, gy)));
  if (!g) return null;
  [gx, gy] = g;
  const start = idx(sx, sy);
  const goal = idx(gx, gy);
  if (start === goal) return [];

  gen++;
  heap.length = 0;
  gScore[start] = 0;
  fScore[start] = octile(sx, sy, gx, gy);
  seen[start] = gen;
  came[start] = -1;
  heapPush(start);

  let iter = 0;
  while (heap.length && iter++ < maxIter) {
    const cur = heapPop();
    if (closed[cur] === gen) continue;
    closed[cur] = gen;
    if (cur === goal) {
      const path: number[] = [];
      for (let c = goal; c !== start && c !== -1; c = came[c]!) path.push(c);
      return path.reverse();
    }
    const cx = cur % MAP_W;
    const cy = (cur / MAP_W) | 0;
    for (const [dx, dy, cost] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!inBounds(nx, ny)) continue;
      const ni = idx(nx, ny);
      if (closed[ni] === gen || !w.walkable(nx, ny)) continue;
      if (dx !== 0 && dy !== 0 && (!w.walkable(cx + dx, cy) || !w.walkable(cx, cy + dy))) continue;
      const ng = gScore[cur]! + cost;
      if (seen[ni] !== gen || ng < gScore[ni]!) {
        seen[ni] = gen;
        gScore[ni] = ng;
        came[ni] = cur;
        fScore[ni] = ng + octile(nx, ny, gx, gy);
        heapPush(ni);
      }
    }
  }
  return null;
}
