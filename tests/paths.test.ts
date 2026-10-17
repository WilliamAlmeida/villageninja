import { describe, expect, test } from 'bun:test';
import { MASK_LIST } from '../src/data/anbu';
import { anbuBlock, anbuSlots } from '../src/game/anbu';
import { createNinja } from '../src/game/entities';
import type { Game } from '../src/game/game';
import { advanceCraft, enqueueCraft } from '../src/game/gear';
import { crownKage } from '../src/game/kage';
import { createNewGame } from '../src/game/newGame';
import { nameSannin, sanninBlock, sanninCandidates, sanninOf } from '../src/game/sannin';
import { migrate } from '../src/game/save';
import { SYSTEMS } from '../src/game/systems';
import { workersOf } from '../src/game/upgrade';
import type { Building } from '../src/game/types';

const setup = (seed: number) => {
  const g = createNewGame(SYSTEMS, seed);
  Object.assign(g.state.res, { ryo: 99999, food: 9999, wood: 9999, stone: 9999, iron: 999 });
  g.state.level = 3;
  return g;
};
const build = (g: Game, type: Building['type'], level = 1) =>
  g.addBuilding({ id: g.newId(), type, tx: 2, ty: 2, built: true, progress: 999, desired: 1, workers: [], cd: 0, level });
const jounin = (g: Game) => {
  const u = createNinja(g, 600, 600, 'jounin', 0);
  u.ninja!.level = 30;
  return u;
};

describe('caminhos do Jounin: ANBU ou Sannin, depois Kage', () => {
  test('ANBU e Sannin são um ou outro', () => {
    const g = setup(3101);
    build(g, 'intel');
    const k = jounin(g);
    k.ninja!.rank = 'kage';
    g.state.kageId = k.id;
    const a = jounin(g);
    a.ninja!.anbu = true;
    expect(sanninCandidates(g)).not.toContain(a);
    expect(sanninBlock(g, a, 'toad')).toContain('ANBU');
    const s = jounin(g);
    expect(nameSannin(g, s.id, 'toad').ok).toBe(true);
    expect(anbuBlock(g, s)).toContain('Sannin');
  });

  test('virando Kage, deixa o título de Sannin e a vaga do caminho abre', () => {
    const g = setup(3102);
    const s = jounin(g);
    expect(nameSannin(g, s.id, 'snake').ok).toBe(true);
    g.state.ceremony = { candidateId: s.id, timer: 0 };
    crownKage(g);
    expect(s.ninja!.rank).toBe('kage');
    expect(s.ninja!.sannin).toBeUndefined();
    expect(sanninOf(g, 'snake')).toBeUndefined();
    expect(nameSannin(g, jounin(g).id, 'snake').ok).toBe(true);
  });

  test('vagas da ANBU crescem com a vila: no nível máximo, uma por máscara', () => {
    const g = setup(3103);
    build(g, 'intel');
    g.state.level = 1;
    expect(anbuSlots(g)).toBe(3);
    g.state.level = 2;
    expect(anbuSlots(g)).toBe(5);
    g.state.level = 3;
    expect(anbuSlots(g)).toBe(MASK_LIST.length);
  });

  test('migração 50 → 51: Kage deixa de ser Sannin; ANBU e Sannin fica Sannin', () => {
    const s = migrate({
      version: 50,
      colonies: {},
      buildings: [{ type: 'forge', level: 3, desired: 1 }],
      units: [
        { id: 1, ninja: { rank: 'kage', sannin: 'toad' } },
        { id: 2, ninja: { rank: 'jounin', sannin: 'slug', anbu: true } },
        { id: 3, ninja: { rank: 'jounin', anbu: true } },
      ],
    } as never) as unknown as { units: { ninja: { sannin?: string; anbu?: boolean } }[]; buildings: { desired: number }[] };
    expect(s.buildings[0]!.desired).toBe(3);
    expect(s.units[0]!.ninja.sannin).toBeUndefined();
    expect(s.units[1]!.ninja).toMatchObject({ sannin: 'slug', anbu: false });
    expect(s.units[2]!.ninja.anbu).toBe(true);
  });
});

describe('oficinas', () => {
  test('um artesão por nível, e dois na bancada fazem no dobro da velocidade', () => {
    const g = setup(3104);
    const f = build(g, 'forge', 3);
    expect(workersOf(f)).toBe(3);
    expect(workersOf({ ...f, level: 1 })).toBe(1);
    expect(enqueueCraft(g, f.id, 'kunai').ok).toBe(true);
    advanceCraft(g, f.id, 1);
    advanceCraft(g, f.id, 1);
    expect(f.craft!.progress).toBe(2);
  });
});
