import { MOOD, SEASON_DAYS, SEASONS, WEATHERS } from '../../data/seasons';
import type { Game } from '../game';
import { moodTarget, rollWeather, seasonOf } from '../mood';

/** Estações e clima (sorteado na virada do dia), felicidade que se aproxima do alvo e emigração de infelizes. */
export function seasonSystem(g: Game, dt: number) {
  const s = g.state;
  s.happiness += (moodTarget(g) - s.happiness) * Math.min(1, dt * 0.05);
  if (s.day === s.moodDay) return;
  s.moodDay = s.day;
  rollWeather(s);
  s.grief = Math.max(0, s.grief - 10);
  const season = SEASONS[seasonOf(s)];
  if ((s.day - 1) % SEASON_DAYS === 0) g.toast(`${season.icon} Começou o ${season.name}! ${season.desc}`, 'info');
  if (s.weather !== 'clear') g.toast(`${WEATHERS[s.weather].icon} Hoje: ${WEATHERS[s.weather].name}. ${WEATHERS[s.weather].desc}`, 'info');
  // vila infeliz: um morador vai embora por dia
  const people = g.villagers();
  if (s.happiness < MOOD.leave && people.length > 2) {
    const u = people[people.length - 1]!;
    u.dead = true;
    g.toast(`{run} ${u.name} foi embora da vila, infeliz. Melhore a comida, as casas ou faça um festival.`, 'danger');
  }
}
