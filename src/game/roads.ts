// Ruas calçadas: o jogador pinta tiles de pedra dentro do território (modo "Rua" da construção). Quem anda por cima vai
// mais rápido e a busca de caminho prefere a rua; prédio construído em cima tira o calçamento. Guardadas num bitset
// (`state.roads`, 1 bit por tile, como a névoa).
import { SUB, TILE } from '../config';
import type { Cost, GameState } from './types';
import type { Game } from './game';
import { idx, inBounds, type MapSize, T, toTile } from './world';
import { inTerritory } from './village';

export const ROAD = {
  /** Custo por tile calçado. */
  cost: { stone: 2 } as Cost,
  /** Velocidade de quem anda na rua. */
  speed: 1.3,
  /** Custo de cada passo na rua para a busca de caminho (menor = prefere a rua). */
  pathCost: 0.7,
};

/** Bitset vazio do tamanho do mapa. */
export const emptyRoads = (m: MapSize) => new Array<number>(Math.ceil((m.mapW * m.mapH) / 32)).fill(0);

export function isRoad(s: GameState, tx: number, ty: number) {
  if (!inBounds(s, tx, ty) || !s.roads) return false;
  const i = idx(s, tx, ty);
  return ((s.roads[i >> 5]! >>> (i & 31)) & 1) === 1;
}
/** Célula de colisão (meio tile) em rua: a busca de caminho usa. */
export const isRoadCell = (s: GameState, fx: number, fy: number) => isRoad(s, Math.floor(fx / SUB), Math.floor(fy / SUB));
export const roadSpeed = (s: GameState, x: number, y: number) => (isRoad(s, toTile(x), toTile(y)) ? ROAD.speed : 1);

function setRoad(s: GameState, tx: number, ty: number, on: boolean) {
  s.roads ??= emptyRoads(s);
  const i = idx(s, tx, ty);
  const bit = 1 << (i & 31);
  s.roads[i >> 5] = on ? s.roads[i >> 5]! | bit : s.roads[i >> 5]! & ~bit;
}

/** Por que não dá para calçar este tile (ou null). */
export function paveBlock(g: Game, tx: number, ty: number): string | null {
  const s = g.state;
  if (!inBounds(s, tx, ty)) return 'Fora do mapa.';
  if (isRoad(s, tx, ty)) return 'Já é rua.';
  if (s.tiles[idx(s, tx, ty)] === T.WATER || s.tiles[idx(s, tx, ty)] === T.ROCK) return 'Não dá para calçar água ou rocha.';
  if (g.world.occupied[idx(s, tx, ty)]) return 'Tem um prédio aqui.';
  if (!inTerritory(s, tx, ty, 1, 1)) return 'Fora do território da vila.';
  if (!g.canAfford(ROAD.cost)) return 'Falta pedra.';
  return null;
}

export function pave(g: Game, tx: number, ty: number): { ok: true } | { ok: false; error: string } {
  const why = paveBlock(g, tx, ty);
  if (why) return { ok: false, error: why };
  g.pay(ROAD.cost);
  setRoad(g.state, tx, ty, true);
  return { ok: true };
}

/** Tira o calçamento (sem devolver a pedra). */
export function unpave(g: Game, tx: number, ty: number) {
  if (!isRoad(g.state, tx, ty)) return false;
  setRoad(g.state, tx, ty, false);
  return true;
}

/** Prédio novo em cima da rua: o calçamento sai. */
export function clearRoadsUnder(s: GameState, tx: number, ty: number, w: number, h: number) {
  for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) if (isRoad(s, x, y)) setRoad(s, x, y, false);
}

/** Quantos tiles de rua a vila tem. */
export function roadCount(s: GameState) {
  let n = 0;
  for (const w of s.roads ?? []) for (let v = w >>> 0; v; v &= v - 1) n++;
  return n;
}

/** Centro do tile em px (para quem desenha). */
export const roadTileCenter = (tx: number, ty: number) => ({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 });
