import { describe, expect, test } from 'bun:test';
import { SAVE_VERSION, SIM_DT } from '../src/config';
import { createAnimal, createNinja, refreshDerived } from '../src/game/entities';
import type { Game } from '../src/game/game';
import { createNewGame } from '../src/game/newGame';
import { trainTick } from '../src/game/progression';
import { migrate } from '../src/game/save';
import { SYSTEMS } from '../src/game/systems';
import {
  autoTeams, createTeamWith, disbandTeam, joinAsMember, joinAsSensei, MAX_MEMBERS, orderAttack, orderMove, orderRetreat, teamOf, teamUnits,
} from '../src/game/teams';
import type { Unit } from '../src/game/types';
import { doorPos } from '../src/game/world';

const run = (g: Game, seconds: number) => {
  for (let t = 0; t < seconds; t += SIM_DT) g.step(SIM_DT);
};
const ninjas = (g: Game) => g.state.units.filter((u) => u.kind === 'ninja');
function makeStrong(u: Unit, rank: 'chunin' | 'jounin' = 'jounin') {
  const n = u.ninja!;
  n.rank = rank;
  for (const k of Object.keys(n.stats) as (keyof typeof n.stats)[]) n.stats[k] = 7;
  refreshDerived(u);
  u.hp = u.maxHp;
}

describe('equipes', () => {
  test('o jogo começa com o Time 1 formado pelos dois genin', () => {
    const g = createNewGame(SYSTEMS, 1);
    expect(g.state.teams.length).toBe(1);
    expect(g.state.teams[0]!.memberIds.length).toBe(2);
    expect(g.state.teams[0]!.senseiId).toBeNull();
  });

  test('regras: sensei precisa ser chunin+, máximo de 3 membros', () => {
    const g = createNewGame(SYSTEMS, 2);
    const team = g.state.teams[0]!;
    const genin = createNinja(g, 100, 100, 'genin', 0);
    expect(joinAsSensei(g, team.id, genin.id).ok).toBe(false);
    const chunin = createNinja(g, 100, 100, 'chunin', 0);
    expect(joinAsSensei(g, team.id, chunin.id).ok).toBe(true);
    expect(joinAsMember(g, team.id, genin.id).ok).toBe(true);
    const extra = createNinja(g, 100, 100, 'genin', 0);
    expect(team.memberIds.length).toBe(MAX_MEMBERS);
    expect(joinAsMember(g, team.id, extra.id).ok).toBe(false);
    // trocar de equipe remove da anterior
    expect(createTeamWith(g, genin.id).ok).toBe(true);
    expect(team.memberIds.includes(genin.id)).toBe(false);
    expect(teamOf(g, genin)!.id).not.toBe(team.id);
    expect(disbandTeam(g, team.id).ok).toBe(true);
    expect(teamOf(g, chunin)).toBeUndefined();
  });

  test('treino com sensei rende mais XP', () => {
    const g = createNewGame(SYSTEMS, 3);
    const team = g.state.teams[0]!;
    const [a, b] = team.memberIds.map((id) => g.unit(id)!);
    const sensei = createNinja(g, a!.x, a!.y, 'jounin', 0);
    joinAsSensei(g, team.id, sensei.id);
    trainTick(g, a!, sensei);
    trainTick(g, b!, null);
    expect(a!.ninja!.xp).toBeGreaterThan(b!.ninja!.xp);
  });

  test('membros seguem o líder', () => {
    const g = createNewGame(SYSTEMS, 4);
    const team = g.state.teams[0]!;
    const sensei = createNinja(g, 300, 300, 'jounin', 0);
    joinAsSensei(g, team.id, sensei.id);
    run(g, 20);
    const [a, b] = team.memberIds.map((id) => g.unit(id)!);
    const near = (u: Unit) => Math.hypot(u.x - sensei.x, u.y - sensei.y) < 80;
    // ao longo do tempo os membros ficam próximos do sensei
    let together = 0;
    for (let i = 0; i < 20; i++) {
      run(g, 1);
      if (near(a!) && near(b!)) together++;
    }
    expect(together).toBeGreaterThan(10);
  });

  test('equipe foca o mesmo alvo', () => {
    const g = createNewGame(SYSTEMS, 5);
    const team = g.state.teams[0]!;
    const d = doorPos(g.hokage()!);
    const w1 = createAnimal(g, 'boar', d.x + 100, d.y + 40);
    const w2 = createAnimal(g, 'boar', d.x - 100, d.y + 40);
    w1.hp = w1.maxHp = w2.hp = w2.maxHp = 9999;
    run(g, 3);
    const targets = teamUnits(g, team).map((u) => u.targetId);
    expect(targets[0]).not.toBeNull();
    expect(targets[0]).toBe(targets[1]!);
  });
});

describe('ordens', () => {
  test('mover e defender um ponto', () => {
    const g = createNewGame(SYSTEMS, 6);
    const n = ninjas(g)[0]!;
    const tx = n.x + 200;
    const ty = n.y + 60;
    expect(orderMove(g, [n.id], tx, ty).ok).toBe(true);
    run(g, 8);
    expect(Math.hypot(n.x - tx, n.y - ty)).toBeLessThan(12);
    expect(n.state).toBe('guard');
  });

  test('atacar um alvo específico mesmo longe da vila', () => {
    const g = createNewGame(SYSTEMS, 7);
    const n = ninjas(g)[0]!;
    makeStrong(n);
    const wolf = createAnimal(g, 'wolf', n.x + 400, n.y);
    wolf.state = 'roam';
    expect(orderAttack(g, [n.id], wolf.id).ok).toBe(true);
    run(g, 20);
    expect(wolf.dead).toBe(true);
    expect(n.command).toBeNull();
  });

  test('recuar ignora inimigos, se abriga e sai curado', () => {
    const g = createNewGame(SYSTEMS, 8);
    const n = ninjas(g)[0]!;
    n.x += 220;
    const boar = createAnimal(g, 'boar', n.x + 30, n.y);
    boar.hp = boar.maxHp = 9999;
    run(g, 1);
    expect(n.state).toBe('fight');
    n.hp = n.maxHp * 0.3;
    orderRetreat(g, [n.id]);
    run(g, 0.5);
    expect(n.state).toBe('cmdRetreat');
    boar.dead = true;
    run(g, 10);
    expect(n.hidden).toBe(true);
    expect(n.state).toBe('cmdRest');
    run(g, 40);
    expect(n.command).toBeNull();
    expect(n.hidden).toBe(false);
  });
});

describe('save', () => {
  test('migra saves da versão 1', () => {
    const g = createNewGame(SYSTEMS, 9);
    const old = JSON.parse(JSON.stringify(g.state));
    old.version = 1;
    delete old.teams;
    for (const u of old.units) delete u.command;
    const s = migrate(old)!;
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.teams).toEqual([]);
    expect(s.units.every((u) => u.command === null)).toBe(true);
  });

  test('equipes automáticas: completa vagas e cria equipes equilibradas com sensei', () => {
    const g = createNewGame(SYSTEMS, 9);
    // Time 1 começa com 2 genin: ganha 1 membro; sobram 6 genin (2 equipes novas) e 2 chunin (senseis)
    const extra = Array.from({ length: 7 }, (_, i) => {
      const u = createNinja(g, 100, 100, 'genin', 0);
      u.ninja!.level = i + 1;
      return u;
    });
    const leads = [createNinja(g, 100, 100, 'chunin', 0), createNinja(g, 100, 100, 'chunin', 0), createNinja(g, 100, 100, 'chunin', 0)];
    const r = autoTeams(g);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.created).toBe(2);
    expect(g.state.teams.length).toBe(3);
    for (const t of g.state.teams) {
      expect(t.memberIds.length).toBe(MAX_MEMBERS);
      expect(t.senseiId).not.toBeNull();
    }
    for (const u of [...extra, ...leads]) expect(teamOf(g, u)).toBeDefined();
    // equilíbrio: as equipes novas não têm diferença grande de nível somado
    const sum = (t: (typeof g.state.teams)[number]) => t.memberIds.reduce((a, id) => a + g.unit(id)!.ninja!.level, 0);
    const [a, b] = g.state.teams.slice(1).map(sum);
    expect(Math.abs(a! - b!)).toBeLessThanOrEqual(2);
    // de novo: ninguém livre
    expect(autoTeams(g).ok).toBe(false);
  });
});
