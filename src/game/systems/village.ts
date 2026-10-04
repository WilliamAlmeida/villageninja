import type { Game } from '../game';
import type { GameState } from '../types';
import { nextLevelStatus } from '../village';

// estado efêmero por partida (não precisa ir para o save)
const notified = new WeakMap<GameState, { acc: number; level: number }>();

/** Avisa (uma vez por nível) quando a vila cumpre os requisitos para evoluir. */
export function villageSystem(g: Game, dt: number) {
  let n = notified.get(g.state);
  if (!n) notified.set(g.state, (n = { acc: 0, level: g.state.level }));
  n.acc += dt;
  if (n.acc < 2) return;
  n.acc = 0;
  const st = nextLevelStatus(g);
  if (!st || !st.ready || n.level >= st.def.level) return;
  n.level = st.def.level;
  g.toast(`{castle} A vila pode evoluir para ${st.def.name}! Toque em {castle} Vila.`, 'good');
}
