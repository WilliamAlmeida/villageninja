// Eleição do Kage: cerimônia na praça da Residência do Hokage.
import { RANKS } from '../data/ninja';
import { DEFAULT_KAGE_ART } from '../data/kageArts';
import { levelDef } from '../data/villageLevels';
import { refreshDerived } from './entities';
import { leaveTeam } from './teams';
import { fx, fxText } from './fx';
import type { Game } from './game';
import type { Unit } from './types';

type Result = { ok: true } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });

export const KAGE_COST = RANKS.kage.promoteCost;
export const KAGE_MIN_LEVEL = RANKS.kage.minLevel;
export const CEREMONY_TIME = 12;
/** Enquanto houver Kage vivo, os ninjas da vila causam +10% de dano. */
export const KAGE_DAMAGE_BONUS = 1.1;

export function currentKage(g: Game): Unit | undefined {
  const k = g.unit(g.state.kageId);
  return k && !k.dead ? k : undefined;
}

/** Jounin de nível alto que podem ser eleitos. */
export function kageCandidates(g: Game): Unit[] {
  return g.state.units
    .filter((u) => !u.dead && u.kind === 'ninja' && u.faction === 'village' && u.ninja!.rank === 'jounin' && u.ninja!.level >= KAGE_MIN_LEVEL)
    .sort((a, b) => b.ninja!.level - a.ninja!.level);
}

export function electionStatus(g: Game) {
  const s = g.state;
  let reason = '';
  if (currentKage(g)) reason = 'A vila já tem um Kage.';
  else if (s.ceremony) reason = 'A cerimônia já está acontecendo.';
  else if (s.level < (RANKS.kage.minVillageLevel ?? 2)) reason = `Requer nível ${levelDef(RANKS.kage.minVillageLevel ?? 2).name}.`;
  else if (!kageCandidates(g).length) reason = `Precisa de um Jounin de nível ${KAGE_MIN_LEVEL}+.`;
  else if (!g.canAfford(KAGE_COST)) reason = 'Recursos insuficientes.';
  return { ready: !reason, reason, candidates: kageCandidates(g) };
}

export function electKage(g: Game, unitId: number): Result {
  const st = electionStatus(g);
  if (!st.ready) return fail(st.reason);
  const u = st.candidates.find((c) => c.id === unitId);
  if (!u) return fail('Candidato inválido.');
  g.pay(KAGE_COST);
  g.state.ceremony = { candidateId: u.id, timer: CEREMONY_TIME };
  g.toast(`{kage} A vila se reúne na praça: ${u.name} será nomeado Kage!`, 'good', u);
  return { ok: true };
}

/** Fim da cerimônia: o candidato vira Kage. */
export function crownKage(g: Game) {
  const s = g.state;
  const u = g.unit(s.ceremony?.candidateId);
  s.ceremony = null;
  if (!u || u.dead) {
    g.toast('A cerimônia foi interrompida: o candidato não está mais entre nós.', 'warn');
    return;
  }
  u.ninja!.rank = 'kage';
  u.ninja!.kageArt ??= DEFAULT_KAGE_ART;
  u.ninja!.anbu = false;
  leaveTeam(g, u.id); // o Kage não tem equipe: a ANBU o protege
  refreshDerived(u);
  u.hp = u.maxHp;
  s.kageId = u.id;
  s.kageHistory.push({ name: u.name, day: s.day });
  s.reputation += 5;
  fx(g, 'ring', u.x, u.y, { r: 40, color: '#ffd34d', life: 1 });
  fxText(g, u.x, u.y - 36, `${u.name.split(' ').pop()}, o Kage!`, '#ffd34d', true);
  g.toast(`{kage} ${u.name} é o novo Kage da vila! Ninjas +10% de dano. Monte dos Kages liberado.`, 'good', u);
}
