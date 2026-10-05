import { autoCraftTick, autoSenseiTick, autoTeachTick } from '../automation';
import type { Game } from '../game';

let acc = 0;

/** Automação da vila grande (a cada 2 s): oficinas repõem estoque, Academia ensina, equipes ganham sensei. */
export function automationSystem(g: Game, dt: number) {
  acc += dt;
  if (acc < 2) return;
  acc = 0;
  autoCraftTick(g);
  if (g.state.flags.autoTeach) autoTeachTick(g);
  if (g.state.flags.autoSensei) autoSenseiTick(g);
}
