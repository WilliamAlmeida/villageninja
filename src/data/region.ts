// Mapa da região (janela Mundo → Região): vilarejos vizinhos no continente, ilhas e lugares sagrados pelo mar.
// Posições em % da imagem de fundo (src/art/region.jpg). Ações viram expedições (game/region.ts).
import type { Cost } from '../game/types';

export type RegionKind = 'village' | 'island' | 'sacred';
export type ContractKind = 'toad' | 'snake' | 'slug';
export type RegionAction = 'trade' | 'protect' | 'raid' | 'annex' | 'explore' | 'outpost' | 'train' | 'contract';

export interface RegionNodeDef {
  id: string;
  name: string;
  kind: RegionKind;
  /** Posição no mapa (% da largura e da altura). */
  x: number;
  y: number;
  desc: string;
  /** Força das defesas (saque / anexação à força / exploração). */
  power: number;
  /** Vilarejo: troca (dá → recebe) e o que paga de tributo por dia quando protegido (vassalo paga o dobro). */
  trade?: { give: Cost; get: Cost };
  tribute?: Cost;
  /** Saque bem-sucedido rende isto. */
  loot?: Cost;
  /** Ilha: o que o posto avançado produz por dia. */
  outpost?: Cost;
  /** Lugar sagrado: contrato de invocação. */
  contract?: ContractKind;
}

export const REGION_NODES: RegionNodeDef[] = [
  // ---- vilarejos (continente)
  {
    id: 'arroz', name: 'Vila do Arroz', kind: 'village', x: 39.7, y: 22, power: 25,
    desc: 'Arrozais nos vales do norte. Gente pacífica, sempre com comida sobrando.',
    trade: { give: { ryo: 60 }, get: { food: 90 } }, tribute: { food: 30 }, loot: { food: 160, ryo: 60 },
  },
  {
    id: 'pesca', name: 'Vila dos Pescadores', kind: 'village', x: 33.9, y: 47.9, power: 20,
    desc: 'Pescadores à beira do lago. Trocam peixe e ervas da margem.',
    trade: { give: { wood: 60 }, get: { food: 50, herbs: 12 } }, tribute: { food: 20, herbs: 4 }, loot: { food: 100, herbs: 25 },
  },
  {
    id: 'montanha', name: 'Vila da Montanha', kind: 'village', x: 72.9, y: 33.7, power: 40,
    desc: 'Mineiros das montanhas do leste. Desconfiados, mas com ferro e pedra de sobra.',
    trade: { give: { food: 80 }, get: { iron: 18, stone: 40 } }, tribute: { iron: 6, stone: 20 }, loot: { iron: 40, stone: 120, ryo: 80 },
  },
  {
    id: 'mercadores', name: 'Cidade dos Mercadores', kind: 'village', x: 64.5, y: 55.7, power: 55,
    desc: 'Entreposto rico no sul. Muito ryo e papel, e mercenários contratados para defender.',
    trade: { give: { food: 60, wood: 60 }, get: { ryo: 160, paper: 8 } }, tribute: { ryo: 70, paper: 3 }, loot: { ryo: 380, paper: 20 },
  },
  // ---- ilhas (precisam do Porto)
  {
    id: 'vulcao', name: 'Ilha Vulcânica', kind: 'island', x: 9.8, y: 12.7, power: 45,
    desc: 'Lava e rochas negras. Veios de ferro e, no fundo das crateras, aço negro.',
    outpost: { iron: 6, darksteel: 1 },
  },
  {
    id: 'nevoa', name: 'Ilha da Névoa', kind: 'island', x: 87, y: 13.7, power: 35,
    desc: 'Coberta por uma névoa eterna. Ervas raras e madeira para papel de selo.',
    outpost: { herbs: 8, paper: 3 },
  },
  {
    id: 'templos', name: 'Ilha dos Templos', kind: 'island', x: 89, y: 41, power: 30,
    desc: 'Monges guardam templos antigos entre as cerejeiras. Ótimo lugar para treinar, e há cristais nas grutas.',
    outpost: { crystal: 1, ryo: 30 },
  },
  // ---- lugares sagrados (contratos de invocação; precisam do Porto)
  {
    id: 'sapos', name: 'Monte dos Sapos', kind: 'sacred', x: 13, y: 66, power: 60, contract: 'toad',
    desc: 'Uma montanha em forma de sapo. Os sapos guerreiros só fazem contrato com quem os vence em combate.',
  },
  {
    id: 'serpentes', name: 'Caverna das Serpentes', kind: 'sacred', x: 86.6, y: 71, power: 70, contract: 'snake',
    desc: 'O covil das serpentes. Contrato perigoso: serpentes venenosas lutam pelo invocador.',
  },
  {
    id: 'lesmas', name: 'Floresta das Lesmas', kind: 'sacred', x: 65, y: 83, power: 50, contract: 'slug',
    desc: 'Floresta úmida de cogumelos gigantes. As lesmas curam os aliados de quem tem o contrato.',
  },
];

export const REGION = Object.fromEntries(REGION_NODES.map((n) => [n.id, n])) as Record<string, RegionNodeDef>;
/** A vila do jogador no mapa. */
export const HOME_POS = { x: 49.8, y: 37 };

/** Duração (s) de cada ação: ida + trabalho + volta. */
export const ACTION_TIME: Record<RegionAction, { travel: number; work: number }> = {
  trade: { travel: 10, work: 6 },
  protect: { travel: 10, work: 30 },
  raid: { travel: 10, work: 10 },
  annex: { travel: 10, work: 20 },
  explore: { travel: 14, work: 16 },
  outpost: { travel: 14, work: 24 },
  train: { travel: 14, work: 40 },
  contract: { travel: 14, work: 20 },
};

export const ACTION_LABEL: Record<RegionAction, string> = {
  trade: 'Comerciar', protect: 'Proteger', raid: 'Saquear', annex: 'Anexar', explore: 'Explorar',
  outpost: 'Montar posto avançado', train: 'Treinar no templo', contract: 'Buscar contrato',
};

/** Custo para montar um posto avançado numa ilha e para anexar um vilarejo em paz. */
export const OUTPOST_COST: Cost = { wood: 150, stone: 100, ryo: 200 };
export const ANNEX_COST: Cost = { ryo: 300 };

/** Relação: protegido a partir de 60, anexável em paz com 90+, à força com -60 ou menos. */
export const REL = { protected: 60, annexPeace: 90, annexForce: -60 };
/** Honra/infâmia a partir das quais os efeitos começam. */
export const FAME = { wanderer: 20, hunters: 20 };
