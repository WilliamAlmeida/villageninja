import { describe, expect, test } from 'bun:test';
import { SAVE_VERSION } from '../src/config';
import { SOUND } from '../src/data/sound';
import { killUnit } from '../src/game/combat';
import { createNinja } from '../src/game/entities';
import { canHit } from '../src/game/factions';
import type { Game } from '../src/game/game';
import { createNewGame } from '../src/game/newGame';
import { actionBlock, resolveRegion } from '../src/game/region';
import { migrate } from '../src/game/save';
import { createSoundMember, grab, soundOnMap, soundTarget, soundTick, taken, WITH_SOUND } from '../src/game/sound';
import { SYSTEMS } from '../src/game/systems';
import { SIM_DT } from '../src/config';
import { refreshDerived } from '../src/game/entities';
import { startRegion } from '../src/game/region';
import { sceneGame } from '../src/game/scene';
import { teamUnits } from '../src/game/teams';
import type { Expedition } from '../src/game/types';

function village(g: Game) {
  g.state.level = 2;
  const a = createNinja(g, 600, 600, 'jounin', 0);
  a.ninja!.level = 30;
  a.ninja!.rank = 'kage';
  g.state.kageId = a.id;
  const b = createNinja(g, 620, 600, 'genin', 0);
  b.ninja!.kekkei = 'mokuton';
  const c = createNinja(g, 640, 600, 'chunin', 0);
  c.ninja!.level = 12;
  return { kage: a, gifted: b, other: c };
}

describe('Quinteto do Som', () => {
  test('invadem atrás do mais talentoso (kekkei genkai primeiro; nunca o Kage)', () => {
    const g = createNewGame(SYSTEMS, 2201);
    const v = village(g);
    expect(soundTarget(g)?.id).toBe(v.gifted.id);
    g.state.sound.nextDay = g.state.day;
    soundTick(g, 0.1);
    expect(soundOnMap(g).length).toBe(4);
    expect(g.state.sound.raid?.targetId).toBe(v.gifted.id);
  });

  test('derrubar quem carrega solta o raptado; sem rapto, a invasão conta como impedida', () => {
    const g = createNewGame(SYSTEMS, 2202);
    const v = village(g);
    g.state.sound.nextDay = g.state.day;
    soundTick(g, 0.1);
    const [carrier] = soundOnMap(g);
    grab(g, carrier!, v.gifted);
    expect(v.gifted.captiveOf).toBe(carrier!.id);
    expect(canHit('enemy', undefined, v.gifted)).toBe(false);
    killUnit(g, carrier!, null);
    expect(v.gifted.captiveOf).toBeUndefined();
    const ryo = g.state.res.ryo;
    for (const u of soundOnMap(g)) killUnit(g, u, null);
    soundTick(g, 0.1);
    expect(g.state.sound.stopped).toBe(1);
    expect(g.state.res.ryo).toBeGreaterThan(ryo);
  });

  test('levado: esconderijo na Região com prazo; passou o prazo, volta com o selo; derrotado, volta para a vila', () => {
    const g = createNewGame(SYSTEMS, 2203);
    const v = village(g);
    g.state.sound.nextDay = g.state.day;
    soundTick(g, 0.1);
    const [carrier] = soundOnMap(g);
    grab(g, carrier!, v.gifted);
    taken(g, carrier!, v.gifted);
    expect(v.gifted.away).toBe(WITH_SOUND);
    expect(g.state.sound.lost).toBe(1);
    expect(actionBlock(g, 'som', 'rescue')).toBeNull();
    const before = v.gifted.ninja!.stats.ninjutsu;
    g.state.day = g.state.sound.captive!.until + 1;
    soundTick(g, 0.1);
    expect(v.gifted.faction).toBe('enemy');
    expect(v.gifted.cursed).toBe(true);
    expect(v.gifted.ninja!.stats.ninjutsu).toBeGreaterThanOrEqual(Math.min(10, before + SOUND.curse) - 0.001);
    v.gifted.away = undefined;
    v.gifted.hidden = false;
    killUnit(g, v.gifted, null);
    expect(v.gifted.dead).toBeFalsy();
    expect(v.gifted.faction).toBe('village');
  });

  test('na invasão eles matam até 4; dali em diante quem derrubam fica nocauteado', () => {
    const g = createNewGame(SYSTEMS, 2206);
    village(g);
    g.state.sound.raid = { targetId: 0, t: 0, taken: false };
    const m = createSoundMember(g, 'kanade', 500, 500);
    const victims = Array.from({ length: SOUND.maxKills + 2 }, (_, i) => createNinja(g, 600 + i * 10, 600, 'genin', 0));
    for (const v of victims) killUnit(g, v, m);
    expect(victims.filter((v) => v.dead).length).toBe(SOUND.maxKills);
    const ko = victims.filter((v) => !v.dead);
    expect(ko.length).toBe(2);
    expect(ko.every((v) => v.hp === 1 && v.stun > 0)).toBe(true);
  });

  test('resgate jogável: caverna com o líder e dois membros; vencendo, o raptado volta', () => {
    const g = createNewGame(SYSTEMS, 2207);
    g.state.level = 2;
    const team = g.state.teams[0]!;
    const us = teamUnits(g, team);
    const victim = createNinja(g, 600, 600, 'genin', 0);
    const m = createSoundMember(g, 'iwao', 500, 500);
    grab(g, m, victim);
    taken(g, m, victim);
    for (const u of us) {
      const st = u.ninja!.stats;
      for (const k of Object.keys(st) as (keyof typeof st)[]) st[k] = 10;
      refreshDerived(u);
      u.hp = u.maxHp;
    }
    expect(startRegion(g, team.id, 'som', 'rescue').ok).toBe(true);
    for (let t = 0; t < 30 && !g.state.scene; t += SIM_DT) g.step(SIM_DT);
    const sg = sceneGame(g)!;
    expect(sg.state.sceneInfo!.node).toBe('som');
    const guards = sg.state.units.filter((u) => u.sound).map((u) => u.sound);
    expect(guards).toContain('hakkotsu');
    expect(guards.length).toBe(3);
    for (const u of sg.state.units) if (u.sound) killUnit(sg, u, null);
    const e = g.state.expeditions.at(-1)!;
    for (let t = 0; t < 60 && e.status !== 'done' && e.status !== 'lost'; t += SIM_DT) g.step(SIM_DT);
    expect(victim.away).toBeUndefined();
    expect(g.state.sound.captive).toBeNull();
  });

  test('resgate vencido traz o raptado de volta', () => {
    const g = createNewGame(SYSTEMS, 2204);
    const v = village(g);
    const m = createSoundMember(g, 'iwao', 500, 500);
    grab(g, m, v.other);
    taken(g, m, v.other);
    const e: Expedition = { id: 1, kind: 'region', node: 'som', action: 'rescue', teamId: -1, unitIds: [], floor: 0, timer: 0, status: 'scene', log: [], loot: {}, day: 1 };
    resolveRegion(g, e, 'win');
    expect(v.other.away).toBeUndefined();
    expect(g.state.sound.captive).toBeNull();
  });
});

test('migra saves da versão 21 (Quinteto do Som)', () => {
  const g = createNewGame(SYSTEMS, 2205);
  const old = JSON.parse(JSON.stringify(g.state));
  old.version = 21;
  delete old.sound;
  delete old.region.som;
  const s = migrate(old)!;
  expect(s.version).toBe(SAVE_VERSION);
  expect(s.sound.captive).toBeNull();
  expect(s.region.som).toBeDefined();
});
