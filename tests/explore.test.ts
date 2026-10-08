import { describe, expect, test } from 'bun:test';
import { SAVE_VERSION, SIM_DT } from '../src/config';
import { jutsuOptions } from '../src/game/commands';
import { killUnit } from '../src/game/combat';
import { createNinja } from '../src/game/entities';
import { discover, exploredPercent, guardiansOf, isExplored, sitePos } from '../src/game/explore';
import type { Game } from '../src/game/game';
import { createNewGame } from '../src/game/newGame';
import { migrate } from '../src/game/save';
import { SYSTEMS } from '../src/game/systems';
import { CENTER_TX, CENTER_TY } from '../src/game/world';

const run = (g: Game, seconds: number, until?: () => boolean) => {
  for (let t = 0; t < seconds; t += SIM_DT) {
    g.state.time = 30; // de dia
    g.step(SIM_DT);
    if (until?.()) return;
  }
};

describe('exploração', () => {
  test('mapa novo: vila explorada, bordas na névoa e locais escondidos', () => {
    const g = createNewGame(SYSTEMS, 71);
    const s = g.state;
    expect(isExplored(s, CENTER_TX, CENTER_TY)).toBe(true);
    expect(isExplored(s, 1, 1)).toBe(false);
    expect(s.sites.filter((x) => x.kind === 'ruin').length).toBe(3);
    expect(s.sites.filter((x) => x.kind === 'chest').length).toBe(5);
    expect(s.sites.every((x) => !x.found)).toBe(true);
  });

  test('ninja andando revela o mapa e descobre o local (ruína ganha guardiões)', () => {
    const g = createNewGame(SYSTEMS, 72);
    const ruin = g.state.sites.find((x) => x.kind === 'ruin')!;
    const p = sitePos(ruin);
    const n = createNinja(g, p.x + 64, p.y + 64, 'jounin', 0);
    n.ninja!.order = 'train';
    run(g, 0.5);
    expect(ruin.found).toBe(true);
    expect(guardiansOf(g, ruin).length).toBe(2);
    // guardiões não contam como invasão (a vila não fica em alerta de raid)
    expect(g.state.flags.raidActive).toBe(false);
  });

  test('baú: o ninja abre parado na frente dele, olhando para ele', () => {
    const g = createNewGame(SYSTEMS, 74);
    const chest = g.state.sites.find((x) => x.kind === 'chest')!;
    const cp = sitePos(chest);
    const a = createNinja(g, cp.x - 90, cp.y + 30, 'jounin', 0);
    a.hp = a.maxHp = 9999;
    a.command = { kind: 'investigate', siteId: chest.id, t: 0 };
    let seen = false;
    for (let t = 0; t < 20 && !chest.done; t += SIM_DT) {
      g.step(SIM_DT);
      if (a.state === 'investigate') seen = true;
    }
    expect(chest.done).toBe(true);
    expect(seen).toBe(true);
    expect(Math.hypot(a.x - cp.x, a.y - cp.y)).toBeLessThan(26); // de pertinho (antes abria a até 48 px)
    expect(a.x + a.y).toBeGreaterThan(cp.x + cp.y); // na frente (abaixo na tela)
  });

  test('investigar baú dá recursos; ruína dá pergaminho proibido depois dos guardiões', () => {
    const g = createNewGame(SYSTEMS, 73);
    const chest = g.state.sites.find((x) => x.kind === 'chest')!;
    const cp = sitePos(chest);
    const a = createNinja(g, cp.x + 20, cp.y + 20, 'jounin', 0);
    a.hp = a.maxHp = 9999;
    const before = Object.values(g.state.res).reduce((x, y) => x + y, 0);
    a.command = { kind: 'investigate', siteId: chest.id, t: 0 };
    run(g, 20, () => chest.done);
    expect(chest.done).toBe(true);
    expect(Object.values(g.state.res).reduce((x, y) => x + y, 0)).toBeGreaterThan(before - 50); // gastos de comida à parte

    const ruin = g.state.sites.find((x) => x.kind === 'ruin')!;
    discover(g, ruin);
    for (const gd of guardiansOf(g, ruin)) killUnit(g, gd, null);
    const rp = sitePos(ruin);
    const b = createNinja(g, rp.x + 20, rp.y + 20, 'jounin', 0);
    b.hp = b.maxHp = 9999;
    b.command = { kind: 'investigate', siteId: ruin.id, t: 0 };
    run(g, 20, () => ruin.done);
    expect(ruin.done).toBe(true);
    expect(g.state.scrolls.length).toBe(1);
    // o jutsu proibido só aparece para quem tem o pergaminho
    const id = g.state.scrolls[0]!;
    expect(jutsuOptions(b).some((o) => o.def.id === id)).toBe(false);
    expect(jutsuOptions(b, g.state.scrolls).some((o) => o.def.id === id)).toBe(true);
  });

  test('batedor (ordem Explorar) revela mais do mapa', () => {
    const g = createNewGame(SYSTEMS, 74);
    for (const u of g.state.units) if (u.kind === 'ninja') u.ninja!.order = 'scout';
    const before = exploredPercent(g.state);
    run(g, 60);
    expect(exploredPercent(g.state)).toBeGreaterThan(before + 3);
  });

  test('migra saves da versão 9 (névoa e locais)', () => {
    const g = createNewGame(SYSTEMS, 75);
    const old = JSON.parse(JSON.stringify(g.state));
    old.version = 9;
    delete old.explored;
    delete old.sites;
    delete old.scrolls;
    const s = migrate(old)!;
    expect(s.version).toBe(SAVE_VERSION);
    expect(isExplored(s, CENTER_TX, CENTER_TY)).toBe(true);
    expect(s.sites.length).toBeGreaterThan(5);
    expect(s.scrolls).toEqual([]);
  });
});
