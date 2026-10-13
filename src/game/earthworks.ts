// Aterrar e cavar (pedido do autor): o jogador marca tiles no modo de pintar da barra de construção ("Aterrar" e
// "Cavar"); aterrar paga pedra ao marcar (devolvida se desmarcar), cavar é grátis. Os moradores sem obra fazem o
// trabalho (systems/villagers.ts, depois das obras e antes de limpar área), de um tile vizinho em terra firme: o lago
// vai fechando pela margem. Pronto, o tile vira grama (aterrado) ou água (cavado), a areia da margem se refaz em volta,
// a colisão e o desenho do chão se refazem (`Game.terrainRev`). Só dentro do território.
import { TILE } from '../config';
import { fx } from './fx';
import type { Game } from './game';
import { isRoad, unpave } from './roads';
import type { Cost, Earthwork, GameState } from './types';
import { inTerritory } from './village';
import { idx, inBounds, T, tileCenter } from './world';

export const EARTH = {
  /** Custo de aterrar um tile (pago ao marcar). */
  fillCost: { stone: 3 } as Cost,
  /** Segundos de trabalho de um morador por tile. */
  work: 6,
};

export const earthworkAt = (s: GameState, tx: number, ty: number) => (s.earthworks ?? []).find((e) => e.tx === tx && e.ty === ty);

/** Por que não dá para marcar este tile (ou null). */
export function earthBlock(g: Game, tx: number, ty: number, op: Earthwork['op']): string | null {
  const s = g.state;
  if (!inBounds(s, tx, ty) || tx < 1 || ty < 1 || tx >= s.mapW - 1 || ty >= s.mapH - 1) return 'Fora do mapa.';
  if (earthworkAt(s, tx, ty)) return 'Já está marcado.';
  if (!inTerritory(s, tx, ty, 1, 1)) return 'Fora do território da vila.';
  const t = s.tiles[idx(s, tx, ty)];
  if (t === T.ROCK) return 'Não dá para mexer em rocha.';
  if (op === 'fill') {
    if (t !== T.WATER) return 'Aqui já é terra.';
    if (g.world.buildingIdAt(tx, ty)) return 'Tem um prédio aqui (píer).';
    if (!g.canAfford(EARTH.fillCost)) return 'Falta pedra.';
  } else {
    if (t === T.WATER) return 'Aqui já é água.';
    if (g.world.buildingIdAt(tx, ty)) return 'Tem um prédio aqui.';
    if (s.nodes.some((n) => n.tx === tx && n.ty === ty && !n.cleared)) return 'Tem árvore ou pedra aqui: limpe a área antes.';
  }
  return null;
}

/** Marca o tile para aterrar/cavar (aterrar paga a pedra agora). */
export function markEarth(g: Game, tx: number, ty: number, op: Earthwork['op']): { ok: true } | { ok: false; error: string } {
  const why = earthBlock(g, tx, ty, op);
  if (why) return { ok: false, error: why };
  if (op === 'fill') g.pay(EARTH.fillCost);
  (g.state.earthworks ??= []).push({ tx, ty, op });
  return { ok: true };
}

/** Desmarca (devolve a pedra de quem ia aterrar). */
export function unmarkEarth(g: Game, tx: number, ty: number): boolean {
  const s = g.state;
  const e = earthworkAt(s, tx, ty);
  if (!e) return false;
  s.earthworks = s.earthworks!.filter((o) => o !== e);
  if (e.op === 'fill') g.give(EARTH.fillCost);
  return true;
}

/** Tile em terra firme ao lado da obra, de onde o morador trabalha (null = ainda sem acesso: meio do lago). */
export function earthSpot(g: Game, e: Earthwork): { x: number; y: number } | null {
  // sempre de um vizinho (cavando em cima do próprio tile, o morador terminava dentro da água)
  for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]] as const) if (g.world.walkable(e.tx + dx, e.ty + dy)) return { x: tileCenter(e.tx + dx), y: tileCenter(e.ty + dy) };
  return null;
}

/** Faz a obra: troca o tile, refaz a areia em volta, a colisão e o desenho do chão. */
export function finishEarthwork(g: Game, e: Earthwork) {
  const s = g.state;
  s.earthworks = (s.earthworks ?? []).filter((o) => o !== e);
  const i = idx(s, e.tx, e.ty);
  if (e.op === 'fill') s.tiles[i] = T.GRASS;
  else {
    s.tiles[i] = T.WATER;
    if (isRoad(s, e.tx, e.ty)) unpave(g, e.tx, e.ty);
    for (const n of [...s.nodes]) if (n.tx === e.tx && n.ty === e.ty) g.removeNode(n.id);
  }
  reshore(s, e.tx, e.ty);
  fx(g, 'smoke', e.tx * TILE + TILE / 2, e.ty * TILE + TILE / 2, { r: 20, life: 0.8, color: e.op === 'fill' ? '#a88355' : '#7fb8e8' });
  g.world.rebuild();
  g.terrainRev++;
}

/** Areia da margem em volta de (tx, ty): terra colada na água vira areia; areia sem água ao lado vira grama. */
function reshore(s: GameState, tx: number, ty: number) {
  const wet = (x: number, y: number) => inBounds(s, x, y) && s.tiles[idx(s, x, y)] === T.WATER;
  for (let y = ty - 1; y <= ty + 1; y++)
    for (let x = tx - 1; x <= tx + 1; x++) {
      if (!inBounds(s, x, y)) continue;
      const i = idx(s, x, y);
      const t = s.tiles[i];
      if (t === T.WATER || t === T.ROCK || t === T.DIRT) continue;
      const shore = wet(x + 1, y) || wet(x - 1, y) || wet(x, y + 1) || wet(x, y - 1);
      if (shore) s.tiles[i] = T.SAND;
      else if (t === T.SAND) s.tiles[i] = T.GRASS;
    }
}
