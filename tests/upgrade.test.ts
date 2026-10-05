import { describe, expect, test } from 'bun:test';
import { SAVE_VERSION } from '../src/config';
import { createNewGame } from '../src/game/newGame';
import { migrate } from '../src/game/save';
import { SYSTEMS } from '../src/game/systems';
import { academyLearnMult, academyRecruitLevel, housingOf, levelOf, startUpgrade, upgradeStatus, upgradeTime } from '../src/game/upgrade';
import { recruitNinja } from '../src/game/commands';

describe('upgrade de prédios', () => {
  test('casa: paga, moradores fazem a obra e a moradia aumenta', () => {
    const g = createNewGame(SYSTEMS, 11);
    Object.assign(g.state.res, { wood: 999, stone: 999, ryo: 999 });
    const house = g.state.buildings.find((b) => b.type === 'house')!;
    const cap0 = g.popCap();
    const wood0 = g.state.res.wood;
    expect(startUpgrade(g, house.id).ok).toBe(true);
    expect(g.state.res.wood).toBeLessThan(wood0);
    expect(house.upgrade).toBe(0);
    // o prédio segue pronto durante a obra (ninguém é despejado)
    expect(house.built).toBe(true);
    for (let i = 0; i < 60 * 120 && house.upgrade != null; i++) {
      g.state.time = 30; // de dia
      g.step(1 / 60);
    }
    expect(house.upgrade).toBeNull();
    expect(levelOf(house)).toBe(2);
    expect(housingOf(house)).toBe(6);
    expect(g.popCap()).toBe(cap0 + 2);
  });

  test('bloqueios: sem recursos, durante a obra e no nível máximo', () => {
    const g = createNewGame([], 3);
    const house = g.state.buildings.find((b) => b.type === 'house')!;
    Object.assign(g.state.res, { wood: 0, stone: 0, ryo: 0 });
    expect(upgradeStatus(g, house).reason).toBe('Recursos insuficientes.');
    Object.assign(g.state.res, { wood: 999, stone: 999, ryo: 999 });
    expect(startUpgrade(g, house.id).ok).toBe(true);
    expect(startUpgrade(g, house.id).ok).toBe(false);
    house.upgrade = upgradeTime(house); // termina na mão
    house.upgrade = null;
    house.level = 3;
    expect(upgradeStatus(g, house).reason).toBe('Nível máximo.');
    // prédio sem upgrade
    const hk = g.hokage()!;
    expect(startUpgrade(g, hk.id).ok).toBe(false);
  });

  test('academia: recruta sai com nível mais alto e o estudo fica mais rápido', () => {
    const g = createNewGame([], 21);
    Object.assign(g.state.res, { wood: 999, stone: 999, ryo: 999, food: 999 });
    const hk = g.hokage()!;
    g.state.buildings.push({ ...hk, id: g.newId(), type: 'academy', tx: hk.tx + 8, ty: hk.ty, built: true, level: 3, upgrade: null, workers: [], desired: 0 });
    expect(academyRecruitLevel(g)).toBe(3);
    expect(academyLearnMult(g)).toBeCloseTo(1.6);
    const before = new Set(g.state.units.filter((u) => u.kind === 'ninja').map((u) => u.id));
    expect(recruitNinja(g).ok).toBe(true);
    const rookie = g.state.units.find((u) => u.kind === 'ninja' && !before.has(u.id))!;
    expect(rookie.ninja!.level).toBe(3);
  });

  test('migra saves da versão 8 (prédios começam no nível 1)', () => {
    const g = createNewGame(SYSTEMS, 5);
    const old = JSON.parse(JSON.stringify(g.state));
    old.version = 8;
    for (const b of old.buildings) {
      delete b.level;
      delete b.upgrade;
    }
    const s = migrate(old)!;
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.buildings.every((b) => b.level === 1 && b.upgrade === null)).toBe(true);
  });
});
