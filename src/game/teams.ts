// Equipes (time de até 3 ninjas + sensei) e ordens diretas do jogador.
import { fx } from './fx';
import type { Game } from './game';
import type { NinjaOrder, Team, Unit } from './types';
import { doorPos } from './world';

export const MAX_MEMBERS = 3;
export const TEAM_COLORS = ['#ff8a2b', '#4da6ff', '#7ddc6b', '#e05ad1', '#ffe14d', '#5ad1c8', '#ff5a5a', '#b39cff'];
/** Distância para os bônus de equipe valerem. */
export const TEAM_BONUS_RANGE = 110;
export const SENSEI_TRAIN_RANGE = 140;
export const GUARD_TIME = 90;

type Result = { ok: true } | { ok: false; error: string };
const ok: Result = { ok: true };
const fail = (error: string): Result => ({ ok: false, error });

// ------------------------------------------------------------------ consultas
/** Equipe de uma unidade (clones contam como o dono). */
export function teamOf(g: Game, u: Unit | number | undefined | null): Team | undefined {
  if (u == null) return undefined;
  const unit = typeof u === 'number' ? g.unit(u) : u;
  if (!unit) return undefined;
  const id = unit.kind === 'clone' ? unit.ownerId : unit.id;
  if (id == null) return undefined;
  return g.state.teams.find((t) => t.senseiId === id || t.memberIds.includes(id));
}

export const isSensei = (t: Team | undefined, u: Unit) => !!t && t.senseiId === u.id;

export function teamUnits(g: Game, t: Team): Unit[] {
  const ids = t.senseiId != null ? [t.senseiId, ...t.memberIds] : t.memberIds;
  return ids.map((id) => g.unit(id)).filter((u): u is Unit => !!u && !u.dead);
}

/** Quem os outros seguem: o sensei, ou o primeiro membro se não houver sensei. */
export function teamLeader(g: Game, t: Team): Unit | undefined {
  return g.unit(t.senseiId) ?? t.memberIds.map((id) => g.unit(id)).find((u) => u && !u.dead);
}

/** Posição de formação (atrás do líder) para o i-ésimo seguidor. */
export function formationOffset(i: number) {
  const slots = [
    { x: -18, y: 16 },
    { x: 18, y: 16 },
    { x: 0, y: 30 },
  ];
  return slots[i % slots.length]!;
}

/** Há algum colega de equipe vivo e visível por perto? */
export function hasTeammateNear(g: Game, u: Unit, range = TEAM_BONUS_RANGE): boolean {
  const t = teamOf(g, u);
  if (!t) return false;
  const self = u.kind === 'clone' ? u.ownerId : u.id;
  for (const o of teamUnits(g, t)) {
    if (o.id === self || o.hidden) continue;
    if (Math.hypot(o.x - u.x, o.y - u.y) <= range) return true;
  }
  return false;
}

/** O sensei da equipe está perto (para o bônus de treino)? */
export function senseiNear(g: Game, u: Unit): Unit | null {
  const t = teamOf(g, u);
  if (!t || t.senseiId == null || t.senseiId === u.id) return null;
  const s = g.unit(t.senseiId);
  if (!s || s.dead || s.hidden) return null;
  return Math.hypot(s.x - u.x, s.y - u.y) <= SENSEI_TRAIN_RANGE ? s : null;
}

const canBeSensei = (u: Unit) => !!u.ninja && u.ninja.rank !== 'genin';

// ------------------------------------------------------------------ gestão
export function createTeam(g: Game, name?: string): Team {
  const used = new Set(g.state.teams.map((t) => t.color));
  let n = 1;
  while (g.state.teams.some((t) => t.name === `Time ${n}`)) n++;
  const t: Team = {
    id: g.newId(),
    name: name ?? `Time ${n}`,
    color: TEAM_COLORS.find((c) => !used.has(c)) ?? TEAM_COLORS[g.state.teams.length % TEAM_COLORS.length]!,
    senseiId: null,
    memberIds: [],
  };
  g.state.teams.push(t);
  return t;
}

function validNinja(g: Game, unitId: number) {
  const u = g.unit(unitId);
  return u && !u.dead && u.kind === 'ninja' && u.faction === 'village' && u.ninja ? u : null;
}

export function leaveTeam(g: Game, unitId: number) {
  for (const t of g.state.teams) {
    if (t.senseiId === unitId) t.senseiId = null;
    t.memberIds = t.memberIds.filter((id) => id !== unitId);
  }
}

export function joinAsMember(g: Game, teamId: number, unitId: number): Result {
  const t = g.team(teamId);
  const u = validNinja(g, unitId);
  if (!t || !u) return fail('Inválido.');
  if (u.ninja!.rank === 'kage') return fail('O Kage não entra em equipes.');
  if (t.memberIds.includes(u.id)) return ok;
  if (t.memberIds.length >= MAX_MEMBERS) return fail(`${t.name} já tem ${MAX_MEMBERS} membros.`);
  leaveTeam(g, u.id);
  t.memberIds.push(u.id);
  return ok;
}

export function joinAsSensei(g: Game, teamId: number, unitId: number): Result {
  const t = g.team(teamId);
  const u = validNinja(g, unitId);
  if (!t || !u) return fail('Inválido.');
  if (!canBeSensei(u)) return fail('O sensei precisa ser Chunin ou superior.');
  if (t.senseiId != null && t.senseiId !== u.id) return fail(`${t.name} já tem sensei.`);
  leaveTeam(g, u.id);
  t.senseiId = u.id;
  return ok;
}

/** Cria uma equipe nova já com este ninja (sensei se Chunin+, senão membro). */
export function createTeamWith(g: Game, unitId: number): Result {
  const u = validNinja(g, unitId);
  if (!u) return fail('Inválido.');
  if (u.ninja!.rank === 'kage') return fail('O Kage não entra em equipes.');
  const t = createTeam(g);
  const r = canBeSensei(u) ? joinAsSensei(g, t.id, u.id) : joinAsMember(g, t.id, u.id);
  if (!r.ok) disbandTeam(g, t.id);
  return r;
}

/**
 * Monta equipes sozinho com os ninjas sem equipe: primeiro completa as vagas das equipes que já existem
 * (sensei Chunin+ e membros), depois cria equipes novas equilibradas (o mais forte com o mais fraco)
 * com um sensei cada, enquanto houver. Retorna quantas equipes foram criadas e quantos ninjas entraram.
 */
export function autoTeams(g: Game): { ok: true; created: number; placed: number } | { ok: false; error: string } {
  const free = g.state.units
    .filter((u) => !u.dead && u.kind === 'ninja' && u.faction === 'village' && u.ninja && u.ninja.rank !== 'kage' && !teamOf(g, u))
    .sort((a, b) => b.ninja!.level - a.ninja!.level);
  if (!free.length) return { ok: false, error: 'Todos os ninjas já estão em equipes.' };
  const leads = free.filter(canBeSensei);
  const genins = free.filter((u) => !canBeSensei(u));
  let placed = 0;
  // 1) vagas das equipes atuais
  for (const t of g.state.teams) {
    if (t.senseiId == null && leads.length && joinAsSensei(g, t.id, leads[0]!.id).ok) {
      leads.shift();
      placed++;
    }
    while (t.memberIds.length < MAX_MEMBERS && genins.length && joinAsMember(g, t.id, genins[0]!.id).ok) {
      genins.shift();
      placed++;
    }
  }
  // 2) equipes novas: genins em "serpentina" (1º, 2º, 3º… e volta) para equilibrar a força
  let created = 0;
  const k = Math.ceil(genins.length / MAX_MEMBERS);
  const fresh = Array.from({ length: k }, () => createTeam(g));
  genins.forEach((u, i) => {
    const round = Math.floor(i / k);
    const col = i % k;
    const t = fresh[round % 2 ? k - 1 - col : col]!;
    if (joinAsMember(g, t.id, u.id).ok) placed++;
  });
  for (const t of fresh) {
    if (leads.length && joinAsSensei(g, t.id, leads.shift()!.id).ok) placed++;
  }
  created += fresh.length;
  // 3) sobraram só Chunin+: um sensei com até 3 colegas por equipe
  while (leads.length >= 2) {
    const t = createTeam(g);
    created++;
    if (joinAsSensei(g, t.id, leads.shift()!.id).ok) placed++;
    while (t.memberIds.length < MAX_MEMBERS && leads.length && joinAsMember(g, t.id, leads.shift()!.id).ok) placed++;
  }
  if (!placed) return { ok: false, error: 'Nenhuma vaga: as equipes estão cheias e não há ninjas suficientes para uma nova.' };
  return { ok: true, created, placed };
}

export function disbandTeam(g: Game, teamId: number): Result {
  const t = g.team(teamId);
  if (!t) return fail('Equipe não encontrada.');
  g.state.teams = g.state.teams.filter((x) => x.id !== teamId);
  if (g.selected?.kind === 'team' && g.selected.id === teamId) g.select(null);
  return ok;
}

export function setTeamOrder(g: Game, teamId: number, order: NinjaOrder): Result {
  const t = g.team(teamId);
  if (!t) return fail('Equipe não encontrada.');
  for (const u of teamUnits(g, t)) {
    u.ninja!.order = order;
    if (!u.command && u.state !== 'fight' && u.state !== 'learn' && u.state !== 'toLearn') {
      u.state = 'idle';
      u.timer = 0;
      u.hidden = false;
    }
  }
  return ok;
}

// ------------------------------------------------------------------ ordens
function commandable(g: Game, ids: number[]) {
  return ids.map((id) => validNinja(g, id)).filter((u): u is Unit => !!u);
}

/** Alvo que dá para mandar atacar: inimigo ou bicho vivo (convidados do exame não). */
export const isAttackable = (t: Unit | undefined | null): t is Unit => !!t && !t.dead && !t.cloak && (t.faction === 'enemy' || t.faction === 'wild');

/** Ninjas da vila que podem largar o que fazem e lutar: fora de missão e com vida acima de 35%. */
export function availableFighters(g: Game): Unit[] {
  const onMission = new Set(g.state.missions.filter((m) => m.status === 'active').map((m) => m.teamId));
  return g.state.units.filter((u) => {
    if (u.dead || u.kind !== 'ninja' || u.faction !== 'village' || !u.ninja || u.away != null || u.hp < u.maxHp * 0.35) return false;
    const t = teamOf(g, u);
    return !t || !onMission.has(t.id);
  });
}

/** Os `n` ninjas disponíveis mais perto do alvo. */
export function nearestFighters(g: Game, target: Unit, n: number): Unit[] {
  return availableFighters(g)
    .sort((a, b) => Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y))
    .slice(0, n);
}

/** Quantos ninjas da vila estão com ordem de atacar este alvo. */
export const attackersOf = (g: Game, targetId: number) =>
  g.state.units.filter((u) => !u.dead && u.faction === 'village' && u.command?.kind === 'attack' && u.command.targetId === targetId);

/** Mover e defender um ponto. Vários ninjas se espalham em formação. */
export function orderMove(g: Game, ids: number[], x: number, y: number): Result {
  const us = commandable(g, ids);
  if (!us.length) return fail('Nenhum ninja para receber a ordem.');
  us.forEach((u, i) => {
    const o = i === 0 ? { x: 0, y: 0 } : formationOffset(i - 1);
    u.command = { kind: 'move', x: x + o.x, y: y + o.y, time: GUARD_TIME };
    u.state = 'idle';
    u.hidden = false;
    u.hasGoal = false;
  });
  fx(g, 'ring', x, y, { r: 18, color: '#ffd34d', life: 0.6 });
  return ok;
}

export function orderAttack(g: Game, ids: number[], targetId: number): Result {
  const t = g.unit(targetId);
  if (!t || t.dead || t.faction === 'village') return fail('Alvo inválido.');
  const us = commandable(g, ids);
  if (!us.length) return fail('Nenhum ninja para receber a ordem.');
  for (const u of us) {
    u.command = { kind: 'attack', targetId };
    u.hidden = false;
    u.targetId = targetId;
  }
  fx(g, 'ring', t.x, t.y, { r: 18, color: '#ff5a5a', life: 0.6 });
  return ok;
}

export function orderRetreat(g: Game, ids: number[]): Result {
  const us = commandable(g, ids);
  if (!us.length) return fail('Nenhum ninja para receber a ordem.');
  for (const u of us) {
    u.command = { kind: 'retreat' };
    u.state = 'idle';
    u.hasGoal = false;
    u.targetId = null;
  }
  return ok;
}

export function clearCommand(g: Game, ids: number[]): Result {
  for (const u of commandable(g, ids)) {
    u.command = null;
    if (u.state === 'cmdMove' || u.state === 'guard' || u.state === 'cmdRetreat' || u.state === 'cmdRest') {
      u.state = 'idle';
      u.hidden = false;
    }
  }
  return ok;
}

/** Ponto de descanso usado pelo "Recuar". */
export function restPoint(g: Game) {
  const b = g.findBuilt('hospital') ?? g.hokage();
  return b ? doorPos(b) : null;
}

export const commandLabel = (u: Unit) => {
  const c = u.command;
  if (!c) return 'Nenhuma (IA automática)';
  if (c.kind === 'move') return `Defender ponto (${Math.ceil(c.time)}s)`;
  if (c.kind === 'attack') return 'Atacar alvo';
  if (c.kind === 'investigate') return 'Investigar local';
  return u.state === 'cmdRest' ? 'Recuado (curando)' : 'Recuar';
};

