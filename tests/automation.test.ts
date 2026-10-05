import { describe, expect, test } from 'bun:test';
import { SAVE_VERSION } from '../src/config';
import type { BuildingType } from '../src/data/buildings';
import { autoCraftTick, autoSenseiTick, buyRare, hireMercenary, setKeep, teachAll } from '../src/game/automation';
import { createNinja } from '../src/game/entities';
import type { Game } from '../src/game/game';
import { advanceCraft, enqueueCraft } from '../src/game/gear';
import { createNewGame } from '../src/game/newGame';
import { migrate } from '../src/game/save';
import { SYSTEMS } from '../src/game/systems';
import { createTeam, joinAsMember } from '../src/game/teams';

const place = (g: Game, type: BuildingType, level = 1) =>
  g.addBuilding({ id: g.newId(), type, tx: 6 + g.state.buildings.length * 3, ty: 6, built: true, progress: 999, desired: 1, workers: [], cd: 0, level });
const rich = (g: Game) => Object.assign(g.state.res, { wood: 9999, stone: 9999, food: 9999, ryo: 99999, iron: 999, herbs: 999, paper: 999 });

describe('automação e destinos para o ryo', () => {
  test('oficina só fabrica sozinha depois do upgrade; repõe até o estoque pedido', () => {
    const g = createNewGame(SYSTEMS, 701);
    rich(g);
    const f1 = place(g, 'forge', 1);
    expect(setKeep(g, f1.id, 'kunai', 3).ok).toBe(false);
    f1.level = 2;
    expect(setKeep(g, f1.id, 'kunai', 3).ok).toBe(true);
    autoCraftTick(g);
    expect(f1.queue!.length).toBe(3);
    autoCraftTick(g); // já garantido: não pede de novo
    expect(f1.queue!.length).toBe(3);
  });

  test('oficina de nível maior fabrica mais rápido e tem fila maior', () => {
    const g = createNewGame(SYSTEMS, 702);
    rich(g);
    const a = place(g, 'forge', 1);
    const b = place(g, 'forge', 3);
    enqueueCraft(g, a.id, 'kunai');
    enqueueCraft(g, b.id, 'kunai');
    advanceCraft(g, a.id, 1);
    advanceCraft(g, b.id, 1);
    expect(b.craft!.progress).toBeCloseTo(a.craft!.progress * 2);
    for (let i = 0; i < 10; i++) enqueueCraft(g, b.id, 'kunai');
    expect(b.queue!.length + 1).toBe(9);
  });

  test('Academia ensina sozinha o melhor jutsu possível a quem tem espaço', () => {
    const g = createNewGame(SYSTEMS, 703);
    rich(g);
    place(g, 'academy', 1);
    const n = createNinja(g, 600, 600, 'chunin', 0);
    const stats = n.ninja!.stats;
    for (const k of Object.keys(stats) as (keyof typeof stats)[]) stats[k] = 6;
    expect(teachAll(g)).toBeGreaterThan(0);
    expect(n.ninja!.learning).not.toBeNull();
  });

  test('equipe sem sensei recebe o Jounin livre mais forte', () => {
    const g = createNewGame(SYSTEMS, 704);
    g.state.teams = []; // só a equipe do teste
    const t = createTeam(g);
    const a = createNinja(g, 600, 600, 'genin', 0);
    joinAsMember(g, t.id, a.id);
    const j = createNinja(g, 600, 600, 'jounin', 0);
    j.ninja!.level = 15;
    expect(autoSenseiTick(g)).toBeGreaterThan(0);
    expect(t.senseiId).toBe(j.id);
  });

  test('mercenários e materiais raros gastam ryo', () => {
    const g = createNewGame(SYSTEMS, 705);
    rich(g);
    g.state.level = 2;
    place(g, 'missions');
    place(g, 'market');
    for (let i = 0; i < 6; i++) place(g, 'house');
    const before = g.state.units.filter((u) => u.kind === 'ninja' && !u.dead).length;
    const ryo = g.state.res.ryo;
    expect(hireMercenary(g, 'jounin').ok).toBe(true);
    const hired = g.state.units.filter((u) => u.kind === 'ninja' && !u.dead);
    expect(hired.length).toBe(before + 1);
    expect(hired.at(-1)!.ninja!.rank).toBe('jounin');
    expect(g.state.res.ryo).toBeLessThan(ryo);
    expect(buyRare(g, 'crystal', 5).ok).toBe(true);
    expect(g.state.res.crystal).toBe(5);
  });

  test('migra saves da versão 18 (automação)', () => {
    const g = createNewGame(SYSTEMS, 706);
    const old = JSON.parse(JSON.stringify(g.state));
    old.version = 18;
    delete old.flags.autoTeach;
    delete old.flags.autoSensei;
    const s = migrate(old)!;
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.flags.autoTeach).toBe(false);
    expect(s.flags.autoSensei).toBe(true);
  });
});
