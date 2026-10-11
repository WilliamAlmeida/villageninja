import type { Game } from '../game';

export function effectSystem(g: Game, dt: number) {
  const fx = g.state.effects;
  let w = 0;
  for (let i = 0; i < fx.length; i++) {
    const e = fx[i]!;
    e.t += dt;
    // sombra do Kage Mane: segue os dois e some se um deles cair
    if (e.kind === 'tether') {
      const a = g.unit(e.uid);
      const b = g.unit(e.tid);
      if (!a || !b || a.dead || b.dead) e.t = e.life;
      else Object.assign(e, { x: a.x, y: a.y, x2: b.x, y2: b.y });
    }
    if (e.t < e.life) fx[w++] = e;
  }
  fx.length = w;
}
