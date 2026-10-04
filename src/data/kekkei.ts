import type { Nature } from './natures';

// Kekkei genkai: naturezas combinadas despertadas por clãs.
export type KekkeiId = 'hyoton' | 'mokuton' | 'yoton' | 'ranton' | 'shakuton';

export interface KekkeiDef {
  id: KekkeiId;
  name: string;
  pt: string;
  kanji: string;
  color: string;
  /** As duas naturezas que, juntas no clã, permitem despertar. */
  natures: [Nature, Nature];
  /** Jutsu exclusivo de quem tem esta kekkei genkai. */
  jutsu: string;
}

export const KEKKEI: Record<KekkeiId, KekkeiDef> = {
  hyoton: { id: 'hyoton', name: 'Hyōton', pt: 'Gelo', kanji: '氷', color: '#9fe8ff', natures: ['fuuton', 'suiton'], jutsu: 'sensatsu' },
  mokuton: { id: 'mokuton', name: 'Mokuton', pt: 'Madeira', kanji: '木', color: '#8fcf6a', natures: ['doton', 'suiton'], jutsu: 'jukai' },
  yoton: { id: 'yoton', name: 'Yōton', pt: 'Lava', kanji: '熔', color: '#ff5a1f', natures: ['katon', 'doton'], jutsu: 'yokai' },
  ranton: { id: 'ranton', name: 'Ranton', pt: 'Tempestade', kanji: '嵐', color: '#c8a6ff', natures: ['raiton', 'suiton'], jutsu: 'reiza' },
  shakuton: { id: 'shakuton', name: 'Shakuton', pt: 'Calor', kanji: '灼', color: '#ffb347', natures: ['katon', 'fuuton'], jutsu: 'kajosatsu' },
};
export const KEKKEI_LIST = Object.values(KEKKEI);

/** Chance de um descendente de clã com kekkei genkai nascer com ela. */
export const KEKKEI_BIRTH_CHANCE = 0.3;
