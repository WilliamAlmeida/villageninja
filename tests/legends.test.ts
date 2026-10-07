import { describe, expect, test } from 'bun:test';
import { SAVE_VERSION } from '../src/config';
import { bladeItem, MIST_BLADES } from '../src/data/blades';
import { anbuBlock, appointAnbu, maskOf } from '../src/game/anbu';
import { recoverBlades } from '../src/game/blades';
import { applyDamage, killUnit } from '../src/game/combat';
import { createNinja } from '../src/game/entities';
import type { Game } from '../src/game/game';
import { craftBlock, enqueueCraft, equip } from '../src/game/gear';
import { createNewGame } from '../src/game/newGame';
import { nameSannin } from '../src/game/sannin';
import { migrate } from '../src/game/save';
import { createSwordsman, swordsmenOnMap, swordsmenTick } from '../src/game/swordsmen';
import { SYSTEMS } from '../src/game/systems';
import { canHit } from '../src/game/factions';

const rich = (g: Game) => Object.assign(g.state.res, { ryo: 99999, food: 9999, wood: 9999, stone: 9999, iron: 999, crystal: 99, darksteel: 99 });
const build = (g: Game, type: 'intel' | 'forge', level = 1) =>
  g.addBuilding({ id: g.newId(), type, tx: 2, ty: 2, built: true, progress: 999, desired: 0, workers: [], cd: 0, level });
function makeKage(g: Game) {
  const k = createNinja(g, 600, 600, 'jounin', 0);
  k.ninja!.rank = 'kage';
  g.state.kageId = k.id;
  return k;
}

describe('Espadachins da Névoa', () => {
  test('invadem da Vila Oculta em diante: dois espadachins com escolta', () => {
    const g = createNewGame(SYSTEMS, 2101);
    swordsmenTick(g);
    expect(swordsmenOnMap(g).length).toBe(0);
    g.state.level = 2;
    g.state.swordsmen.nextDay = g.state.day;
    swordsmenTick(g);
    const on = swordsmenOnMap(g);
    expect(on.length).toBe(2);
    expect(on.every((u) => u.ninja!.equip.weapon === bladeItem(u.swordsman!))).toBe(true);
  });

  test('só uma espada por invasão: o primeiro cai e deixa a espada, o segundo some na névoa', () => {
    const g = createNewGame(SYSTEMS, 2102);
    const a = createSwordsman(g, 'zabuza', 500, 500);
    const b = createSwordsman(g, 'samehada', 540, 500);
    killUnit(g, a, null);
    expect(a.dead).toBe(true);
    expect(g.state.blades).toEqual(['zabuza']);
    expect(g.state.items[bladeItem('zabuza')]).toBe(1);
    killUnit(g, b, null);
    expect(b.dead).toBeFalsy();
    expect(b.cloak).toBe(true);
    expect(b.state).toBe('escape');
    expect(g.state.blades).toEqual(['zabuza']);
  });

  test('tomadas as sete, a organização acaba', () => {
    const g = createNewGame(SYSTEMS, 2103);
    for (const id of MIST_BLADES) {
      g.state.swordsmen.taken = false;
      killUnit(g, createSwordsman(g, id, 500, 500), null);
    }
    expect(g.state.swordsmen.done).toBe(true);
  });
});

describe('lâminas lendárias', () => {
  test('quem cai com a lâmina: ela volta ao estoque', () => {
    const g = createNewGame(SYSTEMS, 2104);
    killUnit(g, createSwordsman(g, 'kiba', 500, 500), null);
    const n = createNinja(g, 600, 600, 'jounin', 0);
    expect(equip(g, n.id, bladeItem('kiba')).ok).toBe(true);
    expect(g.state.items[bladeItem('kiba')]).toBe(0);
    n.dead = true;
    recoverBlades(g);
    expect(g.state.items[bladeItem('kiba')]).toBe(1);
  });

  test('Kabutowari ignora a defesa e bate mais forte em chefes', () => {
    const g = createNewGame(SYSTEMS, 2105);
    const n = createNinja(g, 600, 600, 'jounin', 0);
    const boss = createSwordsman(g, 'nuibari', 610, 600);
    boss.kawaCd = 999;
    boss.ninja!.stats.velocidade = 0; // sem esquiva
    const before = boss.hp;
    applyDamage(g, n, boss, 50, null, { melee: true });
    const plain = before - boss.hp;
    g.state.blades.push('kabutowari');
    g.state.items[bladeItem('kabutowari')] = 1;
    equip(g, n.id, bladeItem('kabutowari'));
    const mid = boss.hp;
    applyDamage(g, n, boss, 50, null, { melee: true });
    expect(mid - boss.hp).toBeGreaterThan(plain * 1.3);
  });

  test('Raijin: forjada na Forja nível 3, uma vez só, e só o Kage usa', () => {
    const g = createNewGame(SYSTEMS, 2106);
    rich(g);
    const forge1 = build(g, 'forge', 1);
    expect(craftBlock(g, forge1, bladeItem('raijin'))).toContain('nível 3');
    const forge = build(g, 'forge', 3);
    expect(craftBlock(g, forge, bladeItem('raijin'))).toContain('Kage');
    const k = makeKage(g);
    expect(enqueueCraft(g, forge.id, bladeItem('raijin')).ok).toBe(true);
    expect(craftBlock(g, forge, bladeItem('raijin'))).toContain('forjada');
    g.state.blades.push('raijin');
    g.state.items[bladeItem('raijin')] = 1;
    const j = createNinja(g, 600, 600, 'jounin', 0);
    expect(equip(g, j.id, bladeItem('raijin')).ok).toBe(false);
    expect(equip(g, k.id, bladeItem('raijin')).ok).toBe(true);
  });

  test('o Sannin das Serpentes traz a Kusanagi', () => {
    const g = createNewGame(SYSTEMS, 2107);
    rich(g);
    g.state.level = 2;
    const j = createNinja(g, 600, 600, 'jounin', 0);
    j.ninja!.level = 20;
    expect(nameSannin(g, j.id, 'snake').ok).toBe(true);
    expect(g.state.blades).toContain('kusanagi');
  });
});

describe('ANBU', () => {
  test('o Kage nomeia com a Torre de Inteligência: sai da equipe, ganha +1 no atributo da máscara e fica invisível', () => {
    const g = createNewGame(SYSTEMS, 2108);
    rich(g);
    const c = createNinja(g, 600, 600, 'chunin', 0);
    expect(anbuBlock(g, c)).toContain('Torre');
    build(g, 'intel');
    expect(anbuBlock(g, c)).toContain('Kage');
    makeKage(g);
    g.state.teams.push({ id: 99, name: 'T', color: '#fff', senseiId: null, memberIds: [c.id] });
    const m = maskOf(c);
    const before = c.ninja!.stats[m.key];
    expect(appointAnbu(g, c.id).ok).toBe(true);
    expect(c.ninja!.anbu).toBe(true);
    expect(g.state.teams[0]!.memberIds).not.toContain(c.id);
    expect(c.ninja!.stats[m.key]).toBeGreaterThan(before);
    g.step(0.1);
    expect(c.cloak).toBe(true);
    expect(canHit('enemy', undefined, c)).toBe(false);
  });

  test('emboscada: o golpe que sai da invisibilidade é mais forte e revela o ANBU', () => {
    const g = createNewGame(SYSTEMS, 2109);
    const a = createNinja(g, 600, 600, 'chunin', 0);
    a.ninja!.anbu = true;
    const t1 = createSwordsman(g, 'shibuki', 610, 600);
    const t2 = createSwordsman(g, 'shibuki', 610, 640);
    t1.kawaCd = t2.kawaCd = 999;
    a.cloak = false;
    let h = t1.hp;
    applyDamage(g, a, t1, 40, null, {});
    const normal = h - t1.hp;
    a.cloak = true;
    h = t2.hp;
    applyDamage(g, a, t2, 40, null, {});
    expect(h - t2.hp).toBeGreaterThan(normal * 1.3);
    expect(a.cloak).toBe(false);
  });
});

test('migra saves da versão 20 (lâminas e Espadachins)', () => {
  const g = createNewGame(SYSTEMS, 2110);
  const old = JSON.parse(JSON.stringify(g.state));
  old.version = 20;
  delete old.blades;
  delete old.swordsmen;
  const s = migrate(old)!;
  expect(s.version).toBe(SAVE_VERSION);
  expect(s.blades).toEqual([]);
  expect(s.swordsmen.done).toBe(false);
});
