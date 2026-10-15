// Tetos de prédios por nível da vila, casa de 4/8/12 e teto de ninjas (docs/gdd-escala-ilhas-pvp.md, seção 3).
import { describe, expect, test } from 'bun:test';
import { BUILDINGS, maxCountOf, type BuildingType } from '../src/data/buildings';
import { levelDef, MAX_VILLAGE_LEVEL, VILLAGE_LEVELS } from '../src/data/villageLevels';
import { hireBlock } from '../src/game/automation';
import { canBuild, countBlock, ninjaBlock, placeBuilding, recruitNinja } from '../src/game/commands';
import { createDemoGame } from '../src/game/demo';
import { createNinja, createVillager } from '../src/game/entities';
import type { Game } from '../src/game/game';
import { createNewGame } from '../src/game/newGame';
import { SYSTEMS } from '../src/game/systems';
import { housingOf } from '../src/game/upgrade';

const rich = (g: Game) => Object.assign(g.state.res, { wood: 9999, stone: 9999, food: 9999, ryo: 99999, iron: 999, herbs: 999, paper: 999 });

/** Prédios já prontos, fora do caminho (atalho: não passa por canBuild). */
function addBuilt(g: Game, type: BuildingType, n: number, level = 1) {
  for (let i = 0; i < n; i++) g.addBuilding({ id: g.newId(), type, tx: 1, ty: 1, built: true, progress: 999, desired: 0, workers: [], cd: 0, level });
}

describe('teto de prédios por nível da vila', () => {
  test('maxCountOf: único = 1, sem campo = sem teto, tabela por nível', () => {
    expect(maxCountOf('academy', 0)).toBe(1);
    expect(maxCountOf('lantern', 3)).toBe(Infinity);
    expect(maxCountOf('house', 0)).toBe(5);
    expect(maxCountOf('house', 3)).toBe(14);
    expect(maxCountOf('ironmine', 0)).toBe(0);
    expect(maxCountOf('house', 99)).toBe(14);
  });

  test('construir até o teto e receber o motivo; o teto sobe com o nível', () => {
    const g = createNewGame(SYSTEMS, 7);
    rich(g);
    const cap0 = maxCountOf('house', 0);
    addBuilt(g, 'house', cap0 - g.buildingCount('house'));
    expect(g.buildingCount('house')).toBe(cap0);
    const r = canBuild(g, 'house');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain(`Limite de ${cap0} casas`);
      expect(r.error).toContain('suba a vila de nível');
      expect(r.error).toContain('melhore');
    }
    expect(placeBuilding(g, 'house', 30, 30).ok).toBe(false);
    g.state.level = 1;
    expect(canBuild(g, 'house').ok).toBe(true);
    expect(countBlock(g, 'house')).toBeNull();
  });

  test('no nível máximo a mensagem não manda subir de nível', () => {
    const g = createNewGame(SYSTEMS, 8);
    rich(g);
    g.state.level = MAX_VILLAGE_LEVEL;
    addBuilt(g, 'tower', maxCountOf('tower', MAX_VILLAGE_LEVEL));
    const why = countBlock(g, 'tower');
    expect(why).toContain('máximo do jogo');
    expect(why).not.toContain('suba a vila');
  });

  test('prédio em obra conta no teto; único e decoração seguem as regras antigas', () => {
    const g = createNewGame(SYSTEMS, 9);
    rich(g);
    const n = g.buildingCount('house');
    g.addBuilding({ id: g.newId(), type: 'house', tx: 1, ty: 1, built: false, progress: 0, desired: 0, workers: [], cd: 0 });
    expect(g.buildingCount('house')).toBe(n + 1);
    addBuilt(g, 'lantern', 40);
    expect(canBuild(g, 'lantern').ok).toBe(true);
    expect(canBuild(g, 'academy').ok).toBe(true);
    addBuilt(g, 'academy', 1);
    const r = canBuild(g, 'academy');
    if (!r.ok) expect(r.error).toBe('Só pode haver um.');
  });

  test('save antigo acima do teto: nada é demolido, só não constrói o próximo', () => {
    const g = createNewGame(SYSTEMS, 10);
    rich(g);
    addBuilt(g, 'house', 30);
    const before = g.state.buildings.length;
    for (let i = 0; i < 120; i++) g.step(1 / 30);
    expect(g.state.buildings.length).toBe(before);
    expect(canBuild(g, 'house').ok).toBe(false);
    expect(g.housingCap()).toBeGreaterThan(levelDef(0).popLimit);
    expect(g.popCap()).toBe(levelDef(0).popLimit);
  });

  test('tabela: teto de casas cheias no nível 3 cobre o popLimit e os requisitos de nível cabem no teto anterior', () => {
    for (const lv of VILLAGE_LEVELS) {
      const casas = maxCountOf('house', lv.level) * housingOf({ id: 0, type: 'house', tx: 0, ty: 0, built: true, progress: 0, desired: 0, workers: [], cd: 0, level: lv.level === 0 ? 2 : 3 });
      expect(casas + (BUILDINGS.hokage.housing ?? 0)).toBeGreaterThanOrEqual(lv.popLimit);
      if (lv.level > 0 && lv.req.population) expect(lv.req.population).toBeLessThanOrEqual(levelDef(lv.level - 1).popLimit);
      if (lv.level > 0 && lv.req.ninjas) expect(lv.req.ninjas).toBeLessThanOrEqual(levelDef(lv.level - 1).ninjaLimit);
      if (lv.level > 0 && lv.req.buildings) for (const [t, n] of Object.entries(lv.req.buildings)) expect(n).toBeLessThanOrEqual(maxCountOf(t as BuildingType, lv.level - 1));
    }
  });
});

describe('casa de 4 / 8 / 12', () => {
  test('housingOf por nível da casa', () => {
    const base = { id: 0, type: 'house' as const, tx: 0, ty: 0, built: true, progress: 0, desired: 0, workers: [], cd: 0 };
    expect(housingOf({ ...base })).toBe(4);
    expect(housingOf({ ...base, level: 2 })).toBe(8);
    expect(housingOf({ ...base, level: 3 })).toBe(12);
  });
});

describe('teto de ninjas', () => {
  test('Academia e mercenários recusam no teto; o teto sobe com o nível', () => {
    const g = createNewGame(SYSTEMS, 11);
    rich(g);
    addBuilt(g, 'academy', 1);
    addBuilt(g, 'missions', 1);
    addBuilt(g, 'house', 4, 3);
    for (let i = 0; i < 12; i++) createVillager(g, 100, 100);
    while (g.ninjaCount() < g.ninjaCap()) createNinja(g, 100, 100);
    expect(ninjaBlock(g)).toContain(`Limite de ${levelDef(0).ninjaLimit} ninjas`);
    const r = recruitNinja(g);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('Limite de');
    g.state.level = 1;
    expect(hireBlock(g, 'chunin')).toBeNull();
    while (g.ninjaCount() < g.ninjaCap()) createNinja(g, 100, 100);
    expect(hireBlock(g, 'chunin')).toContain('Limite de');
    g.state.level = 2;
    expect(ninjaBlock(g)).toBeNull();
  });
});

describe('vitrine', () => {
  test('a vila da vitrine respeita os tetos do nível 3', () => {
    const g = createDemoGame(SYSTEMS);
    for (const t of Object.keys(BUILDINGS) as BuildingType[]) expect(g.buildingCount(t)).toBeLessThanOrEqual(maxCountOf(t, g.state.level));
    expect(g.ninjaCount()).toBeLessThanOrEqual(g.ninjaCap());
    expect(g.population()).toBeLessThanOrEqual(g.popCap());
  });
});
