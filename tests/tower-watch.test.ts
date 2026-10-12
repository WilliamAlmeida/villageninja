import { describe, expect, test } from 'bun:test';
import { SIM_DT } from '../src/config';
import { createNinja, createRogue } from '../src/game/entities';
import type { Game } from '../src/game/game';
import { createNewGame } from '../src/game/newGame';
import { migrate } from '../src/game/save';
import { SYSTEMS } from '../src/game/systems';
import { createTeam, joinAsSensei } from '../src/game/teams';
import { assignWatch, removeWatch, towerGuard, watchBlock } from '../src/game/towerWatch';
import type { Building } from '../src/game/types';
import { CENTER_TX, CENTER_TY, doorPos } from '../src/game/world';

const run = (g: Game, s: number, stop?: () => boolean) => {
  for (let t = 0; t < s; t += SIM_DT) {
    g.state.time = 30;
    g.step(SIM_DT);
    if (stop?.()) return true;
  }
  return false;
};

/** Vila sem ninjas e bichos, com uma torre pronta num lugar livre e um ninja para vigiar. */
const setup = (seed: number) => {
  const g = createNewGame(SYSTEMS, seed);
  for (const u of g.state.units) if (u.kind !== 'villager') u.dead = true;
  g.state.timers.animal = g.state.timers.raid = 1e9;
  let spot = { tx: 0, ty: 0 };
  for (let r = 4; r < 20 && !spot.tx; r++)
    for (let a = 0; a < 16 && !spot.tx; a++) {
      const tx = CENTER_TX + Math.round(Math.cos(a) * r);
      const ty = CENTER_TY + Math.round(Math.sin(a) * r);
      if (g.world.canPlace('tower', tx, ty)) spot = { tx, ty };
    }
  const tower = g.addBuilding({ id: g.newId(), type: 'tower', ...spot, built: true, progress: 99, desired: 0, workers: [], cd: 0 }) as Building;
  const d = doorPos(tower);
  const n = createNinja(g, d.x - 60, d.y + 20, 'chunin', 0);
  return { g, tower, n, d };
};

describe('vigia da torre', () => {
  test('sobe na torre e arremessa no lugar dela, com o XP do abate sendo dele', () => {
    const { g, tower, n, d } = setup(901);
    expect(assignWatch(g, tower.id, n.id).ok).toBe(true);
    expect(run(g, 15, () => n.state === 'towerWatch')).toBe(true);
    expect(Math.hypot(n.x - d.x, n.y - d.y)).toBeLessThan(1);
    const rogue = createRogue(g, d.x + 120, d.y, 1);
    rogue.hp = rogue.maxHp = 9999;
    expect(run(g, 4, () => g.state.projectiles.some((p) => p.ownerId === n.id))).toBe(true);
    // a torre não atira junto (o arremesso é do vigia)
    expect(g.state.projectiles.some((p) => p.ownerId == null && p.faction === 'village')).toBe(false);
    expect(towerGuard(g, tower)).toBe(n);
  });

  test('fica fora das lutas comuns: inimigo longe da porta não o tira de lá', () => {
    const { g, tower, n, d } = setup(902);
    assignWatch(g, tower.id, n.id);
    run(g, 15, () => n.state === 'towerWatch');
    const helper = createNinja(g, d.x + 150, d.y, 'jounin', 0);
    const rogue = createRogue(g, d.x + 160, d.y + 10, 1);
    rogue.hp = rogue.maxHp = 9999;
    run(g, 2);
    expect(helper.state).toBe('fight');
    expect(n.state).toBe('towerWatch');
  });

  test('sem alternativa (inimigo na porta e ninguém lutando por perto) desce para lutar e volta depois', () => {
    const { g, tower, n, d } = setup(903);
    assignWatch(g, tower.id, n.id);
    run(g, 15, () => n.state === 'towerWatch');
    const rogue = createRogue(g, d.x + 20, d.y + 10, 1);
    expect(run(g, 2, () => n.state === 'fight')).toBe(true);
    rogue.dead = true;
    expect(run(g, 10, () => n.state === 'towerWatch')).toBe(true);
  });

  test('muito ferido desce para se tratar; tirado da torre, volta à rotina', () => {
    const { g, tower, n } = setup(904);
    assignWatch(g, tower.id, n.id);
    run(g, 15, () => n.state === 'towerWatch');
    n.hp = n.maxHp * 0.2;
    run(g, 0.5);
    expect(n.state).not.toBe('towerWatch');
    n.hp = n.maxHp;
    expect(removeWatch(g, tower.id).ok).toBe(true);
    expect(n.onTower).toBeUndefined();
    expect(tower.guardId).toBeUndefined();
  });

  test('quem está numa equipe não pode vigiar', () => {
    const { g, n } = setup(905);
    const t = createTeam(g, 'Time');
    joinAsSensei(g, t.id, n.id);
    expect(watchBlock(g, n)).toContain('equipe');
  });

  test('migração v31 → v33 tira o guarda desenhado de antes', () => {
    const { g, tower } = setup(906);
    const s = JSON.parse(JSON.stringify(g.state));
    s.version = 31;
    s.buildings.find((b: Building) => b.id === tower.id).shot = 2;
    const m = migrate(s)!;
    expect(m.version).toBe(33);
    expect((m.buildings.find((b) => b.id === tower.id) as unknown as { shot?: number }).shot).toBeUndefined();
  });
});

describe('torre 2×2 (save v33)', () => {
  test('a torre 1×1 cresce no lugar se couber; se encostar noutro prédio, vai para o lugar livre mais perto', () => {
    const { g, tower } = setup(907);
    const s = JSON.parse(JSON.stringify(g.state));
    s.version = 32;
    const t = s.buildings.find((b: Building) => b.id === tower.id);
    const was = { tx: t.tx, ty: t.ty }; // a migração muda o objeto no lugar
    // uma casa colada à direita: a torre 2×2 no mesmo canto encostaria nela
    s.buildings.push({ id: 99999, type: 'house', tx: t.tx + 1, ty: t.ty, built: true, progress: 99, desired: 0, workers: [], cd: 0 });
    const m = migrate(s)!;
    expect(m.version).toBe(33);
    const nt = m.buildings.find((b) => b.id === tower.id)!;
    expect(nt.tx !== was.tx || nt.ty !== was.ty).toBe(true);
    const house = m.buildings.find((b) => b.id === 99999)!;
    const overlap = nt.tx < house.tx + 2 && nt.tx + 2 > house.tx && nt.ty < house.ty + 2 && nt.ty + 2 > house.ty;
    expect(overlap).toBe(false);

    const s2 = JSON.parse(JSON.stringify(g.state));
    s2.version = 32;
    const m2 = migrate(s2)!;
    const t2 = m2.buildings.find((b) => b.id === tower.id)!;
    expect([t2.tx, t2.ty]).toEqual([tower.tx, tower.ty]);
  });
});
