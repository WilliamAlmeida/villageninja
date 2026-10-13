// A luta marca o cenário (pedido do autor): jutsu em área e projétil que explode perto de árvores e rochas também as
// acertam. A árvore perde madeira com o golpe e, esgotada, vira toco (golpe muito forte a arranca: some por um tempo);
// fogo (Katon) a põe para queimar: chamas por alguns segundos, pode pegar nas árvores vizinhas, e sobra o toco
// queimado, que demora mais para rebrotar; água (Suiton) e chuva apagam. A rocha e o veio só racham e quebram.
// Nada disso rende recurso para a vila (o que voou com o golpe se perdeu).
import { TILE } from '../config';
import { chance } from '../core/rng';
import type { Nature } from '../data/natures';
import { regrowTime } from './clearing';
import { fx } from './fx';
import type { Game } from './game';
import type { ResourceNode } from './types';
import { underRain } from './weather';

export const SCARS = {
  /** Fração do dano do golpe que sai do recurso (árvore 25, rocha 40 de "vida"). */
  treeHit: 0.25,
  rockHit: 0.3,
  /** Golpe que tira mais que isto × o máximo de uma vez arranca a árvore (some, rebrota ×2). */
  blowAway: 1.5,
  /** Segundos que uma árvore queima. */
  burn: 7,
  /** Chance por segundo de cada árvore vizinha (até 1,6 tile) pegar fogo enquanto uma queima (~16% na queima toda: o fogo anda, mas não engole a floresta). */
  spread: 0.025,
  /** Rebrota do toco queimado e da árvore arrancada, × a normal. */
  scarRegrow: 2,
};

const center = (n: ResourceNode) => ({ x: n.tx * TILE + TILE / 2, y: n.ty * TILE + TILE / 2 });

/** Golpe em área em (x, y) de raio r: árvores e rochas dentro levam o seu quinhão. */
export function scarArea(g: Game, x: number, y: number, r: number, dmg: number, nature: Nature | null) {
  if (dmg <= 0 || r <= 0) return;
  for (const n of g.state.nodes) {
    if (n.cleared) continue;
    const c = center(n);
    const d = Math.hypot(c.x - x, c.y - y);
    if (d > r + 10) continue;
    const k = 1 - (0.4 * Math.min(d, r)) / r;
    if (n.type === 'tree') hitTree(g, n, dmg * k, nature);
    else if (n.type === 'rock' || n.type === 'ore') hitRock(g, n, dmg * k);
  }
}

function hitTree(g: Game, n: ResourceNode, dmg: number, nature: Nature | null) {
  const c = center(n);
  if (nature === 'suiton') {
    if (n.burn) {
      delete n.burn;
      fx(g, 'smoke', c.x, c.y - 18, { r: 16, life: 0.8, color: '#d8dde2' });
    }
    return;
  }
  if (n.amount <= 0) return; // toco: o golpe não muda nada
  const loss = dmg * SCARS.treeHit;
  if (loss >= n.max * SCARS.blowAway) {
    // golpe enorme: a árvore voa longe (some e demora a voltar)
    fx(g, 'chips', c.x, c.y - 10, { color: '#a0784a', life: 0.6 });
    fx(g, 'smoke', c.x, c.y, { r: 20, life: 0.8, color: '#b8a888' });
    n.amount = 0;
    n.cleared = true;
    delete n.clear;
    delete n.burn;
    n.regrow = regrowTime(g.state, 'tree') * SCARS.scarRegrow;
    return;
  }
  n.amount = Math.max(0, n.amount - loss);
  fx(g, 'chips', c.x, c.y - 12, { color: '#a0784a', life: 0.4 });
  if (nature === 'katon' && !n.burn) ignite(g, n);
  else if (n.amount <= 0) n.regrow = regrowTime(g.state, 'tree');
}

function hitRock(g: Game, n: ResourceNode, dmg: number) {
  if (n.amount <= 0) return;
  const c = center(n);
  n.amount = Math.max(0, n.amount - dmg * SCARS.rockHit);
  fx(g, 'chips', c.x, c.y - 4, { color: '#bfbfbf', life: 0.45 });
  if (n.amount <= 0) {
    // quebrou: some numa nuvem de poeira (ficam as pedrinhas) e volta com a rebrota de sempre
    fx(g, 'smoke', c.x, c.y, { r: 22, life: 0.9, color: '#b8b4ac' });
    n.regrow = regrowTime(g.state, n.type);
  }
}

/** Põe fogo na árvore (de pé). */
export function ignite(g: Game, n: ResourceNode) {
  if (n.type !== 'tree' || n.cleared || n.amount <= 0) return;
  n.burn = SCARS.burn;
  const c = center(n);
  fx(g, 'burst', c.x, c.y - 22, { r: 14, color: '#ff7a2a', life: 0.5, vfx: 'fire' });
}

/** A cada segundo (sistema da natureza): árvores queimando perdem madeira, soltam fogo e fumaça e podem passar o fogo. */
export function burnTick(g: Game, dt: number) {
  const s = g.state;
  const burning = s.nodes.filter((n) => n.burn);
  for (const n of burning) {
    const c = center(n);
    // chuva por cima apaga
    if (underRain(s, c.x, c.y)) {
      delete n.burn;
      fx(g, 'smoke', c.x, c.y - 18, { r: 16, life: 0.8, color: '#d8dde2' });
      continue;
    }
    n.burn! -= dt;
    n.amount = Math.max(0, n.amount - (n.max / SCARS.burn) * dt);
    fx(g, 'burst', c.x + (Math.random() - 0.5) * 12, c.y - 18 - Math.random() * 20, { r: 9, color: '#ff8a2a', life: 0.6, vfx: 'fire' });
    fx(g, 'smoke', c.x, c.y - 40, { r: 12, life: 1.2, color: '#5a5048' });
    for (const o of s.nodes)
      if (o !== n && o.type === 'tree' && !o.burn && !o.cleared && o.amount > 0 && Math.hypot(o.tx - n.tx, o.ty - n.ty) <= 1.6 && chance(SCARS.spread * dt)) ignite(g, o);
    if (n.burn! <= 0 || n.amount <= 0) {
      // sobra o toco queimado, que demora mais para rebrotar
      delete n.burn;
      n.amount = 0;
      n.regrow = regrowTime(s, 'tree') * SCARS.scarRegrow;
      fx(g, 'smoke', c.x, c.y - 10, { r: 20, life: 1.2, color: '#4a4440' });
    }
  }
}
