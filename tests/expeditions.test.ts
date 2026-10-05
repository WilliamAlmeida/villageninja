import { describe, expect, test } from 'bun:test';
import { SAVE_VERSION, SIM_DT } from '../src/config';
import { MINE } from '../src/data/expeditions';
import { refreshDerived } from '../src/game/entities';
import { chooseExpedition, startMine } from '../src/game/expeditions';
import type { Game } from '../src/game/game';
import { createNewGame } from '../src/game/newGame';
import { migrate } from '../src/game/save';
import { SYSTEMS } from '../src/game/systems';
import { teamUnits } from '../src/game/teams';

const run = (g: Game, seconds: number, until?: () => boolean) => {
  for (let t = 0; t < seconds; t += SIM_DT) {
    g.step(SIM_DT);
    if (until?.()) return;
  }
};

/** Time 1 forte e uma mina já descoberta. */
function setup(seed: number) {
  const g = createNewGame(SYSTEMS, seed);
  const cave = g.state.sites.find((s) => s.kind === 'cave')!;
  cave.found = true;
  const team = g.state.teams[0]!;
  for (const u of teamUnits(g, team)) {
    const n = u.ninja!;
    n.rank = 'jounin';
    n.level = 12;
    for (const k of Object.keys(n.stats) as (keyof typeof n.stats)[]) n.stats[k] = 8;
    refreshDerived(u);
    u.hp = u.maxHp;
  }
  return { g, cave, team };
}

describe('expedições às minas', () => {
  test('a equipe sai do mapa, explora andares, decide e volta com o saque', () => {
    const { g, cave, team } = setup(81);
    const us = teamUnits(g, team);
    expect(startMine(g, team.id, cave.id).ok).toBe(true);
    expect(us.every((u) => u.away != null && u.hidden)).toBe(true);
    const e = g.state.expeditions[0]!;
    run(g, MINE.travel + MINE.floorTime + 2, () => e.status === 'choice' || e.status === 'return');
    expect(e.floor).toBe(1);
    if (e.status === 'choice') {
      expect(chooseExpedition(g, e.id, true).ok).toBe(true);
      run(g, MINE.floorTime + 2, () => e.status === 'choice' || e.status === 'return');
      if (e.status === 'choice') chooseExpedition(g, e.id, false);
    }
    const before = { ...g.state.res };
    run(g, MINE.travel + 2, () => e.status === 'done');
    expect(e.status).toBe('done');
    // voltou: ninjas no mapa de novo e o saque entrou no estoque
    expect(us.filter((u) => !u.dead).every((u) => u.away == null && !u.hidden)).toBe(true);
    const gained = Object.entries(e.loot).some(([k, v]) => (g.state.res as Record<string, number>)[k]! >= (before as Record<string, number>)[k]! + v! - 1);
    expect(Object.keys(e.loot).length === 0 || gained).toBe(true);
  });

  test('regras: equipe em expedição não pega missão nem parte de novo; feridos não partem', () => {
    const { g, cave, team } = setup(82);
    expect(startMine(g, team.id, cave.id).ok).toBe(true);
    expect(startMine(g, team.id, cave.id).ok).toBe(false);
    const g2 = setup(83);
    const u = teamUnits(g2.g, g2.team)[0]!;
    u.hp = u.maxHp * 0.3;
    expect(startMine(g2.g, g2.team.id, g2.cave.id).ok).toBe(false);
  });

  test('migra saves da versão 10 (recursos raros e expedições)', () => {
    const g = createNewGame(SYSTEMS, 84);
    const old = JSON.parse(JSON.stringify(g.state));
    old.version = 10;
    delete old.expeditions;
    delete old.res.crystal;
    delete old.res.gold;
    delete old.res.darksteel;
    const s = migrate(old)!;
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.expeditions).toEqual([]);
    expect(s.res.gold).toBe(0);
  });
});
