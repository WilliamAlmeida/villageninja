import { DAY_LENGTH } from '../../config';
import { levelDef } from '../../data/villageLevels';
import type { Game } from '../game';

export function timeSystem(g: Game, dt: number) {
  const s = g.state;
  const prev = s.day;
  s.time += dt;
  s.day = Math.floor(s.time / DAY_LENGTH) + 1;
  if (s.day !== prev) onNewDay(g);
}

function onNewDay(g: Game) {
  const villagers = g.state.units.filter((u) => !u.dead && u.kind === 'villager').length;
  const tax = villagers * levelDef(g.state.level).tax;
  g.state.res.ryo += tax;
  g.toast(`☀ Dia ${g.state.day} — impostos: +${tax} 💰`, 'info');
}
