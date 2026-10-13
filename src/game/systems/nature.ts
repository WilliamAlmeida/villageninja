import { regrowCleared } from '../clearing';
import type { Game } from '../game';

let acc = 0;

/** Árvores, rochas e veios esgotados crescem de volta aos poucos. */
export function natureSystem(g: Game, dt: number) {
  acc += dt;
  if (acc < 1) return;
  const gone: number[] = [];
  for (const n of g.state.nodes) {
    if (n.regrow == null) continue;
    n.regrow -= acc;
    if (n.regrow <= 0) {
      n.regrow = undefined;
      // arrancado (limpar área): só volta se o lugar continuar livre
      if (n.cleared && !regrowCleared(g, n)) {
        gone.push(n.id);
        continue;
      }
      n.amount = n.max;
    }
  }
  for (const id of gone) g.removeNode(id);
  acc = 0;
  // rocha que rachou, árvore que virou toco, recurso que sumiu: a colisão deles acompanha (Editor de cenário)
  g.world.refreshNodes();
}
