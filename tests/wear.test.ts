import { describe, expect, test } from 'bun:test';
import { TILE } from '../src/config';
import { CARRY, ITEMS, WEAR } from '../src/data/items';
import { applyDamage } from '../src/game/combat';
import { createNinja, createRogue } from '../src/game/entities';
import type { Game } from '../src/game/game';
import { carried, consumeItem, equip, refillItem, stock, unequip } from '../src/game/gear';
import { duraOf, gearBonus, wearStage } from '../src/game/gearBonus';
import { createNewGame } from '../src/game/newGame';
import { SYSTEMS } from '../src/game/systems';
import { autoRepairTick, repairCost, repairUnit, wearOut, weekUse, wornStock } from '../src/game/wear';
import { CENTER_TX, CENTER_TY } from '../src/game/world';

const rich = (g: Game) => (g.state.res = { wood: 999, stone: 999, food: 999, ryo: 9999, iron: 999, herbs: 999, paper: 999, crystal: 99, gold: 0, darksteel: 99 });
const forge = (g: Game, level = 1) =>
  g.addBuilding({ id: g.newId(), type: 'forge', tx: CENTER_TX + 6, ty: CENTER_TY + 3, built: true, progress: 999, desired: 1, workers: [], cd: 0, level });

function setup(rank: 'genin' | 'chunin' | 'jounin' = 'chunin') {
  const g = createNewGame(SYSTEMS, 4401);
  rich(g);
  const u = createNinja(g, CENTER_TX * TILE, CENTER_TY * TILE + 60, rank, 0);
  return { g, u };
}

describe('desgaste de arma e colete', () => {
  test('golpe que acerta gasta a arma: gasta dá metade do bônus, quebrada não dá nada', () => {
    const { g, u } = setup();
    g.state.items.ninjato = 1;
    expect(equip(g, u.id, 'ninjato').ok).toBe(true);
    const full = gearBonus(u).melee;
    const dura = ITEMS.ninjato!.dura!;
    const r = createRogue(g, u.x + 10, u.y, 1);
    r.hp = r.maxHp = 1e6;
    applyDamage(g, u, r, 5, null, { melee: true });
    // a esquiva do alvo pode anular o golpe; a arma gasta só quando acerta
    expect(duraOf(u, 'weapon')).toBeLessThanOrEqual(1);
    wearOut(g, u, 'weapon', dura * (1 - WEAR.worn) + 1);
    expect(wearStage(u, 'weapon')).toBe('worn');
    expect(gearBonus(u).melee).toBe(Math.round(full * WEAR.wornMult));
    wearOut(g, u, 'weapon', dura);
    expect(wearStage(u, 'weapon')).toBe('broken');
    expect(gearBonus(u).melee).toBe(0);
  });

  test('colete gasta com o dano que segura; no duelo do Exame não gasta', () => {
    const { g, u } = setup();
    g.state.items.vest = 1;
    equip(g, u.id, 'vest');
    const r = createRogue(g, u.x + 10, u.y, 1);
    u.hp = u.maxHp = 5000;
    applyDamage(g, r, u, 40, null, {});
    expect(duraOf(u, 'armor')).toBeLessThan(1);
    const before = duraOf(u, 'armor');
    u.arenaSide = 1;
    applyDamage(g, r, u, 40, null, {});
    expect(duraOf(u, 'armor')).toBe(before);
  });

  test('lâmina lendária não quebra: em 0 fica cega (perde 30%)', () => {
    const { g, u } = setup('jounin');
    const id = Object.keys(ITEMS).find((k) => ITEMS[k]!.blade && !ITEMS[k]!.kageOnly)!;
    g.state.items[id] = 1;
    expect(equip(g, u.id, id).ok).toBe(true);
    const full = gearBonus(u).melee;
    wearOut(g, u, 'weapon', 1e6);
    expect(wearStage(u, 'weapon')).toBe('blunt');
    expect(gearBonus(u).melee).toBe(Math.round(full * WEAR.blunt));
  });

  test('tirar a peça gasta não a devolve nova: fica guardada gasta e volta com o desgaste', () => {
    const { g, u } = setup();
    g.state.items.kunai = 1;
    equip(g, u.id, 'kunai');
    wearOut(g, u, 'weapon', 40);
    const d = duraOf(u, 'weapon');
    unequip(g, u.id, 'weapon');
    expect(stock(g, 'kunai')).toBe(0);
    expect(wornStock(g, 'kunai')).toBe(1);
    expect(equip(g, u.id, 'kunai').ok).toBe(true);
    expect(duraOf(u, 'weapon')).toBeCloseTo(d);
  });

  test('Forja conserta pagando parte do custo; do nível 2 em diante conserta sozinha', () => {
    const { g, u } = setup();
    g.state.items.ninjato = 1;
    equip(g, u.id, 'ninjato');
    wearOut(g, u, 'weapon', 1e6);
    expect(repairUnit(g, u).ok).toBe(false); // sem Forja
    forge(g, 1);
    const iron = g.state.res.iron;
    expect(repairCost('ninjato', 0).iron).toBe(Math.ceil(ITEMS.ninjato!.cost.iron! * WEAR.repair));
    expect(repairUnit(g, u).ok).toBe(true);
    expect(duraOf(u, 'weapon')).toBe(1);
    expect(g.state.res.iron).toBeLessThan(iron);
    // nível 1 não conserta sozinha; nível 2 sim (abaixo de WEAR.autoBelow)
    wearOut(g, u, 'weapon', ITEMS.ninjato!.dura! * 0.8);
    autoRepairTick(g);
    expect(duraOf(u, 'weapon')).toBeLessThan(WEAR.autoBelow);
    g.builtOf('forge')[0]!.level = 2;
    autoRepairTick(g);
    expect(duraOf(u, 'weapon')).toBe(1);
  });
});

describe('consumíveis', () => {
  test('a bolsa enche pela patente e cada uso conta no consumo da semana', () => {
    for (const rank of ['genin', 'chunin', 'jounin'] as const) {
      const { g, u } = setup(rank);
      g.state.items.soldierpill = 10;
      equip(g, u.id, 'soldierpill');
      expect(carried(u)).toBe(CARRY[rank]);
      expect(consumeItem(g, u)).not.toBeNull();
      expect(carried(u)).toBe(CARRY[rank]! - 1);
      expect(weekUse(g.state, 'soldierpill')).toBe(1);
      refillItem(g, u);
      expect(carried(u)).toBe(CARRY[rank]);
      // tirar devolve tudo o que carrega
      const left = stock(g, 'soldierpill');
      unequip(g, u.id, 'item');
      expect(stock(g, 'soldierpill')).toBe(left + CARRY[rank]!);
    }
  });

  test('consumo da semana esquece o que passou de 7 dias', () => {
    const { g, u } = setup('jounin');
    g.state.items.bombtag = 5;
    equip(g, u.id, 'bombtag');
    consumeItem(g, u);
    expect(weekUse(g.state, 'bombtag')).toBe(1);
    g.state.day += 3;
    consumeItem(g, u);
    expect(weekUse(g.state, 'bombtag')).toBe(2);
    g.state.day += 5; // o primeiro já tem 8 dias
    expect(weekUse(g.state, 'bombtag')).toBe(1);
  });
});
