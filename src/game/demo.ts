// Vila de vitrine (só para conferir a interface): fim de jogo com tudo liberado — todos os prédios no nível 3, ninjas
// de todas as patentes, Kage, Sannin, ANBU, clãs, cães, equipes em missão e expedição, oficinas com fila e estoque,
// lâminas lendárias, região com vilarejos em cada situação e o mapa todo explorado. Aberta por `?demo` na URL
// (main.ts), não lê nem grava o save do jogador. Nada aqui é usado no jogo normal.
import { DAY_LENGTH } from '../config';
import { BUILDINGS, type BuildingType, defOf } from '../data/buildings';
import { ITEM_LIST } from '../data/items';
import { JUTSU_LIST } from '../data/jutsus';
import { RANKS, type Rank } from '../data/ninja';
import { UPGRADES } from '../data/upgrades';
import { syncHokage } from './upgrade';
import type { BladeId } from '../data/blades';
import { appointAnbu } from './anbu';
import { grantBlade } from './blades';
import { clanMembers, foundClan } from './clans';
import { placeBuilding, shoreSpot } from './commands';
import { createNinja, createVillager, refreshDerived } from './entities';
import { startMine } from './expeditions';
import { autoEquipAll } from './gear';
import { crownKage } from './kage';
import { acceptMission, generateOffers } from './missions';
import { adoptDog } from './ninken';
import { createNewGame } from './newGame';
import { regionOf, startRegion } from './region';
import { colonyGame, createColony, moveToColony } from './colonies';
import { placeBuilt } from './scene';
import { addField, isPaddy, plotBlock } from './fields';
import type { CropId } from '../data/crops';
import { nameSannin } from './sannin';
import { learnSpec } from './specs';
import { autoTeams } from './teams';
import type { Game, System } from './game';
import type { Unit } from './types';
import { territoryCenter } from './village';
import { doorPos, doorTile } from './world';
import { pave } from './roads';
import { recordFallen } from './memorial';
import { assignWatch, watchCandidates } from './towerWatch';

/** Quantos de cada prédio a vitrine levanta (o resto, um). */
const COUNT: Partial<Record<BuildingType, number>> = { house: 8, farm: 3, lumber: 2, quarry: 2, market: 2, training: 2, tower: 3, ironmine: 1, herbgarden: 2, lantern: 4, cherry: 3, flowers: 2 };
/** Ninjas por patente e a faixa de nível. */
const ROSTER: [Rank, number, number, number][] = [['genin', 12, 1, 6], ['chunin', 10, 5, 12], ['jounin', 10, 10, 24]];

export function createDemoGame(systems: System[], seed = 4242): Game {
  const g = createNewGame(systems, seed);
  const s = g.state;
  s.level = 3;
  s.day = 42;
  s.time += 41 * DAY_LENGTH; // o dia vem do relógio
  Object.assign(s.res, { wood: 4800, stone: 3600, food: 2500, ryo: 25000, iron: 600, herbs: 400, paper: 300, crystal: 40, gold: 25, darksteel: 18 });
  s.explored.fill(-1);
  for (const site of s.sites) site.found = true;

  s.kageHistory.push({ name: 'Senju Hashira', day: 9 }); // um Kage anterior (o Monte dos Kages pede)
  syncHokage(g); // Residência da Grande Vila Oculta (5×5) antes de espalhar os prédios em volta
  placeAll(g);
  // ruas calçadas: as passagens em volta dos prédios perto da Residência viram calçada
  const door = doorTile(g.hokage()!);
  const occ = (x: number, y: number) => g.world.buildingIdAt(x, y) > 0;
  for (let ty = door.ty - 9; ty <= door.ty + 9; ty++)
    for (let tx = door.tx - 9; tx <= door.tx + 9; tx++)
      if (!occ(tx, ty) && (occ(tx + 1, ty) || occ(tx - 1, ty) || occ(tx, ty + 1) || occ(tx, ty - 1))) pave(g, tx, ty);
  for (const b of s.buildings) {
    b.built = true;
    b.progress = defOf(b).buildTime;
    if (UPGRADES[b.type]) b.level = 3;
  }
  // um de cada estado de obra para ver os cartões: upgrade andando e prédio em construção
  const house = s.buildings.find((b) => b.type === 'house' && b.level === 3);
  if (house) Object.assign(house, { level: 2, upgrade: 12 });
  const lastLumber = s.buildings.filter((b) => b.type === 'lumber').at(-1);
  if (lastLumber) Object.assign(lastLumber, { built: false, progress: 4 });
  g.world.rebuild();
  demoFields(g);
  g.world.rebuild();

  // moradores e ninjas
  const hk = g.hokage()!;
  const d = doorPos(hk);
  for (let i = 0; i < 40; i++) createVillager(g, d.x + ((i % 10) - 5) * 18, d.y + 40 + Math.floor(i / 10) * 16);
  const ninjas: Unit[] = [...s.units.filter((u) => u.ninja)];
  for (const [rank, n, lo, hi] of ROSTER)
    for (let i = 0; i < n; i++) {
      const u = createNinja(g, d.x + ((i % 6) - 3) * 22, d.y + 110 + ninjas.length * 3, rank, 2);
      u.ninja!.level = Math.round(lo + ((hi - lo) * i) / Math.max(1, n - 1));
      ninjas.push(u);
    }
  // três que caíram (Pedra Memorial e Edo Tensei)
  for (const [rank, lv] of [['chunin', 9], ['jounin', 17], ['genin', 3]] as const) {
    const f = createNinja(g, d.x, d.y + 140, rank, 2);
    f.ninja!.level = lv;
    recordFallen(s, f);
    f.dead = true;
  }
  s.units = s.units.filter((u) => !u.dead);
  for (const u of ninjas) {
    u.ninja!.xp = Math.round(u.ninja!.level * 37) % 90;
    u.ninja!.kills = u.ninja!.level * 3;
  }
  // um estudando, para a barra de estudo
  const learner = ninjas.find((u) => u.ninja!.rank === 'genin' && u.ninja!.jutsu[1] == null);
  const study = JUTSU_LIST.find((j) => j.rank <= 2 && !j.kekkei && !j.forbidden);
  if (learner && study) learner.ninja!.learning = { jutsuId: study.id, slot: 1, progress: 40, total: 100 };

  // Kage e os títulos
  const jounins = ninjas.filter((u) => u.ninja!.rank === 'jounin').sort((a, b) => b.ninja!.level - a.ninja!.level);
  const kage = jounins[0]!;
  kage.ninja!.level = Math.max(kage.ninja!.level, RANKS.kage.minLevel + 4);
  s.ceremony = { candidateId: kage.id, timer: 0 };
  crownKage(g);
  const paths = ['toad', 'snake', 'slug'] as const;
  jounins.slice(1, 4).forEach((u, i) => {
    u.ninja!.level = Math.max(u.ninja!.level, 21);
    nameSannin(g, u.id, paths[i]!);
  });
  jounins.slice(4, 6).forEach((u) => appointAnbu(g, u.id));
  // bestas com cauda: um Jinchuuriki da raposa e uma fera no jarro esperando quem a guarde
  const host = jounins[6];
  if (host) host.ninja!.bijuu = 9;
  s.bijuu.jar = [1];
  ninjas.filter((u) => u.ninja!.rank === 'chunin').slice(0, 3).forEach((u, i) => learnSpec(g, u.id, (['medic', 'spy', 'puppeteer'] as const)[i]!));
  for (const u of ninjas) refreshDerived(u);
  // três clãs: sobrenome repetido não funda outro, então segue tentando os próximos (Jounins e depois Chunins)
  for (const u of [...jounins.slice(6), ...ninjas.filter((x) => x.ninja!.rank === 'chunin')]) if (s.clans.length < 3) foundClan(g, u.id);
  // dōjutsu: o primeiro clã com o Sharingan, o segundo com o Byakugan (a linhagem; cópias e jutsus vêm lutando e estudando)
  (['sharingan', 'byakugan'] as const).forEach((eye, i) => {
    const c = s.clans[i];
    if (!c) return;
    c.kekkei = eye;
    for (const m of clanMembers(g, c)) if (m.ninja) m.ninja.kekkei = eye;
  });

  // equipamento, lâminas, pergaminhos
  for (const it of ITEM_LIST) if (!it.blade) s.items[it.id] = 60 + (it.id.length % 5) * 7;
  const blades: BladeId[] = ['zabuza', 'samehada', 'kusanagi', 'asuma'];
  for (const id of blades) grantBlade(g, id, 'vitrine');
  // metade dos pergaminhos abertos (as duas abas da Biblioteca com conteúdo); os básicos (rank E/D) sempre
  s.jutsuOpen = JUTSU_LIST.filter((j, i) => !j.kekkei && !j.forbidden && (j.rank <= 2 || i % 2 === 0)).map((j) => j.id);
  s.scrolls = JUTSU_LIST.filter((j) => j.forbidden).slice(0, 2).map((j) => j.id);
  s.flags.autoGear = true;
  autoEquipAll(g);
  // desgaste variado para as barras e o filtro "Equip. gasto"
  ninjas.forEach((u, i) => {
    if (i % 4 === 0) u.ninja!.equip.dura = { weapon: 0.15, armor: 0.5 };
  });

  // equipes, cães, oficinas
  autoTeams(g);
  const breeds = ['shiba', 'pug', 'white', 'bull'] as const;
  ninjas.filter((u) => u.ninja!.rank === 'chunin').slice(3, 7).forEach((u, i) => adoptDog(g, u.id, breeds[i]));
  for (const b of s.buildings) {
    if (b.type !== 'forge' && b.type !== 'pharmacy' && b.type !== 'sealshop') continue;
    const own = ITEM_LIST.filter((it) => it.building === b.type && !it.blade).map((it) => it.id);
    const list = own.length ? own : ITEM_LIST.filter((it) => !it.blade).slice(0, 4).map((it) => it.id);
    b.queue = list.slice(1, 4);
    b.craft = { itemId: list[0]!, progress: 3 };
    (b as { keep?: Record<string, number> }).keep = { [list[0]!]: 10, [list[1] ?? list[0]!]: 5 };
  }

  // missões, expedição na mina e na região, vilarejos em cada situação
  generateOffers(g);
  const free = () => s.teams.filter((t) => !s.missions.some((m) => (m as { teamId?: number }).teamId === t.id) && !s.expeditions.some((e) => e.teamId === t.id));
  for (const m of s.missions.slice(0, 2)) {
    const t = free()[0];
    if (t) acceptMission(g, m.id, t.id);
  }
  const mine = s.sites.find((x) => x.kind === 'cave' && !x.done);
  const mt = free()[0];
  if (mine && mt) startMine(g, mt.id, mine.id);
  const rt = free()[0];
  if (rt) startRegion(g, rt.id, 'arroz', 'trade');
  // feridos (depois das saídas: equipe com ferido não parte), para as barras de vida
  const home = ninjas.filter((u) => !s.expeditions.some((e) => e.unitIds.includes(u.id)));
  home[3]!.hp = Math.round(home[3]!.maxHp * 0.3);
  home[8]!.hp = Math.round(home[8]!.maxHp * 0.6);
  Object.assign(s.region.pesca!, { status: 'protected', rel: 60 });
  Object.assign(s.region.montanha!, { status: 'hostile', rel: -70, revengeDay: s.day + 20 });
  Object.assign(s.region.mercadores!, { status: 'vassal', rel: 30 });
  Object.assign(s.region.nevoa!, { explored: true, outpost: true });
  // uma colônia fundada na Ilha do Recife (tema pesca), com gente e uma obra em andamento (game/colonies.ts)
  Object.assign(regionOf(s, 'recife'), { explored: true, colony: true });
  s.colonies.recife = createColony(g, 'recife');
  const settlers = [...s.units.filter((u) => u.kind === 'villager' && !u.dead).slice(0, 6), ...home.filter((u) => u.ninja!.rank === 'genin' && !u.ninja!.learning && u.hp === u.maxHp).slice(0, 2)];
  moveToColony(g, 'recife', settlers);
  {
    const cg = colonyGame(g, 'recife')!;
    const house = cg.state.buildings.find((b) => b.type === 'house')!;
    const tiles: [number, number][] = [];
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) tiles.push([house.tx + x, house.ty - 5 + y]);
    addField(cg, tiles, 'cabbage', (p, i) => Object.assign(p, { st: 2, crop: 'cabbage', g: 0.2 + (i % 5) * 0.18 }));
    const tower = placeBuilt(cg, 'tower', house.tx + 5, house.ty - 4);
    if (tower) Object.assign(tower, { built: false, progress: 3 }); // uma obra para o resumo do dia terminar
    cg.world.rebuild();
  }
  s.honor = 34;
  s.infamy = 12;
  s.reputation = 80;
  s.happiness = 72;
  Object.assign(s.stats, { kills: 412, raidsRepelled: 17, born: 63, lost: 9, missionsDone: 38, bossesDefeated: 4 });

  // sem invasão nem chefe atrapalhando a conferência
  s.timers.raid = 1e9;
  s.bossTimer = 1e9;
  s.examNextDay = s.day + 30;
  s.org.nextDay = s.day + 20;
  s.sound.nextDay = s.day + 20;
  s.swordsmen.nextDay = s.day + 20;
  // uma torre com vigia já lá em cima (game/towerWatch.ts)
  const tower = s.buildings.find((b) => b.type === 'tower' && b.built);
  const guard = watchCandidates(g)[0];
  if (tower && guard && assignWatch(g, tower.id, guard.id).ok) {
    const d = doorPos(tower);
    Object.assign(guard, { x: d.x, y: d.y, state: 'towerWatch', moving: false });
  }
  g.reindex();
  return g;
}

/** Levanta cada tipo de prédio no lugar livre mais perto do centro (o Porto na beira da água mais perto). */
function placeAll(g: Game) {
  const s = g.state;
  const t0 = territoryCenter(s);
  const c = { tx: Math.round(t0?.tx ?? 36), ty: Math.round(t0?.ty ?? 24) };
  const spots: [number, number][] = [];
  for (let r = 3; r < 40; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r && (dx + dy) % 2 === 0) spots.push([c.tx + dx, c.ty + dy]);
  const types = (Object.keys(BUILDINGS) as BuildingType[]).filter((t) => BUILDINGS[t].buildable);
  const have = (t: BuildingType) => s.buildings.filter((b) => b.type === t).length;
  for (const t of types) {
    const want = COUNT[t] ?? 1;
    if (BUILDINGS[t].shore) {
      for (const [tx, ty] of spots) {
        const sp = shoreSpot(g, t, tx, ty, undefined, 1);
        if (sp && placeBuilding(g, t, sp.tx, sp.ty, sp.flip).ok) break;
      }
      continue;
    }
    for (const [tx, ty] of spots) {
      if (have(t) >= want) break;
      // folga de um tile em volta para o mapa não virar um bloco só, pelo terreno do nível final (a casa 3 é 3×3)
      const def = defOf({ type: t, level: UPGRADES[t] ? 3 : 1 });
      const roomy = s.buildings.every((b) => {
        const o = defOf(b);
        return tx + def.w + 1 <= b.tx || b.tx + o.w + 1 <= tx || ty + def.h + 1 <= b.ty || b.ty + o.h + 1 <= ty;
      });
      if (roomy) placeBuilding(g, t, tx, ty);
    }
  }
}

/**
 * Campos cercados da vitrine (game/fields.ts): um de cada cultura, cada um com os canteiros em etapas diferentes (crua,
 * arada, crescendo, madura, seca), em formatos variados; o arroz na beira da água.
 */
function demoFields(g: Game) {
  const s = g.state;
  // o campo inicial do jogo novo sai: a vitrine monta os dela (e fica dentro do teto de canteiros)
  s.fields = [];
  g.world.rebuild();
  const t0 = territoryCenter(s);
  const c = { tx: Math.round(t0?.tx ?? 50), ty: Math.round(t0?.ty ?? 50) };
  const SHAPES: Record<string, [number, number][]> = {
    rect: [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1], [3, 1], [0, 2], [1, 2], [2, 2], [3, 2]],
    l: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2], [2, 2], [3, 2]],
    sq: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]],
    row: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1]],
    small: [[0, 0], [1, 0], [0, 1], [1, 1]],
  };
  const plan: [CropId, string][] = [['wheat', 'rect'], ['rice', 'row'], ['turnip', 'l'], ['cabbage', 'sq'], ['pumpkin', 'sq'], ['herbs', 'small']];
  const taken = new Set<string>();
  const fits = (ax: number, ay: number, shape: [number, number][], paddy: boolean) => {
    let wet = false;
    for (const [dx, dy] of shape) {
      const tx = ax + dx;
      const ty = ay + dy;
      if (plotBlock(g, tx, ty)) return false;
      // um tile de folga entre os campos (cada um com a sua cerca)
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) if (taken.has(`${tx + ox},${ty + oy}`)) return false;
      if (isPaddy(s, tx, ty)) wet = true;
    }
    return !paddy || wet;
  };
  for (const [crop, shape] of plan) {
    const sh = SHAPES[shape]!;
    let at: [number, number] | null = null;
    for (let r = 4; r < 40 && !at; r++)
      for (let dy = -r; dy <= r && !at; dy++)
        for (let dx = -r; dx <= r && !at; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (fits(c.tx + dx, c.ty + dy, sh, crop === 'rice')) at = [c.tx + dx, c.ty + dy];
        }
    if (!at) continue;
    const tiles = sh.map(([dx, dy]) => [at![0] + dx, at![1] + dy] as [number, number]);
    for (const [tx, ty] of tiles) taken.add(`${tx},${ty}`);
    // etapas variadas: maduras, crescendo em vários pontos, uma seca, arada e crua
    addField(g, tiles, crop, (p, i) => {
      const k = i % 6;
      if (k === 0) Object.assign(p, { st: 3, crop, g: 1, ripe: 10 });
      else if (k === 5) Object.assign(p, { st: i % 2 ? 1 : 0 });
      else Object.assign(p, { st: 2, crop, g: k * 0.2, wet: k === 4 ? 0 : 999 });
      if (i % 4 === 1) p.fert = 0.5;
    });
  }
}
