// Duelo por retrato: um ninja da vila contra o retrato (game/snapshot.ts) de um ninja de outro jogador, na Arena do
// Exame, com as regras do Exame (caminhada, "VS", ring-out, tempo). Reaproveita a máquina do Exame (systems/exam.ts)
// com `Exam.duel`: um só par, sem promoção nem cooldown. Primeiro passo do PvP (docs/gdd-escala-ilhas-pvp.md, 6.2).
import { fx } from './fx';
import type { Game } from './game';
import { arenaOf, arenaSpots } from './exam';
import { missionOfTeam } from './missions';
import { type NinjaSnapshot, unitFromSnapshot } from './snapshot';
import { teamOf, teamUnits } from './teams';
import type { Exam, Unit } from './types';

type Result = { ok: true } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });

/** XP do ninja da vila ao vencer e ao perder o duelo. */
export const DUEL_XP = { win: 40, lose: 15 };

/** Ninjas da vila que podem duelar (vivos, no mapa, sem missão em andamento). */
export function duelCandidates(g: Game): Unit[] {
  return g.state.units
    .filter((u) => !u.dead && u.kind === 'ninja' && u.faction === 'village' && u.away == null)
    .filter((u) => {
      const t = teamOf(g, u);
      return !(t && missionOfTeam(g, t.id));
    })
    .sort((a, b) => b.ninja!.level - a.ninja!.level);
}

/** O ninja escolhido para os duelos (o mais forte disponível quando nenhum foi escolhido). */
export function duelist(g: Game): Unit | undefined {
  const list = duelCandidates(g);
  const id = g.state.flags.duelistId;
  return list.find((u) => u.id === id) ?? list[0];
}

export function setDuelist(g: Game, id: number): Result {
  if (!duelCandidates(g).some((u) => u.id === id)) return fail('Esse ninja não pode duelar agora.');
  g.state.flags.duelistId = id;
  return { ok: true };
}

/** Por que não dá para começar um duelo agora (null = pode). */
export function duelBlock(g: Game): string | null {
  if (!arenaOf(g)) return 'Construa a Arena do Exame.';
  if (g.state.exam) return g.state.exam.duel ? 'Um duelo já está acontecendo.' : 'A arena está ocupada com o Exame Chunin.';
  if (!duelist(g)) return 'Nenhum ninja da vila disponível para duelar.';
  return null;
}

/** Sensei e companheiros de equipe do campeão que estão na vila (vão para a arquibancada). */
function teamWatchers(g: Game, mine: Unit): number[] {
  const t = teamOf(g, mine);
  if (!t) return [];
  return teamUnits(g, t)
    .filter((u) => u !== mine && u.away == null && u.arenaSide == null)
    .map((u) => u.id);
}

/** Começa o duelo: o retrato entra como convidado na arquibancada e o Exame de um par cuida do resto. */
export function startDuel(g: Game, snap: NinjaSnapshot, mineId = duelist(g)?.id): Result {
  const why = duelBlock(g);
  if (why) return fail(why);
  const mine = duelCandidates(g).find((u) => u.id === mineId);
  if (!mine) return fail('Esse ninja não pode duelar agora.');
  const arena = arenaOf(g)!;
  const spots = arenaSpots(arena);
  const p = spots.seat(1);
  const foe = unitFromSnapshot(g, snap, p.x, p.y);
  foe.perch = arena.id;
  foe.facing = Math.PI / 4; // olhando para o chão de luta (frente da tela), como quem senta pelo takeSeat
  fx(g, 'smoke', foe.x, foe.y, { r: 14, life: 0.6, color: '#ddd' });
  for (const u of [mine, foe]) {
    u.arenaSide = 0;
    u.command = null;
    u.hidden = false;
    u.targetId = null;
    u.state = 'exam';
    u.hasGoal = false;
  }
  const exam: Exam = {
    phase: 'gather',
    entrants: [mine, foe].map((u) => ({ id: u.id, name: u.name, village: u.faction === 'village', wins: 0, dmg: 0, jutsus: 0, out: false })),
    bracket: [mine.id, foe.id],
    next: [],
    round: 1,
    match: 0,
    timer: 12,
    duel: true,
    // o resto da equipe do campeão (que o seguiria até o chão de luta) assiste da arquibancada
    watchers: teamWatchers(g, mine),
  };
  for (const id of exam.watchers!) {
    const u = g.unit(id)!;
    u.arenaSide = 0;
    u.command = null;
    u.targetId = null;
    u.state = 'exam';
    u.hasGoal = false;
  }
  g.state.exam = exam;
  g.toast(`{arena} Duelo: ${mine.name} × ${snap.name}${snap.from ? ` (${snap.from})` : ''}.`, 'good', spots.center);
  return { ok: true };
}
