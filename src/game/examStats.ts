// Estatísticas de desempenho no Exame Chunin (sem dependências, usado pelo combate).
import type { GameState } from './types';

function entrant(s: GameState, id: number | undefined) {
  return id == null ? undefined : s.exam?.entrants.find((e) => e.id === id);
}

export function recordDuelDamage(s: GameState, attackerId: number | undefined, dmg: number) {
  const e = entrant(s, attackerId);
  if (e) e.dmg += dmg;
}

export function recordDuelJutsu(s: GameState, casterId: number) {
  const e = entrant(s, casterId);
  if (e) e.jutsus++;
}
