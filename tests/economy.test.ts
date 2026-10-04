import { describe, expect, test } from 'bun:test';
import { SAVE_VERSION, SIM_DT } from '../src/config';
import type { BuildingType } from '../src/data/buildings';
import { ITEMS } from '../src/data/items';
import { canBuild } from '../src/game/commands';
import { createAnimal, createNinja, createVillager } from '../src/game/entities';
import type { Game } from '../src/game/game';
import { autoEquip, cancelCraft, enqueueCraft, equip, gearBonus, stock, unequip } from '../src/game/gear';
import { createNewGame } from '../src/game/newGame';
import { migrate } from '../src/game/save';
import { SYSTEMS } from '../src/game/systems';
import { CENTER_TX, CENTER_TY, doorPos } from '../src/game/world';

const run = (g: Game, seconds: number) => {
  for (let t = 0; t < seconds; t += SIM_DT) g.step(SIM_DT);
};
const rich = (g: Game) => (g.state.res = { wood: 999, stone: 999, food: 999, ryo: 9999, iron: 999, herbs: 999, paper: 999 });
function addBuilt(g: Game, type: BuildingType, tx = CENTER_TX + 6, ty = CENTER_TY + 3) {
  return g.addBuilding({ id: g.newId(), type, tx, ty, built: true, progress: 999, desired: 1, workers: [], cd: 0 });
}

describe('economia', () => {
  test('novos prédios exigem o nível Vila', () => {
    const g = createNewGame(SYSTEMS, 1);
    rich(g);
    expect(canBuild(g, 'forge').ok).toBe(false);
    g.state.level = 1;
    expect(canBuild(g, 'forge').ok).toBe(true);
    expect(canBuild(g, 'sealshop').ok).toBe(false);
  });

  test('o mapa tem veios de minério e a mina produz ferro', () => {
    const g = createNewGame(SYSTEMS, 2);
    expect(g.state.nodes.some((n) => n.type === 'ore')).toBe(true);
    // mina ao lado de um veio, com 2 mineiros
    const ore = g.state.nodes.find((n) => n.type === 'ore')!;
    const mine = g.addBuilding({ id: g.newId(), type: 'ironmine', tx: ore.tx + 3, ty: ore.ty - 1, built: true, progress: 99, desired: 2, workers: [], cd: 0 });
    for (let i = 0; i < 4; i++) createVillager(g, doorPos(mine).x, doorPos(mine).y);
    run(g, 60);
    expect(g.state.res.iron).toBeGreaterThan(0);
  });

  test('fila da forja: paga, o ferreiro fabrica e o item vai para o estoque', () => {
    const g = createNewGame(SYSTEMS, 3);
    rich(g);
    g.state.level = 1;
    const forge = addBuilt(g, 'forge');
    const iron = g.state.res.iron;
    expect(enqueueCraft(g, forge.id, 'kunai').ok).toBe(true);
    expect(g.state.res.iron).toBe(iron - ITEMS.kunai!.cost.iron!);
    expect(enqueueCraft(g, forge.id, 'ninjato').ok).toBe(false); // nível 2
    run(g, 45);
    expect(stock(g, 'kunai')).toBe(1);
  });

  test('cancelar devolve os recursos', () => {
    const g = createNewGame(SYSTEMS, 4);
    rich(g);
    g.state.level = 1;
    const forge = addBuilt(g, 'forge');
    const before = { ...g.state.res };
    enqueueCraft(g, forge.id, 'vest');
    expect(cancelCraft(g, forge.id).ok).toBe(true);
    expect(g.state.res).toEqual(before);
  });

  test('equipar aplica bônus e desequipar devolve ao estoque', () => {
    const g = createNewGame(SYSTEMS, 5);
    const n = createNinja(g, 100, 100, 'genin', 0);
    g.state.items = { vest: 1, kunai: 2 };
    const hp = n.maxHp;
    expect(equip(g, n.id, 'vest').ok).toBe(true);
    expect(n.maxHp).toBe(hp + ITEMS.vest!.bonus!.hp!);
    expect(gearBonus(n).defense).toBeCloseTo(0.08);
    expect(stock(g, 'vest')).toBe(0);
    unequip(g, n.id, 'armor');
    expect(stock(g, 'vest')).toBe(1);
    expect(n.maxHp).toBe(hp);
    expect(autoEquip(g, [n.id]).ok).toBe(true);
    expect(n.ninja!.equip.weapon).toBe('kunai');
    expect(n.ninja!.equip.armor).toBe('vest');
  });

  test('pílula de soldado é usada em combate e reposta na vila', () => {
    const g = createNewGame(SYSTEMS, 6);
    const n = g.state.units.find((u) => u.kind === 'ninja')!;
    g.state.items = { soldierpill: 2 };
    equip(g, n.id, 'soldierpill');
    expect(stock(g, 'soldierpill')).toBe(1);
    const boar = createAnimal(g, 'boar', n.x + 20, n.y);
    boar.hp = boar.maxHp = 9999;
    n.hp = n.maxHp * 0.2;
    run(g, 0.5);
    expect(n.hp).toBeGreaterThan(n.maxHp * 0.4);
    boar.dead = true;
    run(g, 0.5);
    // dentro da vila, pega a segunda pílula do estoque
    expect(n.ninja!.equip.itemReady).toBe(true);
    expect(stock(g, 'soldierpill')).toBe(0);
  });

  test('migra saves da versão 4', () => {
    const g = createNewGame(SYSTEMS, 7);
    const old = JSON.parse(JSON.stringify(g.state));
    old.version = 4;
    delete old.items;
    delete old.res.iron;
    delete old.res.herbs;
    delete old.res.paper;
    for (const u of old.units) if (u.ninja) delete u.ninja.equip;
    for (const n of old.nodes) if (n.type === 'ore') n.type = 'rock';
    const s = migrate(old)!;
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.res.iron).toBe(0);
    expect(s.items).toEqual({});
    expect(s.units.filter((u) => u.ninja).every((u) => u.ninja!.equip.weapon === null)).toBe(true);
    expect(s.nodes.some((n) => n.type === 'ore')).toBe(true);
  });
});
