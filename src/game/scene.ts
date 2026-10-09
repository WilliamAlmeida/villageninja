// Mapas de missão jogáveis: quando a equipe chega a um vilarejo para saquear ou anexar à força, a invasão vira um
// mapa próprio (a vila deles no mesmo estilo da sua) simulado ao lado da vila, que continua andando. A equipe é
// copiada para lá; ao terminar, o resultado (vida, XP, atributos, mortes) volta para os ninjas originais.
import { MAP_H, MAP_W } from '../config';
import { chance, mulberry32 } from '../core/rng';
import { BUILDINGS, type BuildingType } from '../data/buildings';
import { ACTION_LABEL, REGION, REL } from '../data/region';
import { rescueChance } from './care';
import { createAnimal, createRogue, refreshDerived } from './entities';
import { resolveSite, revealCircle } from './explore';
import { MINE } from '../data/expeditions';
import { ANIMALS, type AnimalType } from '../data/animals';
import { CONTRACTS } from '../data/contracts';
import { ORG } from '../data/org';
import { createOrgMember, lairGuards } from './org';
import { createSoundMember } from './sound';
import { SOUND, SOUND_MEMBERS, SOUND_RAIDERS } from '../data/sound';
import { fxText } from './fx';
import { noteUse } from './wear';
import { Game } from './game';
import { baseState } from './newGame';
import { findPath, nearestWalkable } from './pathfinding';
import { nodePower, regionOf } from './region';
import { SCENE_SYSTEMS } from './systems';
import { createTeam, joinAsMember, joinAsSensei } from './teams';
import type { Cost, Expedition, GameState, SceneInfo, Unit } from './types';
import { CENTER_TX, CENTER_TY, doorPos, T, tileCenter, toTile } from './world';

// ------------------------------------------------------------------ o jogo do mapa de missão
const games = new WeakMap<GameState, Game>();

/** Jogo do mapa de missão em andamento (criado sob demanda; o estado fica dentro do save da vila). */
export function sceneGame(home: Game): Game | null {
  const s = home.state.scene;
  if (!s) return null;
  let g = games.get(s);
  if (!g) {
    g = new Game(s, SCENE_SYSTEMS);
    g.isScene = true;
    games.set(s, g);
  }
  return g;
}

/** Esta expedição vira um mapa jogável? (saquear; anexar à força). Só um mapa por vez. */
export function opensScene(home: Game, e: Expedition) {
  if (home.state.scene) return false;
  if (e.kind === 'mine') return true;
  if (e.kind !== 'region') return false;
  if (e.action === 'raid' || e.action === 'explore' || e.action === 'contract' || e.action === 'assault' || e.action === 'rescue') return true;
  return e.action === 'annex' && regionOf(home.state, e.node!).rel < REL.annexPeace;
}

// ------------------------------------------------------------------ vilarejo inimigo
/** Planta da vila inimiga em volta do centro (tipo, deslocamento em tiles). As primeiras são as mais importantes. */
const LAYOUT: [BuildingType, number, number][] = [
  ['market', -1, -1], ['house', -6, -4], ['house', 4, -5], ['tower', -3, -7], ['house', -7, 3], ['house', 5, 3], ['tower', 6, -1],
  ['farm', -13, -2], ['house', -2, 6], ['training', 9, 3], ['tower', -9, 7], ['house', 1, -9], ['tower', 3, 8], ['house', 10, -6], ['farm', 9, -11], ['house', -11, -8],
];

/** Ponto de chegada na borda do mapa com caminho até o centro. */
function entryPoint(g: Game) {
  for (const [tx, ty] of [[CENTER_TX, MAP_H - 4], [CENTER_TX, 3], [4, CENTER_TY], [MAP_W - 5, CENTER_TY], [8, MAP_H - 5], [MAP_W - 9, 4]] as const) {
    const w = nearestWalkable(g.world, tx, ty, 6);
    if (w && findPath(g.world, w[0], w[1], CENTER_TX, CENTER_TY + 2)) return { x: tileCenter(w[0]), y: tileCenter(w[1]) };
  }
  return { x: tileCenter(CENTER_TX), y: tileCenter(MAP_H - 6) };
}

function place(g: Game, type: BuildingType, tx: number, ty: number, level: number) {
  const def = BUILDINGS[type];
  for (let r = 0; r <= 3; r++)
    for (const [dx, dy] of r ? [[r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, -r], [r, -r], [-r, r]] : [[0, 0]]) {
      const x = tx + dx!;
      const y = ty + dy!;
      for (const n of [...g.state.nodes]) if (n.tx >= x - 1 && n.tx <= x + def.w && n.ty >= y - 1 && n.ty <= y + def.h) g.removeNode(n.id);
      if (!g.world.canPlace(type, x, y)) continue;
      return g.addBuilding({ id: g.newId(), type, tx: x, ty: y, built: true, progress: def.buildTime, desired: 0, workers: [], cd: 0, level });
    }
  return null;
}

/** Copia a equipe da vila para o mapa (ids novos; `origin` aponta para o ninja original). */
function bringTeam(home: Game, g: Game, e: Expedition, at: { x: number; y: number }) {
  const us = home.state.units.filter((u) => !u.dead && u.away === e.id);
  const ids = new Map<number, number>();
  us.forEach((u, i) => {
    const c: Unit = JSON.parse(JSON.stringify(u));
    c.id = g.newId();
    c.origin = u.id;
    ids.set(u.id, c.id);
    Object.assign(c, {
      x: at.x + ((i % 3) - 1) * 18, y: at.y - Math.floor(i / 3) * 18, homeId: null, jobId: null, taskId: null, command: null, targetId: null,
      path: [], hasGoal: false, hidden: false, away: undefined, state: 'idle', moving: false, timer: 0, hitBy: undefined, mark: undefined,
      cast: undefined, dash: undefined, trainId: undefined,
    });
    if (c.ninja) c.ninja.learning = null; // estudo fica na vila (sem Academia lá ele seria cancelado)
    g.addUnit(c);
    unstick(g, c);
  });
  const tm = home.team(e.teamId);
  if (tm) {
    const t = createTeam(g, tm.name);
    t.color = tm.color;
    if (tm.senseiId != null && ids.has(tm.senseiId)) joinAsSensei(g, t.id, ids.get(tm.senseiId)!);
    for (const id of tm.memberIds) if (ids.has(id)) joinAsMember(g, t.id, ids.get(id)!);
  }
}

/** Quem ficou dentro de parede/rocha (a fila de entrada cai fora do chão numa caverna estreita) vai para o chão mais perto. */
function unstick(g: Game, u: Unit) {
  if (g.world.walkablePx(u.x, u.y)) return;
  const w = nearestWalkable(g.world, toTile(u.x), toTile(u.y), 12);
  if (!w) return;
  u.x = tileCenter(w[0]);
  u.y = tileCenter(w[1]);
  u.path = [];
}

/** Monta o mapa do vilarejo invadido: casas, armazém, torres (do inimigo), guardas e, para anexar, o chefe. */
export function createVillageScene(home: Game, e: Expedition): GameState {
  const def = REGION[e.node!]!;
  const power = nodePower(home.state, def);
  const seed = (home.state.seed ^ (e.id * 2654435761)) >>> 0;
  const s = baseState(seed);
  s.time = home.state.time;
  s.day = home.state.day;
  s.level = power >= 50 ? 2 : power >= 30 ? 1 : 0;
  s.towersFaction = 'enemy';
  s.res = { ...s.res, wood: 0, stone: 0, food: 0, ryo: 0 };
  s.flags = { ...s.flags, shelterRookies: false };
  s.timers = { ...s.timers, animal: 1e9, raid: 1e9 };
  const g = new Game(s, SCENE_SYSTEMS);
  g.isScene = true;
  const lvl = power >= 50 ? 3 : power >= 30 ? 2 : 1;
  const count = power < 30 ? 9 : power < 50 ? 12 : LAYOUT.length;
  const built = LAYOUT.slice(0, count)
    .map(([type, dx, dy]) => place(g, type, CENTER_TX + dx, CENTER_TY + dy, type === 'farm' || type === 'training' ? 1 : lvl))
    .filter((b) => b != null);
  const warehouse = built.find((b) => b!.type === 'market') ?? undefined;
  // guardas espalhados pelas portas, mais e mais fortes conforme o poder do lugar
  const rank = power >= 50 ? 'jounin' : power >= 30 ? 'chunin' : 'genin';
  const n = Math.max(3, Math.min(10, Math.round(power / 8) + 1));
  const rnd = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    const b = built[i % built.length]!;
    const p = doorPos(b);
    const w = nearestWalkable(g.world, Math.floor((p.x + (rnd() - 0.5) * 40) / 32), Math.floor((p.y + 20) / 32), 4);
    const u = createRogue(g, w ? tileCenter(w[0]) : p.x, w ? tileCenter(w[1]) : p.y + 20, home.state.day, {
      rank, stats: Math.min(3, power * 0.04), jutsu: chance(0.5) ? 2 : 1, name: `Guarda de ${def.name}`,
    });
    guard(u);
  }
  let leaderId: number | undefined;
  if (e.action === 'annex' && warehouse) {
    const p = doorPos(warehouse);
    const boss = createRogue(g, p.x, p.y + 24, home.state.day, {
      rank: rank === 'genin' ? 'chunin' : 'jounin', stats: Math.min(3, power * 0.05 + 0.6), jutsu: 2, hpMult: 2.2, name: `Chefe de ${def.name}`,
    });
    boss.boss = true;
    guard(boss);
    leaderId = boss.id;
  }
  const entry = entryPoint(g);
  bringTeam(home, g, e, entry);
  revealCircle(s, Math.floor(entry.x / 32), Math.floor(entry.y / 32), 9);
  const info: SceneInfo = {
    kind: 'village', expId: e.id, node: def.id, action: e.action, title: `${ACTION_LABEL[e.action!]} · ${def.name}`,
    goal: e.action === 'annex' ? `Derrote o chefe de ${def.name}.` : 'Saqueie o armazém (fique no Mercado deles) ou derrote todos os guardas.',
    result: null, warehouseId: warehouse?.id, leaderId, loot: 0, lootNeed: 10, defenders: n + (leaderId ? 1 : 0), entry,
  };
  s.sceneInfo = info;
  return s;
}

function guard(u: Unit) {
  u.missionId = -1; // defende o próprio lugar (guardHome), não marcha
  u.homeX = u.x;
  u.homeY = u.y;
  u.state = 'guard';
}

// ------------------------------------------------------------------ objetivo e fim
/** Quem ainda defende o mapa. */
export const sceneFoes = (g: Game) => g.state.units.filter((u) => !u.dead && (u.faction === 'enemy' || u.faction === 'wild'));
export const sceneTeam = (g: Game) => g.state.units.filter((u) => !u.dead && u.faction === 'village' && u.origin != null);

/** Confere o objetivo do mapa de missão (sistema do mapa). */
export function sceneTick(g: Game, dt: number) {
  const info = g.state.sceneInfo;
  if (!info || info.result) return;
  const end = (r: 'win' | 'lose', text: string) => {
    info.result = r;
    g.toast(text, r === 'win' ? 'good' : 'danger');
  };
  for (const u of sceneTeam(g)) unstick(g, u); // saves de antes: ninja que entrou preso na rocha
  if (!sceneTeam(g).length) return end('lose', `{skull} A equipe caiu em ${info.kind === 'mine' ? 'na mina' : (REGION[info.node!]?.name ?? 'combate')}.`);
  const foes = sceneFoes(g);
  if (info.kind === 'mine') return mineTick(g, info, foes, end);
  if (info.kind === 'island') return islandTick(g, end);
  if (info.kind === 'hideout') {
    const left = g.state.units.filter((u) => !u.dead && (u.org || u.sound));
    if (!left.length) return end('win', info.node === 'som' ? `{crown} O ${SOUND.name} caiu! O raptado está livre.` : `{crown} O líder da ${ORG.name} caiu! O covil é seu.`);
    return;
  }
  if (info.kind === 'trial') {
    const boss = g.unit(info.bossId);
    if (!boss || boss.dead) return end('win', '{scroll} O guardião se curvou: a equipe passou na prova!');
    return;
  }
  if (info.leaderId != null) {
    const leader = g.unit(info.leaderId);
    if (!leader || leader.dead) return end('win', '{crown} O chefe caiu! O vilarejo se rende.');
  }
  if (!foes.length) return end('win', '{swords} Todos os guardas caíram!');
  const wh = g.building(info.warehouseId);
  if (wh && info.action === 'raid') {
    const p = doorPos(wh);
    const ours = sceneTeam(g).some((u) => Math.hypot(u.x - p.x, u.y - p.y) < 44);
    const contested = foes.some((u) => Math.hypot(u.x - p.x, u.y - p.y) < 110);
    if (ours && !contested) {
      info.loot += dt;
      if (Math.random() < dt * 2) fxText(g, p.x, p.y - 20, `Saqueando ${Math.floor((info.loot / info.lootNeed) * 100)}%`, '#ffd34d');
      if (info.loot >= info.lootNeed) return end('win', '{ryo} O armazém foi saqueado!');
    }
  }
}

/** O jogador manda a equipe recuar (sai viva, sem o objetivo). */
export function retreatScene(home: Game) {
  const info = home.state.scene?.sceneInfo;
  if (info && !info.result) info.result = 'retreat';
}

/** Ordem rápida: a equipe avança até o armazém (ou o chefe), lutando com quem aparecer no caminho. */
export function advanceTarget(g: Game) {
  const info = g.state.sceneInfo;
  if (!info) return null;
  if (info.kind === 'island') {
    // a amostra (baú) mais perto ainda fechada
    const lead = sceneTeam(g)[0];
    const open = g.state.sites.filter((x) => x.kind === 'chest' && !x.done);
    const c = lead ? open.sort((a, b) => Math.hypot(tileCenter(a.tx) - lead.x, tileCenter(a.ty) - lead.y) - Math.hypot(tileCenter(b.tx) - lead.x, tileCenter(b.ty) - lead.y))[0] : open[0];
    return c ? { x: tileCenter(c.tx), y: tileCenter(c.ty) } : null;
  }
  if (info.kind === 'hideout') {
    const lead = sceneTeam(g)[0];
    const org = g.state.units.filter((u) => !u.dead && (u.org || u.sound));
    const o = lead ? org.sort((a, b) => Math.hypot(a.x - lead.x, a.y - lead.y) - Math.hypot(b.x - lead.x, b.y - lead.y))[0] : org[0];
    return o ? { x: o.x, y: o.y } : null;
  }
  if (info.kind === 'mine' || info.kind === 'trial') {
    const boss = g.unit(info.bossId);
    if (boss && !boss.dead) return { x: boss.x, y: boss.y };
    const st = g.state.sites.find((x) => x.id === info.stairsId);
    return st ? { x: tileCenter(st.tx), y: tileCenter(st.ty) } : null;
  }
  const leader = g.unit(info.leaderId);
  if (leader && !leader.dead) return { x: leader.x, y: leader.y };
  const wh = g.building(info.warehouseId);
  if (wh) return doorPos(wh);
  const f = sceneFoes(g)[0];
  return f ? { x: f.x, y: f.y } : null;
}

/** Fecha o mapa: devolve vida, XP, atributos e mortes aos ninjas da vila. Retorna o resultado e o saque juntado lá. */
export function closeScene(home: Game): { result: 'win' | 'lose' | 'retreat'; loot: Cost } {
  const s = home.state.scene;
  const result = s?.sceneInfo?.result ?? 'retreat';
  if (!s) return { result, loot: {} };
  const loot: Cost = {};
  for (const [k, v] of Object.entries(s.res)) if (v > 0) loot[k as keyof Cost] = Math.floor(v);
  for (const c of s.units) {
    if (c.origin == null) continue;
    const u = home.unit(c.origin);
    if (!u || u.dead) continue;
    if (u.ninja && c.ninja) {
      u.ninja.xp = c.ninja.xp;
      u.ninja.level = c.ninja.level;
      u.ninja.kills = c.ninja.kills;
      u.ninja.stats = { ...c.ninja.stats };
      u.ninja.equip = { ...c.ninja.equip, dura: c.ninja.equip.dura && { ...c.ninja.equip.dura } };
      refreshDerived(u);
    }
    if (!c.dead) {
      u.hp = Math.max(1, Math.min(u.maxHp, c.hp));
      continue;
    }
    // caiu no mapa: o Hospital da vila ainda pode salvar (trazido ferido pelos colegas)
    if (chance(rescueChance(home, u))) {
      u.hp = 1;
      home.toast(`{medic} ${u.name} caiu, mas foi trazido(a) ferido(a) para o Hospital.`, 'warn');
    } else {
      u.dead = true;
      home.state.stats.lost++;
      home.state.grief = Math.min(30, home.state.grief + 8);
      home.toast(`{skull} ${u.name} não voltou da invasão.`, 'danger');
    }
  }
  // consumíveis gastos lá entram no consumo da semana da vila
  for (const d of s.usage?.days ?? []) for (const [id, n] of Object.entries(d)) noteUse(home.state, id, n);
  home.state.scene = null;
  return { result, loot };
}

// ------------------------------------------------------------------ mina: um mapa de caverna por andar
/** Bichos de cada andar (o último tem o guardião). */
const MINE_FAUNA: AnimalType[][] = [['spider', 'boar'], ['spider', 'bear'], ['spider', 'tiger', 'bear'], ['rhino', 'tiger'], ['rhino', 'bear']];


/** Caverna por autômato celular: só a galeria ligada à entrada (à esquerda) fica; `far` é o ponto mais fundo. */
function carveCave(s: GameState, rnd: () => number) {
  const W = MAP_W;
  const H = MAP_H;
  let wall = Array.from({ length: W * H }, (_, i) => {
    const x = i % W;
    const y = Math.floor(i / W);
    return x < 2 || y < 2 || x >= W - 2 || y >= H - 2 ? 1 : rnd() < 0.44 ? 1 : 0;
  });
  for (let it = 0; it < 5; it++) {
    const next = wall.slice();
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) n += wall[(y + dy) * W + x + dx]!;
        next[y * W + x] = n >= 5 ? 1 : 0;
      }
    wall = next;
  }
  // entrada: chão mais à esquerda; só a galeria ligada a ela fica (o resto vira rocha)
  let start = -1;
  for (let x = 2; x < W && start < 0; x++) for (let y = Math.floor(H / 3); y < (H * 2) / 3 && start < 0; y++) if (!wall[y * W + x]) start = y * W + x;
  if (start < 0) start = Math.floor(H / 2) * W + 4;
  wall[start] = 0;
  const dist = new Int32Array(W * H).fill(-1);
  const q = [start];
  dist[start] = 0;
  for (let k = 0; k < q.length; k++) {
    const i = q[k]!;
    for (const d of [1, -1, W, -W]) {
      const j = i + d;
      if (j < 0 || j >= W * H || wall[j] || dist[j]! >= 0) continue;
      dist[j] = dist[i]! + 1;
      q.push(j);
    }
  }
  let far = start;
  for (let i = 0; i < W * H; i++) {
    if (dist[i]! < 0) wall[i] = 1;
    else if (dist[i]! > dist[far]!) far = i;
  }
  s.tiles = wall.map((w) => (w ? T.ROCK : T.DIRT));
  s.nodes = [];
  return { wall, start, far, dist, cells: q.filter((i) => !wall[i]) };
}

/** Caverna gerada por autômato celular: galerias ligadas da entrada (à esquerda) até a descida (o ponto mais longe). */
export function createMineScene(home: Game, e: Expedition, floor: number): GameState {
  const seed = (home.state.seed ^ (e.id * 40503) ^ (floor * 2246822519)) >>> 0;
  const s = baseState(seed);
  const rnd = mulberry32(seed);
  const { wall, start, far, dist, cells: q } = carveCave(s, rnd);
  const W = MAP_W;
  s.nodes = [];
  s.time = home.state.time;
  s.day = home.state.day;
  s.towersFaction = 'enemy';
  s.res = { ...s.res, wood: 0, stone: 0, food: 0, ryo: 0 };
  s.flags = { ...s.flags, shelterRookies: false };
  s.timers = { ...s.timers, animal: 1e9, raid: 1e9 };
  const g = new Game(s, SCENE_SYSTEMS);
  g.isScene = true;
  const floorCells = q.filter((i) => !wall[i]);
  const at = (i: number) => ({ tx: i % W, ty: Math.floor(i / W) });
  // veios de minério junto das paredes (enfeite) e alguns baús nos cantos mais fundos
  for (const i of floorCells) {
    const { tx, ty } = at(i);
    const byWall = wall[i - 1] || wall[i + 1] || wall[i - W] || wall[i + W];
    if (byWall && rnd() < 0.035) s.nodes.push({ id: g.newId(), type: rnd() < 0.7 ? 'ore' : 'rock', tx, ty, amount: 40, max: 40, variant: Math.floor(rnd() * 4) });
  }
  g.reindex();
  const deep = floorCells.filter((i) => dist[i]! > dist[far]! * 0.35).sort(() => rnd() - 0.5);
  for (let c = 0; c < 2 + Math.floor(floor / 2) && deep.length; c++) {
    const { tx, ty } = at(deep.pop()!);
    s.sites.push({ id: g.newId(), kind: 'chest', tx, ty, found: false, done: false });
  }
  const last = floor >= MINE.floors;
  const stairs = at(far);
  const stairsSite = { id: g.newId(), kind: 'cave' as const, tx: stairs.tx, ty: stairs.ty, found: false, done: false };
  s.sites.push(stairsSite);
  // bichos guardando as galerias, mais fortes a cada andar
  const fauna = MINE_FAUNA[Math.min(MINE_FAUNA.length, floor) - 1]!;
  const n = 3 + Math.round(floor * 1.5);
  const spots = floorCells.filter((i) => dist[i]! > 14).sort(() => rnd() - 0.5);
  for (let k = 0; k < n && spots.length; k++) {
    const { tx, ty } = at(spots.pop()!);
    const a = createAnimal(g, fauna[k % fauna.length]!, tileCenter(tx), tileCenter(ty));
    a.maxHp = a.hp = Math.round(a.maxHp * (1 + floor * 0.3));
    guard(a);
  }
  let bossId: number | undefined;
  if (last) {
    const boss = createAnimal(g, 'golem', tileCenter(stairs.tx) - 30, tileCenter(stairs.ty));
    boss.boss = true;
    boss.life = 1e9;
    boss.name = 'Golem de cristal';
    guard(boss);
    bossId = boss.id;
  }
  const entry = { x: tileCenter(at(start).tx), y: tileCenter(at(start).ty) };
  bringTeam(home, g, e, entry);
  revealCircle(s, at(start).tx, at(start).ty, 6);
  s.sceneInfo = {
    kind: 'mine', expId: e.id, title: `Mina · andar ${floor}/${MINE.floors}`, floor, stairsId: stairsSite.id, bossId,
    goal: last ? 'Derrote o guardião do fundo da mina.' : 'Ache a descida para o próximo andar (baús pelo caminho).',
    result: null, loot: 0, lootNeed: 0, defenders: n + (bossId ? 1 : 0), entry,
  };
  return s;
}

// ------------------------------------------------------------------ ilha (explorar) e lugar sagrado (prova do contrato)
/** Bichos de cada ilha. */
const ISLAND_FAUNA: Record<string, AnimalType[]> = { vulcao: ['rhino', 'boar', 'bear'], nevoa: ['spider', 'tiger', 'wolf'], templos: ['monkey', 'boar', 'wolf'] };

/** Base comum dos mapas de região (ilha e prova): estado do mapa e jogo, sem vila. */
function regionMap(home: Game, e: Expedition) {
  const seed = (home.state.seed ^ (e.id * 2654435761) ^ 0x51a7) >>> 0;
  const s = baseState(seed);
  s.time = home.state.time;
  s.day = home.state.day;
  s.towersFaction = 'enemy';
  s.res = { ...s.res, wood: 0, stone: 0, food: 0, ryo: 0 };
  s.flags = { ...s.flags, shelterRookies: false };
  s.timers = { ...s.timers, animal: 1e9, raid: 1e9 };
  return { s, rnd: mulberry32(seed) };
}

/** Ilha: terra cercada de mar, bichos da ilha e amostras (baús) a recolher. */
export function createIslandScene(home: Game, e: Expedition): GameState {
  const def = REGION[e.node!]!;
  const power = nodePower(home.state, def);
  const { s, rnd } = regionMap(home, e);
  // máscara da ilha: raio com ondulação; fora dela é mar
  const R = Math.min(MAP_W, MAP_H) * 0.46;
  const wob = Array.from({ length: 12 }, () => 0.75 + rnd() * 0.35);
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const dx = (x - CENTER_TX) / 1.45;
      const dy = y - CENTER_TY;
      const a = ((Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2)) * wob.length;
      const k = wob[Math.floor(a) % wob.length]! * (1 - (a % 1)) + wob[Math.ceil(a) % wob.length]! * (a % 1);
      const r = Math.hypot(dx, dy);
      const i = y * MAP_W + x;
      if (r > R * k) s.tiles[i] = T.WATER;
      else if (r > R * k - 1.6) s.tiles[i] = T.SAND;
    }
  s.nodes = s.nodes.filter((n) => s.tiles[n.ty * MAP_W + n.tx] !== T.WATER && s.tiles[n.ty * MAP_W + n.tx] !== T.SAND);
  const g = new Game(s, SCENE_SYSTEMS);
  g.isScene = true;
  // chegada: praia do sul
  let entry = { x: tileCenter(CENTER_TX), y: tileCenter(CENTER_TY) };
  for (let y = MAP_H - 2; y > CENTER_TY; y--) {
    const w = nearestWalkable(g.world, CENTER_TX, y, 3);
    if (w && s.tiles[w[1] * MAP_W + w[0]] !== T.WATER) {
      entry = { x: tileCenter(w[0]), y: tileCenter(w[1]) };
      break;
    }
  }
  // amostras (baús) espalhadas longe da praia
  const land: [number, number][] = [];
  for (let y = 2; y < MAP_H - 2; y++) for (let x = 2; x < MAP_W - 2; x++) if (g.world.walkable(x, y) && Math.hypot(x - entry.x / 32, y - entry.y / 32) > 12) land.push([x, y]);
  const chests = 3 + (power >= 40 ? 1 : 0);
  for (let c = 0; c < chests && land.length; c++) {
    const [tx, ty] = land.splice(Math.floor(rnd() * land.length), 1)[0]!;
    s.sites.push({ id: g.newId(), kind: 'chest', tx, ty, found: false, done: false });
  }
  const fauna = ISLAND_FAUNA[def.id] ?? ['wolf', 'boar'];
  const n = Math.max(4, Math.round(power / 6));
  for (let k = 0; k < n && land.length; k++) {
    const [tx, ty] = land.splice(Math.floor(rnd() * land.length), 1)[0]!;
    const a = createAnimal(g, fauna[k % fauna.length]!, tileCenter(tx), tileCenter(ty));
    a.maxHp = a.hp = Math.round(a.maxHp * (0.8 + power / 50));
    guard(a);
  }
  bringTeam(home, g, e, entry);
  revealCircle(s, Math.floor(entry.x / 32), Math.floor(entry.y / 32), 8);
  s.sceneInfo = {
    kind: 'island', expId: e.id, node: def.id, action: e.action, title: `Explorar · ${def.name}`,
    goal: `Recolha as ${chests} amostras da ilha (baús).`, result: null, loot: 0, lootNeed: chests, defenders: n, entry,
  };
  return s;
}

/** Ilha: as amostras abrem ao encostar; recolhidas todas, a exploração está feita. */
function islandTick(g: Game, end: (r: 'win' | 'lose', text: string) => void) {
  const team = sceneTeam(g);
  for (const site of g.state.sites) {
    if (site.kind !== 'chest' || site.done) continue;
    const x = tileCenter(site.tx);
    const y = tileCenter(site.ty);
    const who = team.find((u) => Math.hypot(u.x - x, u.y - y) < 46);
    if (!who) continue;
    site.found = true;
    g.toast(resolveSite(g, site, who), 'good', { x, y });
  }
  const left = g.state.sites.filter((x) => x.kind === 'chest' && !x.done).length;
  if (!left) end('win', '{check} Todas as amostras recolhidas! A ilha foi explorada.');
}

/** Lugar sagrado: clareira com o guardião (o animal do contrato, enorme) e seus filhotes. */
export function createTrialScene(home: Game, e: Expedition): GameState {
  const def = REGION[e.node!]!;
  const power = nodePower(home.state, def);
  const { s } = regionMap(home, e);
  // clareira no centro, sem árvores
  s.nodes = s.nodes.filter((n) => Math.hypot(n.tx - CENTER_TX, n.ty - CENTER_TY) > 9);
  const g = new Game(s, SCENE_SYSTEMS);
  g.isScene = true;
  const kind = def.contract!;
  const animal = CONTRACTS[kind].animal;
  const cx = tileCenter(CENTER_TX);
  const cy = tileCenter(CENTER_TY);
  const boss = createAnimal(g, animal, cx, cy - 20);
  boss.maxHp = boss.hp = Math.round(power * 14);
  boss.boss = true;
  boss.life = 1e9;
  boss.name = `Guardião: ${ANIMALS[animal].name}`;
  guard(boss);
  for (const dx of [-60, 60]) {
    const m = createAnimal(g, animal, cx + dx, cy + 30);
    m.maxHp = m.hp = Math.round(m.maxHp * 0.6);
    guard(m);
  }
  const entry = entryPoint(g);
  bringTeam(home, g, e, entry);
  revealCircle(s, CENTER_TX, CENTER_TY, 8);
  revealCircle(s, Math.floor(entry.x / 32), Math.floor(entry.y / 32), 8);
  s.sceneInfo = {
    kind: 'trial', expId: e.id, node: def.id, action: e.action, title: `Prova do contrato · ${def.name}`, bossId: boss.id,
    goal: `Vença o guardião para ganhar o contrato: ${CONTRACTS[kind].name}.`, result: null, loot: 0, lootNeed: 0, defenders: 3, entry,
  };
  return s;
}

/** Covil da Ordem: caverna escura, aranhas pelo caminho e, no fundo, os guardiões e o líder. */
export function createHideoutScene(home: Game, e: Expedition): GameState {
  const seed = (home.state.seed ^ (e.id * 97531) ^ 0xec11) >>> 0;
  const s = baseState(seed);
  const rnd = mulberry32(seed);
  const cave = carveCave(s, rnd);
  s.time = home.state.time;
  s.day = home.state.day;
  s.towersFaction = 'enemy';
  s.res = { ...s.res, wood: 0, stone: 0, food: 0, ryo: 0 };
  s.flags = { ...s.flags, shelterRookies: false };
  s.timers = { ...s.timers, animal: 1e9, raid: 1e9 };
  const g = new Game(s, SCENE_SYSTEMS);
  g.isScene = true;
  const at = (i: number) => ({ x: tileCenter(i % MAP_W), y: tileCenter(Math.floor(i / MAP_W)) });
  const spots = cave.cells.filter((i) => cave.dist[i]! > 14 && cave.dist[i]! < cave.dist[cave.far]! * 0.8).sort(() => rnd() - 0.5);
  for (let k = 0; k < 5 && spots.length; k++) {
    const p = at(spots.pop()!);
    const a = createAnimal(g, 'spider', p.x, p.y);
    a.maxHp = a.hp = Math.round(a.maxHp * 2.2);
    guard(a);
  }
  const lair = at(cave.far);
  let bossId: number | undefined;
  lairGuards(home.state).forEach((id, i) => {
    const u = createOrgMember(g, id, lair.x + (i ? 28 : -28), lair.y);
    guard(u);
    if (id === 'yomi') bossId = u.id;
  });
  const entry = at(cave.start);
  bringTeam(home, g, e, entry);
  revealCircle(s, Math.floor(entry.x / 32), Math.floor(entry.y / 32), 6);
  s.sceneInfo = {
    kind: 'hideout', expId: e.id, node: 'covil', action: e.action, title: `Covil da ${ORG.name}`, bossId,
    goal: 'Atravesse a caverna e derrote os guardiões e o líder da Ordem.', result: null, loot: 0, lootNeed: 0, defenders: 5 + lairGuards(home.state).length, entry,
  };
  return s;
}

/** Esconderijo do Som: caverna com o líder e dois membros guardando o raptado. */
export function createSoundScene(home: Game, e: Expedition): GameState {
  const seed = (home.state.seed ^ (e.id * 86243) ^ 0x50d) >>> 0;
  const s = baseState(seed);
  const rnd = mulberry32(seed);
  const cave = carveCave(s, rnd);
  s.time = home.state.time;
  s.day = home.state.day;
  s.towersFaction = 'enemy';
  s.res = { ...s.res, wood: 0, stone: 0, food: 0, ryo: 0 };
  s.flags = { ...s.flags, shelterRookies: false };
  s.timers = { ...s.timers, animal: 1e9, raid: 1e9 };
  const g = new Game(s, SCENE_SYSTEMS);
  g.isScene = true;
  const at = (i: number) => ({ x: tileCenter(i % MAP_W), y: tileCenter(Math.floor(i / MAP_W)) });
  const spots = cave.cells.filter((i) => cave.dist[i]! > 14 && cave.dist[i]! < cave.dist[cave.far]! * 0.8).sort(() => rnd() - 0.5);
  // dois membros no caminho, o líder no fundo
  const raiders = [...SOUND_RAIDERS].sort(() => rnd() - 0.5).slice(0, 2);
  for (const id of raiders) {
    const p = at(spots.pop() ?? cave.far);
    guard(createSoundMember(g, id, p.x, p.y));
  }
  const lair = at(cave.far);
  const boss = createSoundMember(g, 'hakkotsu', lair.x, lair.y);
  guard(boss);
  const entry = at(cave.start);
  bringTeam(home, g, e, entry);
  revealCircle(s, Math.floor(entry.x / 32), Math.floor(entry.y / 32), 6);
  s.sceneInfo = {
    kind: 'hideout', expId: e.id, node: 'som', action: e.action, title: 'Esconderijo do Som', bossId: boss.id,
    goal: `Derrote os guardiões e ${SOUND_MEMBERS.hakkotsu.name}, o líder, para libertar o raptado.`, result: null, loot: 0, lootNeed: 0, defenders: 3, entry,
  };
  return s;
}

/** Objetivo da mina: chegar à descida (sem bicho em cima) ou, no último andar, derrubar o guardião. Baús abrem ao encostar. */
function mineTick(g: Game, info: SceneInfo, foes: Unit[], end: (r: 'win' | 'lose', text: string) => void) {
  const team = sceneTeam(g);
  for (const site of g.state.sites) {
    if (site.kind !== 'chest' || site.done || !site.found) continue;
    const x = tileCenter(site.tx);
    const y = tileCenter(site.ty);
    const who = team.find((u) => Math.hypot(u.x - x, u.y - y) < 46);
    if (who) g.toast(resolveSite(g, site, who), 'good', { x, y });
  }
  if (info.bossId != null) {
    const boss = g.unit(info.bossId);
    if (!boss || boss.dead) end('win', '{crown} O guardião do fundo caiu! A mina é sua.');
    return;
  }
  const st = g.state.sites.find((x) => x.id === info.stairsId);
  if (!st) return;
  const x = tileCenter(st.tx);
  const y = tileCenter(st.ty);
  if (team.some((u) => Math.hypot(u.x - x, u.y - y) < 36) && !foes.some((u) => Math.hypot(u.x - x, u.y - y) < 100))
    end('win', `{pickaxe} Acharam a descida do andar ${info.floor}!`);
}

