import type { Cost } from '../game/types';

export type AnimalType = 'wolf' | 'boar' | 'bear' | 'snake' | 'titan';

export interface AnimalDef {
  type: AnimalType;
  name: string;
  hp: number;
  damage: number;
  attackCd: number;
  speed: number;
  /** Raio em que percebe e ataca moradores. */
  aggro: number;
  range: number;
  size: number;
  color: string;
  reward: Cost;
  xp: number;
  /** Dia a partir do qual pode surgir. */
  minDay: number;
  weight: number;
  pack: [number, number];
}

const LIST: AnimalDef[] = [
  { type: 'wolf', name: 'Lobo', hp: 38, damage: 6, attackCd: 1, speed: 78, aggro: 150, range: 20, size: 9, color: '#8a8f98', reward: { food: 8, ryo: 4 }, xp: 12, minDay: 1, weight: 5, pack: [2, 3] },
  { type: 'boar', name: 'Javali', hp: 65, damage: 9, attackCd: 1.4, speed: 62, aggro: 110, range: 22, size: 11, color: '#6b4a33', reward: { food: 22 }, xp: 15, minDay: 1, weight: 4, pack: [1, 2] },
  { type: 'bear', name: 'Urso', hp: 150, damage: 15, attackCd: 1.8, speed: 55, aggro: 140, range: 26, size: 15, color: '#4a3426', reward: { food: 35, ryo: 12 }, xp: 35, minDay: 3, weight: 2, pack: [1, 1] },
  // chefe: não surge sozinho (minDay alto), só como ameaça (ver data/bosses.ts)
  { type: 'titan', name: 'Fera Colossal', hp: 900, damage: 26, attackCd: 2.2, speed: 40, aggro: 230, range: 36, size: 26, color: '#7a2e2e', reward: { ryo: 400, food: 150 }, xp: 200, minDay: 9999, weight: 0, pack: [1, 1] },
  { type: 'snake', name: 'Cobra Gigante', hp: 260, damage: 22, attackCd: 2, speed: 48, aggro: 170, range: 30, size: 14, color: '#6b3fa0', reward: { ryo: 70 }, xp: 70, minDay: 6, weight: 1, pack: [1, 1] },
];

export const ANIMALS = Object.fromEntries(LIST.map((a) => [a.type, a])) as Record<AnimalType, AnimalDef>;
export const ANIMAL_LIST: readonly AnimalDef[] = LIST;
