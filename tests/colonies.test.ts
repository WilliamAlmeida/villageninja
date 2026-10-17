// Colônias nas ilhas (docs/gdd-escala-ilhas-pvp.md, seção 5; game/colonies.ts): fundar, mandar gente, resumo por dia,
// tetos próprios, save/carregar e o limite de três.
import { describe, expect, test } from 'bun:test';
import { SAVE_VERSION, SIM_DT } from '../src/config';
import { COLONY, COLONY_PRODUCTION_CAP, colonyCapOf } from '../src/data/colonies';
import { colonyGame, colonyIncome, colonists, colonyPeople, createColony, homecomers, sendColonists, sendHome } from '../src/game/colonies';
import { canBuild, countBlock } from '../src/game/commands';
import { createDemoGame } from '../src/game/demo';
import type { Game } from '../src/game/game';
import { Game as GameClass } from '../src/game/game';
import { createNewGame } from '../src/game/newGame';
import { actionBlock, regionDaily, regionOf } from '../src/game/region';
import { migrate } from '../src/game/save';
import { SYSTEMS } from '../src/game/systems';
import { colonySystem } from '../src/game/systems/colonies';
import { addField, plotCap } from '../src/game/fields';
import { FIELD } from '../src/data/crops';

const run = (g: Game, seconds: number, until?: () => boolean) => {
  for (let t = 0; t < seconds; t += SIM_DT) {
    g.step(SIM_DT);
    if (until?.()) return;
  }
};

/** Vila com Porto, a Ilha do Recife explorada e recursos de sobra. */
function setup(seed: number) {
  const g = createNewGame(SYSTEMS, seed);
  Object.assign(g.state.res, { wood: 2000, stone: 2000, food: 2000, ryo: 9999 });
  const hk = g.hokage()!;
  g.addBuilding({ id: g.newId(), type: 'port', tx: hk.tx + 8, ty: hk.ty + 6, built: true, progress: 99, desired: 0, workers: [], cd: 0 });
  regionOf(g.state, 'recife').explored = true;
  g.state.timers.animal = g.state.timers.raid = 1e9;
  return g;
}

/** Funda a colônia e espera os colonos chegarem. */
function found(g: Game, villagers = 2, ninjas = 1) {
  const ids = colonists(g).ninjas.slice(0, ninjas).map((u) => u.id);
  const r = sendColonists(g, 'recife', { villagers, ninjaIds: ids });
  expect(r.ok).toBe(true);
  const e = g.state.expeditions.at(-1)!;
  run(g, COLONY.travel + 5, () => e.status === 'done');
  return colonyGame(g, 'recife')!;
}

describe('colônias nas ilhas', () => {
  test('fundar: só em ilha explorada e com Porto; paga o custo, cria o mapa no tema e os colonos chegam depois da viagem', () => {
    const g = setup(501);
    const s = g.state;
    regionOf(s, 'recife').explored = false;
    expect(sendColonists(g, 'recife', { villagers: 2, ninjaIds: [] }).ok).toBe(false);
    regionOf(s, 'recife').explored = true;
    expect(sendColonists(g, 'recife', { villagers: 0, ninjaIds: [] }).ok).toBe(false); // ninguém escolhido
    const pop = g.population();
    const wood = s.res.wood;
    const cg = found(g, 2, 1);
    expect(s.res.wood).toBe(wood - COLONY.cost.wood!);
    expect(regionOf(s, 'recife').colony).toBe(true);
    const c = cg.state;
    expect(c.mapW).toBe(COLONY.w);
    expect(c.mapH).toBe(COLONY.h);
    expect(c.colony?.theme).toBe('fishing');
    expect(c.buildings.some((b) => b.type === 'port' && b.built)).toBe(true);
    expect(c.buildings.some((b) => b.type === 'house' && b.built)).toBe(true);
    // a mudança: saíram da vila, entraram na colônia (o teto da colônia é dela; a vila ganha a vaga de volta)
    expect(colonyPeople(c).length).toBe(3);
    expect(colonyPeople(c).filter((u) => u.ninja).length).toBe(1);
    expect(g.population()).toBe(pop - 3);
    expect(g.colonyPopulation()).toBe(3);
    expect(s.expeditions.at(-1)!.kind).toBe('colony');
    expect(c.res).toBe(s.res); // tesouro compartilhado
  });

  test('mandar mais gente para a colônia que existe não paga de novo; a colônia na tela roda e dá emprego', () => {
    const g = setup(502);
    const cg = found(g, 1, 0);
    const ryo = g.state.res.ryo;
    expect(sendColonists(g, 'recife', { villagers: 2, ninjaIds: [] }).ok).toBe(true);
    expect(g.state.res.ryo).toBe(ryo);
    const e = g.state.expeditions.at(-1)!;
    run(g, COLONY.travel + 5, () => e.status === 'done');
    expect(colonyPeople(cg.state).length).toBe(3);
    // na tela: roda em detalhe no relógio da vila; os moradores pegam casa e emprego num campo cercado novo
    const house = cg.state.buildings.find((b) => b.type === 'house')!;
    const field = addField(cg, Array.from({ length: 9 }, (_, i) => [house.tx + (i % 3), house.ty - 5 + Math.floor(i / 3)] as [number, number]), 'wheat');
    g.activeColony = 'recife';
    run(g, 12);
    expect(cg.state.day).toBe(g.state.day);
    expect(field.workers.length).toBeGreaterThan(0);
    expect(colonyPeople(cg.state).every((u) => u.homeId != null)).toBe(true);
  });

  test('fora da tela, a virada do dia credita a produção uma vez só, cobra a comida e termina as obras', () => {
    const g = setup(503);
    const cg = found(g, 3, 1);
    const c = cg.state;
    const house = c.buildings.find((b) => b.type === 'house')!;
    addField(cg, Array.from({ length: 9 }, (_, i) => [house.tx + (i % 3), house.ty - 5 + Math.floor(i / 3)] as [number, number]), 'wheat');
    cg.addBuilding({ id: cg.newId(), type: 'tower', tx: house.tx + 5, ty: house.ty - 4, built: false, progress: 1, desired: 0, workers: [], cd: 0 });
    const income = colonyIncome(g, c);
    expect(income.food).toBeGreaterThan(0); // campo de trigo + o peixe da ilha
    expect(income.ryo).toBeGreaterThan(0); // pérolas: o recurso da ilha só vem da colônia
    g.state.res.food = 500;
    g.state.day += 1;
    c.colony!.day = g.state.day - 1;
    colonySystem(g, SIM_DT);
    const after = g.state.res.food;
    expect(after).toBeGreaterThan(500); // produziu mais do que comeu
    expect(c.colony!.day).toBe(g.state.day);
    expect(c.buildings.find((b) => b.type === 'tower')!.built).toBe(true);
    colonySystem(g, SIM_DT); // mesmo dia: nada dobra
    expect(g.state.res.food).toBe(after);
    // o posto avançado da mesma ilha não paga por fora
    regionOf(g.state, 'recife').outpost = true;
    const ryo = g.state.res.ryo;
    regionDaily(g);
    expect(g.state.res.ryo - ryo).toBeLessThan(20);
  });

  test('teto separado: quem mora na colônia não ocupa vaga na vila', () => {
    const g = setup(507);
    const cap = g.popCap();
    found(g, 2, 1);
    expect(g.popCap()).toBe(cap);
  });

  test('fora da tela também nasce gente na colônia (casal numa casa, vaga e comida), sem aviso por bebê', () => {
    const g = setup(508);
    const cg = found(g, 4, 0);
    const c = cg.state;
    // um casal numa casa da colônia
    const house = c.buildings.find((b) => b.type === 'house' && b.built)!;
    for (const u of colonyPeople(c).slice(0, 2)) u.homeId = house.id;
    // e vaga: uma segunda casa (a primeira já está cheia com os 4)
    cg.addBuilding({ id: cg.newId(), type: 'house', tx: house.tx - 6, ty: house.ty, built: true, progress: 99, desired: 0, workers: [], cd: 0 });
    const before = colonyPeople(c).length;
    g.state.res.food = 2000;
    g.state.day += 1;
    c.colony!.day = g.state.day - 1;
    colonySystem(g, SIM_DT);
    expect(colonyPeople(c).length).toBeGreaterThan(before);
    expect(c.colony!.log.at(-1)).toContain('nasceram');
    // sem comida não nasce ninguém
    const n = colonyPeople(c).length;
    g.state.res.food = 0;
    g.state.day += 1;
    colonySystem(g, SIM_DT);
    expect(colonyPeople(c).length).toBe(n);
  });

  test('mudar da colônia para a vila: saem na hora, chegam no Porto da vila e respeitam as vagas', () => {
    const g = setup(509);
    const cg = found(g, 3, 1);
    const pop = g.population();
    const ninjas = g.ninjaCount();
    const { ninjas: ns } = homecomers(cg);
    expect(sendHome(g, 'recife', { villagers: 0, ninjaIds: [] }).ok).toBe(false); // ninguém escolhido
    expect(sendHome(g, 'recife', { villagers: 2, ninjaIds: [ns[0]!.id] }).ok).toBe(true);
    expect(colonyPeople(cg.state).length).toBe(1);
    const e = g.state.expeditions.at(-1)!;
    expect(e.toHome).toBe(true);
    run(g, COLONY.travel + 5, () => e.status === 'done');
    expect(e.status).toBe('done');
    expect(g.population()).toBeGreaterThanOrEqual(pop + 3); // a vila pode ter tido um nascimento na viagem
    expect(g.ninjaCount()).toBe(ninjas + 1);
    // ids novos e válidos na vila
    expect(g.state.units.filter((u) => !u.dead).every((u) => g.unit(u.id) === u)).toBe(true);
    // sem vaga de moradia na vila: não dá
    const cg2 = colonyGame(g, 'recife')!;
    expect(homecomers(cg2).villagers.length).toBe(1);
    const cap = g.popCap();
    g.popCap = () => g.population();
    expect(sendHome(g, 'recife', { villagers: 1, ninjaIds: [] }).ok).toBe(false);
    g.popCap = () => cap;
  });

  test('tetos próprios da colônia: 4 casas, 3 de produção somados, 1 mercado, 4 torres, canteiros; Academia só na vila', () => {
    const g = setup(504);
    const cg = found(g, 1, 0);
    Object.assign(g.state.res, { wood: 9999, stone: 9999, ryo: 99999 });
    expect(colonyCapOf('house')).toBe(4);
    expect(colonyCapOf('tower')).toBe(4);
    expect(colonyCapOf('academy')).toBe(0);
    expect(colonyCapOf('lantern')).toBe(Infinity);
    const r = canBuild(cg, 'academy');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('só na vila');
    const add = (type: 'house' | 'ironmine' | 'lumber' | 'quarry') => cg.addBuilding({ id: cg.newId(), type, tx: 1, ty: 1, built: true, progress: 99, desired: 0, workers: [], cd: 0 });
    while (cg.buildingCount('house') < 4) add('house');
    expect(countBlock(cg, 'house')).toContain('Limite de 4 casas na colônia');
    add('ironmine');
    add('lumber');
    expect(canBuild(cg, 'quarry').ok).toBe(true);
    add('quarry');
    expect(countBlock(cg, 'lumber')).toContain(`Limite de ${COLONY_PRODUCTION_CAP} prédios de produção`);
    // campos: teto próprio de canteiros na colônia, menor que o da vila
    expect(plotCap(cg.state)).toBe(FIELD.colonyPlots);
    expect(plotCap(g.state)).toBeGreaterThan(0);
    // a vila continua com a tabela dela
    expect(countBlock(g, 'house')).toBeNull();
    expect(g.buildingCap('house')).toBeGreaterThan(4);
  });

  test('salvar e carregar: a colônia sobrevive no save da vila e o tesouro volta a ser um só', () => {
    const g = setup(505);
    const cg = found(g, 2, 1);
    const saved = JSON.parse(JSON.stringify(g.state));
    const back = migrate(saved)!;
    expect(back.version).toBe(SAVE_VERSION);
    expect(Object.keys(back.colonies)).toEqual(['recife']);
    const g2 = new GameClass(back, SYSTEMS);
    const cg2 = colonyGame(g2, 'recife')!;
    expect(cg2.state.res).toBe(g2.state.res);
    expect(colonyPeople(cg2.state).length).toBe(colonyPeople(cg.state).length);
    expect(cg2.state.colony?.node).toBe('recife');
    run(g2, 5); // roda sem quebrar
  });

  test('limite de três colônias e migração do save v47', () => {
    const g = setup(506);
    for (const id of ['recife', 'vulcao', 'nevoa']) {
      regionOf(g.state, id).explored = true;
      g.state.colonies[id] = createColony(g, id);
      regionOf(g.state, id).colony = true;
    }
    regionOf(g.state, 'templos').explored = true;
    expect(actionBlock(g, 'templos', 'colony')).toContain('3 colônias');
    expect(actionBlock(g, 'recife', 'colony')).toContain('já tem uma colônia');
    expect(sendColonists(g, 'templos', { villagers: 1, ninjaIds: [] }).ok).toBe(false);
    const old = JSON.parse(JSON.stringify(createNewGame(SYSTEMS, 507).state));
    old.version = 47;
    delete old.colonies;
    const m = migrate(old)!;
    expect(m.version).toBe(SAVE_VERSION);
    expect(m.colonies).toEqual({});
  });

  test('vitrine: a colônia da Ilha do Recife tem gente, uma obra e abre o mapa', () => {
    const g = createDemoGame(SYSTEMS);
    const cg = colonyGame(g, 'recife')!;
    expect(cg).not.toBeNull();
    expect(colonyPeople(cg.state).length).toBeGreaterThanOrEqual(6);
    expect(cg.state.fields.length).toBeGreaterThan(0);
    expect(cg.state.buildings.some((b) => !b.built)).toBe(true);
    g.activeColony = 'recife';
    run(g, 5);
  });
});
