import { describe, expect, test } from 'bun:test';
import { SAVE_VERSION, SIM_DT } from '../src/config';
import { ORG_PAIRS } from '../src/data/org';
import { applyDamage, killUnit } from '../src/game/combat';
import { refreshDerived } from '../src/game/entities';
import type { Game } from '../src/game/game';
import { createNewGame } from '../src/game/newGame';
import { createOrgMember, orgOnMap, orgTick, prepareDefense } from '../src/game/org';
import { actionBlock, startRegion } from '../src/game/region';
import { migrate } from '../src/game/save';
import { sceneGame } from '../src/game/scene';
import { SYSTEMS } from '../src/game/systems';
import { teamUnits } from '../src/game/teams';

const run = (g: Game, seconds: number, until?: () => boolean) => {
  for (let t = 0; t < seconds; t += SIM_DT) {
    g.step(SIM_DT);
    if (until?.()) return;
  }
};

describe('Ordem do Eclipse', () => {
  test('só aparece na Vila Oculta; manda a primeira dupla, que caça o ninja mais forte', () => {
    const g = createNewGame(SYSTEMS, 1001);
    orgTick(g);
    expect(orgOnMap(g).length).toBe(0); // aldeia: ainda não
    g.state.level = 2;
    g.state.org.nextDay = g.state.day;
    orgTick(g);
    expect(orgOnMap(g).length).toBe(0); // os Espadachins ainda não vieram (ordem da história: Som, Névoa, Eclipse)
    g.state.swordsmen.raids = 1;
    orgTick(g);
    const on = orgOnMap(g);
    expect(on.map((u) => u.org).sort()).toEqual([...ORG_PAIRS[0]!].sort());
    expect(on.every((u) => u.boss)).toBe(true);
  });

  test('caídas as três duplas, a Ordem volta com membros novos e mais fortes', () => {
    const g = createNewGame(SYSTEMS, 1003);
    g.state.level = 2;
    g.state.swordsmen.raids = 1;
    g.state.org.down = ORG_PAIRS.flat();
    g.state.org.lairKnown = true;
    g.state.org.nextDay = g.state.day;
    const ref = createOrgMember(g, 'goen', 100, 100);
    const plain = ref.maxHp;
    ref.dead = true;
    orgTick(g);
    expect(g.state.org.cycle).toBe(1);
    expect(g.state.org.lairKnown).toBe(true); // o covil continua lá
    const on = orgOnMap(g);
    expect(on.map((u) => u.org).sort()).toEqual([...ORG_PAIRS[0]!].sort());
    expect(on.find((u) => u.org === 'goen')!.maxHp).toBeGreaterThan(plain);
  });

  test('covil destruído: some uns dias e depois se reergue do zero', () => {
    const g = createNewGame(SYSTEMS, 1004);
    g.state.level = 2;
    g.state.swordsmen.raids = 1;
    g.state.org.down = [...ORG_PAIRS.flat()];
    g.state.org.done = true;
    g.state.org.nextDay = g.state.day + 5;
    orgTick(g);
    expect(orgOnMap(g).length).toBe(0);
    g.state.org.nextDay = g.state.day;
    orgTick(g);
    expect(g.state.org.done).toBe(false);
    expect(g.state.org.lairKnown).toBe(false);
    expect(orgOnMap(g).length).toBe(2);
  });

  test('Tetsuo recebe metade do dano; quem cai não volta; caídas as duplas, o covil aparece', () => {
    const g = createNewGame(SYSTEMS, 1002);
    g.state.level = 2;
    const a = createOrgMember(g, 'tetsuo', 600, 600);
    const b = createOrgMember(g, 'goen', 640, 600);
    a.kawaCd = b.kawaCd = 999;
    const hpA = a.hp;
    const hpB = b.hp;
    applyDamage(g, null, a, 100, null, {});
    applyDamage(g, null, b, 100, null, {});
    expect(hpA - a.hp).toBeLessThan((hpB - b.hp) * 0.75);
    for (const pair of ORG_PAIRS)
      for (const id of pair) {
        const u = createOrgMember(g, id, 500, 500);
        killUnit(g, u, null);
      }
    expect(g.state.org.down.length).toBe(6);
    expect(g.state.org.lairKnown).toBe(true);
    expect(actionBlock(g, 'covil', 'assault')).toBeNull();
  });

  test('invasão do covil: mapa de caverna com os guardiões e o líder; vencendo, a Ordem acaba', () => {
    const g = createNewGame(SYSTEMS, 1003);
    Object.assign(g.state.res, { ryo: 9999, food: 999 });
    g.state.level = 2;
    g.state.org.lairKnown = true;
    g.state.org.down = ORG_PAIRS.flat();
    const team = g.state.teams[0]!;
    for (const u of teamUnits(g, team)) {
      const n = u.ninja!;
      n.rank = 'jounin';
      for (const k of Object.keys(n.stats) as (keyof typeof n.stats)[]) n.stats[k] = 10;
      refreshDerived(u);
      u.hp = u.maxHp;
    }
    expect(startRegion(g, team.id, 'covil', 'assault').ok).toBe(true);
    run(g, 30, () => !!g.state.scene);
    const sg = sceneGame(g)!;
    expect(sg.state.sceneInfo!.kind).toBe('hideout');
    expect(sg.state.units.filter((u) => u.org).map((u) => u.org).sort()).toEqual(['tsuchigumo', 'yomi']);
    // vitória (forçada aqui: o teste é do fim, não da luta)
    for (const u of sg.state.units) if (u.org) killUnit(sg, u, null);
    const e = g.state.expeditions.at(-1)!;
    run(g, 60, () => e.status === 'done' || e.status === 'lost');
    expect(g.state.org.done).toBe(true);
    expect(e.loot.darksteel).toBeGreaterThan(0);
  });

  test('Preparar defesa: ninjas livres patrulham e os novatos ficam protegidos', () => {
    const g = createNewGame(SYSTEMS, 1005);
    g.state.flags.shelterRookies = false;
    const r = prepareDefense(g);
    expect(r.ok).toBe(true);
    const ninjas = g.state.units.filter((u) => !u.dead && u.kind === 'ninja' && u.faction === 'village');
    expect(ninjas.every((u) => u.ninja!.order === 'patrol')).toBe(true);
    expect(g.state.flags.shelterRookies).toBe(true);
  });

  test('migra saves da versão 19 (Ordem do Eclipse)', () => {
    const g = createNewGame(SYSTEMS, 1004);
    const old = JSON.parse(JSON.stringify(g.state));
    old.version = 19;
    delete old.org;
    delete old.region.covil;
    const s = migrate(old)!;
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.org.down).toEqual([]);
    expect(s.region.covil).toBeDefined();
  });
});
