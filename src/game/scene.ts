// Mapas de missão jogáveis: quando a equipe chega a um vilarejo para saquear ou anexar à força, a invasão vira um
// mapa próprio (a vila deles no mesmo estilo da sua) simulado ao lado da vila, que continua andando. A equipe é
// copiada para lá; ao terminar, o resultado (vida, XP, atributos, mortes) volta para os ninjas originais.
import { MAP_H, MAP_W } from '../config';
import { chance, mulberry32 } from '../core/rng';
import { BUILDINGS, type BuildingType } from '../data/buildings';
import { ACTION_LABEL, REGION, REL } from '../data/region';
import { rescueChance } from './care';
import { createRogue, refreshDerived } from './entities';
import { revealCircle } from './explore';
import { fxText } from './fx';
import { Game } from './game';
import { baseState } from './newGame';
import { findPath, nearestWalkable } from './pathfinding';
import { nodePower, regionOf } from './region';
import { SCENE_SYSTEMS } from './systems';
import { createTeam, joinAsMember, joinAsSensei } from './teams';
import type { Expedition, GameState, SceneInfo, Unit } from './types';
import { CENTER_TX, CENTER_TY, doorPos, tileCenter } from './world';

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
  if (e.kind !== 'region' || home.state.scene) return false;
  if (e.action === 'raid') return true;
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
  });
  const tm = home.team(e.teamId);
  if (tm) {
    const t = createTeam(g, tm.name);
    t.color = tm.color;
    if (tm.senseiId != null && ids.has(tm.senseiId)) joinAsSensei(g, t.id, ids.get(tm.senseiId)!);
    for (const id of tm.memberIds) if (ids.has(id)) joinAsMember(g, t.id, ids.get(id)!);
  }
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
export const sceneFoes = (g: Game) => g.state.units.filter((u) => !u.dead && u.faction === 'enemy');
export const sceneTeam = (g: Game) => g.state.units.filter((u) => !u.dead && u.faction === 'village' && u.origin != null);

/** Confere o objetivo do mapa de missão (sistema do mapa). */
export function sceneTick(g: Game, dt: number) {
  const info = g.state.sceneInfo;
  if (!info || info.result) return;
  const end = (r: 'win' | 'lose', text: string) => {
    info.result = r;
    g.toast(text, r === 'win' ? 'good' : 'danger');
  };
  if (!sceneTeam(g).length) return end('lose', `{skull} A equipe caiu em ${REGION[info.node!]?.name ?? 'combate'}.`);
  const foes = sceneFoes(g);
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
  const leader = g.unit(info.leaderId);
  if (leader && !leader.dead) return { x: leader.x, y: leader.y };
  const wh = g.building(info.warehouseId);
  if (wh) return doorPos(wh);
  const f = sceneFoes(g)[0];
  return f ? { x: f.x, y: f.y } : null;
}

/** Fecha o mapa: devolve vida, XP, atributos e mortes aos ninjas da vila. Retorna o resultado. */
export function closeScene(home: Game): 'win' | 'lose' | 'retreat' {
  const s = home.state.scene;
  const result = s?.sceneInfo?.result ?? 'retreat';
  if (!s) return result;
  for (const c of s.units) {
    if (c.origin == null) continue;
    const u = home.unit(c.origin);
    if (!u || u.dead) continue;
    if (u.ninja && c.ninja) {
      u.ninja.xp = c.ninja.xp;
      u.ninja.level = c.ninja.level;
      u.ninja.kills = c.ninja.kills;
      u.ninja.stats = { ...c.ninja.stats };
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
  home.state.scene = null;
  return result;
}

