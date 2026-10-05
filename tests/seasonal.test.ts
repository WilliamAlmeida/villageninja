import { describe, expect, test } from 'bun:test';
import { DAY_LENGTH } from '../src/config';
import { SEASON_DAYS } from '../src/data/seasons';
import { createNewGame } from '../src/game/newGame';
import { SYSTEMS } from '../src/game/systems';
import { iceLevel, Seasonal, setLightWeatherFx } from '../src/render/seasonal';

describe('visual do inverno', () => {
  test('quem anda na neve deixa pegadas e pisa uma trilha; sem neve, nada', () => {
    const g = createNewGame(SYSTEMS, 301);
    const se = new Seasonal();
    const u = g.state.units.find((v) => v.kind === 'villager')!;
    u.moving = true;
    const walk = () => {
      for (let i = 0; i < 60; i++) {
        u.x += 1.5;
        se.frame(g.state, 1 / 60);
      }
    };
    walk();
    expect(se.stats(u.x, u.y).prints).toBe(0); // chão sem neve
    g.state.snow = 0.9;
    const x0 = u.x;
    walk();
    expect(se.stats(u.x, u.y).prints).toBeGreaterThan(5);
    expect(se.stats(x0 + 20, u.y + 6).trample).toBeGreaterThan(0.05);
    // efeitos leves: sem pegadas
    setLightWeatherFx(true);
    const before = se.stats(0, 0).prints;
    walk();
    expect(se.stats(0, 0).prints).toBeLessThanOrEqual(before);
    setLightWeatherFx(false);
  });

  test('fogo derrete a neve; água sobre a neve congela', () => {
    const g = createNewGame(SYSTEMS, 302);
    g.state.snow = 0.8;
    const se = new Seasonal();
    se.frame(g.state, 0.016);
    se.onEffect(g.state, { kind: 'burst', x: 600, y: 600, r: 40 }, 'katon');
    expect(se.stats(600, 600).melt).toBeGreaterThan(0.9);
    se.onEffect(g.state, { kind: 'burst', x: 900, y: 600, r: 20 }, 'suiton');
    expect(se.stats(0, 0).patches).toBe(1);
  });

  test('a água congela das margens no começo do inverno e derrete na primavera', () => {
    const g = createNewGame(SYSTEMS, 303);
    const s = g.state;
    s.day = 1 + SEASON_DAYS * 2; // outono
    expect(iceLevel(s)).toBe(0);
    s.day = 1 + SEASON_DAYS * 3; // 1º dia do inverno
    s.time = DAY_LENGTH * (s.day - 1);
    expect(iceLevel(s)).toBe(0);
    s.day += 2;
    s.time = DAY_LENGTH * (s.day - 1);
    expect(iceLevel(s)).toBe(1);
    s.day = 1 + SEASON_DAYS * 4; // primavera
    s.time = DAY_LENGTH * (s.day - 1) + DAY_LENGTH / 2; // meio do 1º dia
    expect(iceLevel(s)).toBeGreaterThan(0);
    expect(iceLevel(s)).toBeLessThan(1);
  });
});
