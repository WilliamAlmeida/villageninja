// Ninjas caídos da vila (`state.fallen`): a Pedra Memorial lista os nomes e o Edo Tensei os traz de volta por um tempo.
import type { GameState, Unit } from './types';

/** Quantos nomes a pedra guarda (os mais antigos saem). */
export const FALLEN_MAX = 120;

/** Anota o ninja que caiu (só ninjas da vila; o Edo Tensei que se desfaz não conta). */
export function recordFallen(s: GameState, u: Unit) {
  if (u.kind !== 'ninja' || !u.ninja || u.edo || u.faction !== 'village') return;
  s.fallen ??= [];
  if (s.fallen.some((f) => f.id === u.id)) return;
  const n = u.ninja;
  s.fallen.unshift({ id: u.id, name: u.name, rank: n.rank, level: n.level, day: s.day, nature: n.nature, stats: { ...n.stats }, jutsu: [...n.jutsu] as [string | null, string | null], look: { ...u.look } });
  if (s.fallen.length > FALLEN_MAX) s.fallen.length = FALLEN_MAX;
}
