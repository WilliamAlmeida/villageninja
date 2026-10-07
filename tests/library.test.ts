import { describe, expect, test } from 'bun:test';
import { DAY_LENGTH, SAVE_VERSION } from '../src/config';
import type { BuildingType } from '../src/data/buildings';
import { MINE_USES } from '../src/data/sites';
import { jutsuOptions } from '../src/game/commands';
import { createNinja } from '../src/game/entities';
import { mineUses, siteTick, spendMine } from '../src/game/explore';
import type { Game } from '../src/game/game';
import { libraryLearnMult, openBlock, openScroll, studyable } from '../src/game/library';
import { createNewGame } from '../src/game/newGame';
import { migrate } from '../src/game/save';
import { SYSTEMS } from '../src/game/systems';
import { CENTER_TX, CENTER_TY } from '../src/game/world';

const rich = (g: Game) => (g.state.res = { wood: 999, stone: 999, food: 999, ryo: 9999, iron: 999, herbs: 999, paper: 999, crystal: 0, gold: 0, darksteel: 0 });
function addBuilt(g: Game, type: BuildingType, level = 1) {
  return g.addBuilding({ id: g.newId(), type, tx: CENTER_TX + 6, ty: CENTER_TY + 3, built: true, progress: 999, desired: 1, workers: [], cd: 0, level });
}

describe('Biblioteca de Jutsus', () => {
  test('rank C+ só aparece com o pergaminho aberto; o nível diz até que rank abre', () => {
    const g = createNewGame(SYSTEMS, 501);
    rich(g);
    const u = createNinja(g, 600, 600, 'jounin', 0);
    u.ninja!.nature = 'katon';
    for (const k of Object.keys(u.ninja!.stats)) (u.ninja!.stats as Record<string, number>)[k] = 9;
    const ids = () => jutsuOptions(u, studyable(g.state)).map((o) => o.def.id);
    expect(ids()).toContain('housenka'); // básico (rank D): sem pergaminho
    expect(ids()).not.toContain('goukakyuu'); // rank C: precisa abrir
    expect(openBlock(g, 'goukakyuu')).toContain('Biblioteca');
    const lib = addBuilt(g, 'library');
    expect(openScroll(g, 'goukakyuu').ok).toBe(true);
    expect(ids()).toContain('goukakyuu');
    expect(openBlock(g, 'kagebunshin')).toContain('nível 2'); // rank B
    expect(openBlock(g, 'chidori')).toContain('nível 3'); // rank A
    lib.level = 3;
    expect(openScroll(g, 'chidori').ok).toBe(true);
    expect(libraryLearnMult(g)).toBe(2);
  });

  test('save antigo: jutsus que a vila já sabe ou estuda ficam abertos', () => {
    const g = createNewGame(SYSTEMS, 502);
    for (const o of g.state.units) if (o.ninja) o.ninja.jutsu = [null, null]; // ninjas iniciais nascem com jutsu sorteado
    const u = createNinja(g, 600, 600, 'jounin', 0);
    u.ninja!.jutsu = ['chidori', null];
    u.ninja!.learning = { jutsuId: 'kagebunshin', slot: 1, progress: 0, total: 10 };
    const old = JSON.parse(JSON.stringify(g.state));
    old.version = 22;
    delete old.jutsuOpen;
    const s = migrate(old)!;
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.jutsuOpen).toContain('chidori');
    expect(s.jutsuOpen).toContain('kagebunshin');
    expect(s.jutsuOpen).not.toContain('goukakyuu');
  });
});

describe('locais que voltam', () => {
  test('a mina aguenta poucas expedições, desaba e reaparece noutro lugar; baú saqueado também volta', () => {
    const g = createNewGame(SYSTEMS, 503);
    const cave = g.state.sites.find((x) => x.kind === 'cave')!;
    const at = { tx: cave.tx, ty: cave.ty };
    for (let i = 0; i < MINE_USES - 1; i++) spendMine(g, cave.id);
    expect(mineUses(cave)).toBe(1);
    expect(cave.done).toBe(false);
    spendMine(g, cave.id);
    expect(cave.done).toBe(true);
    siteTick(g, DAY_LENGTH * 3 + 1);
    expect(cave.done).toBe(false);
    expect(mineUses(cave)).toBe(MINE_USES);
    expect(cave.tx !== at.tx || cave.ty !== at.ty).toBe(true);
    const chest = g.state.sites.find((x) => x.kind === 'chest')!;
    chest.done = true;
    siteTick(g, DAY_LENGTH);
    expect(chest.done).toBe(true); // ainda não deu o tempo
    siteTick(g, DAY_LENGTH + 1);
    expect(chest.done).toBe(false);
  });
});
