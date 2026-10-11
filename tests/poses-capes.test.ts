import { describe, expect, test } from 'bun:test';
import { createNinja } from '../src/game/entities';
import { CARRY_SACK } from '../src/game/expeditions';
import { createNewGame } from '../src/game/newGame';
import { SYSTEMS } from '../src/game/systems';
import { statusSystem } from '../src/game/systems/status';
import { createTeam, joinAsSensei, markSenseis } from '../src/game/teams';
import { SIM_DT } from '../src/config';

describe('capa do sensei e saco do espólio (só desenho)', () => {
  test('o sensei veste a capa na cor da equipe; ao sair, tira', () => {
    const g = createNewGame(SYSTEMS, 401);
    const s = createNinja(g, 1100, 800, 'jounin', 0);
    const t = createTeam(g, 'Time Capa');
    expect(joinAsSensei(g, t.id, s.id).ok).toBe(true);
    markSenseis(g);
    expect(s.cape).toBe(t.color);
    t.senseiId = null;
    markSenseis(g);
    expect(s.cape).toBeUndefined();
  });

  test('Sannin não usa a capa (já tem o sobretudo)', () => {
    const g = createNewGame(SYSTEMS, 402);
    const s = createNinja(g, 1100, 800, 'jounin', 0);
    s.ninja!.sannin = 'toad';
    const t = createTeam(g, 'Time Sannin');
    t.senseiId = s.id;
    markSenseis(g);
    expect(s.cape).toBeUndefined();
  });

  test('o saco do espólio some com o tempo', () => {
    const g = createNewGame(SYSTEMS, 403);
    const n = createNinja(g, 1100, 800, 'chunin', 0);
    n.carrySack = CARRY_SACK;
    for (let t = 0; t < CARRY_SACK + 1; t += SIM_DT) statusSystem(g, SIM_DT);
    expect(n.carrySack).toBeUndefined();
  });
});
