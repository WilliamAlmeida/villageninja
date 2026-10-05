import type { Cost } from '../game/types';

export type AnimalType = 'wolf' | 'boar' | 'bear' | 'snake' | 'titan' | 'crow' | 'monkey' | 'spider' | 'tiger' | 'rhino';

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
  /** Comportamento especial (painel do animal). */
  desc?: string;
  /** Ladrão: vai até a vila roubar em vez de caçar (ver systems/hostiles.ts). */
  thief?: 'farm' | 'stash';
  /** Golpe especial (ver `animalAbility` em systems/hostiles.ts). */
  ability?: 'web' | 'pounce' | 'charge';
  /** Só aparece à noite (e vai embora quando amanhece). */
  night?: boolean;
}

const LIST: AnimalDef[] = [
  { type: 'wolf', name: 'Lobo', hp: 38, damage: 6, attackCd: 1, speed: 78, aggro: 150, range: 20, size: 9, color: '#8a8f98', reward: { food: 8, ryo: 4 }, xp: 12, minDay: 1, weight: 5, pack: [2, 3] },
  { type: 'boar', name: 'Javali', hp: 65, damage: 9, attackCd: 1.4, speed: 62, aggro: 110, range: 22, size: 11, color: '#6b4a33', reward: { food: 22 }, xp: 15, minDay: 1, weight: 4, pack: [1, 2] },
  { type: 'bear', name: 'Urso', hp: 150, damage: 15, attackCd: 1.8, speed: 55, aggro: 140, range: 26, size: 15, color: '#4a3426', reward: { food: 35, ryo: 12 }, xp: 35, minDay: 3, weight: 2, pack: [1, 1] },
  // chefe: não surge sozinho (minDay alto), só como ameaça (ver data/bosses.ts)
  { type: 'titan', name: 'Fera Colossal', hp: 900, damage: 26, attackCd: 2.2, speed: 40, aggro: 230, range: 36, size: 26, color: '#7a2e2e', reward: { ryo: 400, food: 150 }, xp: 200, minDay: 9999, weight: 0, pack: [1, 1] },
  { type: 'snake', name: 'Cobra Gigante', hp: 260, damage: 22, attackCd: 2, speed: 48, aggro: 170, range: 30, size: 14, color: '#6b3fa0', reward: { ryo: 70 }, xp: 70, minDay: 6, weight: 1, pack: [1, 1] },
  // ladrões: não caçam, vêm roubar e fogem
  { type: 'crow', name: 'Corvo', hp: 14, damage: 2, attackCd: 0.8, speed: 96, aggro: 26, range: 16, size: 6, color: '#2a2a35', reward: { food: 2 }, xp: 4, minDay: 2, weight: 3, pack: [4, 6],
    desc: 'Vêm em bando bicar a fazenda e levam comida. Abata-os para recuperar o que levaram.', thief: 'farm' },
  { type: 'monkey', name: 'Macaco ladrão', hp: 34, damage: 3, attackCd: 1, speed: 92, aggro: 0, range: 18, size: 8, color: '#8a5a2e', reward: { ryo: 6 }, xp: 10, minDay: 4, weight: 2, pack: [2, 3],
    desc: 'Rouba ryo da Residência do Hokage (ou ervas) e foge para a floresta. Alcance-o antes que saia do mapa para recuperar o saque.', thief: 'stash' },
  // golpes especiais
  { type: 'spider', name: 'Aranha gigante', hp: 95, damage: 8, attackCd: 1.3, speed: 60, aggro: 150, range: 22, size: 11, color: '#3a2440', reward: { herbs: 6, ryo: 15 }, xp: 30, minDay: 5, weight: 2, pack: [1, 2],
    desc: 'Cospe teia que prende o alvo por alguns segundos. Lute em grupo para ninguém ficar sozinho preso.', ability: 'web' },
  { type: 'tiger', name: 'Tigre das sombras', hp: 130, damage: 15, attackCd: 1.2, speed: 96, aggro: 190, range: 24, size: 13, color: '#2a2440', reward: { ryo: 45 }, xp: 50, minDay: 6, weight: 2, pack: [1, 1],
    desc: 'Caça só à noite e é difícil de ver no escuro. Dá botes de longe que causam muito dano. Some quando amanhece.', ability: 'pounce', night: true },
  { type: 'rhino', name: 'Rinoceronte de pedra', hp: 320, damage: 18, attackCd: 2, speed: 50, aggro: 160, range: 30, size: 17, color: '#7d7a72', reward: { stone: 60, food: 30 }, xp: 70, minDay: 8, weight: 1, pack: [1, 1],
    desc: 'Pele de pedra. Dá investidas em linha reta que atropelam quem estiver no caminho e danificam prédios.', ability: 'charge' },
];

export const ANIMALS = Object.fromEntries(LIST.map((a) => [a.type, a])) as Record<AnimalType, AnimalDef>;
export const ANIMAL_LIST: readonly AnimalDef[] = LIST;
