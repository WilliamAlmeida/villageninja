import { colonyDay, colonyGame } from '../colonies';
import type { Game } from '../game';

/**
 * Colônias (game/colonies.ts): a que está na tela (`Game.activeColony`, posto pelo main) roda em detalhe no mesmo
 * relógio da vila; as outras recebem o resumo por dia na virada do dia, como a região.
 */
export function colonySystem(home: Game, dt: number) {
  const s = home.state;
  const cols = s.colonies;
  if (!cols) return;
  for (const id of Object.keys(cols)) {
    const c = cols[id]!;
    const cg = colonyGame(home, id)!;
    c.level = s.level;
    if (home.activeColony === id) {
      c.time = s.time;
      c.day = s.day;
      c.weather = s.weather;
      c.snow = s.snow;
      c.pace = s.pace;
      cg.step(dt);
      c.colony!.day = s.day; // o dia de hoje já está sendo vivido em detalhe: sem resumo por cima
      continue;
    }
    while (c.colony!.day < s.day) {
      c.colony!.day++;
      colonyDay(home, id, c.colony!.day);
    }
  }
}
