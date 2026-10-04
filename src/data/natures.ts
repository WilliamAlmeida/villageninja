// Naturezas de chakra (Chakra Henka). Ciclo de vantagem igual ao do anime:
// Fogo > Vento > Raio > Terra > Água > Fogo
export type Nature = 'katon' | 'fuuton' | 'raiton' | 'doton' | 'suiton';

export interface NatureDef {
  name: string;
  kanji: string;
  color: string;
  beats: Nature;
}

export const NATURES: Record<Nature, NatureDef> = {
  katon: { name: 'Fogo', kanji: '火', color: '#ff6a2b', beats: 'fuuton' },
  fuuton: { name: 'Vento', kanji: '風', color: '#7fe0a0', beats: 'raiton' },
  raiton: { name: 'Raio', kanji: '雷', color: '#ffe14d', beats: 'doton' },
  doton: { name: 'Terra', kanji: '土', color: '#c39257', beats: 'suiton' },
  suiton: { name: 'Água', kanji: '水', color: '#4da6ff', beats: 'katon' },
};

export const NATURE_KEYS = Object.keys(NATURES) as Nature[];

/** Multiplicador de dano de uma natureza atacando outra. */
export function natureMultiplier(att: Nature | null | undefined, def: Nature | null | undefined): number {
  if (!att || !def) return 1;
  if (NATURES[att].beats === def) return 1.5;
  if (NATURES[def].beats === att) return 0.75;
  return 1;
}
