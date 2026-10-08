// Execução do Exame Chunin na arena: arquibancada → caminhada → "VS" → luta → próximo duelo.
import { engage } from '../combat';
import { arenaOf, arenaSpots, finishExam, leaveSeat, takeSeat } from '../exam';
import { ARENA_RING, arenaRing } from '../arena';
import { fxText } from '../fx';
import type { Game } from '../game';
import { followPath, setDestination } from '../movement';
import type { Exam, Unit } from '../types';

const FIGHT_TIME = 40;

export function examSystem(g: Game, dt: number) {
  const exam = g.state.exam;
  if (!exam) {
    // save de exame encerrado com alguém ainda sentado na arquibancada
    for (const u of g.state.units) if (u.perch != null && !u.dead) leaveSeat(g, u);
    return;
  }
  const arena = arenaOf(g);
  if (!arena) {
    finishExam(g); // a arena foi demolida: encerra com o que houver
    return;
  }
  const spots = arenaSpots(arena);
  exam.timer -= dt;
  const [a, b] = fighters(g, exam);

  // quem não está lutando assiste da arquibancada: anda até o chão logo abaixo do lugar e salta para ele
  exam.entrants.forEach((e, i) => {
    const u = g.unit(e.id);
    if (!u || u.dead || u.away != null || u === a || u === b) return;
    const seat = spots.seat(i);
    if (u.perch != null) {
      if (Math.hypot(u.x - seat.x, u.y - seat.y) > 2) takeSeat(g, u, arena, seat); // trocou de lugar (chaveamento)
      return;
    }
    const below = spots.below(seat);
    if (walkTo(g, u, below, dt) || (Math.hypot(u.x - below.x, u.y - below.y) < 28 && !u.moving)) takeSeat(g, u, arena, seat);
  });

  switch (exam.phase) {
    case 'gather':
      if (exam.timer <= 0 || everyoneSeated(g, exam)) startMatch(g, exam);
      break;
    case 'walk': {
      if (!a || !b) return nextMatch(g, exam, a ?? b ?? null);
      const okA = walkTo(g, a, spots.left, dt);
      const okB = walkTo(g, b, spots.right, dt);
      if ((okA && okB) || exam.timer <= 0) {
        exam.phase = 'ready';
        exam.timer = 1.6;
        a.facing = 0;
        b.facing = Math.PI;
        fxText(g, spots.center.x, spots.center.y - 20, `${short(a)} VS ${short(b)}`, '#ffd34d', true);
      }
      break;
    }
    case 'ready':
      if (exam.timer <= 0) {
        exam.phase = 'fight';
        exam.timer = FIGHT_TIME;
        fxText(g, spots.center.x, spots.center.y - 20, 'Hajime!', '#ff8a2b', true);
      }
      break;
    case 'fight': {
      if (!a || !b) return nextMatch(g, exam, a ?? b ?? null);
      if (a.state === 'ko') return nextMatch(g, exam, b);
      if (b.state === 'ko') return nextMatch(g, exam, a);
      if (exam.timer <= 0) {
        // tempo esgotado: decide pela vida restante
        fxText(g, spots.center.x, spots.center.y - 20, 'Tempo!', '#ffd34d', true);
        return nextMatch(g, exam, a.hp / a.maxHp >= b.hp / b.maxHp ? a : b);
      }
      for (const [f, o] of [[a, b], [b, a]] as const) if (f.stun <= 0) engage(g, f, o, dt);
      // dentro da arena: andar não tira ninguém; jogado para fora por um golpe = derrota (ring-out)
      const ring = arenaRing(arena);
      for (const [f, o] of [[a, b], [b, a]] as const) {
        const dx = f.x - ring.cx;
        const dy = f.y - ring.cy;
        const d = Math.hypot(dx, dy);
        if (d <= ring.r) continue;
        if (d > ring.r + ARENA_RING.out && (f.knockT ?? 0) > 0) {
          fxText(g, f.x, f.y - 30, 'Fora da arena!', '#ff8a2b', true);
          fxText(g, spots.center.x, spots.center.y - 20, `${short(o)} vence!`, '#ffd34d', true);
          return nextMatch(g, exam, o);
        }
        if (!f.knockT) {
          f.x = ring.cx + (dx / d) * (ring.r - 2);
          f.y = ring.cy + (dy / d) * (ring.r - 2);
        }
      }
      break;
    }
  }
}

const short = (u: Unit) => u.name.replace(' (convidado)', '').split(' ').pop();

function fighters(g: Game, exam: Exam): [Unit | undefined, Unit | undefined] {
  if (exam.phase === 'gather' || exam.phase === 'done') return [undefined, undefined];
  // quem saiu em expedição (saves de antes da trava em teamBusy) não luta: o outro passa
  const f = (id: number | undefined) => {
    const u = g.unit(id);
    return u && u.away == null ? u : undefined;
  };
  return [f(exam.bracket[exam.match]), f(exam.bracket[exam.match + 1])];
}

/** Anda até o ponto; retorna true ao chegar. */
function walkTo(g: Game, u: Unit, p: { x: number; y: number }, dt: number) {
  if (Math.hypot(u.x - p.x, u.y - p.y) < 8) {
    u.moving = false;
    return true;
  }
  if (!u.hasGoal || Math.hypot(u.goalX - p.x, u.goalY - p.y) > 8) setDestination(g, u, p.x, p.y);
  followPath(g, u, dt);
  return false;
}

function everyoneSeated(g: Game, exam: Exam) {
  return exam.entrants.every((e) => {
    const u = g.unit(e.id);
    return !u || u.dead || u.away != null || u.perch != null;
  });
}

function startMatch(g: Game, exam: Exam) {
  const a = g.unit(exam.bracket[exam.match]);
  const b = g.unit(exam.bracket[exam.match + 1]);
  if (!a || !b) return nextMatch(g, exam, a ?? b ?? null);
  a.arenaSide = 1;
  b.arenaSide = 2;
  for (const u of [a, b]) {
    if (u.perch != null) leaveSeat(g, u); // desce da arquibancada para lutar
    u.state = 'duel';
    u.stun = 0;
    u.targetId = null;
    u.hasGoal = false;
  }
  exam.phase = 'walk';
  exam.timer = 15;
  const label = exam.bracket.length === 2 ? 'Final' : exam.bracket.length === 4 ? 'Semifinal' : `Rodada ${exam.round}`;
  g.toast(`{arena} ${label}: ${a.name} × ${b.name}`, 'info', a);
}

/** Registra o resultado do duelo e chama o próximo (ou encerra o exame). */
function nextMatch(g: Game, exam: Exam, winner: Unit | null) {
  const a = g.unit(exam.bracket[exam.match]);
  const b = g.unit(exam.bracket[exam.match + 1]);
  for (const u of [a, b]) {
    if (!u) continue;
    const e = exam.entrants.find((x) => x.id === u.id)!;
    if (u === winner) {
      e.wins++;
      u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.5);
      u.chakra = u.maxChakra;
    } else {
      e.out = true;
      u.hp = Math.max(u.hp, u.maxHp * 0.3);
    }
    u.arenaSide = 0;
    u.stun = 0;
    u.state = 'exam';
    u.targetId = null;
    if (u.ninja) u.ninja.cd = [0, 0];
  }
  if (winner) {
    exam.next.push(winner.id);
    fxText(g, winner.x, winner.y - 34, 'Vitória!', '#7dff9a', true);
  }
  exam.match += 2;
  if (exam.match >= exam.bracket.length) {
    if (exam.next.length <= 1) {
      exam.bracket = exam.next;
      exam.phase = 'done';
      finishExam(g);
      return;
    }
    exam.bracket = exam.next;
    exam.next = [];
    exam.round++;
    exam.match = 0;
  }
  exam.phase = 'gather';
  exam.timer = 4;
}
