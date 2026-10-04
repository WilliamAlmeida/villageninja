import { describe, expect, test } from 'bun:test';
import { SAVE_VERSION, SIM_DT } from '../src/config';
import { JUTSUS } from '../src/data/jutsus';
import { awakenKekkei, awakenOptions, childOf, clanMembers, clanOf, foundClan, surname } from '../src/game/clans';
import { jutsuOptions, recruitNinja } from '../src/game/commands';
import { castJutsu } from '../src/game/combat';
import { createAnimal, createNinja, createVillager } from '../src/game/entities';
import type { Game } from '../src/game/game';
import { createNewGame } from '../src/game/newGame';
import { migrate } from '../src/game/save';
import { SYSTEMS } from '../src/game/systems';
import type { Unit } from '../src/game/types';

const run = (g: Game, seconds: number) => {
  for (let t = 0; t < seconds; t += SIM_DT) g.step(SIM_DT);
};
const rich = (g: Game) => Object.assign(g.state.res, { ryo: 9999, food: 999, wood: 999, stone: 999 });

function founder(g: Game, nature: 'fuuton' | 'suiton' | 'katon' = 'fuuton'): Unit {
  const u = createNinja(g, 1100, 800, 'chunin', 0);
  u.name = 'Hoshino Kenta';
  u.ninja!.level = 6;
  u.ninja!.nature = nature;
  return u;
}

describe('famílias e clãs', () => {
  test('filho herda sobrenome, aparência e pais', () => {
    const g = createNewGame(SYSTEMS, 1);
    const a = createVillager(g, 0, 0);
    a.name = 'Takeda Aiko';
    const b = createNinja(g, 0, 0, 'genin', 0);
    b.name = 'Mizuki Ren';
    const c = childOf(g, a, b);
    expect(['Takeda', 'Mizuki']).toContain(c.name.split(' ')[0]!);
    expect(c.heritage.parents).toEqual(['Takeda Aiko', 'Mizuki Ren']);
    expect([a.look.hair, b.look.hair]).toContain(c.look.hair!);
  });

  test('nascimentos vêm de casais nas casas', () => {
    const g = createNewGame(SYSTEMS, 2);
    g.state.res.food = 999;
    run(g, 35);
    const born = g.state.units.filter((u) => u.heritage?.parents);
    expect(born.length).toBeGreaterThan(0);
  });

  test('fundar clã: requisitos e parentes entram', () => {
    const g = createNewGame(SYSTEMS, 3);
    rich(g);
    const f = founder(g);
    const cousin = createVillager(g, 0, 0);
    cousin.name = 'Hoshino Yui';
    expect(foundClan(g, f.id).ok).toBe(false); // aldeia
    g.state.level = 1;
    expect(foundClan(g, f.id).ok).toBe(true);
    const clan = clanOf(g, f)!;
    expect(clan.name).toBe('Hoshino');
    expect(clanMembers(g, clan).map((u) => u.id)).toContain(cousin.id);
    expect(foundClan(g, f.id).ok).toBe(false); // já tem clã
  });

  test('recruta de clã herda natureza/especialidade', () => {
    const g = createNewGame(SYSTEMS, 4);
    rich(g);
    g.state.level = 1;
    g.addBuilding({ id: g.newId(), type: 'academy', tx: 1, ty: 1, built: true, progress: 99, desired: 0, workers: [], cd: 0 });
    const f = founder(g, 'katon');
    foundClan(g, f.id);
    for (const u of g.state.units) if (u.kind === 'villager') u.jobId = 1; // ocupados
    const kid = createVillager(g, 0, 0);
    kid.jobId = null;
    kid.name = 'Hoshino Mei';
    kid.heritage = { clanId: clanOf(g, f)!.id, nature: 'katon', bias: 'forca', kekkei: null, parents: ['x', 'y'] };
    expect(recruitNinja(g).ok).toBe(true);
    expect(kid.kind).toBe('ninja');
    expect(kid.ninja!.nature).toBe('katon');
    expect(kid.ninja!.stats.forca).toBeGreaterThanOrEqual(2);
  });

  test('kekkei genkai exige naturezas no clã e libera jutsu exclusivo', () => {
    const g = createNewGame(SYSTEMS, 5);
    rich(g);
    g.state.level = 2;
    const f = founder(g, 'fuuton');
    foundClan(g, f.id);
    const clan = clanOf(g, f)!;
    expect(awakenOptions(g, clan).length).toBe(0);
    expect(awakenKekkei(g, clan.id, 'hyoton').ok).toBe(false);
    const water = createNinja(g, 1100, 800, 'genin', 0);
    water.name = 'Hoshino Rin';
    water.ninja!.nature = 'suiton';
    water.heritage = { clanId: clan.id, nature: 'suiton', bias: null, kekkei: null, parents: null };
    expect(awakenOptions(g, clan).map((k) => k.id)).toContain('hyoton');
    expect(awakenKekkei(g, clan.id, 'hyoton').ok).toBe(true);
    expect(f.ninja!.kekkei).toBe('hyoton');
    expect(water.ninja!.kekkei).toBe('hyoton');
    // só quem tem a kekkei vê o jutsu exclusivo
    expect(jutsuOptions(f).some((o) => o.def.id === 'sensatsu')).toBe(true);
    const outsider = createNinja(g, 0, 0, 'jounin', 0);
    expect(jutsuOptions(outsider).some((o) => o.def.kekkei)).toBe(false);
    expect(surname(f)).toBe('Hoshino');
  });

  test('Mokuton prende o alvo', () => {
    const g = createNewGame(SYSTEMS, 6);
    const n = createNinja(g, 1100, 800, 'jounin', 0);
    n.ninja!.kekkei = 'mokuton';
    n.ninja!.jutsu = ['jukai', null];
    n.chakra = n.maxChakra = 200;
    const bear = createAnimal(g, 'bear', 1180, 800);
    const hp = bear.hp;
    castJutsu(g, n, 0, bear);
    expect(bear.hp).toBeLessThan(hp);
    expect(bear.stun).toBeGreaterThanOrEqual(JUTSUS.jukai!.duration! - 0.01);
  });

  test('migra saves da versão 6', () => {
    const g = createNewGame(SYSTEMS, 7);
    const old = JSON.parse(JSON.stringify(g.state));
    old.version = 6;
    delete old.clans;
    for (const u of old.units) if (u.ninja) delete u.ninja.kekkei;
    const s = migrate(old)!;
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.clans).toEqual([]);
    expect(s.units.filter((u) => u.ninja).every((u) => u.ninja!.kekkei === null)).toBe(true);
  });
});
