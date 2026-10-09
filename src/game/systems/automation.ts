import { autoCraftTick, autoSenseiTick, autoTeachTick } from '../automation';
import { enforceTeamRules } from '../teams';
import { autoRepairTick } from '../wear';
import { releaseSanninDogs } from '../ninken';
import type { Game } from '../game';

let acc = 0;

/** Automação da vila grande (a cada 2 s): oficinas repõem estoque, Academia ensina, equipes ganham sensei. */
export function automationSystem(g: Game, dt: number) {
  acc += dt;
  if (acc < 2) return;
  acc = 0;
  enforceTeamRules(g); // Kage sem equipe; ANBU e Sannin só entre si (conserta também saves antigos)
  releaseSanninDogs(g); // Sannin não fica com ninken
  autoCraftTick(g);
  autoRepairTick(g); // Forja nv 2+: conserta quem passa pela vila
  if (g.state.flags.autoTeach) autoTeachTick(g);
  if (g.state.flags.autoSensei) autoSenseiTick(g);
}
