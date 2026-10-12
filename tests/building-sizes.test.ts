import { describe, expect, test } from 'bun:test';
import { SAVE_VERSION } from '../src/config';
import { defOf } from '../src/data/buildings';
import type { Game } from '../src/game/game';
import { createNewGame } from '../src/game/newGame';
import { migrate } from '../src/game/save';
import { SYSTEMS } from '../src/game/systems';
import type { Building } from '../src/game/types';
import { growRoom, startUpgrade, syncHokage, upgradeTime, workUpgrade } from '../src/game/upgrade';
import { CENTER_TX, CENTER_TY } from '../src/game/world';

/** Casa nível 2 pronta num lugar com espaço de sobra em volta (para crescer para 3×3). */
const setup = (seed: number) => {
  const g = createNewGame(SYSTEMS, seed);
  g.state.level = 3;
  Object.assign(g.state.res, { wood: 9999, stone: 9999, ryo: 9999 });
  let spot: { tx: number; ty: number } | null = null;
  for (let r = 5; r < 20 && !spot; r++)
    for (let a = 0; a < 24 && !spot; a++) {
      const tx = CENTER_TX + Math.round(Math.cos(a) * r);
      const ty = CENTER_TY + Math.round(Math.sin(a) * r);
      if (g.world.canPlace('house', tx, ty, false, 3)) spot = { tx, ty };
    }
  const b = g.addBuilding({ id: g.newId(), type: 'house', ...spot!, built: true, progress: 99, desired: 0, workers: [], cd: 0, level: 2 }) as Building;
  g.world.rebuild();
  return { g, b };
};
const finish = (g: Game, b: Building) => workUpgrade(g, b, upgradeTime(b) + 1);

describe('prédio que cresce no upgrade (casa nível 3 = 3×3)', () => {
  test('com espaço: a obra começa e, pronta, a casa ocupa 3×3', () => {
    const { g, b } = setup(1201);
    expect(defOf(b).w).toBe(2);
    expect(startUpgrade(g, b.id).ok).toBe(true);
    finish(g, b);
    expect(b.level).toBe(3);
    expect([defOf(b).w, defOf(b).h]).toEqual([3, 3]);
    expect(g.world.buildingIdAt(b.tx + 2, b.ty + 2)).toBe(b.id);
  });

  test('sem espaço: o upgrade diz por quê; se fecharem o espaço durante a obra, ela espera', () => {
    const { g, b } = setup(1202);
    // um prédio colado à direita
    g.addBuilding({ id: g.newId(), type: 'lantern', tx: b.tx + 3, ty: b.ty, built: true, progress: 99, desired: 0, workers: [], cd: 0 });
    g.world.rebuild();
    expect(growRoom(g, b, 3)).toContain('3×3');
    expect(startUpgrade(g, b.id).ok).toBe(false);
    // libera, começa, fecha de novo e termina a obra: fica esperando no nível 2
    g.state.buildings = g.state.buildings.filter((o) => o.type !== 'lantern');
    g.world.rebuild();
    expect(startUpgrade(g, b.id).ok).toBe(true);
    g.addBuilding({ id: g.newId(), type: 'lantern', tx: b.tx + 3, ty: b.ty, built: true, progress: 99, desired: 0, workers: [], cd: 0 });
    g.world.rebuild();
    finish(g, b);
    expect(b.level).toBe(2);
    expect(b.waitRoom).toBe(true);
  });

  test('save v33 → v34: a casa que já era nível 3 cresce no lugar (ou muda se encostar)', () => {
    const { g, b } = setup(1203);
    b.level = 3;
    const s = JSON.parse(JSON.stringify(g.state));
    s.version = 33;
    const m = migrate(s)!;
    expect(m.version).toBe(SAVE_VERSION);
    const h = m.buildings.find((o) => o.id === b.id)!;
    for (const o of m.buildings) {
      if (o === h) continue;
      const d = defOf(o);
      const overlap = h.tx < o.tx + d.w && h.tx + 3 > o.tx && h.ty < o.ty + d.h && h.ty + 3 > o.ty;
      expect(overlap).toBe(false);
    }
  });
});

describe('Residência do Hokage cresce com a vila (3×3, 3×3, 4×4, 5×5)', () => {
  test('vila sobe de nível: a Residência acompanha e ocupa o terreno do nível', () => {
    const g = createNewGame(SYSTEMS, 1301);
    const hk = g.hokage()!;
    expect([defOf(hk).w, defOf(hk).h]).toEqual([3, 3]);
    g.state.level = 2;
    syncHokage(g);
    expect(hk.level).toBe(3);
    expect([defOf(hk).w, defOf(hk).h]).toEqual([4, 4]);
    g.state.level = 3;
    syncHokage(g);
    expect(hk.level).toBe(4);
    expect(g.world.buildingIdAt(hk.tx + 4, hk.ty + 4)).toBe(hk.id);
  });

  test('sem espaço, espera; liberado, cresce', () => {
    const g = createNewGame(SYSTEMS, 1302);
    const hk = g.hokage()!;
    const block = g.addBuilding({ id: g.newId(), type: 'lantern', tx: hk.tx + 4, ty: hk.ty, built: true, progress: 99, desired: 0, workers: [], cd: 0 });
    g.world.rebuild();
    g.state.level = 2;
    syncHokage(g);
    expect(hk.level ?? 1).toBe(2); // o 3×3 do nível 2 cabe; o 4×4 encosta na lanterna
    expect(hk.waitRoom).toBe(true);
    g.state.buildings = g.state.buildings.filter((b) => b !== block);
    g.world.rebuild();
    syncHokage(g);
    expect(hk.level).toBe(3);
    expect(hk.waitRoom).toBeUndefined();
  });

  test('save v36 → v37: a Residência ganha o nível da vila e cresce sem encostar em ninguém', () => {
    const g = createNewGame(SYSTEMS, 1303);
    g.state.level = 3;
    const s = JSON.parse(JSON.stringify(g.state));
    s.version = 36;
    const m = migrate(s)!;
    const hk = m.buildings.find((b) => b.type === 'hokage')!;
    expect(hk.level).toBe(4);
    for (const o of m.buildings) {
      if (o === hk) continue;
      const d = defOf(o);
      expect(hk.tx < o.tx + d.w && hk.tx + 5 > o.tx && hk.ty < o.ty + d.h && hk.ty + 5 > o.ty).toBe(false);
    }
  });
});
