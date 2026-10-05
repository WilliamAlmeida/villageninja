// Expedições: equipes saem do mapa para explorar minas (e, depois, lugares da região).
import type { Cost } from '../game/types';

/** Mina: andares, tempos (s) e dificuldade (força de equipe "boa" por andar). */
export const MINE = {
  floors: 5,
  /** Ida até a entrada e volta para a vila. */
  travel: 8,
  /** Tempo explorando cada andar. */
  floorTime: 18,
  /** Força de equipe recomendada no andar N = power × N. */
  power: 22,
  /** Abaixo desta fração de vida média a equipe volta sozinha. */
  retreatHp: 0.25,
};

/** O que cada andar pode render (escala com o andar). */
export function mineLoot(floor: number): Cost {
  const f = floor;
  if (f <= 1) return { iron: 6 + Math.round(Math.random() * 6), stone: 25 };
  if (f === 2) return { iron: 10, crystal: 2 + Math.round(Math.random() * 2) };
  if (f === 3) return { crystal: 3 + Math.round(Math.random() * 3), gold: 2 + Math.round(Math.random() * 2) };
  if (f === 4) return { gold: 4 + Math.round(Math.random() * 3), darksteel: 1 + Math.round(Math.random() * 2) };
  return { darksteel: 3 + Math.round(Math.random() * 3), crystal: 4, gold: 5 };
}

export type MineEvent = 'ore' | 'chest' | 'monster' | 'cavein' | 'quiet';
/** Chance de cada evento por andar (o resto vira "andar tranquilo"). */
export const MINE_EVENTS: [MineEvent, number][] = [
  ['ore', 4],
  ['monster', 3],
  ['chest', 1.2],
  ['cavein', 1.2],
  ['quiet', 0.8],
];

/** Quanto o mercado paga por 1 ouro. */
export const GOLD_PRICE = 45;

/** Nomes dos monstros das minas por andar. */
export const MINE_MONSTERS = ['Morcegos gigantes', 'Toupeira de pedra', 'Aranhas das cavernas', 'Golem de cristal', 'Wyrm das profundezas'];
