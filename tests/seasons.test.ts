import { describe, expect, test } from 'bun:test';
import { DAY_LENGTH, SAVE_VERSION, SIM_DT } from '../src/config';
import { SEASON_DAYS } from '../src/data/seasons';
import { killUnit } from '../src/game/combat';
import type { Game } from '../src/game/game';
import { festivalBlock, harvestMult, holdFestival, moodTarget, seasonOf } from '../src/game/mood';
import { createNewGame } from '../src/game/newGame';
import { migrate } from '../src/game/save';
import { SYSTEMS } from '../src/game/systems';

const run = (g: Game, seconds: number) => {
  for (let t = 0; t < seconds; t += SIM_DT) g.step(SIM_DT);
};
/** Pula para o dia seguinte (o dia vem do relógio do jogo). */
const nextDay = (g: Game) => {
  g.state.time = Math.floor(g.state.time / DAY_LENGTH + 1) * DAY_LENGTH + 1;
  run(g, SIM_DT * 2);
};

describe('estações, clima e felicidade', () => {
  test('estação muda a cada poucos dias e o inverno colhe menos', () => {
    const g = createNewGame(SYSTEMS, 111);
    const s = g.state;
    expect(seasonOf(s)).toBe('spring');
    s.day = 1 + SEASON_DAYS * 3;
    expect(seasonOf(s)).toBe('winter');
    s.weather = 'clear';
    const winter = harvestMult(s);
    s.day = 1 + SEASON_DAYS * 2;
    expect(seasonOf(s)).toBe('autumn');
    expect(harvestMult(s)).toBeGreaterThan(winter * 2);
  });

  test('o clima é sorteado na virada do dia', () => {
    const g = createNewGame(SYSTEMS, 112);
    g.state.time = DAY_LENGTH * SEASON_DAYS * 3; // inverno: neve é comum
    const seen = new Set<string>();
    for (let i = 0; i < 4; i++) {
      nextDay(g);
      seen.add(g.state.weather);
    }
    for (let i = 0; i < 20; i++) {
      g.state.time -= DAY_LENGTH; // volta um dia e avança de novo: sorteia outra vez
      nextDay(g);
      seen.add(g.state.weather);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  test('festival deixa a vila feliz e tem intervalo', () => {
    const g = createNewGame(SYSTEMS, 113);
    Object.assign(g.state.res, { food: 999, ryo: 999 });
    const before = moodTarget(g);
    expect(holdFestival(g).ok).toBe(true);
    expect(moodTarget(g)).toBeGreaterThan(before + 10);
    expect(festivalBlock(g)).not.toBeNull();
    run(g, 5);
    expect(g.state.happiness).toBeGreaterThan(60);
  });

  test('mortes deixam a vila de luto; muito infeliz, morador vai embora', () => {
    const g = createNewGame(SYSTEMS, 114);
    const v = g.villagers()[0]!;
    killUnit(g, v, null);
    expect(g.state.grief).toBeGreaterThan(0);
    g.state.happiness = 5;
    g.state.flags.starving = true;
    const pop = g.villagers().length;
    nextDay(g);
    expect(g.villagers().length).toBe(pop - 1);
  });

  test('migra saves da versão 12 (clima e felicidade)', () => {
    const g = createNewGame(SYSTEMS, 115);
    const old = JSON.parse(JSON.stringify(g.state));
    old.version = 12;
    for (const k of ['weather', 'happiness', 'grief', 'moodDay', 'festivalDay', 'festivalUntil']) delete old[k];
    const s = migrate(old)!;
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.weather).toBe('clear');
    expect(s.happiness).toBe(60);
  });
});
