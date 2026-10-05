// Especialização de prédios repetíveis: vagas e foco dos Campos de Treino, e o que cada Mercado vende.
import type { ResKey } from './resources';

/** Ninjas treinando ao mesmo tempo num Campo de Treino, por nível (1–3). */
export const TRAIN_SLOTS = [3, 5, 7];
/** Treino no atributo de foco do campo rende tanto a mais. */
export const FIELD_FOCUS_BONUS = 1.5;

export type MarketGood = Extract<ResKey, 'wood' | 'stone' | 'food' | 'herbs'>;

export interface GoodDef {
  name: string;
  /** Ryo por unidade vendida. */
  price: number;
  /** O mercado nunca vende abaixo desta reserva no estoque. */
  keep: number;
  /** Unidades vendidas por venda (a cada 8 s), multiplicadas pelo nível do mercado. */
  lot: number;
}

export const MARKET_GOODS: Record<MarketGood, GoodDef> = {
  wood: { name: 'Madeira', price: 1, keep: 150, lot: 6 },
  stone: { name: 'Pedra', price: 1.5, keep: 120, lot: 5 },
  food: { name: 'Comida', price: 1.2, keep: 150, lot: 6 },
  herbs: { name: 'Ervas', price: 3, keep: 40, lot: 3 },
};
export const MARKET_GOOD_LIST = Object.keys(MARKET_GOODS) as MarketGood[];
