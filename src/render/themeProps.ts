// Enfeites dos mapas temáticos (só desenho, fora do estado): barcos, redes e peixe secando na Vila dos Pescadores;
// palmeiras, poço, tendas, cactos e potes na Cidade dos Mercadores. Espalhados pela semente do mapa, longe dos prédios.
// Arte: atlas src/art/theme-props.png (scripts/theme-art.py; mesma ordem de THEME_PROPS).
import { MAP_W, TILE } from '../config';
import { mulberry32 } from '../core/rng';
import { BUILDINGS } from '../data/buildings';
import type { GameState } from '../game/types';
import { CENTER_TX, CENTER_TY, idx, inBounds, T } from '../game/world';
import { art, smoothIfShrunk } from './art';

type Ctx = CanvasRenderingContext2D;

/** Na ordem do atlas (scripts/theme-art.py → PROPS); `h` = altura no mundo (px), `water` = flutua (sem sombra). */
export const THEME_PROPS: { name: string; h: number; water?: boolean }[] = [
  { name: 'boat', h: 40, water: true },
  { name: 'boat-small', h: 24, water: true },
  { name: 'nets', h: 34 },
  { name: 'fish-rack', h: 26 },
  { name: 'barrels', h: 26 },
  { name: 'lantern-pole', h: 42 },
  { name: 'palm', h: 74 },
  { name: 'palm-small', h: 42 },
  { name: 'well', h: 34 },
  { name: 'tent', h: 40 },
  { name: 'cactus', h: 36 },
  { name: 'pots', h: 24 },
];
const P = Object.fromEntries(THEME_PROPS.map((p, i) => [p.name, i])) as Record<string, number>;

export interface ThemeDeco {
  prop: number;
  x: number;
  y: number;
  flip: boolean;
}

const cache = new WeakMap<GameState, ThemeDeco[]>();

/** Enfeites do tema (o mesmo mapa dá sempre os mesmos); vazio fora dos mapas temáticos. */
export function themeDecos(s: GameState): ThemeDeco[] {
  const theme = s.sceneInfo?.theme;
  if (!theme) return [];
  const hit = cache.get(s);
  if (hit) return hit;
  const rnd = mulberry32(s.seed ^ 0x51ed);
  const tile = (tx: number, ty: number) => (inBounds(tx, ty) ? s.tiles[idx(tx, ty)] : T.ROCK);
  // prédios (com um tile de folga), recursos e a chegada da equipe ficam livres
  const busy = new Set<number>(s.nodes.map((n) => idx(n.tx, n.ty)));
  for (const b of s.buildings) {
    const d = BUILDINGS[b.type];
    for (let y = b.ty - 1; y <= b.ty + d.h; y++) for (let x = b.tx - 1; x <= b.tx + d.w; x++) if (inBounds(x, y)) busy.add(idx(x, y));
  }
  const near = (tx: number, ty: number, t: number) => [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dx, dy]) => tile(tx + dx!, ty + dy!) === t);
  const nearBuilding = (tx: number, ty: number) =>
    s.buildings.some((b) => tx >= b.tx - 2 && tx <= b.tx + BUILDINGS[b.type].w + 1 && ty >= b.ty - 2 && ty <= b.ty + BUILDINGS[b.type].h + 1);
  const pick = (list: [string, number][]) => {
    let r = rnd();
    for (const [n, w] of list) if ((r -= w) < 0) return P[n]!;
    return null;
  };
  const entry = s.sceneInfo!.entry;
  const out: ThemeDeco[] = [];
  let well = theme !== 'desert';
  for (let i = 0; i < s.tiles.length; i++) {
    const tx = i % MAP_W;
    const ty = Math.floor(i / MAP_W);
    if (busy.has(i) || Math.hypot(tx * TILE - entry.x, ty * TILE - entry.y) < TILE * 3) continue;
    const t = s.tiles[i];
    let prop: number | null = null;
    if (theme === 'fishing') {
      if (t === T.WATER && near(tx, ty - 1, T.SAND)) prop = pick([['boat', 0.06], ['boat-small', 0.08]]);
      else if (t === T.SAND && near(tx, ty, T.WATER)) prop = pick([['nets', 0.06], ['fish-rack', 0.06], ['barrels', 0.05], ['lantern-pole', 0.04]]);
      else if (t === T.SAND) prop = pick([['barrels', 0.02], ['fish-rack', 0.02]]);
    } else if (t === T.SAND || t === T.DIRT) {
      if (!well && Math.abs(tx - CENTER_TX - 3) <= 1 && Math.abs(ty - CENTER_TY - 3) <= 1) {
        prop = P.well!;
        well = true;
      } else if (nearBuilding(tx, ty)) prop = pick([['pots', 0.07], ['tent', 0.015]]);
      else prop = pick([['palm', 0.028], ['palm-small', 0.02], ['cactus', 0.012], ['tent', 0.004]]);
    } else if (t !== T.WATER && t !== T.ROCK && near(tx, ty, T.WATER)) prop = pick([['palm', 0.5]]); // palmeiras no oásis
    if (prop == null) continue;
    out.push({ prop, x: tx * TILE + TILE / 2 + (rnd() - 0.5) * 10, y: ty * TILE + TILE / 2 + (rnd() - 0.5) * 10, flip: rnd() < 0.5 });
  }
  cache.set(s, out);
  return out;
}

/** Desenha um enfeite com a base em (x, y) da cena. */
export function drawThemeDeco(ctx: Ctx, d: ThemeDeco, x: number, y: number) {
  const atlas = art('theme-props');
  if (!atlas) return;
  const def = THEME_PROPS[d.prop]!;
  const cell = atlas.naturalHeight;
  const k = def.h / cell;
  const w = cell * k;
  ctx.save();
  smoothIfShrunk(ctx, w, cell);
  ctx.translate(x, y);
  if (d.flip) ctx.scale(-1, 1);
  if (!def.water) {
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(0, -1, w * 0.28, w * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.drawImage(atlas, d.prop * cell, 0, cell, cell, -w / 2, -w + (def.water ? w * 0.15 : 0), w, w);
  ctx.restore();
}
