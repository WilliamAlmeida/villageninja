// Exame Chunin: convocação, chaveamento, pontuação e promoções.
import { promoteToSensei } from './teams';
// A execução das lutas na arena fica em systems/exam.ts.
import { TILE } from '../config';
import { layoutPoint } from '../data/layout';
import { rand } from '../core/rng';
import { randomName } from '../data/names';
import { RANKS, STAT_KEYS } from '../data/ninja';
import { createNinja, refreshDerived } from './entities';
import { fx, fxText } from './fx';
import type { Game } from './game';
import { missionOfTeam } from './missions';
import { gainXp } from './progression';
import { teamOf } from './teams';
import type { Building, Exam, ExamEntrant, Unit } from './types';
import { BUILDINGS } from '../data/buildings';
import { arenaRing } from './arena';

type Result = { ok: true } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });

export const EXAM_MIN_LEVEL = 2;
export const EXAM_COOLDOWN_DAYS = 4;
export const MAX_ENTRANTS = 8;
/** Pontuação mínima para promoção (o campeão é sempre promovido). */
export const PROMOTE_SCORE = 4.5;

export const arenaOf = (g: Game) => g.findBuilt('arena');

/** Genins da vila que podem se inscrever (nível mínimo, sem missão em andamento). */
export function eligibleGenin(g: Game): Unit[] {
  return g.state.units
    .filter((u) => !u.dead && u.kind === 'ninja' && u.faction === 'village' && u.ninja!.rank === 'genin' && u.ninja!.level >= EXAM_MIN_LEVEL)
    .filter((u) => {
      const t = teamOf(g, u);
      return !(t && missionOfTeam(g, t.id));
    })
    .sort((a, b) => b.ninja!.level - a.ninja!.level)
    .slice(0, MAX_ENTRANTS);
}

export function examStatus(g: Game) {
  const s = g.state;
  const arena = arenaOf(g);
  const eligible = eligibleGenin(g);
  let reason = '';
  if (!arena) reason = 'Construa a Arena do Exame.';
  else if (s.exam) reason = 'Um exame já está acontecendo.';
  else if (s.day < s.examNextDay) reason = `Próximo exame a partir do dia ${s.examNextDay}.`;
  else if (eligible.length < 2) reason = `Precisa de 2 genins de nível ${EXAM_MIN_LEVEL}+ livres (há ${eligible.length}).`;
  return { ready: !reason, reason, eligible, arena };
}

/** Pontuação: vitórias pesam mais, mas dano e jutsus também contam. */
export function score(e: ExamEntrant, g: Game) {
  const u = g.unit(e.id);
  const ref = u ? u.maxHp : 100;
  return Math.round((e.wins * 3 + Math.min(4, (e.dmg / ref) * 2) + Math.min(2, e.jutsus * 0.5)) * 10) / 10;
}

/** Posições na arena: lados do duelo e arquibancada (embaixo). */
export function arenaSpots(a: Building) {
  const x0 = a.tx * TILE;
  const y0 = a.ty * TILE;
  const w = BUILDINGS.arena.w * TILE;
  const ring = arenaRing(a);
  // lugares ajustáveis no Editor de cenário: "left", "right" (os dois do duelo) e "stands" (começo da arquibancada)
  const pt = (n: string, def: { x: number; y: number }) => {
    const p = layoutPoint('arena', n);
    return p ? { x: x0 + p[0], y: y0 + p[1] } : def;
  };
  const st = pt('stands', { x: x0 + 10, y: y0 + w + 14 });
  return {
    left: pt('left', { x: ring.cx - ring.r * 0.5, y: ring.cy }),
    right: pt('right', { x: ring.cx + ring.r * 0.5, y: ring.cy }),
    stand: (i: number) => ({ x: st.x + (i % 8) * ((w - 20) / 7), y: st.y + Math.floor(i / 8) * 14 }),
    center: { x: x0 + w / 2, y: y0 + w / 2 },
  };
}

function nextPow2(n: number) {
  return n <= 4 ? 4 : 8;
}

export function startExam(g: Game): Result {
  const st = examStatus(g);
  if (!st.ready || !st.arena) return fail(st.reason);
  const s = g.state;
  const spots = arenaSpots(st.arena);
  const village = st.eligible;
  const total = nextPow2(village.length);
  const entrants: Unit[] = [...village];
  // convidados de outras vilas, com força parecida com a dos nossos genins
  const avg = village.reduce((a, u) => a + STAT_KEYS.reduce((b, k) => b + u.ninja!.stats[k], 0) / STAT_KEYS.length, 0) / village.length;
  for (let i = village.length; i < total; i++) {
    const p = spots.stand(i);
    const gst = createNinja(g, p.x + rand(-4, 4), p.y, 'genin');
    gst.faction = 'guest';
    gst.name = `${randomName()} (convidado)`;
    for (const k of STAT_KEYS) gst.ninja!.stats[k] = Math.max(0.5, Math.min(RANKS.genin.statCap, avg + rand(-0.8, 0.8)));
    gst.ninja!.level = Math.max(EXAM_MIN_LEVEL, Math.round(village.reduce((a, u) => a + u.ninja!.level, 0) / village.length));
    gst.look = { ...gst.look, cloth: '#6b5a2a' };
    refreshDerived(gst);
    gst.hp = gst.maxHp;
    gst.chakra = gst.maxChakra;
    fx(g, 'smoke', gst.x, gst.y, { r: 14, life: 0.6, color: '#ddd' });
    entrants.push(gst);
  }
  // embaralha o chaveamento
  for (let i = entrants.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [entrants[i], entrants[j]] = [entrants[j]!, entrants[i]!];
  }
  for (const u of entrants) {
    u.arenaSide = 0;
    u.command = null;
    u.hidden = false;
    u.targetId = null;
    u.state = 'exam';
    u.hasGoal = false;
  }
  const exam: Exam = {
    phase: 'gather',
    entrants: entrants.map((u) => ({ id: u.id, name: u.name, village: u.faction === 'village', wins: 0, dmg: 0, jutsus: 0, out: false })),
    bracket: entrants.map((u) => u.id),
    next: [],
    round: 1,
    match: 0,
    timer: 25,
  };
  s.exam = exam;
  g.toast(`{arena} O Exame Chunin começou! ${village.length} genin(s) da vila e ${total - village.length} convidado(s).`, 'good', spots.center);
  return { ok: true };
}

/** Encerra o exame: promoções, recompensas, convidados vão embora. */
export function finishExam(g: Game) {
  const s = g.state;
  const exam = s.exam;
  if (!exam) return;
  const champion = exam.bracket[0];
  const ranking = exam.entrants
    .map((e) => ({ e, sc: score(e, g) + (e.id === champion ? 2 : 0) }))
    .sort((a, b) => b.sc - a.sc);
  const promoted: string[] = [];
  const result = ranking.map(({ e, sc }) => {
    const u = g.unit(e.id);
    let ok = false;
    if (u && !u.dead && e.village && u.ninja!.rank === 'genin' && (e.id === champion || sc >= PROMOTE_SCORE)) {
      u.ninja!.rank = 'chunin';
      refreshDerived(u);
      fxText(g, u.x, u.y - 30, 'Chunin!', '#ffd34d', true);
      fx(g, 'ring', u.x, u.y, { r: 28, color: '#ffd34d', life: 0.7 });
      promoted.push(u.name);
      promoteToSensei(g, u);
      ok = true;
    }
    if (u && e.village) gainXp(g, u, 20 + e.wins * 15);
    return { name: e.name, village: e.village, score: sc, promoted: ok };
  });
  const guests = exam.entrants.filter((e) => !e.village).length;
  const champ = exam.entrants.find((e) => e.id === champion);
  const ryo = 30 + guests * 40;
  s.res.ryo += ryo;
  s.reputation += 2 + (champ?.village ? 4 : 0);
  // libera participantes; convidados voltam para casa
  for (const e of exam.entrants) {
    const u = g.unit(e.id);
    if (!u) continue;
    if (!e.village) {
      fx(g, 'smoke', u.x, u.y, { r: 14, life: 0.6, color: '#ddd' });
      u.dead = true;
      continue;
    }
    u.arenaSide = undefined;
    u.stun = 0;
    u.state = 'idle';
    u.hp = Math.max(u.hp, u.maxHp * 0.5);
  }
  s.lastExam = { day: s.day, champion: champ?.name ?? '?', ranking: result };
  s.exam = null;
  s.examNextDay = s.day + EXAM_COOLDOWN_DAYS;
  g.toast(
    `{trophy} ${champ?.name ?? '?'} venceu o Exame Chunin! ${promoted.length ? `Promovidos: ${promoted.join(', ')}.` : 'Ninguém da vila foi promovido.'} +${ryo}{ryo}`,
    'good',
  );
}

/** "Semifinal: Kenta × Yui" — texto curto do momento atual do exame. */
export function examLabel(g: Game) {
  const ex = g.state.exam;
  if (!ex) return '';
  const stage = ex.bracket.length === 2 ? 'Final' : ex.bracket.length === 4 ? 'Semifinal' : `Rodada ${ex.round}`;
  if (ex.phase === 'gather') return `${stage} · preparando`;
  const nm = (id: number | undefined) => g.unit(id)?.name.replace(' (convidado)', '').split(' ').pop() ?? '?';
  return `${stage}: ${nm(ex.bracket[ex.match])} × ${nm(ex.bracket[ex.match + 1])}`;
}
