// Rebrota e limpeza de terreno. Árvore/rocha/veio esgotado vira toco/rocha rachada e volta inteiro com o tempo
// (systems/nature.ts); quanto maior a vila, mais devagar (no começo a vila depende disso, no meio e no fim o mato
// voltava rápido demais). O jogador pode mandar LIMPAR uma área (modo "Limpar área" da barra de construção): marca
// árvores, tocos, rochas e veios; os moradores sem obra vão lá e arrancam (o que ainda estava de pé rende o que
// sobrava), e o lugar fica limpo (sem desenho nem colisão) por bem mais tempo antes de brotar de novo.
import { TILE } from '../config';
import { REGROW } from '../data/regrow';
import { RES_INFO, type ResKey } from '../data/resources';
import { fx, fxText } from './fx';
import type { Game } from './game';
import { isRoad } from './roads';
import type { GameState, ResourceNode } from './types';

export const CLEAR = {
  /** Segundos de trabalho de um morador para arrancar um recurso. */
  work: 5,
  /** Recurso arrancado leva esse tanto de vezes o tempo normal de rebrota para voltar. */
  regrowMult: 4,
  /** Tempo de rebrota pelo nível da vila (Aldeia, Vila, Vila Oculta, Grande Vila Oculta). */
  levelMult: [1, 2, 3, 4],
};

/** O que cada recurso arrancado ainda de pé rende (o que sobrava nele). */
const CLEAR_YIELD: Record<ResourceNode['type'], ResKey | null> = { tree: 'wood', rock: 'stone', ore: 'iron', herb: 'herbs' };

/** Segundos para um recurso esgotado voltar inteiro, pelo nível da vila. */
export function regrowTime(s: GameState, type: ResourceNode['type']): number {
  const base = REGROW[type] ?? 0;
  return base * (CLEAR.levelMult[Math.max(0, Math.min(CLEAR.levelMult.length - 1, s.level ?? 0))] ?? 1);
}

/** Recurso no tile (o de pé ou o toco; não o já arrancado). */
export const nodeAt = (s: GameState, tx: number, ty: number) => s.nodes.find((n) => n.tx === tx && n.ty === ty && !n.cleared);

/** Marca (ou desmarca) para limpar os recursos num raio de `r` tiles em volta de (tx, ty). Devolve quantos mudaram. */
export function markClear(g: Game, tx: number, ty: number, on: boolean, r = 1): number {
  let n = 0;
  for (const node of g.state.nodes) {
    if (node.cleared || Math.abs(node.tx - tx) > r || Math.abs(node.ty - ty) > r) continue;
    if (!!node.clear === on) continue;
    if (on) node.clear = true;
    else delete node.clear;
    n++;
  }
  return n;
}

/** Recursos marcados esperando um morador. */
export const toClear = (s: GameState) => s.nodes.filter((n) => n.clear && !n.cleared);

/** Arranca o recurso: rende o que sobrava, some do mapa e fica limpo até a rebrota longa. */
export function clearNode(g: Game, n: ResourceNode) {
  const res = CLEAR_YIELD[n.type];
  const x = n.tx * TILE + TILE / 2;
  const y = n.ty * TILE + TILE / 2;
  if (res && n.amount > 0) {
    g.state.res[res] += n.amount;
    fxText(g, x, y - 20, `${RES_INFO[res].icon} +${n.amount}`, '#ffe08a');
  }
  fx(g, 'smoke', x, y, { r: 20, life: 0.9, color: '#b8a888' });
  n.amount = 0;
  n.cleared = true;
  delete n.clear;
  n.regrow = regrowTime(g.state, n.type) * CLEAR.regrowMult;
}

/**
 * Fim da rebrota de um recurso arrancado: volta inteiro se o tile continuar livre; com prédio ou rua em cima, sai do
 * mapa de vez (a vila tomou o lugar). Devolve false se o recurso deve ser removido.
 */
export function regrowCleared(g: Game, n: ResourceNode): boolean {
  if (g.world.buildingIdAt(n.tx, n.ty) || isRoad(g.state, n.tx, n.ty)) return false;
  delete n.cleared;
  return true;
}
