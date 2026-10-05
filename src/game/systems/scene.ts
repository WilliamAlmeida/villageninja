import type { Game } from '../game';
import { sceneGame, sceneTick } from '../scene';

/** Na vila: o mapa de missão em andamento roda junto, no mesmo passo (mesma hora, dia e clima). */
export function sceneRunSystem(g: Game, dt: number) {
  const sg = sceneGame(g);
  if (!sg) return;
  const s = sg.state;
  s.time = g.state.time;
  s.day = g.state.day;
  // dentro da caverna não chove nem neva
  const cave = s.sceneInfo?.kind === 'mine' || s.sceneInfo?.kind === 'hideout';
  s.weather = cave ? 'clear' : g.state.weather;
  s.snow = cave ? 0 : g.state.snow;
  s.pace = g.state.pace;
  sg.step(dt);
}

/** Mapa de missão: confere o objetivo (vitória, derrota). */
export function sceneSystem(g: Game, dt: number) {
  sceneTick(g, dt);
}
