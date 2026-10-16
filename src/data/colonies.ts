// Colônias nas ilhas (docs/gdd-escala-ilhas-pvp.md, seção 5): um mapa pequeno por ilha, simulado em detalhe só
// enquanto está na tela e em resumo por dia fora dela (game/colonies.ts, systems/colonies.ts).
import { BUILDINGS, type BuildingType } from './buildings';
import type { Cost } from '../game/types';
import type { SceneTheme } from '../game/types';

export const COLONY = {
  /** Custo de fundar (pago ao partir; o posto avançado, se houver, não desconta). */
  cost: { wood: 300, stone: 200, ryo: 500 } as Cost,
  /** Colônias ao mesmo tempo (uma por ilha). */
  max: 3,
  /** Viagem (s) de quem vai morar lá, como a do posto avançado. */
  travel: 14,
  /** Tamanho do mapa da colônia (tiles). */
  w: 48,
  h: 48,
  /** Teto de gente na colônia (4 casas no nível 3 = 48). */
  popLimit: 48,
  /** Chance por dia de uma ameaça (bichos da ilha, piratas) fora da tela. */
  threatChance: 0.25,
  /** O que uma torre pronta vale de defesa no resumo por dia (na escala de `unitPower`). */
  towerPower: 25,
};

/**
 * Teto de prédios por tipo na colônia (o que não está aqui não pode ser construído lá: Academia, Hospital,
 * Biblioteca e as oficinas ficam na vila). Decorações e ruas são livres, como na vila. `production` é o teto
 * SOMADO de fazenda, lenhador, pedreira, mina de ferro e horta.
 */
export const COLONY_CAPS: Partial<Record<BuildingType, number>> = { house: 4, market: 1, tower: 4, port: 1 };
/** Fazenda e horta viraram campos cercados (game/fields.ts; teto próprio de canteiros na colônia). */
export const COLONY_PRODUCTION: BuildingType[] = ['lumber', 'quarry', 'ironmine'];
export const COLONY_PRODUCTION_CAP = 3;

/** Tema do mapa de cada ilha (arte dos prédios e enfeites, render/themeProps.ts); sem tema = ilha comum. */
export const ISLAND_THEME: Record<string, SceneTheme> = { recife: 'fishing' };

/**
 * Produção por trabalhador e por dia no resumo fora da tela (um pouco abaixo do que a simulação rende: quem não
 * olha a colônia paga um pouco por isso). Fazenda e mercado escalam com o nível pelos helpers de upgrade.ts.
 */
export const COLONY_YIELD: Record<string, { res: keyof Cost; perDay: number }> = {
  farmer: { res: 'food', perDay: 9 },
  lumber: { res: 'wood', perDay: 10 },
  miner: { res: 'stone', perDay: 8 },
  ironminer: { res: 'iron', perDay: 5 },
  gardener: { res: 'herbs', perDay: 4 },
  merchant: { res: 'ryo', perDay: 12 },
};

/** Teto de um tipo de prédio na colônia (0 = só na vila; decorações sem teto). */
export function colonyCapOf(type: BuildingType): number {
  if (COLONY_CAPS[type] != null) return COLONY_CAPS[type]!;
  if (COLONY_PRODUCTION.includes(type)) return COLONY_PRODUCTION_CAP;
  return BUILDINGS[type].deco ? Infinity : 0;
}
