// Locais especiais escondidos pelo mapa (ficam na névoa até alguém explorar a região).

export type SiteKind = 'ruin' | 'chest' | 'cave';

export interface SiteDef {
  name: string;
  icon: string;
  desc: string;
  /** Quantos aparecem num mapa novo. */
  count: number;
  /** Segundos que o ninja leva investigando no local. */
  work: number;
}

export const SITES: Record<SiteKind, SiteDef> = {
  ruin: {
    name: 'Ruínas antigas', icon: '{scroll}', count: 3, work: 4,
    desc: 'Templo abandonado de um clã esquecido. Guardiões protegem o altar, onde pode haver um pergaminho proibido.',
  },
  chest: {
    name: 'Baú esquecido', icon: '{luggage}', count: 5, work: 2,
    desc: 'Um baú meio enterrado. Pode ter recursos… ou uma armadilha.',
  },
  cave: {
    name: 'Entrada de mina', icon: '{pickaxe}', count: 2, work: 0,
    desc: 'Túneis profundos com minérios raros. Mande uma equipe em expedição (janela Mundo → Expedições).',
  },
};

/** Raio (tiles) que cada morador/ninja revela ao andar, o das torres e o revelado no começo do jogo. */
export const SIGHT = { unit: 4, tower: 7, intel: 14, start: 13 };
/** Distância mínima (tiles) do centro para um local especial. */
export const SITE_MIN_DIST = 16;
