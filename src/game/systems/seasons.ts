import { DAY_LENGTH } from '../../config';
import { MOOD, SEASON_DAYS, SEASONS, SNOW, WEATHERS } from '../../data/seasons';
import type { Game } from '../game';
import { isSnowing, moodTarget, rollWeather, seasonOf } from '../mood';

/** Estações e clima (sorteado na virada do dia), felicidade que se aproxima do alvo e emigração de infelizes. */
export function seasonSystem(g: Game, dt: number) {
  const s = g.state;
  s.happiness += (moodTarget(g) - s.happiness) * Math.min(1, dt * 0.05);
  // neve no chão: acumula enquanto neva (no inverno, a tempestade vira nevasca) e derrete devagar
  const season = seasonOf(s);
  if (isSnowing(s)) s.snow = Math.min(1, s.snow + dt / (DAY_LENGTH * SNOW.cover));
  else if (s.snow > 0) {
    const days = season === 'winter' ? SNOW.meltWinter : season === 'spring' ? SNOW.meltSpring : SNOW.meltWarm;
    s.snow = Math.max(0, s.snow - dt / (DAY_LENGTH * days));
  }
  if (s.day === s.moodDay) return;
  s.moodDay = s.day;
  rollWeather(s);
  s.grief = Math.max(0, s.grief - 10);
  const def = SEASONS[seasonOf(s)];
  if ((s.day - 1) % SEASON_DAYS === 0) g.toast(`${def.icon} Começou o ${def.name}! ${def.desc}`, 'info');
  if (s.weather !== 'clear') g.toast(`${WEATHERS[s.weather].icon} Hoje: ${WEATHERS[s.weather].name}. ${WEATHERS[s.weather].desc}`, 'info');
  // vila infeliz: um morador vai embora por dia
  const people = g.villagers();
  if (s.happiness < MOOD.leave && people.length > 2) {
    const u = people[people.length - 1]!;
    u.dead = true;
    g.toast(`{run} ${u.name} foi embora da vila, infeliz. Melhore a comida, as casas ou faça um festival.`, 'danger');
  }
}
