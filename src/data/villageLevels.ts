import type { Cost } from '../game/types';
import type { BuildingType } from './buildings';
import type { Rank } from './ninja';

/** Requisitos para alcançar um nível da vila. */
export interface LevelReq {
  population?: number;
  ninjas?: number;
  /** Quantidade mínima de ninjas com este rank ou superior. */
  ranked?: { rank: Rank; count: number };
  buildings?: Partial<Record<BuildingType, number>>;
  raidsRepelled?: number;
  missionsDone?: number;
  clans?: number;
  /** Exige um Kage eleito e vivo. */
  kage?: boolean;
}

export interface VillageLevelDef {
  level: number;
  name: string;
  icon: string;
  /** Raio (em tiles) a partir da Residência do Hokage onde se pode construir. */
  territory: number;
  req: LevelReq;
  cost: Cost;
  /** Ryo de imposto por morador ao amanhecer. */
  tax: number;
  /** Peso extra nas ameaças (invasões maiores, mais animais). */
  threat: number;
  perks: string[];
}

export const VILLAGE_LEVELS: VillageLevelDef[] = [
  {
    level: 0, name: 'Aldeia', icon: '{hut}', territory: 12, req: {}, cost: {}, tax: 2, threat: 0,
    perks: ['Prédios básicos, Academia e Campo de Treino'],
  },
  {
    level: 1, name: 'Vila', icon: '{houses}', territory: 17, tax: 3, threat: 1,
    req: { population: 14, ninjas: 4, buildings: { house: 3, academy: 1, training: 1 } },
    cost: { wood: 150, stone: 100, ryo: 200 },
    perks: ['Território maior', 'Libera Hospital, Arena, Mina de Ferro, Horta, Forja e Farmácia', 'Fundação de clãs', 'Impostos: 3 ryo por morador'],
  },
  {
    level: 2, name: 'Vila Oculta', icon: '{castle}', territory: 23, tax: 3, threat: 2,
    req: { population: 24, ninjas: 7, ranked: { rank: 'chunin', count: 2 }, buildings: { hospital: 1, market: 1, missions: 1 }, raidsRepelled: 2, missionsDone: 2 },
    cost: { wood: 300, stone: 250, ryo: 500 },
    perks: ['Território maior', 'Libera Biblioteca, Oficina de Selos, Ninjatō e Colete tático', 'Kekkei genkai dos clãs', 'Permite eleger um Kage'],
  },
  {
    level: 3, name: 'Grande Vila Oculta', icon: '{leaf}', territory: 60, tax: 4, threat: 3,
    req: { population: 36, ninjas: 12, ranked: { rank: 'jounin', count: 1 }, buildings: { library: 1, tower: 3 }, raidsRepelled: 5, missionsDone: 6, clans: 1, kage: true },
    cost: { wood: 600, stone: 500, ryo: 1200 },
    perks: ['Território: o mapa inteiro', 'Impostos: 4 ryo por morador', 'Guerra entre vilas e ameaças muito maiores'],
  },
];

export const MAX_VILLAGE_LEVEL = VILLAGE_LEVELS.length - 1;
export const levelDef = (level: number) => VILLAGE_LEVELS[Math.max(0, Math.min(MAX_VILLAGE_LEVEL, level))]!;
