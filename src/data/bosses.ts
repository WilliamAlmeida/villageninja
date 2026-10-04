// Ameaças chefes: eventos raros que escalam com o nível da vila.
export type BossKind = 'titan' | 'order' | 'war';

export interface BossDef {
  kind: BossKind;
  name: string;
  icon: string;
  desc: string;
  minLevel: number;
}

export const BOSSES: Record<BossKind, BossDef> = {
  titan: {
    kind: 'titan', name: 'Fera Colossal', icon: '🐲', minLevel: 1,
    desc: 'Uma fera gigantesca desperta e marcha até a vila, esmagando tudo com pisões.',
  },
  order: {
    kind: 'order', name: 'Ordem da Lua Vermelha', icon: '🌙', minLevel: 2,
    desc: 'Dois ninjas de elite de uma organização criminosa vêm testar a força da vila.',
  },
  war: {
    kind: 'war', name: 'Invasão da Vila da Rocha Negra', icon: '⚔️', minLevel: 3,
    desc: 'Uma vila rival declara guerra: um esquadrão inteiro liderado por um comandante.',
  },
};

/** Pesos de cada ameaça por nível da vila. */
export const BOSS_WEIGHTS: Record<number, [BossKind, number][]> = {
  1: [['titan', 1]],
  2: [['titan', 2], ['order', 2]],
  3: [['titan', 1], ['order', 2], ['war', 2]],
};

/** Segundos de aviso antes da ameaça chegar. */
export const BOSS_WARNING = 30;
