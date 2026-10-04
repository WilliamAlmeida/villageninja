// Recursos da vila: um único lugar para nome, ícone e ordem de exibição.
export const RES_KEYS = ['wood', 'stone', 'food', 'ryo', 'iron', 'herbs', 'paper'] as const;
export type ResKey = (typeof RES_KEYS)[number];

export const RES_INFO: Record<ResKey, { name: string; icon: string; /** Só aparece na barra quando a vila já usa. */ advanced?: boolean }> = {
  wood: { name: 'Madeira', icon: '{wood}' },
  stone: { name: 'Pedra', icon: '{stone}' },
  food: { name: 'Comida', icon: '{food}' },
  ryo: { name: 'Ryo', icon: '{ryo}' },
  iron: { name: 'Ferro', icon: '{iron}', advanced: true },
  herbs: { name: 'Ervas', icon: '{herbs}', advanced: true },
  paper: { name: 'Papel de selo', icon: '{paper}', advanced: true },
};

export const emptyRes = (): Record<ResKey, number> => ({ wood: 0, stone: 0, food: 0, ryo: 0, iron: 0, herbs: 0, paper: 0 });

/** "30{wood} 10{stone}" — formata qualquer custo/recompensa. */
export const costLabel = (c: Partial<Record<ResKey, number>>) =>
  RES_KEYS.filter((k) => c[k])
    .map((k) => `${c[k]}${RES_INFO[k].icon}`)
    .join(' ') || 'grátis';
