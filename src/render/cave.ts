// Enfeites dos andares da mina (só desenho, fora do estado): estalagmites, cristais e cogumelos que brilham, poças,
// ossos, carrinho, escoras com lanterna, tochas e caixotes, espalhados pela caverna a partir da semente do mapa.
// Arte: atlas src/art/props/cave-props.png (scripts/cave-props.py; mesma ordem de CAVE_PROPS).
import { MAP_W, TILE } from '../config';
import { project } from '../core/iso';
import { mulberry32 } from '../core/rng';
import type { GameState } from '../game/types';
import { idx, inBounds, T } from '../game/world';
import { art, smoothIfShrunk } from './art';

type Ctx = CanvasRenderingContext2D;

interface PropDef {
  name: string;
  /** Altura no mundo (px). */
  h: number;
  /** Deitado no chão (desenhado antes de todo mundo). */
  flat?: boolean;
  /** Luz própria na escuridão: cor (com A no lugar da opacidade), altura da fonte e raio. */
  glow?: [string, number, number];
}

/** Na ordem do atlas (scripts/cave-props.py → PROPS). */
export const CAVE_PROPS: PropDef[] = [
  { name: 'stalagmites', h: 48 },
  { name: 'stalagmites-small', h: 25 },
  { name: 'crystal-blue', h: 31, glow: ['rgba(90,170,255,A)', 10, 46] },
  { name: 'crystal-orange', h: 31, glow: ['rgba(255,150,60,A)', 10, 46] },
  { name: 'mushroom-purple', h: 25, glow: ['rgba(200,90,255,A)', 8, 38] },
  { name: 'mushroom-blue', h: 20, glow: ['rgba(80,220,255,A)', 6, 32] },
  { name: 'pool', h: 22, flat: true },
  { name: 'bones', h: 17, flat: true },
  { name: 'cart', h: 31 },
  { name: 'support', h: 50, glow: ['rgba(255,180,90,A)', 26, 60] },
  { name: 'torch', h: 36, glow: ['rgba(255,150,60,A)', 22, 64] },
  { name: 'crates', h: 34, glow: ['rgba(255,180,90,A)', 18, 40] },
];
const P = Object.fromEntries(CAVE_PROPS.map((p, i) => [p.name, i])) as Record<string, number>;

export interface CaveDeco {
  prop: number;
  x: number;
  y: number;
  flip: boolean;
}

const cache = new WeakMap<GameState, CaveDeco[]>();

/** Enfeites da caverna (o mesmo mapa dá sempre os mesmos); vazio fora de mina. */
export function caveDecos(s: GameState): CaveDeco[] {
  if (s.sceneInfo?.kind !== 'mine') return [];
  const hit = cache.get(s);
  if (hit) return hit;
  const rnd = mulberry32(s.seed ^ 0xc4e5);
  const rock = (tx: number, ty: number) => !inBounds(tx, ty) || s.tiles[idx(tx, ty)] === T.ROCK;
  const taken = new Set<number>([...s.nodes.map((n) => idx(n.tx, n.ty)), ...s.sites.map((x) => idx(x.tx, x.ty))]);
  const entry = s.sceneInfo.entry;
  const out: CaveDeco[] = [];
  const pick = (list: [string, number][]) => {
    let r = rnd();
    for (const [n, w] of list) if ((r -= w) < 0) return P[n]!;
    return null;
  };
  const W = MAP_W;
  for (let i = 0; i < s.tiles.length; i++) {
    if (s.tiles[i] === T.ROCK || taken.has(i)) continue;
    const tx = i % W;
    const ty = Math.floor(i / W);
    if (entry && Math.hypot(tx * TILE + TILE / 2 - entry.x, ty * TILE + TILE / 2 - entry.y) < TILE * 2.5) continue;
    // encostado na parede: o que cresce da rocha; no meio da galeria: o que fica no chão
    const walls = [[-1, 0], [1, 0], [0, -1], [0, 1]].filter(([dx, dy]) => rock(tx + dx!, ty + dy!));
    const prop = walls.length
      ? pick([['stalagmites', 0.05], ['crystal-blue', 0.025], ['crystal-orange', 0.018], ['mushroom-purple', 0.025], ['mushroom-blue', 0.025], ['support', 0.012], ['torch', 0.008]])
      : pick([['stalagmites-small', 0.012], ['pool', 0.006], ['bones', 0.007], ['cart', 0.003], ['crates', 0.003]]);
    if (prop == null) continue;
    // empurra para a parede (a escora e a tocha ficam na parede; o resto meio de lado)
    const [wx, wy] = walls.length ? walls[Math.floor(rnd() * walls.length)]! : [0, 0];
    const push = walls.length ? TILE * 0.32 : 0;
    out.push({ prop, x: tx * TILE + TILE / 2 + wx! * push + (rnd() - 0.5) * 8, y: ty * TILE + TILE / 2 + wy! * push + (rnd() - 0.5) * 8, flip: rnd() < 0.5 });
  }
  cache.set(s, out);
  return out;
}

/** Desenha um enfeite com a base em (x, y) da cena. */
export function drawCaveDeco(ctx: Ctx, d: CaveDeco, x: number, y: number) {
  const atlas = art('cave-props');
  if (!atlas) return;
  const def = CAVE_PROPS[d.prop]!;
  const cell = atlas.naturalHeight;
  const k = def.h / cell; // a casa inteira vale a altura do enfeite (o desenho encosta embaixo)
  const w = cell * k;
  ctx.save();
  smoothIfShrunk(ctx, w, cell);
  ctx.translate(x, y);
  if (d.flip) ctx.scale(-1, 1);
  if (!def.flat) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, -1, w * 0.3, w * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.drawImage(atlas, d.prop * cell, 0, cell, cell, -w / 2, def.flat ? -w * 0.7 : -w, w, w);
  ctx.restore();
}

/** Enfeites deitados no chão (poça, ossos), em coordenadas da cena, antes dos que ficam em pé. */
export function drawCaveFlat(ctx: Ctx, s: GameState, seen: (tx: number, ty: number) => boolean) {
  for (const d of caveDecos(s)) {
    if (!CAVE_PROPS[d.prop]!.flat || !seen(Math.floor(d.x / TILE), Math.floor(d.y / TILE))) continue;
    const p = project(d.x, d.y);
    drawCaveDeco(ctx, d, p.x, p.y);
  }
}
