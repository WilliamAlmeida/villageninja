import type { Game } from '../game';

let acc = 0;

/** Árvores, rochas e veios esgotados crescem de volta aos poucos. */
export function natureSystem(g: Game, dt: number) {
  acc += dt;
  if (acc < 1) return;
  for (const n of g.state.nodes) {
    if (n.regrow == null) continue;
    n.regrow -= acc;
    if (n.regrow <= 0) {
      n.regrow = undefined;
      n.amount = n.max;
    }
  }
  acc = 0;
}
