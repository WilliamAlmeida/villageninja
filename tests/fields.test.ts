// Campos cercados (game/fields.ts, data/crops.ts): pintar em formato livre, teto de canteiros, o ciclo do canteiro
// (arar, semear, crescer, colher), água, murcha, geada, solo cansado e a migração das fazendas antigas (save v49).
import { describe, expect, test } from 'bun:test';
import { DAY_LENGTH, SAVE_VERSION, SIM_DT } from '../src/config';
import { CROPS, FIELD } from '../src/data/crops';
import { SEASON_DAYS } from '../src/data/seasons';
import {
  addField, commitFields, cropBlock, cropTick, draftField, type FieldDraft, isPaddy, plotAt, plotBlock, plotCap, plotCount, setFieldCrop, workPlot,
} from '../src/game/fields';
import type { Game } from '../src/game/game';
import { createNewGame } from '../src/game/newGame';
import { migrate } from '../src/game/save';
import { SYSTEMS } from '../src/game/systems';
import { T } from '../src/game/world';

/** Vila sem o campo inicial, com madeira de sobra, sem bichos nem invasões. */
function setup(seed: number) {
  const g = createNewGame(SYSTEMS, seed);
  g.state.fields = [];
  g.world.rebuild();
  Object.assign(g.state.res, { wood: 999, food: 500 });
  g.state.timers.animal = g.state.timers.raid = 1e9;
  return g;
}

/** Um canto livre de `w`×`h` tiles perto da Residência (para pintar). */
function freeSpot(g: Game, w: number, h: number) {
  const hk = g.hokage()!;
  for (let r = 4; r < 30; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const x0 = hk.tx + dx;
        const y0 = hk.ty + dy;
        let ok = true;
        for (let y = 0; y < h && ok; y++) for (let x = 0; x < w && ok; x++) if (plotBlock(g, x0 + x, y0 + y, 0)) ok = false;
        if (ok) return { x0, y0 };
      }
  throw new Error('sem espaço');
}

const paint = (g: Game, tiles: [number, number][]) => {
  const d: FieldDraft = new Map();
  for (const [x, y] of tiles) draftField(g, d, x, y, true);
  return commitFields(g, d);
};

describe('campos cercados', () => {
  test('pintar em formato livre: paga a cerca, canteiros ligados viram um cercado, soltos viram outro, e se juntam', () => {
    const g = setup(301);
    const { x0, y0 } = freeSpot(g, 6, 3);
    const wood = g.state.res.wood;
    // um L de 4 canteiros e um canteiro solto mais adiante
    expect(paint(g, [[x0, y0], [x0, y0 + 1], [x0, y0 + 2], [x0 + 1, y0 + 2], [x0 + 4, y0]])).toBe(5);
    expect(g.state.res.wood).toBe(wood - 5 * FIELD.cost.wood);
    expect(g.state.fields.length).toBe(2);
    expect(plotAt(g, x0, y0)!.field).toBe(plotAt(g, x0 + 1, y0 + 2)!.field);
    // ligar os dois: vira um cercado só, com a cultura do maior
    setFieldCrop(g, plotAt(g, x0, y0)!.field.id, 'turnip');
    paint(g, [[x0 + 1, y0], [x0 + 2, y0], [x0 + 3, y0]]);
    expect(g.state.fields.length).toBe(1);
    expect(g.state.fields[0]!.crop).toBe('turnip');
    // tirar o meio parte em dois, com a mesma cultura
    const d: FieldDraft = new Map();
    draftField(g, d, x0 + 2, y0, false);
    commitFields(g, d);
    expect(g.state.fields.length).toBe(2);
    expect(g.state.fields.every((f) => f.crop === 'turnip')).toBe(true);
    // prédio não entra no canteiro
    expect(g.world.canPlace('tower', x0, y0)).toBe(false);
  });

  test('teto total de canteiros pelo nível da vila', () => {
    const g = setup(302);
    const cap = plotCap(g.state);
    expect(cap).toBe(FIELD.maxPlots[0]);
    const { x0, y0 } = freeSpot(g, 6, 6);
    const tiles: [number, number][] = [];
    for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) tiles.push([x0 + x, y0 + y]);
    paint(g, tiles);
    expect(plotCount(g.state)).toBe(cap);
    expect(plotBlock(g, x0 + 7, y0)).toContain(`Limite de ${cap} canteiros`);
    g.state.level = 2;
    expect(plotCap(g.state)).toBe(FIELD.maxPlots[2]);
  });

  test('o fazendeiro ara, semeia e colhe; o canteiro cresce por dias de jogo', () => {
    const g = setup(303);
    const { x0, y0 } = freeSpot(g, 3, 2);
    const tiles: [number, number][] = [];
    for (let y = 0; y < 2; y++) for (let x = 0; x < 3; x++) tiles.push([x0 + x, y0 + y]);
    const f = addField(g, tiles, 'wheat');
    // de dia, os fazendeiros pedidos chegam e aram/semeiam tudo
    for (let t = 0; t < 90; t += SIM_DT) {
      g.state.time = 30 + (g.state.day - 1) * DAY_LENGTH;
      g.step(SIM_DT);
      if (f.plots.every((p) => p.st === 2)) break;
    }
    expect(f.workers.length).toBeGreaterThan(0);
    expect(f.plots.every((p) => p.st === 2 && p.crop === 'wheat')).toBe(true);
    // crescer: três dias com água = maduro
    for (const p of f.plots) p.wet = 1e9;
    for (let i = 0; i < CROPS.wheat.days * DAY_LENGTH + 5; i++) cropTick(g, 1);
    expect(f.plots.every((p) => p.st === 3)).toBe(true);
    // colher rende comida e o canteiro volta a ficar arado
    const food = g.state.res.food;
    for (let t = 0; t < 120; t += SIM_DT) {
      g.state.time = 30 + (g.state.day - 1) * DAY_LENGTH;
      g.step(SIM_DT);
      if (f.plots.every((p) => p.st !== 3)) break;
    }
    expect(f.plots.some((p) => p.st !== 3)).toBe(true);
    expect(g.state.res.food).toBeGreaterThan(food);
  });

  test('seco cresce na metade; o maduro murcha se ninguém colhe', () => {
    const g = setup(304);
    const { x0, y0 } = freeSpot(g, 2, 1);
    const f = addField(g, [[x0, y0], [x0 + 1, y0]], 'turnip', (p) => Object.assign(p, { st: 2, crop: 'turnip', g: 0 }));
    f.plots[0]!.wet = 1e9;
    f.plots[1]!.wet = 0;
    g.state.weather = 'clear';
    const dry = !isPaddy(g.state, f.plots[1]!.tx, f.plots[1]!.ty);
    for (let i = 0; i < DAY_LENGTH; i++) cropTick(g, 1);
    if (dry) expect(f.plots[1]!.g).toBeLessThan(f.plots[0]!.g * 0.75);
    Object.assign(f.plots[0]!, { st: 3, g: 1, ripe: 0 });
    for (let i = 0; i < (FIELD.witherDays + 0.1) * DAY_LENGTH; i++) cropTick(g, 1);
    expect(f.plots[0]!.st).toBe(1);
  });

  test('arroz só na beira da água; a geada do inverno mata a abóbora', () => {
    const g = setup(305);
    const { x0, y0 } = freeSpot(g, 2, 2);
    const f = addField(g, [[x0, y0], [x0 + 1, y0]], 'wheat');
    if (!f.plots.some((p) => isPaddy(g.state, p.tx, p.ty))) {
      expect(cropBlock(g, f, 'rice')).toContain('vizinho de água');
      expect(setFieldCrop(g, f.id, 'rice').ok).toBe(false);
    }
    // um tile de água colado: agora dá
    g.state.tiles[(y0 + 1) * g.state.mapW + x0] = T.WATER;
    expect(cropBlock(g, f, 'rice')).toBeNull();
    // inverno com neve: abóbora plantada morre
    const p2 = addField(g, [[x0 + 5, y0 + 5]], 'pumpkin', (p) => Object.assign(p, { st: 2, crop: 'pumpkin', g: 0.5 })).plots[0]!;
    g.state.day = SEASON_DAYS * 3 + 1;
    g.state.weather = 'snow';
    cropTick(g, 1);
    expect(p2.st).toBe(1);
  });

  test('solo cansa repetindo a cultura e descansa trocando', () => {
    const g = setup(306);
    const { x0, y0 } = freeSpot(g, 1, 1);
    const f = addField(g, [[x0, y0]], 'wheat');
    const p = f.plots[0]!;
    const u = g.villagers()[0]!;
    const harvest = (crop: 'wheat' | 'turnip') => {
      Object.assign(p, { st: 3, crop, g: 1 });
      workPlot(g, f, p, u);
    };
    harvest('wheat');
    harvest('wheat');
    expect(p.fert).toBeLessThan(1);
    const tired = p.fert;
    harvest('turnip');
    expect(p.fert).toBeGreaterThan(tired);
  });

  test('migração v48 → v49: Fazenda e Horta viram campos com os mesmos trabalhadores', () => {
    const g = createNewGame(SYSTEMS, 307);
    const old = JSON.parse(JSON.stringify(g.state));
    old.version = 48;
    old.fields = undefined;
    const v = old.units.find((u: { kind: string }) => u.kind === 'villager');
    old.buildings.push({ id: 9001, type: 'farm', tx: 10, ty: 10, built: true, progress: 10, desired: 2, workers: [v.id], cd: 0 });
    old.buildings.push({ id: 9002, type: 'herbgarden', tx: 20, ty: 10, built: true, progress: 10, desired: 2, workers: [], cd: 0 });
    v.jobId = 9001;
    const m = migrate(old)!;
    expect(m.version).toBe(SAVE_VERSION);
    expect(m.buildings.some((b) => b.type === 'farm' || b.type === 'herbgarden')).toBe(false);
    const wheat = m.fields.find((f) => f.crop === 'wheat' && f.plots.some((p) => p.tx === 10 && p.ty === 10))!;
    expect(wheat.plots.length).toBe(9);
    expect(wheat.workers).toContain(v.id);
    expect(m.units.find((u) => u.id === v.id)!.fieldId).toBe(wheat.id);
    expect(m.fields.find((f) => f.crop === 'herbs')!.plots.length).toBe(4);
  });

  test('jogo novo já começa com um campo de trigo crescendo', () => {
    const g = createNewGame(SYSTEMS, 308);
    expect(g.state.fields.length).toBe(1);
    expect(g.state.fields[0]!.plots.every((p) => p.st === 2)).toBe(true);
  });
});
