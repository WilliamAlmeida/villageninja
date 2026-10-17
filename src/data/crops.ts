// Culturas dos campos cercados (game/fields.ts): cada canteiro (um tile) passa por terra crua → arada → plantada
// (crescendo por dias de jogo) → madura, e a colheita rende pela cultura. A cultura é escolhida por cercado.
import type { ResKey } from './resources';

export type CropId = 'wheat' | 'turnip' | 'cabbage' | 'rice' | 'pumpkin' | 'herbs';

export interface CropDef {
  id: CropId;
  name: string;
  icon: string;
  /** Dias de jogo de plantada a madura, com água e na estação neutra. */
  days: number;
  /** O que um canteiro maduro rende na colheita (antes de clima e cansaço do solo). */
  res: ResKey;
  yield: number;
  /** Ritmo de crescimento por estação (primavera, verão, outono, inverno). 0 = não cresce. */
  season: [number, number, number, number];
  /** Morre na geada: plantada no inverno com neve, perde. */
  frost?: boolean;
  /** Só cresce em canteiro vizinho de água (arroz). */
  paddy?: boolean;
  /** Nível mínimo da vila. */
  minLevel?: number;
  desc: string;
  /** Cores do desenho provisório (folha, fruto/espiga). */
  leaf: string;
  fruit: string;
}

export const CROP_LIST: CropDef[] = [
  {
    id: 'wheat', name: 'Trigo', icon: '{wheat}', days: 3, res: 'food', yield: 30, season: [1, 1.1, 1, 0.2],
    desc: 'A base: rende bem e cresce em quase toda estação.', leaf: '#7fae4a', fruit: '#e8c25a',
  },
  {
    id: 'turnip', name: 'Nabo', icon: '{food}', days: 2, res: 'food', yield: 17, season: [1, 0.9, 1.1, 0.7],
    desc: 'Rápido e aguenta o frio: a comida do inverno.', leaf: '#5fa34a', fruit: '#f2efe2',
  },
  {
    id: 'cabbage', name: 'Repolho', icon: '{leaf}', days: 3, res: 'food', yield: 28, season: [0.9, 0.8, 1.3, 0.4],
    desc: 'Cresce melhor no outono.', leaf: '#6cbf55', fruit: '#a8dc7a',
  },
  {
    id: 'rice', name: 'Arroz', icon: '{wheat}', days: 4, res: 'food', yield: 50, season: [1.1, 1.2, 0.9, 0],
    paddy: true, desc: 'Rende muito, mas só nos canteiros vizinhos de água e para no inverno.', leaf: '#8bc34a', fruit: '#e6dca0',
  },
  {
    id: 'pumpkin', name: 'Abóbora', icon: '{food}', days: 5, res: 'food', yield: 68, season: [1, 1.2, 1.1, 0],
    frost: true, desc: 'A que mais rende, mas é lenta e a geada do inverno mata.', leaf: '#4f8f3a', fruit: '#e8892b',
  },
  {
    id: 'herbs', name: 'Ervas', icon: '{herbs}', days: 3, res: 'herbs', yield: 9, season: [1.1, 1, 1, 0.3],
    minLevel: 1, desc: 'Ervas medicinais para a Farmácia (era a Horta de Ervas).', leaf: '#4c9a5a', fruit: '#b18be0',
  },
];

export const CROPS = Object.fromEntries(CROP_LIST.map((c) => [c.id, c])) as Record<CropId, CropDef>;

export const FIELD = {
  /** Custo da cerca por canteiro pintado. */
  cost: { wood: 3 },
  /** Teto total de canteiros por nível da vila (substitui o teto de fazendas e hortas). */
  maxPlots: [18, 36, 48, 100] as [number, number, number, number],
  /** Teto de canteiros numa colônia. */
  colonyPlots: 36,
  /** Segundos de trabalho no canteiro: arar, semear, regar, colher. */
  work: { till: 3, sow: 2, water: 1.5, harvest: 3 },
  /** Umidade (dias) que uma rega, a chuva ou a água vizinha deixa; seco cresce na metade. */
  wetDays: 1,
  dryGrowth: 0.5,
  /** Dias que o maduro aguenta no pé antes de murchar. */
  witherDays: 2,
  /** Cansaço do solo: repetir a cultura tira, trocar devolve; rende 50% a 100% pela fertilidade. */
  fertStep: 0.25,
  /** Um fazendeiro cuida de até tantos canteiros (vagas sugeridas do cercado). */
  plotsPerWorker: 5,
};

/** Maduro em fração (0..1) → etapa do desenho: semente, broto, crescendo, quase, maduro. */
export const growStage = (g: number) => (g < 0.15 ? 0 : g < 0.4 ? 1 : g < 0.7 ? 2 : g < 1 ? 3 : 4);
