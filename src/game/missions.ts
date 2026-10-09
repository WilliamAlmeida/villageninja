// Missões: o quadro da Mesa de Missões, aceitar/abandonar e o resultado.
// A execução no mapa (IA da equipe e dos alvos) fica em systems/missions.ts.
import { DAY_LENGTH, MAP_H, MAP_W, TILE } from '../config';
import { pick, rand, weightedPick } from '../core/rng';
import { MISSION_RANKS, MISSION_TEMPLATES, OFFER_RANKS, type Enemy, type MissionTemplate } from '../data/missions';
import { randomGiven } from '../data/names';
import { costLabel } from '../data/resources';
import { RANKS, STAT_KEYS } from '../data/ninja';
import { createAnimal, createRogue, createVillager } from './entities';
import { fx } from './fx';
import type { Game } from './game';
import { findPath, nearestWalkable } from './pathfinding';
import { gainXp } from './progression';
import { teamUnits } from './teams';
import type { Cost, Mission, Team, Unit } from './types';
import { CENTER_TX, CENTER_TY, cellCenter, doorTile, tileCenter, toTile } from './world';

type Result = { ok: true } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });

export const OFFERS_PER_DAY = 3;
export const MISSION_TIME = DAY_LENGTH * 1.5;
/** Distância mínima (tiles) entre a vila e o objetivo. */
const MIN_DIST = 15;
const HISTORY = 6;

export const templateOf = (m: Mission): MissionTemplate => MISSION_TEMPLATES[m.template]!;
export const maxActiveMissions = (g: Game) => 1 + g.state.level;

export function missionReward(t: MissionTemplate): Cost {
  const r = MISSION_RANKS[t.rank]!;
  return { ryo: r.ryo, ...t.bonus };
}

/** Força estimada de uma equipe, para comparar com a dificuldade da missão. */
export function teamPower(g: Game, t: Team): number {
  let p = 0;
  for (const u of teamUnits(g, t)) {
    const n = u.ninja!;
    const avg = STAT_KEYS.reduce((a, k) => a + n.stats[k], 0) / STAT_KEYS.length;
    const rankBonus = ['genin', 'chunin', 'jounin', 'kage'].indexOf(n.rank) * 4;
    p += n.level * 1.5 + avg * 4 + n.jutsu.filter(Boolean).length * 3 + rankBonus;
  }
  return Math.round(p);
}
export const missionPower = (m: Mission) => MISSION_RANKS[m.rank]!.power;

export const missionOfTeam = (g: Game, teamId: number) => g.state.missions.find((m) => m.status === 'active' && m.teamId === teamId);

// ------------------------------------------------------------------ local
/** Um ponto alcançável a pé, longe da vila: na floresta ou perto da borda. */
export function pickSite(g: Game, kind: 'forest' | 'edge'): { x: number; y: number } | null {
  const hk = g.hokage();
  const from = hk ? doorTile(hk) : { tx: CENTER_TX, ty: CENTER_TY };
  const far = (tx: number, ty: number) => Math.hypot(tx - CENTER_TX, ty - CENTER_TY) >= MIN_DIST;
  const ok = (tx: number, ty: number) => g.world.walkable(tx, ty) && far(tx, ty) && !!findPath(g.world, from.tx, from.ty, tx, ty);
  const trees = g.state.nodes.filter((n) => n.type === 'tree' && far(n.tx, n.ty));
  for (let i = 0; i < 40; i++) {
    let tx: number;
    let ty: number;
    if (kind === 'forest' && trees.length) {
      const n = pick(trees);
      const w = nearestWalkable(g.world, n.tx, n.ty + 1, 3);
      if (!w) continue;
      [tx, ty] = w;
    } else {
      const side = Math.floor(rand(0, 4));
      tx = side === 0 ? Math.floor(rand(2, 5)) : side === 1 ? Math.floor(rand(MAP_W - 5, MAP_W - 2)) : Math.floor(rand(3, MAP_W - 3));
      ty = side === 2 ? Math.floor(rand(2, 5)) : side === 3 ? Math.floor(rand(MAP_H - 5, MAP_H - 2)) : Math.floor(rand(3, MAP_H - 3));
    }
    if (ok(tx, ty)) return { x: tileCenter(tx), y: tileCenter(ty) };
  }
  return null;
}

// ------------------------------------------------------------------ quadro
/** Renova as missões oferecidas (as ativas continuam). */
export function generateOffers(g: Game) {
  const s = g.state;
  s.missions = s.missions.filter((m) => m.status !== 'offered');
  const ranks = OFFER_RANKS[Math.min(3, s.level)]!;
  const used = new Set<number>();
  for (let i = 0; i < OFFERS_PER_DAY; i++) {
    const rank = weightedPick(ranks, ([, w]) => w)![0];
    const pool = MISSION_TEMPLATES.map((t, ti) => ({ t, ti })).filter((e) => e.t.rank === rank && !used.has(e.ti));
    const choice = pool.length ? pick(pool) : null;
    if (!choice) continue;
    used.add(choice.ti);
    const site = pickSite(g, choice.t.site);
    if (!site) continue;
    s.missions.push({
      id: g.newId(), template: choice.ti, type: choice.t.type, rank: choice.t.rank, title: choice.t.title,
      status: 'offered', teamId: null, x: site.x, y: site.y, targetIds: [], nodeIds: [], progress: 0, goal: 1,
      timeLeft: MISSION_TIME, phase: '',
    });
  }
}

export function acceptMission(g: Game, missionId: number, teamId: number): Result {
  const m = g.state.missions.find((x) => x.id === missionId);
  const team = g.team(teamId);
  if (!m || m.status !== 'offered') return fail('Missão indisponível.');
  if (!team) return fail('Equipe inválida.');
  if (!teamUnits(g, team).length) return fail('A equipe não tem ninjas.');
  if (missionOfTeam(g, teamId)) return fail(`${team.name} já está em uma missão.`);
  if (teamUnits(g, team).some((u) => u.away != null)) return fail(`${team.name} está numa expedição.`);
  const active = g.state.missions.filter((x) => x.status === 'active').length;
  if (active >= maxActiveMissions(g)) return fail(`Máximo de ${maxActiveMissions(g)} missão(ões) ao mesmo tempo. Evolua a vila para mais.`);
  m.status = 'active';
  m.teamId = teamId;
  m.timeLeft = MISSION_TIME * (m.type === 'escort' ? 1.3 : 1);
  spawnObjective(g, m);
  g.toast(`{scroll} ${team.name} partiu: ${m.title} (rank ${MISSION_RANKS[m.rank]!.label}).`, 'info', m);
  return { ok: true };
}

// ------------------------------------------------------------------ escolha da equipe
export type MissionRisk = 'safe' | 'good' | 'risky' | 'danger';
/** Risco pela força da equipe contra a dificuldade: folga de 50% = seguro, empate = favorável, 70% = arriscado. */
export function missionRisk(power: number, need: number): MissionRisk {
  if (power >= need * 1.5) return 'safe';
  if (power >= need) return 'good';
  if (power >= need * 0.7) return 'risky';
  return 'danger';
}

/** Equipes que podem partir agora (com ninjas, fora de missão e de expedição). */
export const freeTeams = (g: Game) =>
  g.state.teams.filter((tm) => {
    const us = teamUnits(g, tm);
    return us.length && !missionOfTeam(g, tm.id) && !us.some((u) => u.away != null);
  });

/**
 * Equipe recomendada para a missão: a MAIS FRACA que ainda dá conta (poupa a elite para as difíceis);
 * se nenhuma dá conta, a mais forte. `skip` = equipes já reservadas para outras missões.
 */
export function recommendTeam(g: Game, m: Mission, skip: ReadonlySet<number> = new Set()): Team | null {
  const need = missionPower(m);
  const pool = freeTeams(g)
    .filter((tm) => !skip.has(tm.id))
    .map((tm) => ({ tm, p: teamPower(g, tm) }));
  if (!pool.length) return null;
  const able = pool.filter((x) => x.p >= need).sort((a, z) => a.p - z.p);
  return (able[0] ?? pool.sort((a, z) => z.p - a.p)[0]!).tm;
}

/** Equipes livres ordenadas para a missão: primeiro as que dão conta (da mais justa à mais forte), depois as fracas. */
export function teamsForMission(g: Game, m: Mission) {
  const need = missionPower(m);
  const list = freeTeams(g).map((tm) => ({ team: tm, power: teamPower(g, tm), risk: missionRisk(teamPower(g, tm), need) }));
  const able = list.filter((x) => x.power >= need).sort((a, z) => a.power - z.power);
  const weak = list.filter((x) => x.power < need).sort((a, z) => z.power - a.power);
  return [...able, ...weak];
}

/**
 * Auto designar: das missões mais difíceis para as mais fáceis, manda a equipe mais fraca que dá conta
 * (só envios favoráveis ou seguros), até o limite de missões simultâneas.
 */
export function autoAssign(g: Game): Result & { sent?: number } {
  const offered = g.state.missions.filter((m) => m.status === 'offered').sort((a, z) => missionPower(z) - missionPower(a));
  if (!offered.length) return fail('Nenhuma missão no quadro.');
  let sent = 0;
  for (const m of offered) {
    if (g.state.missions.filter((x) => x.status === 'active').length >= maxActiveMissions(g)) break;
    const tm = recommendTeam(g, m);
    if (!tm || teamPower(g, tm) < missionPower(m)) continue;
    if (acceptMission(g, m.id, tm.id).ok) sent++;
  }
  if (!sent) return fail('Nenhuma equipe livre dá conta das missões do quadro (ou o limite foi atingido).');
  return { ok: true, sent };
}

export function abandonMission(g: Game, missionId: number): Result {
  const m = g.state.missions.find((x) => x.id === missionId);
  if (!m || m.status !== 'active') return fail('Missão não está ativa.');
  failMission(g, m, 'Abandonada');
  return { ok: true };
}

// ------------------------------------------------------------------ alvos no mapa
function spawnEnemy(g: Game, m: Mission, e: Enemy, x: number, y: number): Unit {
  const name = e.boss ? `★ ${randomGiven()}, o Procurado` : `Bandido ${randomGiven()}`;
  const u = createRogue(g, x, y, g.state.day, { rank: e.rank, stats: e.stats ?? 0, hpMult: e.hpMult, jutsu: e.jutsu ?? 0, name });
  u.missionId = m.id;
  u.homeX = x;
  u.homeY = y;
  u.state = 'guard';
  return u;
}

/** Ponto livre perto de (x,y) e alcançável a pé a partir dele (nada do outro lado da água). */
function around(g: Game, x: number, y: number, r: number) {
  for (let i = 0; i < 16; i++) {
    const a = rand(0, Math.PI * 2);
    const d = rand(r * 0.3, r);
    const px = x + Math.cos(a) * d;
    const py = y + Math.sin(a) * d;
    if (g.world.walkablePx(px, py) && findPath(g.world, toTile(x), toTile(y), toTile(px), toTile(py), 1500)) return { x: px, y: py };
  }
  return { x, y };
}

function spawnObjective(g: Game, m: Mission) {
  const t = templateOf(m);
  const withMission = (u: Unit) => {
    u.missionId = m.id;
    u.homeX = u.x;
    u.homeY = u.y;
    return u;
  };
  switch (t.type) {
    case 'herbs': {
      const n = t.herbs ?? 3;
      for (let i = 0; i < n; i++) {
        const p = around(g, m.x, m.y, 4 * TILE);
        const tx = toTile(p.x);
        const ty = toTile(p.y);
        const node = { id: g.newId(), type: 'herb' as const, tx, ty, amount: 3, max: 3, variant: i, missionId: m.id };
        g.state.nodes.push(node);
        g.reindex();
        m.nodeIds.push(node.id);
      }
      m.goal = n;
      if (t.animals) for (let i = 0; i < t.animals.count; i++) {
        const p = around(g, m.x, m.y, 3 * TILE);
        withMission(createAnimal(g, t.animals.type, p.x, p.y));
      }
      break;
    }
    case 'hunt': {
      const a = t.animals!;
      for (let i = 0; i < a.count; i++) {
        const p = around(g, m.x, m.y, 2 * TILE);
        const u = withMission(createAnimal(g, a.type, p.x, p.y));
        u.maxHp = u.hp = Math.round(u.maxHp * (a.hpMult ?? 1));
        if (a.type === 'hydra') u.heads = 3;
        m.targetIds.push(u.id);
      }
      m.goal = a.count;
      break;
    }
    case 'camp':
    case 'wanted':
      for (const e of t.enemies ?? []) {
        const p = around(g, m.x, m.y, 2.5 * TILE);
        m.targetIds.push(spawnEnemy(g, m, e, p.x, p.y).id);
      }
      m.goal = m.targetIds.length;
      break;
    case 'escort': {
      const u = createVillager(g, m.x, m.y);
      u.name = `Mercador ${randomGiven()}`;
      u.look = { ...u.look, cloth: '#d4a017' };
      u.missionId = m.id;
      u.speed = 34;
      u.maxHp = u.hp = 120;
      u.state = 'escortWait';
      m.targetIds.push(u.id);
      m.phase = 'meet';
      m.goal = 1;
      break;
    }
  }
}

/** Emboscada na escolta: bandidos saem da mata à frente do mercador. */
export function spawnAmbush(g: Game, m: Mission, merchant: Unit) {
  const ahead = merchant.path[Math.min(merchant.path.length - 1, 14)];
  const ax = ahead != null ? cellCenter(ahead).x : merchant.x;
  const ay = ahead != null ? cellCenter(ahead).y : merchant.y;
  for (const e of templateOf(m).ambush ?? []) {
    const p = around(g, ax, ay, 2.5 * TILE);
    const u = spawnEnemy(g, m, e, p.x, p.y);
    m.targetIds.push(u.id);
    fx(g, 'smoke', u.x, u.y, { r: 16, life: 0.6, color: '#bbb' });
  }
  g.toast(`{swords} Emboscada! Bandidos bloqueiam a estrada do ${merchant.name}!`, 'danger', { x: ax, y: ay });
}

// ------------------------------------------------------------------ fim
function clearTeamCommands(g: Game, m: Mission) {
  const team = g.team(m.teamId);
  if (!team) return;
  for (const u of teamUnits(g, team)) {
    if (u.command && u.command.kind !== 'retreat') u.command = null;
    if (u.state === 'cmdMove' || u.state === 'guard' || u.state === 'fight') u.state = 'idle';
  }
}

/** Remove o que sobrou da missão no mapa (inimigos, ervas, mercador). */
function cleanup(g: Game, m: Mission) {
  for (const u of g.state.units) {
    if (u.missionId !== m.id || u.dead) continue;
    u.dead = true;
    if (!u.hidden) fx(g, 'smoke', u.x, u.y, { r: 14, life: 0.5, color: '#ccc' });
  }
  for (const id of m.nodeIds) if (g.node(id)) g.removeNode(id);
}

function archive(g: Game) {
  const ended = g.state.missions.filter((m) => m.status === 'done' || m.status === 'failed');
  if (ended.length > HISTORY) {
    const drop = new Set(ended.slice(0, ended.length - HISTORY).map((m) => m.id));
    g.state.missions = g.state.missions.filter((m) => !drop.has(m.id));
  }
}

export function completeMission(g: Game, m: Mission) {
  const t = templateOf(m);
  const r = MISSION_RANKS[m.rank]!;
  const reward = missionReward(t);
  m.status = 'done';
  m.result = 'Sucesso';
  g.give(reward);
  g.state.reputation += r.rep;
  g.state.stats.missionsDone++;
  const team = g.team(m.teamId);
  if (team) for (const u of teamUnits(g, team)) gainXp(g, u, r.xp);
  clearTeamCommands(g, m);
  cleanup(g, m);
  g.toast(`{check} Missão cumprida: ${m.title}! +${costLabel(reward)} · +${r.rep} reputação`, 'good');
  archive(g);
}

export function failMission(g: Game, m: Mission, reason: string) {
  m.status = 'failed';
  m.result = reason;
  g.state.reputation = Math.max(0, g.state.reputation - (m.rank + 1));
  clearTeamCommands(g, m);
  cleanup(g, m);
  g.toast(`{fail} Missão falhou: ${m.title} — ${reason}.`, 'danger');
  archive(g);
}

/** Recomendação de rank de ninja para a dificuldade (texto de ajuda). */
export const rankHint = (rank: number) => RANKS[(['genin', 'genin', 'chunin', 'jounin', 'jounin'] as const)[rank]!].name;
