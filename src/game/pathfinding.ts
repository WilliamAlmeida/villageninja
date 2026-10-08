import { CELL, FINE_H, FINE_W, MAP_H, MAP_W, SUB } from '../config';
import { fidx, inFine, type World } from './world';

// A* em grade 8-direções, nas células de colisão (meio tile), com buffers reaproveitados (zero alocação por busca).
const N = FINE_W * FINE_H;
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

/** Célula livre mais perto da célula (fx, fy), ou null. */
export function nearestCell(w: World, fx: number, fy: number, maxR = 16): [number, number] | null {
  if (w.walkableCell(fx, fy)) return [fx, fy];
  for (let r = 1; r <= maxR; r++) {
    let best: [number, number] | null = null;
    let bd = Infinity;
    for (let y = fy - r; y <= fy + r; y++)
      for (let x = fx - r; x <= fx + r; x++) {
        if (Math.max(Math.abs(x - fx), Math.abs(y - fy)) !== r || !w.walkableCell(x, y)) continue;
        const d = (x - fx) ** 2 + (y - fy) ** 2;
        if (d < bd) {
          bd = d;
          best = [x, y];
        }
      }
    if (best) return best;
  }
  return null;
}

/** Caminho entre tiles (do meio de um ao meio do outro): lista de células (sem a inicial) ou null. */
export function findPath(w: World, sx: number, sy: number, gx: number, gy: number, maxIter = 6000): number[] | null {
  const c = (t: number, max: number) => Math.max(0, Math.min(max - 1, t)) * SUB + (SUB >> 1);
  return findCells(w, c(sx, MAP_W), c(sy, MAP_H), c(gx, MAP_W), c(gy, MAP_H), maxIter * SUB * SUB);
}

/** Caminho entre dois pontos (px). */
export function findPathPx(w: World, ax: number, ay: number, bx: number, by: number, maxIter = 6000 * SUB * SUB): number[] | null {
  const c = (v: number, max: number) => Math.max(0, Math.min(max - 1, Math.floor(v / CELL)));
  return findCells(w, c(ax, FINE_W), c(ay, FINE_H), c(bx, FINE_W), c(by, FINE_H), maxIter);
}

/** A* nas células: lista de índices de célula (sem a inicial) ou null. Destino bloqueado vai para a célula livre mais perto. */
export function findCells(w: World, sx: number, sy: number, gx: number, gy: number, maxIter: number): number[] | null {
  const g = nearestCell(w, gx, gy);
  if (!g) return null;
  [gx, gy] = g;
  // começando dentro de um muro (empurrado, nasceu num prédio): sai pela célula livre mais perto
  let pre: number | null = null;
  if (!w.walkableCell(sx, sy)) {
    const s = nearestCell(w, sx, sy);
    if (!s) return null;
    [sx, sy] = s;
    pre = fidx(sx, sy);
  }
  const start = fidx(sx, sy);
  const goal = fidx(gx, gy);
  if (start === goal) return pre != null ? [pre] : [];

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
      if (pre != null) path.push(pre);
      return path.reverse();
    }
    const cx = cur % FINE_W;
    const cy = (cur / FINE_W) | 0;
    for (const [dx, dy, cost] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!inFine(nx, ny)) continue;
      const ni = fidx(nx, ny);
      if (closed[ni] === gen || !w.walkableCell(nx, ny)) continue;
      if (dx !== 0 && dy !== 0 && (!w.walkableCell(cx + dx, cy) || !w.walkableCell(cx, cy + dy))) continue;
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
