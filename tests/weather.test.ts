import { describe, expect, test } from 'bun:test';
import { DAY_LENGTH, SAVE_VERSION, SIM_DT } from '../src/config';
import type { Game } from '../src/game/game';
import { harvestMult, natureWeather, weatherSpeed } from '../src/game/mood';
import { createNewGame } from '../src/game/newGame';
import { migrate } from '../src/game/save';
import { SYSTEMS } from '../src/game/systems';
import { underRain } from '../src/game/weather';

/** Avança o jogo sem trocar de dia (o clima só é sorteado na virada). */
const run = (g: Game, seconds: number) => {
  for (let t = 0; t < seconds; t += SIM_DT) {
    g.state.time = DAY_LENGTH * (g.state.day - 1) + 30;
    g.step(SIM_DT);
  }
};
const rainyGame = (seed: number) => {
  const g = createNewGame(SYSTEMS, seed);
  g.state.moodDay = g.state.day; // sem novo sorteio
  g.state.weather = 'rain';
  run(g, SIM_DT * 2);
  return g;
};

describe('nuvens de chuva', () => {
  test('em dia de chuva nuvens cruzam o mapa e só chove embaixo delas', () => {
    const g = rainyGame(601);
    const s = g.state;
    expect(s.clouds.length).toBe(3);
    const c = s.clouds[0]!;
    expect(underRain(s, c.x, c.y)).toBe(true);
    s.clouds = [c];
    expect(underRain(s, c.x + c.r * 1.5, c.y)).toBe(false);
    const x0 = c.x;
    run(g, 5);
    expect(c.x).not.toBe(x0); // o vento leva a nuvem
  });

  test('os efeitos da chuva valem embaixo da nuvem, não no resto do mapa', () => {
    const g = rainyGame(602);
    const s = g.state;
    s.clouds = [{ x: 500, y: 500, r: 200, vx: 0, vy: 0 }];
    expect(harvestMult(s, 500, 500)).toBeGreaterThan(harvestMult(s, 1800, 1200));
    expect(weatherSpeed(s, 500, 500)).toBeLessThan(weatherSpeed(s, 1800, 1200));
    expect(natureWeather(s, 'suiton', 500, 500)).toBe(1.2);
    expect(natureWeather(s, 'suiton', 1800, 1200)).toBe(1);
    expect(natureWeather(s, 'katon', 1800, 1200)).toBe(1.2); // fora da nuvem é dia de sol
  });

  test('sem chuva no dia, as nuvens que sobraram terminam de passar e não voltam', () => {
    const g = rainyGame(603);
    g.state.weather = 'clear';
    run(g, 260);
    expect(g.state.clouds.length).toBe(0);
  });

  test('migra saves da versão 17 (nuvens)', () => {
    const g = createNewGame(SYSTEMS, 604);
    const old = JSON.parse(JSON.stringify(g.state));
    old.version = 17;
    delete old.clouds;
    const s = migrate(old)!;
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.clouds).toEqual([]);
  });
});
