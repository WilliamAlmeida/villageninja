// Projeção isométrica (2:1). A simulação continua num plano ortogonal em px de "mundo";
// só o desenho e os cliques passam por aqui. "Cena" = plano já projetado, antes de zoom/câmera.
import { TILE } from '../config';

/** Escala mundo → cena: um tile de 32 px vira um losango de 48×24. */
export const ISO_K = 0.75;

export const project = (wx: number, wy: number) => ({ x: (wx - wy) * ISO_K, y: ((wx + wy) * ISO_K) / 2 });
export const unproject = (sx: number, sy: number) => ({ x: (sy + sx / 2) / ISO_K, y: (sy - sx / 2) / ISO_K });

/** Ângulo de um vetor do mundo depois de projetado (para virar sprites e projéteis). */
export const projectAngle = (a: number) => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return Math.atan2((c + s) / 2, c - s);
};

/** Caixa que contém o mapa inteiro (mapW×mapH tiles) na cena. */
export function sceneBox(m: { mapW: number; mapH: number }) {
  const W = m.mapW * TILE;
  const H = m.mapH * TILE;
  return { minX: -H * ISO_K, maxX: W * ISO_K, minY: 0, maxY: ((W + H) * ISO_K) / 2 };
}

/** Aplica ao canvas a transformação "chão": desenhar em coordenadas de mundo cai deitado no plano isométrico. */
export const groundTransform = (ctx: CanvasRenderingContext2D) => ctx.transform(ISO_K, ISO_K / 2, -ISO_K, ISO_K / 2, 0, 0);
