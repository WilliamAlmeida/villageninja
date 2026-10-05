import { describe, expect, test } from 'bun:test';
import { SIM_DT } from '../src/config';
import { createNinja, createRogue, refreshDerived } from '../src/game/entities';
import type { Game } from '../src/game/game';
import { createNewGame } from '../src/game/newGame';
import { learnSpec, specBlock } from '../src/game/specs';
import { SYSTEMS } from '../src/game/systems';
import type { Unit } from '../src/game/types';

const run = (g: Game, seconds: number, until?: () => boolean) => {
  for (let t = 0; t < seconds; t += SIM_DT) {
    g.state.time = 30;
    g.step(SIM_DT);
    if (until?.()) return;
  }
};
const strong = (u: Unit) => {
  const n = u.ninja!;
  n.rank = 'jounin';
  for (const k of Object.keys(n.stats) as (keyof typeof n.stats)[]) n.stats[k] = 7;
  refreshDerived(u);
  u.hp = u.maxHp;
  u.chakra = u.maxChakra;
  return u;
};

describe('profissões e invocações', () => {
  test('aprender profissão exige Chunin+, o prédio e recursos', () => {
    const g = createNewGame(SYSTEMS, 101);
    Object.assign(g.state.res, { ryo: 999, herbs: 99, paper: 99, wood: 999, iron: 99 });
    const n = createNinja(g, 400, 400, 'genin', 0);
    expect(specBlock(g, n, 'spy')).not.toBeNull();
    n.ninja!.rank = 'chunin';
    expect(specBlock(g, n, 'spy')).toContain('Torre de Inteligência');
    g.addBuilding({ id: g.newId(), type: 'intel', tx: 2, ty: 2, built: true, progress: 99, desired: 0, workers: [], cd: 0 });
    expect(learnSpec(g, n.id, 'spy').ok).toBe(true);
    expect(n.ninja!.spec).toBe('spy');
  });

  test('ninja médico cura aliado ferido por perto', () => {
    const g = createNewGame(SYSTEMS, 102);
    const medic = strong(createNinja(g, 600, 600, 'chunin', 0));
    medic.ninja!.spec = 'medic';
    const friend = strong(createNinja(g, 640, 600, 'chunin', 0));
    friend.hp = friend.maxHp * 0.3;
    const hp0 = friend.hp;
    run(g, 0.5);
    expect(friend.hp).toBeGreaterThan(hp0);
  });

  test('espião da vila revela espião inimigo de longe', () => {
    const g = createNewGame(SYSTEMS, 103);
    const spyN = strong(createNinja(g, 600, 600, 'chunin', 0));
    spyN.ninja!.spec = 'spy';
    spyN.ninja!.stats.inteligencia = 1; // sem a profissão, não descobriria
    const foe = createRogue(g, 800, 600, 9);
    foe.role = 'spy';
    foe.cloak = true;
    run(g, 0.3);
    expect(foe.cloak).toBe(false);
  });

  test('marionetista e contrato invocam aliados em combate', () => {
    const g = createNewGame(SYSTEMS, 104);
    const pm = strong(createNinja(g, 600, 600, 'chunin', 0));
    pm.ninja!.spec = 'puppeteer';
    pm.ninja!.contract = 'toad';
    const foe = createRogue(g, 680, 600, 3);
    foe.hp = foe.maxHp = 9999;
    run(g, 3, () => g.state.units.some((u) => u.role === 'puppet' && u.ownerId === pm.id) && g.state.units.some((u) => u.animal === 'toad'));
    const puppet = g.state.units.find((u) => u.role === 'puppet' && u.ownerId === pm.id);
    const toad = g.state.units.find((u) => u.animal === 'toad' && u.ownerId === pm.id);
    expect(puppet?.faction).toBe('village');
    expect(toad?.faction).toBe('village');
    // o dono cai: as invocações somem
    pm.dead = true;
    run(g, 0.2);
    expect(toad!.dead).toBe(true);
  });
});
