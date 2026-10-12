// Campo de Treino: onde cada um treina dentro do campo (só posição e desenho; o ganho é o de progression.ts).
// Os bonecos/alvos são pontos do Editor de cenário (`post1`…`post5` do tipo `training`, px a partir do canto do terreno):
// Taijutsu e Força golpeiam um boneco livre, Velocidade e Stamina correm uma volta por fora deles, o resto (meditar,
// selos, ler) fica num canto livre longe dos bonecos. Sem pontos marcados, o campo inteiro serve (o jeito antigo).
import { TILE } from '../config';
import { rand } from '../core/rng';
import { defOf, layoutKey } from '../data/buildings';
import { layoutPoint } from '../data/layout';
import type { StatKey } from '../data/ninja';
import type { Game } from './game';
import type { Building, Unit } from './types';

export const TRAIN_POSTS = 5;
/** Treinos que golpeiam um boneco e os que correm a volta. */
export const STRIKE_STATS: readonly StatKey[] = ['taijutsu', 'forca'];
export const RUN_STATS: readonly StatKey[] = ['velocidade', 'stamina'];
/** Onde o ninja fica em relação ao boneco que golpeia (px de mundo: à esquerda e um pouco à frente, de lado na tela). */
const STAND = { dx: -15, dy: 9 };
/** Quanto a volta de corrida passa por fora dos bonecos (px). */
const ROUTE_OUT = 16;

/** Bonecos/alvos do campo em px de mundo (os pontos marcados no Editor de cenário). */
export function fieldPosts(b: Building): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let i = 1; i <= TRAIN_POSTS; i++) {
    const p = layoutPoint(layoutKey(b), `post${i}`, b.flip);
    if (p) out.push({ x: b.tx * TILE + p[0], y: b.ty * TILE + p[1] });
  }
  return out;
}

/** Onde ficar para golpear o boneco `i`. */
export const postStand = (post: { x: number; y: number }) => ({ x: post.x + STAND.dx, y: post.y + STAND.dy });

/** Boneco menos usado agora por quem treina neste campo (o primeiro em caso de empate). */
export function freePost(g: Game, u: Unit, b: Building): number | null {
  const posts = fieldPosts(b);
  if (!posts.length) return null;
  const use = posts.map(() => 0);
  for (const o of g.state.units)
    if (o !== u && !o.dead && o.trainId === b.id && o.trainPost != null && (o.state === 'train' || o.state === 'toTrain')) use[o.trainPost] = (use[o.trainPost] ?? 0) + 1;
  let best = 0;
  for (let i = 1; i < posts.length; i++) if (use[i]! < use[best]!) best = i;
  return best;
}

/** Volta de corrida: os bonecos em volta do meio deles, empurrados para fora (null com menos de 3). */
export function fieldRoute(b: Building): { x: number; y: number }[] | null {
  const posts = fieldPosts(b);
  if (posts.length < 3) return null;
  const cx = posts.reduce((a, p) => a + p.x, 0) / posts.length;
  const cy = posts.reduce((a, p) => a + p.y, 0) / posts.length;
  return posts
    .map((p) => {
      const d = Math.hypot(p.x - cx, p.y - cy) || 1;
      return { x: p.x + ((p.x - cx) / d) * ROUTE_OUT, y: p.y + ((p.y - cy) / d) * ROUTE_OUT, a: Math.atan2(p.y - cy, p.x - cx) };
    })
    .sort((p, q) => p.a - q.a)
    .map(({ x, y }) => ({ x, y }));
}

/** Um lugar livre do campo para meditar/ler/fazer selos: longe dos bonecos (e no campo todo sem eles). */
export function quietSpot(g: Game, b: Building): { x: number; y: number } {
  const def = defOf(b);
  const posts = fieldPosts(b);
  let best = { x: (b.tx + def.w / 2) * TILE, y: (b.ty + def.h / 2) * TILE };
  let bestD = -1;
  for (let i = 0; i < 10; i++) {
    const p = { x: (b.tx + rand(0.3, def.w - 0.3)) * TILE, y: (b.ty + rand(0.3, def.h - 0.3)) * TILE };
    if (!g.world.walkablePx(p.x, p.y)) continue;
    const d = posts.length ? Math.min(...posts.map((q) => Math.hypot(q.x - p.x, q.y - p.y))) : 99;
    if (d > bestD) {
      best = p;
      bestD = d;
    }
    if (d > 26) break;
  }
  return best;
}
