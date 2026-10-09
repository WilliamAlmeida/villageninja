import { CELL, FINE_H, FINE_W, MAP_H, MAP_W, SUB, TILE, VILLAGE_MARGIN } from '../config';
import { lerp } from '../core/math';
import { mulberry32 } from '../core/rng';
import { BUILDINGS, type BuildingType } from '../data/buildings';
import { extraOf, layoutPoint, tileOf, typeLayout } from '../data/layout';
import type { Building, GameState, ResourceNode, Site } from './types';
import { inTerritory } from './village';

/** ROCK: parede de caverna (bloqueia como a água; só nos mapas de mina). */
export const T = { GRASS: 0, GRASS2: 1, DIRT: 2, SAND: 3, WATER: 4, ROCK: 5 } as const;

export const CENTER_TX = Math.floor(MAP_W / 2);
export const CENTER_TY = Math.floor(MAP_H / 2);

export const idx = (tx: number, ty: number) => ty * MAP_W + tx;
export const inBounds = (tx: number, ty: number) => tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H;
export const toTile = (v: number) => Math.floor(v / TILE);
export const tileCenter = (t: number) => t * TILE + TILE / 2;
/** Células de colisão (meio tile, CELL px). */
export const fidx = (fx: number, fy: number) => fy * FINE_W + fx;
export const inFine = (fx: number, fy: number) => fx >= 0 && fy >= 0 && fx < FINE_W && fy < FINE_H;
export const toCell = (v: number) => Math.floor(v / CELL);
/** Centro (px) da célula de índice `i`. */
export const cellCenter = (i: number) => ({ x: (i % FINE_W) * CELL + CELL / 2, y: Math.floor(i / FINE_W) * CELL + CELL / 2 });

export function doorTile(b: Building) {
  const p = layoutPoint(b.type, 'door', b.flip); // ajustado no Editor de cenário
  if (p) return { tx: b.tx + Math.floor(p[0] / TILE), ty: b.ty + Math.floor(p[1] / TILE) };
  const d = BUILDINGS[b.type];
  return { tx: b.tx + Math.floor(d.w / 2), ty: b.ty + d.h };
}
/** Ponto (px) logo em frente à porta. */
export function doorPos(b: Building) {
  const p = layoutPoint(b.type, 'door', b.flip);
  if (p) return { x: b.tx * TILE + p[0], y: b.ty * TILE + p[1] };
  const t = doorTile(b);
  return { x: tileCenter(t.tx), y: t.ty * TILE + 10 };
}
/** Arte do recurso no estágio atual: árvore (tree0/tree1) vira toco quase no fim; rocha racha depois da metade. */
export function nodeArt(n: ResourceNode): string {
  const left = n.max ? n.amount / n.max : 1;
  // cada árvore tem o toco dela (folhosa / pinheiro)
  if (n.type === 'tree') return left < 0.25 ? `stump${n.variant % 2}` : `tree${n.variant % 2}`;
  // rocha: racha depois da metade; esgotada some numa nuvem e deixa só pedrinhas no chão (dá para andar) até voltar
  if (n.type === 'rock') return n.amount <= 0 ? 'rock-pebbles' : left < 0.5 ? 'rock-cracked' : 'rock';
  // veio: esgotado fica a rocha sem os cristais
  if (n.type === 'ore' && n.amount <= 0) return 'ore-empty';
  return n.type;
}
/** Canto (em tiles) da grade de colisão de um recurso pelo layout (arte do estágio), ou null = não bloqueia. */
export function nodeTiles(n: ResourceNode) {
  const L = typeLayout(nodeArt(n));
  if (!L?.tiles) return null;
  const h = Math.ceil(L.tiles.length / SUB);
  const w = Math.ceil(Math.max(...L.tiles.map((r) => r.length)) / SUB);
  const [ox, oy] = L.origin ?? [Math.floor(w / 2), Math.floor(h / 2)];
  return { x0: n.tx - ox, y0: n.ty - oy, rows: L.tiles };
}

/** Tiles que um local (ruína, mina…) ocupa pelo layout: canto e grade. */
export function siteTiles(site: Site) {
  const L = typeLayout(site.kind);
  if (!L?.tiles) return null;
  // as linhas do layout são em meio tile: o retângulo é em tiles inteiros
  const h = Math.ceil(L.tiles.length / SUB);
  const w = Math.ceil(Math.max(...L.tiles.map((r) => r.length)) / SUB);
  const [ox, oy] = L.origin ?? [Math.floor(w / 2), Math.floor(h / 2)];
  return { x0: site.tx - ox, y0: site.ty - oy, w, h };
}
export function buildingCenter(b: Building) {
  const d = BUILDINGS[b.type];
  return { x: (b.tx + d.w / 2) * TILE, y: (b.ty + d.h / 2) * TILE };
}

/** Dados derivados do estado (grade de colisão etc.). Não é salvo. */
export class World {
  /** Tile bloqueado se qualquer pedaço dele for (para escolher lugar de nascer, trabalhar etc.). */
  readonly blocked = new Uint8Array(MAP_W * MAP_H);
  /** Colisão de verdade, em meio tile (CELL px): caminhos, empurrões e `walkablePx`. */
  readonly fine = new Uint8Array(FINE_W * FINE_H);
  /** Colisão sem os recursos (terreno, prédios, locais): base para refazer só a parte das rochas/árvores. */
  private baseFine = new Uint8Array(FINE_W * FINE_H);
  private baseBlocked = new Uint8Array(MAP_W * MAP_H);
  private nodeSig = '';
  /**
   * Células "macias" (rocha, árvore com terreno no Editor de cenário): o caminho desvia delas sempre que há volta
   * razoável (custo alto no A*), mas atravessa se não houver outra saída — um aglomerado de rochas nunca prende ninguém.
   */
  readonly soft = new Uint8Array(FINE_W * FINE_H);
  /**
   * "Ilha" de cada célula livre (as que se alcançam andando; 0 = muro). Uma busca de caminho para outra ilha não
   * varre o mapa: vai direto à célula alcançável mais perto do destino. Refeita quando a colisão muda.
   */
  readonly region = new Int32Array(FINE_W * FINE_H);
  private regionStack = new Int32Array(FINE_W * FINE_H);
  readonly occupied = new Int32Array(MAP_W * MAP_H);
  private villageRects: { x0: number; y0: number; x1: number; y1: number }[] = [];

  constructor(public state: GameState) {
    this.rebuild();
  }

  rebuild() {
    const s = this.state;
    this.blocked.fill(0);
    this.fine.fill(0);
    this.occupied.fill(0);
    for (let i = 0; i < s.tiles.length; i++) if (s.tiles[i] === T.WATER || s.tiles[i] === T.ROCK) this.blockTile(i % MAP_W, Math.floor(i / MAP_W));
    this.villageRects = [];
    for (const b of s.buildings) {
      const d = BUILDINGS[b.type];
      // células ajustadas no Editor de cenário (muro/portão, em meio tile) valem com o prédio pronto; senão a regra do prédio
      const custom = b.built && tileOf(b.type, 0, 0) !== undefined;
      for (let y = b.ty; y < b.ty + d.h; y++)
        for (let x = b.tx; x < b.tx + d.w; x++) {
          this.occupied[idx(x, y)] = b.id;
          if (!custom && !d.walkable) this.blockTile(x, y);
        }
      if (custom)
        for (let fy = 0; fy < d.h * SUB; fy++)
          for (let fx = 0; fx < d.w * SUB; fx++) {
            const c = tileOf(b.type, fx, fy, b.flip);
            if (c === '#' || c === '~') this.blockCell(b.tx * SUB + fx, b.ty * SUB + fy);
          }
      // bloqueios avulsos em volta (arte maior que o terreno)
      if (b.built) for (const [fx, fy] of extraOf(b.type, b.flip)) this.blockCell(b.tx * SUB + fx, b.ty * SUB + fy);
      const m = VILLAGE_MARGIN * TILE;
      this.villageRects.push({ x0: b.tx * TILE - m, y0: b.ty * TILE - m, x1: (b.tx + d.w) * TILE + m, y1: (b.ty + d.h) * TILE + m });
    }
    this.blockSites();
    this.baseFine.set(this.fine);
    this.baseBlocked.set(this.blocked);
    this.stampNodes();
    this.computeRegions();
  }

  /** Pinta as ilhas (vizinhança de 4, como o A* que não corta quina). */
  private computeRegions() {
    const r = this.region;
    r.fill(0);
    const st = this.regionStack;
    let id = 0;
    for (let i = 0; i < r.length; i++) {
      if (r[i] || this.fine[i]) continue;
      id++;
      let top = 0;
      st[top++] = i;
      r[i] = id;
      while (top) {
        const c = st[--top]!;
        const x = c % FINE_W;
        if (x > 0 && !r[c - 1] && !this.fine[c - 1]) (r[c - 1] = id), (st[top++] = c - 1);
        if (x < FINE_W - 1 && !r[c + 1] && !this.fine[c + 1]) (r[c + 1] = id), (st[top++] = c + 1);
        if (c >= FINE_W && !r[c - FINE_W] && !this.fine[c - FINE_W]) (r[c - FINE_W] = id), (st[top++] = c - FINE_W);
        if (c + FINE_W < r.length && !r[c + FINE_W] && !this.fine[c + FINE_W]) (r[c + FINE_W] = id), (st[top++] = c + FINE_W);
      }
    }
  }

  /** Rocha/árvore com terreno no Editor de cenário marca as células dela como macias (pelo estágio: rocha rachada, toco…). */
  private stampNodes() {
    const sig: string[] = [];
    this.soft.fill(0);
    for (const n of this.state.nodes) {
      const r = nodeTiles(n);
      if (!r) continue;
      sig.push(`${n.id}:${nodeArt(n)}`);
      for (let y = 0; y < r.rows.length; y++)
        for (let x = 0; x < r.rows[y]!.length; x++) {
          if (r.rows[y]![x] !== '#') continue;
          const fx = r.x0 * SUB + x;
          const fy = r.y0 * SUB + y;
          if (!inFine(fx, fy)) continue;
          this.soft[fidx(fx, fy)] = 1;
          this.blocked[idx(Math.floor(fx / SUB), Math.floor(fy / SUB))] = 1; // ninguém nasce/trabalha em cima
        }
    }
    this.nodeSig = sig.join(',');
  }

  /** Recursos mudaram (esgotou, rebrotou, sumiu, apareceu)? Refaz só a colisão deles. Barato: chame todo passo. */
  refreshNodes() {
    const sig: string[] = [];
    for (const n of this.state.nodes) if (typeLayout(nodeArt(n))?.tiles) sig.push(`${n.id}:${nodeArt(n)}`);
    if (sig.join(',') === this.nodeSig) return;
    this.blocked.set(this.baseBlocked);
    this.stampNodes(); // só as células macias mudam: as ilhas (colisão dura) continuam as mesmas
  }

  private blockTile(tx: number, ty: number) {
    for (let sy = 0; sy < SUB; sy++) for (let sx = 0; sx < SUB; sx++) this.blockCell(tx * SUB + sx, ty * SUB + sy);
  }
  private blockCell(fx: number, fy: number) {
    if (!inFine(fx, fy)) return;
    this.fine[fidx(fx, fy)] = 1;
    this.blocked[idx(Math.floor(fx / SUB), Math.floor(fy / SUB))] = 1;
  }

  /** Locais à vista (ruína, entrada de mina…) com muro no layout bloqueiam esses tiles. */
  private blockSites() {
    // mapas de missão (caverna da mina): a descida fica num beco escavado; muro em volta dela a deixaria sem acesso
    if (this.state.sceneInfo) return;
    for (const site of this.state.sites) {
      if (!site.found || site.done) continue;
      const r = siteTiles(site);
      if (!r) continue;
      const rows = typeLayout(site.kind)!.tiles!;
      for (let y = 0; y < rows.length; y++)
        for (let x = 0; x < rows[y]!.length; x++) if (rows[y]![x] === '#') this.blockCell(r.x0 * SUB + x, r.y0 * SUB + y);
    }
  }

  walkable(tx: number, ty: number) {
    return inBounds(tx, ty) && this.blocked[idx(tx, ty)] === 0;
  }
  walkablePx(x: number, y: number) {
    return this.walkableCell(toCell(x), toCell(y));
  }
  walkableCell(fx: number, fy: number) {
    return inFine(fx, fy) && this.fine[fidx(fx, fy)] === 0;
  }
  /** Livre e sem rocha/árvore (o que dá para andar em linha reta sem contornar nada). */
  clearPx(x: number, y: number) {
    const fx = toCell(x);
    const fy = toCell(y);
    return inFine(fx, fy) && this.fine[fidx(fx, fy)] === 0 && this.soft[fidx(fx, fy)] === 0;
  }
  buildingIdAt(tx: number, ty: number) {
    return inBounds(tx, ty) ? this.occupied[idx(tx, ty)]! : 0;
  }

  inVillage(x: number, y: number) {
    for (const r of this.villageRects) if (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) return true;
    return false;
  }

  canPlace(type: BuildingType, tx: number, ty: number, flip = false): boolean {
    const d = BUILDINGS[type];
    if (tx < 1 || ty < 1 || tx + d.w > MAP_W - 1 || ty + d.h > MAP_H - 2) return false;
    if (flip && !canFlip(type)) return false;
    // 1 tile de folga entre prédios garante que sempre exista caminho.
    for (let y = ty - 1; y <= ty + d.h; y++)
      for (let x = tx - 1; x <= tx + d.w; x++) if (inBounds(x, y) && this.occupied[idx(x, y)] !== 0) return false;
    if (d.shore && tileOf(type, 0, 0) !== undefined) {
      if (!this.shoreFits(type, tx, ty, flip)) return false;
    } else
      for (let y = ty; y <= ty + d.h; y++)
        for (let x = tx; x < tx + d.w; x++) if (this.state.tiles[idx(x, y)] === T.WATER || this.state.tiles[idx(x, y)] === T.ROCK) return false;
    for (const n of this.state.nodes)
      // rocha/veio esgotado (rachado, crescendo de volta) não bloqueia: some quando constroem em cima
      if ((n.type === 'rock' || n.type === 'ore') && n.amount > 0 && n.tx >= tx && n.tx < tx + d.w && n.ty >= ty && n.ty < ty + d.h) return false;
    return inTerritory(this.state, tx, ty, d.w, d.h + 1);
  }

  /**
   * Prédio de margem: cada tile do terreno pelo que as 4 células dele pedem: só água ("~") = tile de água; só muro
   * ("#") = terra; os dois = a beira (qualquer um); só livre = qualquer chão. A porta tem que dar em terra firme.
   */
  shoreFits(type: BuildingType, tx: number, ty: number, flip = false): boolean {
    const d = BUILDINGS[type];
    const tiles = this.state.tiles;
    for (let y = 0; y < d.h; y++)
      for (let x = 0; x < d.w; x++) {
        let wet = false;
        let dry = false;
        for (let c = 0; c < SUB * SUB; c++) {
          const k = tileOf(type, x * SUB + (c % SUB), y * SUB + Math.floor(c / SUB), flip);
          if (k === '~') wet = true;
          else if (k === '#') dry = true;
        }
        const t = tiles[idx(tx + x, ty + y)];
        if (t === T.ROCK) return false;
        if (wet && !dry && t !== T.WATER) return false;
        if (dry && !wet && t === T.WATER) return false;
      }
    const door = doorTile({ type, tx, ty, flip } as Building);
    if (!inBounds(door.tx, door.ty)) return false;
    const dt = tiles[idx(door.tx, door.ty)];
    return dt !== T.WATER && dt !== T.ROCK;
  }
}

/** Só prédio de margem com terreno quadrado pode ser espelhado (trocar x por y não muda o tamanho). */
export function canFlip(type: BuildingType): boolean {
  const d = BUILDINGS[type];
  return !!d.shore && d.w === d.h;
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
        // parte das rochas tem veios de minério de ferro
        const ore = d > 12 && rng() < 0.25;
        nodes.push({ id: nextId(), type: ore ? 'ore' : 'rock', tx: x, ty: y, amount: 40, max: 40, variant: Math.floor(rng() * 4) });
      }
    }
  return { tiles, nodes };
}
