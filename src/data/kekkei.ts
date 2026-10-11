import type { Nature } from './natures';
import type { StatKey } from './ninja';

// Kekkei genkai: naturezas combinadas despertadas por clãs, e os dōjutsu (técnicas oculares: Sharingan, Byakugan).
export type KekkeiId = 'hyoton' | 'mokuton' | 'yoton' | 'ranton' | 'shakuton' | 'sharingan' | 'byakugan';

/** O que o clã precisa ter para despertar: um ninja desta natureza, ou um ninja com este atributo alto. */
export type KekkeiNeed = { nature: Nature } | { stat: StatKey };

export interface KekkeiDef {
  id: KekkeiId;
  name: string;
  pt: string;
  kanji: string;
  color: string;
  /** As duas condições que, juntas no clã, permitem despertar. */
  need: [KekkeiNeed, KekkeiNeed];
  /** Jutsu exclusivo de quem tem esta kekkei genkai (o que o recém-nascido pode trazer de berço). */
  jutsu: string;
  /** Dōjutsu: técnica ocular (game/dojutsu.ts), com os olhos acesos em combate. */
  eye?: boolean;
  /** O que faz (dica na lista de kekkei genkai). */
  desc?: string;
}

export const KEKKEI: Record<KekkeiId, KekkeiDef> = {
  hyoton: { id: 'hyoton', name: 'Hyōton', pt: 'Gelo', kanji: '氷', color: '#9fe8ff', need: [{ nature: 'fuuton' }, { nature: 'suiton' }], jutsu: 'sensatsu' },
  mokuton: { id: 'mokuton', name: 'Mokuton', pt: 'Madeira', kanji: '木', color: '#8fcf6a', need: [{ nature: 'doton' }, { nature: 'suiton' }], jutsu: 'jukai' },
  yoton: { id: 'yoton', name: 'Yōton', pt: 'Lava', kanji: '熔', color: '#ff5a1f', need: [{ nature: 'katon' }, { nature: 'doton' }], jutsu: 'yokai' },
  ranton: { id: 'ranton', name: 'Ranton', pt: 'Tempestade', kanji: '嵐', color: '#c8a6ff', need: [{ nature: 'raiton' }, { nature: 'suiton' }], jutsu: 'reiza' },
  shakuton: { id: 'shakuton', name: 'Shakuton', pt: 'Calor', kanji: '灼', color: '#ffb347', need: [{ nature: 'katon' }, { nature: 'fuuton' }], jutsu: 'kajosatsu' },
  // dōjutsu: o Sharingan nasce do fogo e da ilusão; o Byakugan, do corpo a corpo e da percepção
  sharingan: { id: 'sharingan', name: 'Sharingan', pt: 'Olho copiador', kanji: '写', color: '#e0202a', need: [{ nature: 'katon' }, { stat: 'genjutsu' }], jutsu: 'kanashibari', eye: true,
    desc: "Lê os golpes (esquiva mais), copia um jutsu de rank baixo (até C) que o inimigo usa por perto e o devolve; guarda uma cópia por ninja e pode aprendê-la sem pergaminho. Kanashibari, Amaterasu e Susano'o." },
  byakugan: { id: 'byakugan', name: 'Byakugan', pt: 'Olho branco', kanji: '白', color: '#cfc8ff', need: [{ stat: 'taijutsu' }, { stat: 'inteligencia' }], jutsu: 'kusho', eye: true,
    desc: 'Vê quem está invisível por perto; cada golpe corpo a corpo fecha pontos de chakra do alvo (Punho Gentil). Os golpes Hyuga exigem o Byakugan.' },
};
export const KEKKEI_LIST = Object.values(KEKKEI);

/** Atributo mínimo de um ninja para contar numa condição de atributo (dōjutsu). */
export const KEKKEI_STAT = 6;

/** Chance de um descendente de clã com kekkei genkai nascer com ela. */
export const KEKKEI_BIRTH_CHANCE = 0.3;
