import type { Game } from '../game';
import { autoEquipAll } from '../gear';

let acc = 0;

/** Equipamento automático: a cada poucos segundos passa o que tem no estoque para quem precisa. */
export function gearSystem(g: Game, dt: number) {
  if (!g.state.flags.autoGear) return;
  acc += dt;
  if (acc < 4) return;
  acc = 0;
  autoEquipAll(g);
}
