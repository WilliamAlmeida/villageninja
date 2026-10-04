import type { Game } from '../game';

export function effectSystem(g: Game, dt: number) {
  const fx = g.state.effects;
  let w = 0;
  for (let i = 0; i < fx.length; i++) {
    const e = fx[i]!;
    e.t += dt;
    if (e.t < e.life) fx[w++] = e;
  }
  fx.length = w;
}
