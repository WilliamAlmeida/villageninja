// Estações, clima e felicidade dos moradores (e festivais). Valores derivados; o sistema atualiza o clima do dia e
// aproxima a felicidade do alvo aos poucos.
import { weightedPick } from '../core/rng';
import { FAME } from '../data/region';
import { FESTIVAL, SEASON_DAYS, SEASON_ORDER, SEASONS, WEATHERS, type Season } from '../data/seasons';
import type { Nature } from '../data/natures';
import type { Game } from './game';
import type { GameState } from './types';

type Result = { ok: true } | { ok: false; error: string };

export const seasonOf = (s: GameState): Season => SEASON_ORDER[Math.floor((s.day - 1) / SEASON_DAYS) % 4]!;
/** Dias que faltam para a próxima estação. */
export const daysToNextSeason = (s: GameState) => SEASON_DAYS - ((s.day - 1) % SEASON_DAYS);

/** Multiplicador da colheita (estação × clima). */
export const harvestMult = (s: GameState) => SEASONS[seasonOf(s)].harvest * WEATHERS[s.weather].harvest;
/** Multiplicador do consumo de comida. */
export const foodMult = (s: GameState) => SEASONS[seasonOf(s)].food;
/** Multiplicador da velocidade de quem anda. */
export const weatherSpeed = (s: GameState) => WEATHERS[s.weather].speed;
/** Bônus de dano da natureza no clima atual. */
export const natureWeather = (s: GameState, n: Nature | null) => (n && WEATHERS[s.weather].boost.includes(n) ? 1.2 : 1);

export const festivalOn = (s: GameState) => s.festivalUntil > s.day || (s.festivalUntil === s.day && s.festivalUntil > 0);

/** Cada fator que mexe na felicidade (rótulo, pontos) — o painel mostra a lista. */
export function moodFactors(g: Game): [string, number][] {
  const s = g.state;
  const out: [string, number][] = [['Base', 55]];
  const pop = g.population();
  const cap = g.popCap();
  if (s.flags.starving) out.push(['Fome', -35]);
  else if (s.res.food < pop * 3) out.push(['Pouca comida guardada', -10]);
  else out.push(['Comida farta', 6]);
  if (pop > cap) out.push(['Casas lotadas', -15]);
  else if (cap - pop >= 2) out.push(['Casas com espaço', 5]);
  if (s.flags.alert) out.push(['Inimigos na vila', -12]);
  if (s.grief > 0) out.push(['Luto pelos mortos', -Math.round(s.grief)]);
  const season = SEASONS[seasonOf(s)];
  if (season.mood) out.push([season.name, season.mood]);
  if (festivalOn(s)) out.push(['Festival', FESTIVAL.mood]);
  if (s.honor >= FAME.wanderer) out.push(['Orgulho da honra da vila', 5]);
  if (s.infamy >= FAME.hunters) out.push(['Medo da fama de saqueadores', -5]);
  if (s.kageId != null) out.push(['Um Kage governa', 4]);
  return out;
}

export const moodTarget = (g: Game) => Math.max(0, Math.min(100, moodFactors(g).reduce((a, [, v]) => a + v, 0)));

/** Felicidade 0–100 → velocidade do trabalho dos moradores (0,75× a 1,25×). */
export const workMult = (s: GameState) => 0.75 + s.happiness / 200;
/** Felicidade → frequência de nascimentos (mais feliz, mais filhos). */
export const birthMult = (s: GameState) => 0.5 + s.happiness / 100;

/** Sorteia o clima do dia (muda na virada). */
export function rollWeather(s: GameState) {
  s.weather = weightedPick(SEASONS[seasonOf(s)].weather, ([, w]) => w)![0];
}

export function festivalBlock(g: Game): string | null {
  const s = g.state;
  if (festivalOn(s)) return 'Já tem um festival acontecendo.';
  if (s.festivalDay && s.day - s.festivalDay < FESTIVAL.every) return `O último festival foi há pouco. Próximo a partir do dia ${s.festivalDay + FESTIVAL.every}.`;
  return null;
}

/** Faz o festival da estação: custa comida e ryo, deixa todos felizes até o fim do dia seguinte. */
export function holdFestival(g: Game): Result {
  const why = festivalBlock(g);
  if (why) return { ok: false, error: why };
  if (!g.pay(FESTIVAL.cost)) return { ok: false, error: 'Recursos insuficientes.' };
  const s = g.state;
  s.festivalDay = s.day;
  s.festivalUntil = s.day + FESTIVAL.days;
  g.toast(`{party} ${SEASONS[seasonOf(s)].festival}! Lanternas, comida e música: a vila está em festa.`, 'good');
  return { ok: true };
}
