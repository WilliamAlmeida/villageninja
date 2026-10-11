import { describe, expect, test } from 'bun:test';
import { SIM_DT } from '../src/config';
import { JUTSUS } from '../src/data/jutsus';
import { awakenKekkei, awakenOptions, clanOf, foundClan } from '../src/game/clans';
import { jutsuOptions } from '../src/game/commands';
import { applyDamage, castJutsu, engage } from '../src/game/combat';
import { DOJUTSU, sawJutsu } from '../src/game/dojutsu';
import { createNinja, createRogue } from '../src/game/entities';
import type { Game } from '../src/game/game';
import { modeGuard } from '../src/game/modes';
import { createNewGame } from '../src/game/newGame';
import { statusSystem } from '../src/game/systems/status';
import { SYSTEMS } from '../src/game/systems';
import type { Unit } from '../src/game/types';
import { CENTER_TX, CENTER_TY } from '../src/game/world';

const at = { x: (CENTER_TX + 6) * 32, y: (CENTER_TY + 6) * 32 };

function ninja(g: Game, stats = 8): Unit {
  const n = createNinja(g, at.x, at.y, 'jounin', 0);
  const s = n.ninja!.stats;
  for (const k of Object.keys(s) as (keyof typeof s)[]) s[k] = stats;
  n.ninja!.level = 20;
  n.chakra = n.maxChakra = 300;
  return n;
}

describe('dōjutsu (Sharingan e Byakugan)', () => {
  test('o clã desperta o Sharingan com fogo e genjutsu alto; só ele vê os jutsus do olho', () => {
    const g = createNewGame(SYSTEMS, 71);
    Object.assign(g.state.res, { ryo: 5000 });
    g.state.level = 2;
    for (const o of g.state.units) if (o.name.startsWith('Kurogane')) o.name = `Outro ${o.name}`;
    const f = ninja(g, 3);
    f.name = 'Kurogane Itsuki';
    f.ninja!.nature = 'katon';
    foundClan(g, f.id);
    const clan = clanOf(g, f)!;
    expect(awakenOptions(g, clan).some((k) => k.id === 'sharingan')).toBe(false);
    const illusion = ninja(g, 3);
    illusion.name = 'Kurogane Mei';
    illusion.ninja!.nature = 'suiton';
    illusion.ninja!.stats.genjutsu = 7;
    illusion.heritage = { clanId: clan.id, nature: 'suiton', bias: null, kekkei: null, parents: null };
    expect(awakenOptions(g, clan).map((k) => k.id)).toContain('sharingan');
    expect(awakenKekkei(g, clan.id, 'sharingan').ok).toBe(true);
    expect(f.ninja!.kekkei).toBe('sharingan');
    expect(illusion.ninja!.kekkei).toBe('sharingan');
    expect(jutsuOptions(f).some((o) => o.def.id === 'kanashibari')).toBe(true);
    expect(jutsuOptions(ninja(g)).some((o) => o.def.kekkei === 'sharingan')).toBe(false);
  });

  test('os golpes Hyuga exigem o Byakugan', () => {
    const g = createNewGame(SYSTEMS, 72);
    const plain = ninja(g);
    const hyuga = ninja(g);
    hyuga.ninja!.kekkei = 'byakugan';
    for (const id of ['kusho', 'rokujuyon', 'kaiten', 'soshiken']) {
      expect(jutsuOptions(plain).some((o) => o.def.id === id)).toBe(false);
      expect(jutsuOptions(hyuga).some((o) => o.def.id === id)).toBe(true);
    }
  });

  test('o Sharingan copia o jutsu do inimigo, devolve e pode aprendê-lo depois', () => {
    const g = createNewGame(SYSTEMS, 73);
    g.state.pace = 'fast';
    const n = ninja(g);
    n.ninja!.kekkei = 'sharingan';
    n.ninja!.nature = 'suiton';
    const r = createRogue(g, at.x + 90, at.y, 1);
    r.hp = r.maxHp = 3000;
    r.ninja!.jutsu = ['goukakyuu', null];
    r.chakra = r.maxChakra = 300;
    // o Goukakyuu precisa de pergaminho aberto e da natureza do fogo: o Sharingan não
    expect(jutsuOptions(n).some((o) => o.def.id === 'goukakyuu')).toBe(false);
    castJutsu(g, r, 0, n);
    expect(n.mirror?.id).toBe('goukakyuu');
    expect(n.ninja!.seen).toContain('goukakyuu');
    expect(jutsuOptions(n).some((o) => o.def.id === 'goukakyuu')).toBe(true);
    const shots = g.state.projectiles.length;
    n.attackCd = 0;
    engage(g, n, r, SIM_DT);
    expect(n.mirror).toBeUndefined();
    expect(g.state.projectiles.filter((p) => p.ownerId === n.id).length).toBe(1);
    expect(g.state.projectiles.length).toBe(shots + 1);
  });

  test('só copia rank baixo (até C) e guarda uma cópia por ninja', () => {
    const g = createNewGame(SYSTEMS, 78);
    const n = ninja(g);
    n.ninja!.kekkei = 'sharingan';
    const r = createRogue(g, at.x + 60, at.y, 1);
    sawJutsu(g, r, JUTSUS.chidori!); // rank A
    expect(n.mirror).toBeUndefined();
    expect(n.ninja!.seen ?? []).toEqual([]);
    sawJutsu(g, r, JUTSUS.housenka!);
    sawJutsu(g, r, JUTSUS.goukakyuu!);
    expect(n.ninja!.seen).toEqual(['goukakyuu']);
    expect(n.mirror?.id).toBe('goukakyuu');
  });

  test('não copia técnica de clã nem proibida, nem do próprio lado', () => {
    const g = createNewGame(SYSTEMS, 74);
    const n = ninja(g);
    n.ninja!.kekkei = 'sharingan';
    const r = createRogue(g, at.x + 60, at.y, 1);
    sawJutsu(g, r, JUTSUS.sensatsu!);
    sawJutsu(g, r, JUTSUS.kuroduki!);
    const friend = ninja(g);
    sawJutsu(g, friend, JUTSUS.goukakyuu!);
    expect(n.mirror).toBeUndefined();
    expect(n.ninja!.seen ?? []).toEqual([]);
  });

  test('Amaterasu queima aos poucos até apagar', () => {
    const g = createNewGame(SYSTEMS, 75);
    g.state.pace = 'fast';
    const n = ninja(g);
    n.ninja!.kekkei = 'sharingan';
    n.ninja!.jutsu = ['amaterasu', null];
    const r = createRogue(g, at.x + 100, at.y, 1);
    r.hp = r.maxHp = 3000;
    castJutsu(g, n, 0, r);
    expect(r.burn).toBeDefined();
    const hp0 = r.hp;
    for (let t = 0; t < 2; t += SIM_DT) statusSystem(g, SIM_DT);
    const mid = r.hp;
    expect(mid).toBeLessThan(hp0);
    for (let t = 0; t < 8; t += SIM_DT) statusSystem(g, SIM_DT);
    expect(r.burn).toBeUndefined();
    expect(r.hp).toBeLessThan(mid);
  });

  test('Punho Gentil (Byakugan) fecha o chakra do alvo', () => {
    const g = createNewGame(SYSTEMS, 76);
    const n = ninja(g);
    const r = createRogue(g, at.x + 20, at.y, 1);
    r.chakra = r.maxChakra = 100;
    r.ninja!.stats.velocidade = 0; // sem esquiva
    applyDamage(g, n, r, 5, null, { melee: true });
    const plain = r.chakra;
    n.ninja!.kekkei = 'byakugan';
    let hits = 0;
    for (let i = 0; i < 5; i++) {
      const c = r.chakra;
      applyDamage(g, n, r, 5, null, { melee: true });
      if (r.chakra < c) hits++;
    }
    expect(plain).toBe(100);
    expect(hits).toBeGreaterThan(0);
    expect(r.chakra).toBeLessThanOrEqual(100 - DOJUTSU.juken * hits);
  });

  test("Susano'o veste o guerreiro de chakra que segura os golpes", () => {
    const g = createNewGame(SYSTEMS, 77);
    const n = ninja(g);
    n.ninja!.kekkei = 'sharingan';
    n.ninja!.jutsu = ['susanoo', null];
    const r = createRogue(g, at.x + 40, at.y, 1);
    castJutsu(g, n, 0, r);
    expect(n.mode?.kind).toBe('susanoo');
    expect(modeGuard(n)).toBeLessThan(0.5);
  });
});
