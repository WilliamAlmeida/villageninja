import { describe, expect, test } from 'bun:test';
import { SIM_DT } from '../src/config';
import { killUnit } from '../src/game/combat';
import { createAnimal, createNinja, createRogue } from '../src/game/entities';
import type { Game } from '../src/game/game';
import { createNewGame } from '../src/game/newGame';
import { SYSTEMS } from '../src/game/systems';
import { bombBuilding } from '../src/game/systems/hostiles';
import { raidRoles } from '../src/game/systems/spawner';
import { spawnBoss } from '../src/game/bosses';
import { canHit } from '../src/game/factions';
import { buildingCenter, doorPos } from '../src/game/world';

const run = (g: Game, seconds: number, until?: () => boolean) => {
  for (let t = 0; t < seconds; t += SIM_DT) {
    g.state.time = 30; // de dia
    g.step(SIM_DT);
    if (until?.()) return;
  }
};
/** Tira os ninjas da vila de cena para o bicho/renegado agir sem ser abatido. */
const noDefenders = (g: Game) => {
  for (const u of g.state.units) if (u.kind === 'ninja') u.dead = true;
  g.state.buildings = g.state.buildings.filter((b) => b.type !== 'tower');
};

/** Um trecho reto e livre (sem prédio nem árvore) para testar corrida/bote: devolve o início em px. */
const openRow = (g: Game, len = 300) => {
  for (let y = 200; y < 1400; y += 32)
    for (let x = 100; x < 2000; x += 32) {
      let ok = true;
      for (let k = 0; k <= len && ok; k += 8) ok = g.world.walkablePx(x + k, y);
      if (ok) return { x, y };
    }
  throw new Error('sem espaço livre');
};

describe('inimigos novos', () => {
  test('corvos bicam a fazenda, levam comida e devolvem quando abatidos', () => {
    const g = createNewGame(SYSTEMS, 31);
    noDefenders(g);
    const farm = g.builtOf('farm')[0]!;
    const c = buildingCenter(farm);
    g.state.res.food = 100;
    const crow = createAnimal(g, 'crow', c.x, c.y);
    crow.hp = crow.maxHp = 9999; // a Residência do Hokage atira kunai: o corvo não pode cair antes de juntar o saque
    run(g, 30, () => (crow.loot?.food ?? 0) >= 4);
    expect(crow.loot?.food ?? 0).toBeGreaterThanOrEqual(4);
    const before = g.state.res.food;
    const taken = crow.loot!.food!;
    killUnit(g, crow, null);
    expect(g.state.res.food).toBeGreaterThanOrEqual(before + taken);
  });

  test('macaco rouba ryo da Residência e foge; abatido devolve o saque', () => {
    const g = createNewGame(SYSTEMS, 32);
    noDefenders(g);
    g.state.res.ryo = 500;
    const p = doorPos(g.hokage()!);
    const monkey = createAnimal(g, 'monkey', p.x + 60, p.y + 40);
    monkey.hp = monkey.maxHp = 9999; // idem
    run(g, 40, () => !!monkey.loot);
    expect(monkey.loot?.ryo ?? 0).toBeGreaterThan(0);
    expect(monkey.state).toBe('escape');
    const ryo = g.state.res.ryo;
    const stolen = monkey.loot!.ryo!;
    killUnit(g, monkey, null);
    // devolve o saque (mais a recompensa do bicho)
    expect(g.state.res.ryo).toBeGreaterThanOrEqual(ryo + stolen);
    expect(monkey.loot).toBeUndefined();
  });

  test('bomba derruba o prédio pela metade e os moradores reconstroem', () => {
    const g = createNewGame(SYSTEMS, 33);
    const house = g.state.buildings.find((b) => b.type === 'house')!;
    bombBuilding(g, null, house);
    expect(house.built).toBe(false);
    expect(house.progress).toBeGreaterThan(0);
    run(g, 120, () => house.built);
    expect(house.built).toBe(true);
  });

  test('bombardeiro vai até um prédio e lança a bomba', () => {
    const g = createNewGame(SYSTEMS, 34);
    noDefenders(g);
    const house = g.state.buildings.find((b) => b.type === 'house')!;
    const c = buildingCenter(house);
    const b = createRogue(g, c.x + 160, c.y + 60, 6);
    b.role = 'bomber';
    run(g, 30, () => (b.bombs ?? 0) > 0);
    expect(b.bombs).toBe(1);
    expect(g.state.buildings.some((x) => !x.built)).toBe(true);
  });

  test('médico renegado cura o aliado ferido', () => {
    const g = createNewGame(SYSTEMS, 35);
    noDefenders(g);
    const ally = createRogue(g, 200, 200, 6);
    const medic = createRogue(g, 230, 200, 6);
    medic.role = 'medic';
    ally.hp = ally.maxHp * 0.3;
    const hp0 = ally.hp;
    run(g, 1);
    expect(ally.hp).toBeGreaterThan(hp0);
  });

  test('invasões trazem bombardeiro e médico conforme o tamanho e o dia', () => {
    expect(raidRoles(2, 3).filter(Boolean)).toEqual([]);
    expect(raidRoles(6, 2)).toEqual(['bomber', undefined]);
    expect(raidRoles(8, 4)).toEqual(['bomber', undefined, undefined, 'medic']);
  });

  test('aranha cospe teia que prende o ninja', () => {
    const g = createNewGame(SYSTEMS, 41);
    noDefenders(g);
    const o = openRow(g);
    const n = createNinja(g, o.x + 200, o.y, 'genin', 0);
    n.ninja!.order = 'train';
    const spider = createAnimal(g, 'spider', o.x + 110, o.y);
    spider.abilityCd = 0;
    let stunned = false;
    run(g, 6, () => (stunned = n.stun > 1));
    expect(stunned).toBe(true);
  });

  test('tigre das sombras dá bote e vai embora quando amanhece', () => {
    const g = createNewGame(SYSTEMS, 42);
    noDefenders(g);
    const o = openRow(g);
    const n = createNinja(g, o.x + 200, o.y, 'jounin', 0);
    n.ninja!.stats.velocidade = 0; // sem esquiva: o bote tem que acertar
    const tiger = createAnimal(g, 'tiger', o.x + 100, o.y);
    tiger.abilityCd = 0;
    const hp0 = n.hp;
    g.state.time = 0; // noite
    g.step(1 / 60);
    expect(n.hp).toBeLessThan(hp0);
    expect(Math.hypot(tiger.x - n.x, tiger.y - n.y)).toBeLessThan(40);
    // de dia ele desiste
    n.dead = true;
    run(g, 1);
    expect(tiger.life).toBeLessThanOrEqual(0);
  });

  test('rinoceronte faz investida e atropela', () => {
    const g = createNewGame(SYSTEMS, 43);
    noDefenders(g);
    const o = openRow(g);
    const n = createNinja(g, o.x + 240, o.y, 'jounin', 0); // 140 px: dentro da percepção (160) e da investida (60–220)
    const rhino = createAnimal(g, 'rhino', o.x + 100, o.y);
    rhino.abilityCd = 0;
    n.stun = 5; // parado na linha da investida (senão ele sai do caminho e o teste vira sorte)
    // só ele de alvo (um morador mais perto desviaria a investida)
    for (const u of g.state.units) if (u.faction === 'village' && u !== n) u.dead = true;
    const hp0 = n.hp;
    run(g, 3, () => n.hp < hp0 && rhino.state !== 'charge');
    expect(n.hp).toBeLessThan(hp0);
  });

  test('espião: invisível até a torre o descobrir, sabota e foge', () => {
    const g = createNewGame(SYSTEMS, 51);
    noDefenders(g);
    const house = g.state.buildings.find((b) => b.type === 'house')!;
    const c = buildingCenter(house);
    const spy = createRogue(g, c.x + 120, c.y + 40, 9);
    spy.role = 'spy';
    spy.cloak = true;
    expect(canHit('village', undefined, spy)).toBe(false);
    run(g, 40, () => (spy.bombs ?? 0) > 0);
    expect(spy.bombs).toBe(1);
    expect(g.state.buildings.some((b) => !b.built)).toBe(true);
    expect(spy.state).toBe('escape');
    // uma torre perto revela
    const tower = { ...house, id: g.newId(), type: 'tower' as const, built: true, tx: Math.floor(spy.x / 32), ty: Math.floor(spy.y / 32) + 2 };
    g.state.buildings.push(tower);
    run(g, 0.2);
    expect(spy.cloak).toBe(false);
    expect(canHit('village', undefined, spy)).toBe(true);
  });

  test('marionetista monta marionetes que desmontam quando ele cai', () => {
    const g = createNewGame(SYSTEMS, 52);
    noDefenders(g);
    const o = openRow(g);
    const n = createNinja(g, o.x + 200, o.y, 'jounin', 0);
    n.ninja!.order = 'train';
    const pm = createRogue(g, o.x + 20, o.y, 11);
    pm.role = 'puppeteer';
    run(g, 0.5);
    const puppets = g.state.units.filter((u) => u.role === 'puppet' && !u.dead);
    expect(puppets.length).toBe(2);
    killUnit(g, pm, n);
    run(g, 0.1);
    expect(puppets.every((u) => u.dead)).toBe(true);
  });

  test('invocador chama lobos que somem depois de um tempo', () => {
    const g = createNewGame(SYSTEMS, 53);
    noDefenders(g);
    const o = openRow(g);
    createNinja(g, o.x + 150, o.y, 'jounin', 0);
    const sm = createRogue(g, o.x, o.y, 13);
    sm.role = 'summoner';
    sm.abilityCd = 0;
    run(g, 0.2);
    const wolves = g.state.units.filter((u) => u.animal === 'wolf' && u.ownerId === sm.id);
    expect(wolves.length).toBe(2);
    expect(wolves.every((w) => w.faction === 'enemy')).toBe(true);
    for (const w of wolves) w.life = 0.01;
    run(g, 0.1);
    expect(wolves.every((w) => w.dead)).toBe(true);
  });

  test('hidra perde uma cabeça por vez e só cai na última', () => {
    const g = createNewGame(SYSTEMS, 54);
    g.state.level = 2;
    const [h] = spawnBoss(g, 'hydra', 300, 300);
    expect(h!.heads).toBe(3);
    const before = g.state.stats.bossesDefeated;
    killUnit(g, h!, null);
    expect(h!.dead).toBe(false);
    expect(h!.heads).toBe(2);
    expect(h!.hp).toBe(h!.maxHp);
    killUnit(g, h!, null);
    killUnit(g, h!, null);
    expect(h!.dead).toBe(true);
    expect(g.state.stats.bossesDefeated).toBe(before + 1);
  });

  test('golem se divide duas vezes e conta como chefe derrotado uma vez só', () => {
    const g = createNewGame(SYSTEMS, 55);
    g.state.level = 1;
    spawnBoss(g, 'golem', 300, 300);
    const before = g.state.stats.bossesDefeated;
    const alive = () => g.state.units.filter((u) => u.animal === 'golem' && !u.dead);
    let killed = 0;
    while (alive().length) {
      killUnit(g, alive()[0]!, null);
      killed++;
    }
    expect(killed).toBe(7); // 1 + 2 + 4
    expect(g.state.stats.bossesDefeated).toBe(before + 1);
  });

  test('invasões grandes trazem espião, marionetista e invocador em dias avançados', () => {
    const r = raidRoles(14, 6);
    expect(r).toContain('spy');
    expect(r).toContain('puppeteer');
    expect(r).toContain('summoner');
    expect(r.filter((x) => !x).length).toBeGreaterThanOrEqual(1);
    // grupo pequeno: sempre sobra ao menos um renegado comum
    expect(raidRoles(10, 3)).toEqual(['bomber', undefined, 'medic']);
  });
});
