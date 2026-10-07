import { describe, expect, test } from 'bun:test';
import { SIM_DT } from '../src/config';
import { createNinja, createRogue, refreshDerived } from '../src/game/entities';
import type { Game } from '../src/game/game';
import { createNewGame } from '../src/game/newGame';
import { SYSTEMS } from '../src/game/systems';
import { pickFoe, roleOf, setTeamTactic, spreadSystem } from '../src/game/tactics';
import { createTeam, joinAsMember } from '../src/game/teams';
import { doorPos } from '../src/game/world';

const run = (g: Game, seconds: number) => {
  for (let t = 0; t < seconds; t += SIM_DT) {
    g.state.time = 30;
    g.step(SIM_DT);
  }
};

describe('estratégia de luta', () => {
  test('papel pelo atributo; quem tem cura é suporte', () => {
    const g = createNewGame(SYSTEMS, 901);
    const u = createNinja(g, 600, 600, 'chunin', 0);
    for (const k of Object.keys(u.ninja!.stats)) (u.ninja!.stats as Record<string, number>)[k] = 1;
    u.ninja!.stats.forca = 6;
    u.ninja!.stats.stamina = 6;
    expect(roleOf(u)).toBe('tank');
    u.ninja!.stats.ninjutsu = 8;
    u.ninja!.stats.selos = 8;
    expect(roleOf(u)).toBe('ranged');
    u.ninja!.jutsu = ['shousen', null];
    expect(roleOf(u)).toBe('support');
  });

  test('duelos: o segundo ninja prefere o inimigo que ninguém está enfrentando', () => {
    const g = createNewGame(SYSTEMS, 902);
    const p = doorPos(g.hokage()!);
    const a = createNinja(g, p.x, p.y + 40, 'chunin', 0);
    const b = createNinja(g, p.x + 4, p.y + 40, 'chunin', 0);
    const e1 = createRogue(g, p.x + 60, p.y + 40, 1, { rank: 'genin' });
    const e2 = createRogue(g, p.x + 90, p.y + 40, 1, { rank: 'genin' });
    a.targetId = e1.id;
    a.state = 'fight';
    expect(pickFoe(g, b, 300)).toBe(e2);
    void b;
  });

  test('segurar posição: não persegue longe do ponto', () => {
    const g = createNewGame(SYSTEMS, 903);
    const p = doorPos(g.hokage()!);
    const t = createTeam(g);
    const n = createNinja(g, p.x, p.y + 40, 'chunin', 0);
    refreshDerived(n);
    expect(joinAsMember(g, t.id, n.id).ok).toBe(true);
    expect(setTeamTactic(g, t.id, 'hold').ok).toBe(true);
    run(g, 0.2);
    expect(n.anchor).toBeDefined();
    const far = createRogue(g, p.x + 200, p.y + 40, 1, { rank: 'genin' });
    expect(pickFoe(g, n, 400)).toBeNull();
    void far;
  });

  test('afastamento: aliados lutando colados se separam devagar (desligável)', () => {
    const g = createNewGame(SYSTEMS, 904);
    const p = doorPos(g.hokage()!);
    const a = createNinja(g, p.x, p.y + 40, 'chunin', 0);
    const b = createNinja(g, p.x + 2, p.y + 40, 'chunin', 0);
    a.combatTimer = b.combatTimer = 5;
    for (let i = 0; i < 30; i++) spreadSystem(g, SIM_DT);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(6);
    g.state.flags.spread = false;
    b.x = a.x + 2;
    b.y = a.y;
    for (let i = 0; i < 30; i++) spreadSystem(g, SIM_DT);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(3);
  });
});
