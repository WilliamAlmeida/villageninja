import type { Cost } from '../game/types';

// Atributos no estilo do databook de Naruto (escala 0–10).
export const STAT_KEYS = [
  'ninjutsu',
  'taijutsu',
  'genjutsu',
  'inteligencia',
  'forca',
  'velocidade',
  'stamina',
  'selos',
] as const;
export type StatKey = (typeof STAT_KEYS)[number];
export type Stats = Record<StatKey, number>;

export const STAT_INFO: Record<StatKey, { label: string; short: string; color: string; /** O que o atributo melhora (dica do foco de treino). */ desc: string }> = {
  ninjutsu: { label: 'Ninjutsu', short: 'Nin', color: '#4da6ff', desc: 'Força dos jutsus de ninjutsu e chakra máximo.' },
  taijutsu: { label: 'Taijutsu', short: 'Tai', color: '#ff8a3d', desc: 'Dano e ritmo do corpo a corpo; força dos jutsus de taijutsu.' },
  genjutsu: { label: 'Genjutsu', short: 'Gen', color: '#b36bff', desc: 'Força e duração das ilusões; resistência a genjutsu.' },
  inteligencia: { label: 'Inteligência', short: 'Int', color: '#5ad1c8', desc: 'Aprende jutsus e treina mais rápido, gasta menos chakra e recupera chakra mais rápido.' },
  forca: { label: 'Força', short: 'For', color: '#ff5a5a', desc: 'Dano no corpo a corpo, vida máxima e defesa.' },
  velocidade: { label: 'Velocidade', short: 'Vel', color: '#ffe14d', desc: 'Corre mais rápido, ataca mais vezes, esquiva e acerta mais com kunai.' },
  stamina: { label: 'Stamina', short: 'Sta', color: '#7ddc6b', desc: 'Vida e chakra máximos, defesa e recuperação de chakra.' },
  selos: { label: 'Selos', short: 'Sel', color: '#d9d9d9', desc: 'Recarga dos jutsus mais curta, chakra máximo e dano de kunai.' },
};

export type Rank = 'genin' | 'chunin' | 'jounin' | 'kage';
export const RANK_ORDER: Rank[] = ['genin', 'chunin', 'jounin', 'kage'];

export interface RankDef {
  name: string;
  /** Teto de cada atributo neste rank. */
  statCap: number;
  /** Rank máximo de jutsu que pode aprender (0=E … 5=S). */
  maxJutsuRank: number;
  /** Nível mínimo para ser promovido a este rank. */
  minLevel: number;
  promoteCost: Cost;
  vest: string | null;
  unique?: boolean;
  /** Nível mínimo da vila para promover a este rank. */
  minVillageLevel?: number;
}

export const RANKS: Record<Rank, RankDef> = {
  genin: { name: 'Genin', statCap: 5, maxJutsuRank: 2, minLevel: 1, promoteCost: {}, vest: null },
  chunin: { name: 'Chunin', statCap: 7, maxJutsuRank: 3, minLevel: 4, promoteCost: { ryo: 120 }, vest: '#55703d' },
  jounin: { name: 'Jounin', statCap: 9, maxJutsuRank: 4, minLevel: 8, promoteCost: { ryo: 300 }, vest: '#3f5a2c' },
  kage: { name: 'Kage', statCap: 10, maxJutsuRank: 5, minLevel: 10, promoteCost: { ryo: 500 }, vest: '#f1ece0', unique: true, minVillageLevel: 2 },
};

export const JUTSU_RANK_LABEL = ['E', 'D', 'C', 'B', 'A', 'S'];

export const xpToNext = (level: number) => 40 + level * 30;

/** Valores derivados dos atributos. Um único lugar para balancear. */
export function derive(s: Stats) {
  return {
    maxHp: Math.round(50 + s.stamina * 12 + s.forca * 5),
    maxChakra: Math.round(30 + s.stamina * 6 + s.ninjutsu * 6 + s.selos * 2),
    speed: 52 + s.velocidade * 7,
    meleeDmg: 3 + s.taijutsu * 1.4 + s.forca * 1.1,
    meleeCd: Math.max(0.45, 1.2 - s.velocidade * 0.06 - s.taijutsu * 0.03),
    kunaiDmg: 3 + s.selos * 0.4 + s.velocidade * 0.5,
    chakraRegen: 0.6 + s.stamina * 0.15 + s.inteligencia * 0.1,
    defense: Math.min(0.45, s.stamina * 0.03 + s.forca * 0.015),
    dodge: Math.min(0.25, s.velocidade * 0.025),
    learnMult: 0.7 + s.inteligencia * 0.12,
  };
}
export type Derived = ReturnType<typeof derive>;
