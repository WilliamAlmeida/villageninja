// Ameaças chefes: eventos raros que escalam com o nível da vila.
export type BossKind = 'titan' | 'order' | 'war' | 'hydra' | 'golem';

export interface BossDef {
  kind: BossKind;
  name: string;
  icon: string;
  desc: string;
  minLevel: number;
}

export const BOSSES: Record<BossKind, BossDef> = {
  titan: {
    kind: 'titan', name: 'Fera Colossal', icon: '{beast}', minLevel: 1,
    desc: 'Uma fera gigantesca desperta e marcha até a vila, esmagando tudo com pisões.',
  },
  order: {
    kind: 'order', name: 'Ordem da Lua Vermelha', icon: '{moon}', minLevel: 2,
    desc: 'Dois ninjas de elite de uma organização criminosa vêm testar a força da vila.',
  },
  hydra: {
    kind: 'hydra', name: 'Hidra do Pântano', icon: '{beast}', minLevel: 2,
    desc: 'Uma serpente de três cabeças sai do pântano. Cada cabeça derrubada faz ela voltar com toda a vida.',
  },
  golem: {
    kind: 'golem', name: 'Golem de Barro', icon: '{beast}', minLevel: 1,
    desc: 'Um gigante de barro anda até a vila. Cada vez que cai, se divide em dois menores.',
  },
  war: {
    kind: 'war', name: 'Invasão da Vila da Rocha Negra', icon: '{swords}', minLevel: 3,
    desc: 'Uma vila rival declara guerra: um esquadrão inteiro liderado por um comandante.',
  },
};

/** Pesos de cada ameaça por nível da vila. */
export const BOSS_WEIGHTS: Record<number, [BossKind, number][]> = {
  1: [['titan', 1], ['golem', 1]],
  2: [['titan', 2], ['order', 2], ['golem', 1], ['hydra', 2]],
  3: [['titan', 1], ['order', 2], ['war', 2], ['golem', 1], ['hydra', 2]],
};

/** Segundos de aviso antes da ameaça chegar. */
export const BOSS_WARNING = 30;
