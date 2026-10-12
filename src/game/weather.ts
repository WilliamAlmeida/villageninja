// Nuvens de chuva no mapa: em dia de chuva (ou tempestade fora do inverno) algumas nuvens cruzam o mapa com o vento.
// Só chove embaixo delas, e é lá que valem os efeitos da chuva (colheita, velocidade, natureza mais forte).
import { TILE } from '../config';
import { rand } from '../core/rng';
import { CLOUDS, type Weather } from '../data/seasons';
import type { Cloud, GameState } from './types';

/** O clima do dia é de chuva (a tempestade de inverno é nevasca, que cobre o mapa todo). */
export const rainyDay = (s: GameState, season: string) => s.weather === 'rain' || (s.weather === 'storm' && season !== 'winter');

/** Vento do dia: as nuvens andam todas para o mesmo lado (muda dia a dia). */
const windOf = (s: GameState) => (s.day % 2 ? 1 : -1);

function spawn(s: GameState, inside: boolean): Cloud {
  const r = rand(CLOUDS.rMin, CLOUDS.rMax);
  const w = windOf(s);
  const speed = rand(CLOUDS.speed[0], CLOUDS.speed[1]);
  const W = s.mapW * TILE;
  const H = s.mapH * TILE;
  return {
    x: inside ? rand(0, W) : w > 0 ? -r : W + r,
    y: rand(r * 0.3, H - r * 0.3),
    r,
    vx: speed * w,
    vy: rand(-4, 4),
  };
}

/** Move as nuvens; em dia de chuva mantém a quantidade do dia (começa já espalhadas pelo mapa). */
export function cloudsTick(s: GameState, season: string, dt: number) {
  // a quantidade do dia é para o mapa de 72×48: mapa maior, mais nuvens (a mesma cobertura)
  const area = (s.mapW * s.mapH) / (72 * 48);
  const want = rainyDay(s, season) ? Math.round(CLOUDS.count[s.weather as 'rain' | 'storm'] * area) : 0;
  if (want && !s.clouds.length) for (let i = 0; i < want; i++) s.clouds.push(spawn(s, true));
  for (const c of s.clouds) {
    c.x += c.vx * dt;
    c.y += c.vy * dt;
  }
  // saiu do mapa: some (sem chuva no dia, as nuvens que restam só terminam de passar)
  const W = s.mapW * TILE;
  const H = s.mapH * TILE;
  s.clouds = s.clouds.filter((c) => c.x > -c.r * 1.2 && c.x < W + c.r * 1.2 && c.y > -c.r * 1.2 && c.y < H + c.r * 1.2);
  while (s.clouds.length < want) s.clouds.push(spawn(s, false));
}

/** Está chovendo neste ponto (px de mundo)? */
export function underRain(s: GameState, x: number, y: number) {
  for (const c of s.clouds) if ((c.x - x) ** 2 + (c.y - y) ** 2 < c.r * c.r) return true;
  return false;
}

/** Clima neste ponto: a chuva só vale embaixo das nuvens; neve e nevasca cobrem tudo. */
export function weatherAt(s: GameState, season: string, x: number, y: number): Weather {
  const w = s.weather;
  if (w === 'snow' || (w === 'storm' && season === 'winter')) return w;
  if (underRain(s, x, y)) return w === 'storm' ? 'storm' : 'rain';
  return 'clear';
}
