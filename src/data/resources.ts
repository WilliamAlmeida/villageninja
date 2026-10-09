// Recursos da vila: um único lugar para nome, ícone e ordem de exibição.
export const RES_KEYS = ['wood', 'stone', 'food', 'ryo', 'iron', 'herbs', 'paper', 'crystal', 'gold', 'darksteel'] as const;
export type ResKey = (typeof RES_KEYS)[number];

export const RES_INFO: Record<ResKey, { name: string; icon: string; /** Só aparece na barra quando a vila já usa. */ advanced?: boolean }> = {
  wood: { name: 'Madeira', icon: '{wood}' },
  stone: { name: 'Pedra', icon: '{stone}' },
  food: { name: 'Comida', icon: '{food}' },
  ryo: { name: 'Ryo', icon: '{ryo}' },
  iron: { name: 'Ferro', icon: '{iron}', advanced: true },
  herbs: { name: 'Ervas', icon: '{herbs}', advanced: true },
  paper: { name: 'Papel de selo', icon: '{paper}', advanced: true },
  // raros: só nas minas (expedições)
  crystal: { name: 'Cristal de chakra', icon: '{crystal}', advanced: true },
  gold: { name: 'Ouro', icon: '{gold}', advanced: true },
  darksteel: { name: 'Aço negro', icon: '{darksteel}', advanced: true },
};

export const emptyRes = (): Record<ResKey, number> => ({ wood: 0, stone: 0, food: 0, ryo: 0, iron: 0, herbs: 0, paper: 0, crystal: 0, gold: 0, darksteel: 0 });

/** "{wood} 30 {stone} 10" — formata qualquer custo/recompensa no padrão ícone-quantidade. */
export const costLabel = (c: Partial<Record<ResKey, number>>) =>
  RES_KEYS.filter((k) => c[k])
    .map((k) => `${RES_INFO[k].icon} ${c[k]}`)
    .join(' ') || 'grátis';
