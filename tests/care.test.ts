import { describe, expect, test } from 'bun:test';
import { SAVE_VERSION, SIM_DT } from '../src/config';
import { xpToNext } from '../src/data/ninja';
import { applyDamage, killUnit } from '../src/game/combat';
import { catchingUp, fightPower, rescueChance } from '../src/game/care';
import { createNinja, createRogue } from '../src/game/entities';
import type { Game } from '../src/game/game';
import { createNewGame } from '../src/game/newGame';
import { trainTick } from '../src/game/progression';
import { migrate } from '../src/game/save';
import { SYSTEMS } from '../src/game/systems';
import { raidStrength } from '../src/game/systems/spawner';
import type { Unit } from '../src/game/types';
import { doorPos } from '../src/game/world';

/** XP acumulado desde o nível 1. */
const totalXp = (u: Unit) => {
  let t = u.ninja!.xp;
  for (let l = 1; l < u.ninja!.level; l++) t += xpToNext(l);
  return t;
};
const hospital = (g: Game, level = 1) =>
  g.addBuilding({ id: g.newId(), type: 'hospital', tx: 4, ty: 4, built: true, progress: 999, desired: 0, workers: [], cd: 0, level });

describe('cuidado com os ninjas', () => {
  test('A. o XP do abate é dividido com quem também acertou', () => {
    const g = createNewGame(SYSTEMS, 401);
    const a = createNinja(g, 700, 500, 'genin', 0);
    const b = createNinja(g, 720, 500, 'genin', 0);
    const foe = createRogue(g, 710, 520, 30);
    const xa = totalXp(a);
    const xb = totalXp(b);
    applyDamage(g, b, foe, 1, null, {}); // b ajudou
    killUnit(g, foe, a); // a derrubou
    const xp = 40 + g.state.day * 3;
    expect(totalXp(a) - xa).toBe(xp);
    expect(totalXp(b) - xb).toBe(Math.round(xp * 0.5));
  });

  test('B. novato se abriga de inimigo forte demais; sem veteranos ou com a opção desligada, luta', () => {
    const setup = (veteran: boolean, on = true) => {
      const g = createNewGame(SYSTEMS, 402);
      g.state.flags.shelterRookies = on;
      for (const u of g.state.units) if (u.kind === 'ninja') u.dead = true;
      const d = doorPos(g.hokage()!);
      const rookie = createNinja(g, d.x + 20, d.y + 30, 'genin', 0);
      if (veteran) {
        const v = createNinja(g, d.x - 400, d.y - 300, 'chunin', 0);
        v.ninja!.rank = 'chunin';
      }
      const foe = createRogue(g, d.x + 120, d.y + 40, 60, { rank: 'jounin', stats: 3 });
      foe.hp = foe.maxHp = 9999;
      expect(fightPower(foe)).toBeGreaterThan(fightPower(rookie) * 1.5);
      // o que o novato fez em algum momento do primeiro segundo (sozinho contra um jounin ele apanha rápido)
      const did = new Set<string>();
      for (let t = 0; t < 1; t += SIM_DT) {
        g.state.time = 30;
        g.step(SIM_DT);
        did.add(rookie.state);
      }
      return { fought: did.has('fight'), sheltered: did.has('toShelter') || did.has('shelter') };
    };
    expect(setup(true)).toEqual({ fought: false, sheltered: true });
    expect(setup(false)).toEqual({ fought: true, sheltered: false }); // única defesa da vila
    expect(setup(true, false)).toEqual({ fought: true, sheltered: false });
  });

  test('C. invasões seguem a força da vila mais que os dias', () => {
    const weak = raidStrength(84, 1, 40);
    const strong = raidStrength(84, 1, 450);
    expect(weak.stats).toBeLessThan(strong.stats);
    expect(weak.count).toBeLessThan(strong.count);
    expect(weak.rank).not.toBe('jounin');
    expect(raidStrength(3, 0, 36).rank).toBe('genin');
  });

  test('D. quem ficou para trás treina com XP em dobro', () => {
    const g = createNewGame(SYSTEMS, 403);
    const vets = g.state.units.filter((u) => u.kind === 'ninja');
    for (const v of vets) v.ninja!.level = 12;
    const rookie = createNinja(g, 700, 500, 'genin', 0);
    const peer = createNinja(g, 720, 500, 'genin', 0);
    peer.ninja!.level = 12;
    expect(catchingUp(g, rookie)).toBe(true);
    expect(catchingUp(g, peer)).toBe(false);
    const r0 = totalXp(rookie);
    trainTick(g, rookie);
    const p0 = peer.ninja!.xp;
    trainTick(g, peer);
    expect(totalXp(rookie) - r0).toBe((peer.ninja!.xp - p0) * 2);
  });

  test('E. com Hospital, quem cai pode ser resgatado ferido em vez de morrer', () => {
    const g = createNewGame(SYSTEMS, 404);
    const n = createNinja(g, 700, 500, 'genin', 0);
    const foe = createRogue(g, 720, 500, 10);
    expect(rescueChance(g, n)).toBe(0);
    hospital(g, 3);
    expect(rescueChance(g, n)).toBeCloseTo(0.65);
    const random = Math.random;
    Math.random = () => 0; // o resgate dá certo (e nada de esquiva/Kawarimi atrapalha: golpe direto)
    try {
      n.kawaCd = 999;
      applyDamage(g, foe, n, 9999, null, {});
    } finally {
      Math.random = random;
    }
    expect(n.dead).toBe(false);
    expect(n.hp).toBe(1);
    expect(n.hidden).toBe(true);
    expect(n.command?.kind).toBe('retreat');
    // sem resgate (chance 0): morre
    const m = createNinja(g, 700, 500, 'genin', 0);
    m.kawaCd = 999;
    Math.random = () => 0.999;
    try {
      applyDamage(g, foe, m, 9999, null, {});
    } finally {
      Math.random = random;
    }
    expect(m.dead).toBe(true);
  });

  test('migra saves da versão 16 (proteger novatos ligado)', () => {
    const g = createNewGame(SYSTEMS, 405);
    const old = JSON.parse(JSON.stringify(g.state));
    old.version = 16;
    delete old.flags.shelterRookies;
    const s = migrate(old)!;
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.flags.shelterRookies).toBe(true);
  });
});
