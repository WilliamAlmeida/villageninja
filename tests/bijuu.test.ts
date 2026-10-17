import { describe, expect, test } from 'bun:test';
import { SAVE_VERSION, SIM_DT } from '../src/config';
import { BIJUU_MAX_TAILS, MODES, SEAL } from '../src/data/bijuu';
import { bijuuFree, bijuuTaken, jinchuuriki, sealBijuu } from '../src/game/bijuu';
import { bossSystem } from '../src/game/systems/bosses';
import { spawnBoss } from '../src/game/bosses';
import { castJutsu, killUnit } from '../src/game/combat';
import { createNinja, createRogue } from '../src/game/entities';
import { modeDamage, modeTick } from '../src/game/modes';
import { createNewGame } from '../src/game/newGame';
import { migrate } from '../src/game/save';
import { SYSTEMS } from '../src/game/systems';
import { CENTER_TX, CENTER_TY } from '../src/game/world';

const at = { x: (CENTER_TX + 6) * 32, y: (CENTER_TY + 6) * 32 };

describe('bestas com cauda (Bijuu)', () => {
  test('a Fera Colossal é uma das feras, até o limite de caudas do nível da vila', () => {
    for (const level of [0, 1, 2, 3]) {
      const g = createNewGame(SYSTEMS, 50 + level);
      g.state.level = level;
      const [u] = spawnBoss(g, 'titan', at.x, at.y);
      expect(u!.bijuu).toBeGreaterThanOrEqual(1);
      expect(u!.bijuu).toBeLessThanOrEqual(BIJUU_MAX_TAILS[level]!);
      expect(u!.name).toContain('cauda');
    }
  });

  test('vencida vai para o jarro; selada num ninja, ele vira Jinchuuriki; caindo, a fera se solta', () => {
    const g = createNewGame(SYSTEMS, 61);
    g.state.level = 3;
    const [beast] = spawnBoss(g, 'titan', at.x, at.y);
    const tails = beast!.bijuu!;
    killUnit(g, beast!, null);
    expect(g.state.bijuu.jar).toEqual([tails]);
    const host = createNinja(g, at.x, at.y, 'jounin', 0);
    host.ninja!.level = SEAL.minLevel;
    Object.assign(g.state.res, { ryo: 99999, paper: 9999 });
    expect(sealBijuu(g, host.id, tails).ok).toBe(true);
    expect(host.ninja!.bijuu).toBe(tails);
    expect(g.state.bijuu.jar).toEqual([]);
    expect(jinchuuriki(g)).toContain(host);
    expect(bijuuTaken(g).has(tails)).toBe(true);
    // clone (Kage Bunshin, marionete) leva a ficha do dono, com a fera junto: não é outro Jinchuuriki
    g.state.units.push({ ...structuredClone(host), id: g.state.nextId++, kind: 'clone', ownerId: host.id });
    expect(jinchuuriki(g).length).toBe(1);
    killUnit(g, host, null);
    expect(host.ninja!.bijuu).toBeUndefined();
    expect(bijuuTaken(g).has(tails)).toBe(false);
  });

  test('o Jinchuuriki veste o manto quando a luta aperta e bate mais forte', () => {
    const g = createNewGame(SYSTEMS, 62);
    const host = createNinja(g, at.x, at.y, 'jounin', 0);
    host.ninja!.bijuu = 9;
    host.combatTimer = 5;
    host.hp = host.maxHp * 0.4;
    modeTick(g, host, SIM_DT);
    expect(host.mode?.kind).toBe('bijuu');
    expect(modeDamage(host)).toBeGreaterThan(1.5);
    expect(host.modeCd).toBe(MODES.bijuu.cooldown);
  });

  test('Oito Portões: muito dano, mas a vida escorre (sem matar sozinho)', () => {
    const g = createNewGame(SYSTEMS, 63);
    const n = createNinja(g, at.x, at.y, 'jounin', 0);
    const r = createRogue(g, at.x + 30, at.y, 1);
    n.ninja!.jutsu = ['hachimon', null];
    castJutsu(g, n, 0, r);
    expect(n.mode?.kind).toBe('gates');
    const hp0 = n.hp;
    for (let t = 0; t < 3; t += SIM_DT) modeTick(g, n, SIM_DT);
    expect(n.hp).toBeLessThan(hp0);
    expect(n.hp).toBeGreaterThanOrEqual(1);
  });

  test('migração 28 → 29 cria o jarro', () => {
    const s = migrate({ version: 28, units: [], scene: null })!;
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.bijuu).toEqual({ jar: [] });
  });
});

describe('Bijuu solta aparece mais', () => {
  const titans = (jar: number[]) => {
    const g = createNewGame(SYSTEMS, 2400);
    g.state.level = 3;
    g.state.day = 50;
    g.state.bijuu.jar = jar;
    let n = 0;
    for (let i = 0; i < 2500; i++) {
      g.state.pendingBoss = null;
      g.state.bossTimer = 0;
      bossSystem(g, SIM_DT);
      if ((g.state.pendingBoss as { kind: string } | null)?.kind === 'titan') n++;
    }
    return n;
  };

  test('com fera solta a Fera Colossal vem mais do que com as nove presas', () => {
    expect(bijuuFree(createNewGame(SYSTEMS, 2401)).length).toBeGreaterThan(0);
    expect(titans([1, 2, 3, 4])).toBeGreaterThan(titans([1, 2, 3, 4, 5, 6, 7, 8, 9]) * 1.1);
  }, 30000);
});
