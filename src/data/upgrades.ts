// Upgrades de prédios: até o nível 3. Cada nível custa recursos e um tempo de obra (feita pelos moradores,
// com o prédio funcionando). O visual muda por nível (arte <tipo>-2 / <tipo>-3 em src/art).
import type { BuildingType } from './buildings';
import type { Cost } from '../game/types';

export const MAX_BUILDING_LEVEL = 3;

export interface UpgradeDef {
  /** Custo para ir ao nível 2 e ao nível 3. */
  costs: [Cost, Cost];
  /** Nível mínimo da vila para cada upgrade (0 = Aldeia). */
  minVillage: [number, number];
  /** O que muda em cada nível (1, 2, 3), para mostrar no painel. */
  perks: [string, string, string];
}

export const UPGRADES: Partial<Record<BuildingType, UpgradeDef>> = {
  house: { costs: [{ wood: 50, stone: 30 }, { wood: 90, stone: 70, ryo: 60 }], minVillage: [0, 1], perks: ['4 moradores', '6 moradores', '8 moradores'] },
  farm: { costs: [{ wood: 40, stone: 10 }, { wood: 80, stone: 40, ryo: 50 }], minVillage: [0, 1], perks: ['+2 comida por colheita', '+3 comida por colheita', '+4 comida por colheita'] },
  lumber: { costs: [{ wood: 40, stone: 20 }, { wood: 70, stone: 50, ryo: 40 }], minVillage: [0, 1], perks: ['2 lenhadores', '3 lenhadores', '4 lenhadores'] },
  quarry: { costs: [{ wood: 50, stone: 10 }, { wood: 80, stone: 40, ryo: 40 }], minVillage: [0, 1], perks: ['2 mineradores', '3 mineradores', '4 mineradores'] },
  market: { costs: [{ wood: 60, stone: 40 }, { wood: 100, stone: 80, ryo: 80 }], minVillage: [0, 1], perks: ['+3 ryo por venda · vende 1× o lote', '+5 ryo por venda · 2× o lote', '+7 ryo por venda · 3× o lote'] },
  tower: { costs: [{ wood: 40, stone: 50 }, { wood: 60, stone: 100, ryo: 60 }], minVillage: [0, 1], perks: ['dano 7 · alcance normal', 'dano 10 · +15% de alcance', 'dano 13 · +30% de alcance'] },
  hospital: { costs: [{ wood: 60, stone: 60, ryo: 60 }, { wood: 100, stone: 100, ryo: 120 }], minVillage: [1, 2], perks: ['cura normal', 'cura 50% mais rápida', 'cura 2× mais rápida'] },
  academy: { costs: [{ wood: 80, stone: 60, ryo: 80 }, { wood: 140, stone: 120, ryo: 160 }], minVillage: [0, 1], perks: ['estudo normal · recruta no nível 1', 'estudo de jutsu +30% · recruta no nível 2', 'estudo de jutsu +60% · recruta no nível 3'] },
  training: { costs: [{ wood: 60, stone: 20 }, { wood: 100, stone: 60, ryo: 60 }], minVillage: [0, 1], perks: ['treino normal · 3 vagas', 'treino +30% · 5 vagas', 'treino +60% · 7 vagas'] },
};

/** Multiplicador por nível usado por vários efeitos (nível 1 = 1). */
export const levelStep = (level: number, perLevel: number) => 1 + (Math.max(1, level) - 1) * perLevel;
