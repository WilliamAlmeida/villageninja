import { describe, expect, test } from 'bun:test';
import { SAVE_VERSION } from '../src/config';
import { levelDef } from '../src/data/villageLevels';
import { canBuild, placeBuilding, promote } from '../src/game/commands';
import { createNinja, createVillager } from '../src/game/entities';
import type { Game } from '../src/game/game';
import { createNewGame } from '../src/game/newGame';
import { migrate } from '../src/game/save';
import { SYSTEMS } from '../src/game/systems';
import type { BuildingType } from '../src/data/buildings';
import { inTerritory, nextLevelStatus, territoryCenter, upgradeVillage } from '../src/game/village';
import { electionStatus } from '../src/game/kage';

const rich = (g: Game) => (g.state.res = { wood: 9999, stone: 9999, food: 9999, ryo: 99999, iron: 999, herbs: 999, paper: 999, crystal: 0, gold: 0, darksteel: 0 });

/** Cria prédios já prontos (atalho para testes). */
function addBuilt(g: Game, type: BuildingType, n: number) {
  for (let i = 0; i < n; i++)
    g.addBuilding({ id: g.newId(), type, tx: 1, ty: 1, built: true, progress: 999, desired: 0, workers: [], cd: 0 });
}

describe('níveis da vila', () => {
  test('começa como Aldeia e bloqueia prédios de níveis maiores', () => {
    const g = createNewGame(SYSTEMS, 1);
    rich(g);
    expect(g.state.level).toBe(0);
    expect(canBuild(g, 'hospital').ok).toBe(false);
    expect(canBuild(g, 'library').ok).toBe(false);
    expect(canBuild(g, 'house').ok).toBe(true);
  });

  test('território limita onde se pode construir', () => {
    const g = createNewGame(SYSTEMS, 2);
    rich(g);
    const c = territoryCenter(g.state)!;
    const far = { tx: Math.round(c.tx + levelDef(0).territory + 2), ty: Math.round(c.ty) };
    expect(inTerritory(g.state, far.tx, far.ty, 2, 3)).toBe(false);
    const r = placeBuilding(g, 'house', far.tx, far.ty);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('território');
    g.state.level = 1;
    expect(inTerritory(g.state, Math.round(c.tx + 13), Math.round(c.ty), 2, 3)).toBe(true);
  });

  test('requisitos impedem e depois permitem evoluir', () => {
    const g = createNewGame(SYSTEMS, 3);
    rich(g);
    expect(upgradeVillage(g).ok).toBe(false);
    const st = nextLevelStatus(g)!;
    expect(st.ready).toBe(false);
    // cumpre os requisitos da Vila
    while (g.population() < 14) createVillager(g, 100, 100);
    while (g.state.units.filter((u) => u.kind === 'ninja').length < 4) createNinja(g, 100, 100);
    addBuilt(g, 'house', 1);
    addBuilt(g, 'academy', 1);
    addBuilt(g, 'training', 1);
    expect(nextLevelStatus(g)!.ready).toBe(true);
    const before = g.state.res.ryo;
    expect(upgradeVillage(g).ok).toBe(true);
    expect(g.state.level).toBe(1);
    expect(g.state.res.ryo).toBe(before - (levelDef(1).cost.ryo ?? 0));
    expect(canBuild(g, 'hospital').ok).toBe(true);
    expect(canBuild(g, 'sealshop').ok).toBe(false);
  });

  test('Kage só pode ser eleito em Vila Oculta (e não por promoção comum)', () => {
    const g = createNewGame(SYSTEMS, 4);
    rich(g);
    const n = createNinja(g, 100, 100, 'jounin', 0);
    n.ninja!.level = 20;
    expect(promote(g, n.id).ok).toBe(false);
    expect(electionStatus(g).ready).toBe(false);
    g.state.level = 2;
    expect(promote(g, n.id).ok).toBe(false);
    expect(electionStatus(g).ready).toBe(true);
  });

  test('migra saves da versão 2', () => {
    const g = createNewGame(SYSTEMS, 5);
    const old = JSON.parse(JSON.stringify(g.state));
    old.version = 2;
    delete old.level;
    const s = migrate(old)!;
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.level).toBe(0);
  });
});

describe('teto de população pelo nível da vila', () => {
  test('casas sobrando não passam do teto do nível', async () => {
    const { createNewGame } = await import('../src/game/newGame');
    const { SYSTEMS } = await import('../src/game/systems');
    const { levelDef } = await import('../src/data/villageLevels');
    const g = createNewGame(SYSTEMS, 61);
    for (let i = 0; i < 30; i++) g.state.buildings.push({ id: g.newId(), type: 'house', tx: 2 + (i % 10) * 2, ty: 2 + Math.floor(i / 10) * 2, built: true, progress: 99, desired: 0, workers: [], cd: 0 });
    g.state.level = 0;
    expect(g.housingCap()).toBeGreaterThan(levelDef(0).popLimit);
    expect(g.popCap()).toBe(levelDef(0).popLimit);
    g.state.level = 3;
    expect(g.popCap()).toBe(Math.min(g.housingCap(), levelDef(3).popLimit));
  });
});
