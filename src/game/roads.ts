// Ruas calçadas: o jogador pinta tiles de pedra dentro do território (modo "Rua" da construção). Quem anda por cima vai
// mais rápido e a busca de caminho prefere a rua; a rua continua sob os prédios (só campo/área aberta tira o
// calçamento). A pintura é um rascunho (`RoadDraft`) que só vale no "Pronto". Guardadas num bitset
// (`state.roads`, 1 bit por tile, como a névoa).
import { SUB, TILE } from '../config';
import type { Cost, GameState } from './types';
import type { Game } from './game';
import { idx, inBounds, type MapSize, T, toTile } from './world';
import { inTerritory } from './village';
import { defOf } from '../data/buildings';

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

/** Custo de `n` tiles calçados. */
export const roadCost = (n: number): Cost => Object.fromEntries(Object.entries(ROAD.cost).map(([k, v]) => [k, (v ?? 0) * n])) as Cost;

/**
 * Por que não dá para calçar este tile (ou null). Embaixo de prédio dá (a rua fica em volta da base e continua
 * se ele mudar de lugar); só campo/área aberta não. `pending` = tiles já pintados no rascunho e ainda não pagos.
 */
export function paveBlock(g: Game, tx: number, ty: number, pending = 0): string | null {
  const s = g.state;
  if (!inBounds(s, tx, ty)) return 'Fora do mapa.';
  if (isRoad(s, tx, ty)) return 'Já é rua.';
  if (s.tiles[idx(s, tx, ty)] === T.WATER || s.tiles[idx(s, tx, ty)] === T.ROCK) return 'Não dá para calçar água ou rocha.';
  const bid = g.world.buildingIdAt(tx, ty);
  const b = bid ? g.building(bid) : undefined;
  if (b && defOf(b).walkable) return 'Tem um campo aqui.';
  if (!inTerritory(s, tx, ty, 1, 1)) return 'Fora do território da vila.';
  if (!g.canAfford(roadCost(pending + 1))) return 'Falta pedra.';
  return null;
}

/**
 * Rascunho do modo "Rua": índice do tile → true (calçar) / false (tirar). Nada muda no estado (nem paga) até o
 * "Pronto"; sair sem confirmar (ou recarregar) descarta.
 */
export type RoadDraft = Map<number, boolean>;

/** Rua como fica com o rascunho aplicado (para o desenho). */
export const roadWith = (s: GameState, d: RoadDraft | null, tx: number, ty: number) =>
  (d && inBounds(s, tx, ty) ? d.get(idx(s, tx, ty)) : undefined) ?? isRoad(s, tx, ty);

/** Tiles a calçar no rascunho (os que serão pagos). */
export const draftPaves = (d: RoadDraft) => {
  let n = 0;
  for (const v of d.values()) if (v) n++;
  return n;
};

/** Pinta um tile no rascunho. Devolve o motivo se não deu (null = mudou ou já estava assim). */
export function draftRoad(g: Game, d: RoadDraft, tx: number, ty: number, on: boolean): string | null {
  const s = g.state;
  if (!inBounds(s, tx, ty)) return null;
  const i = idx(s, tx, ty);
  if (!on) {
    if (d.get(i)) d.delete(i);
    else if (isRoad(s, tx, ty)) d.set(i, false);
    return null;
  }
  if (d.get(i) === false) {
    d.delete(i); // ia tirar: volta a ser a rua que já era
    return null;
  }
  if (d.has(i) || isRoad(s, tx, ty)) return null;
  const why = paveBlock(g, tx, ty, draftPaves(d));
  if (!why) d.set(i, true);
  return why;
}

/** "Pronto": aplica o rascunho (paga cada tile calçado). Devolve quantos tiles mudaram. */
export function commitRoads(g: Game, d: RoadDraft): number {
  const s = g.state;
  let n = 0;
  for (const [i, on] of d) {
    const tx = i % s.mapW;
    const ty = Math.floor(i / s.mapW);
    if (on ? pave(g, tx, ty).ok : unpave(g, tx, ty)) n++;
  }
  d.clear();
  return n;
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

/** Campo (prédio de andar por cima) em cima da rua: o calçamento sai. Prédio comum deixa a rua embaixo. */
export function clearRoadsUnder(s: GameState, tx: number, ty: number, w: number, h: number, walkable = true) {
  if (!walkable) return;
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
