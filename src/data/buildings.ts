import type { Cost } from '../game/types';

export type BuildingType =
  | 'hokage'
  | 'house'
  | 'farm'
  | 'lumber'
  | 'quarry'
  | 'market'
  | 'academy'
  | 'training'
  | 'hospital'
  | 'tower'
  | 'library';

export type JobType = 'farmer' | 'lumber' | 'miner' | 'merchant';

export interface BuildingDef {
  type: BuildingType;
  name: string;
  icon: string;
  desc: string;
  w: number;
  h: number;
  cost: Cost;
  buildTime: number;
  housing?: number;
  workers?: number;
  job?: JobType;
  unique?: boolean;
  buildable: boolean;
  /** Pode ser atravessado (campos, áreas abertas). */
  walkable?: boolean;
  /** Cura por segundo para quem descansa na porta. */
  healRate?: number;
  /** Desenha janelas acesas à noite. */
  lights?: boolean;
  /** Nível mínimo da vila para construir (padrão 0). */
  minLevel?: number;
  roof: string;
  wall: string;
}

const LIST: BuildingDef[] = [
  {
    type: 'hokage', name: 'Residência do Hokage', icon: '🏯', desc: 'Centro da vila. Abriga 2 pessoas, serve de refúgio e seus guardas arremessam kunais.',
    w: 3, h: 3, cost: {}, buildTime: 0, housing: 2, unique: true, buildable: false, healRate: 2, lights: true,
    roof: '#c0392b', wall: '#eadcb8',
  },
  {
    type: 'house', name: 'Casa', icon: '🏠', desc: 'Abriga 4 moradores.',
    w: 2, h: 2, cost: { wood: 30, stone: 10 }, buildTime: 14, housing: 4, buildable: true, lights: true,
    roof: '#5b7fa6', wall: '#dccaa2',
  },
  {
    type: 'farm', name: 'Fazenda', icon: '🌾', desc: '2 fazendeiros cultivam comida.',
    w: 3, h: 3, cost: { wood: 25 }, buildTime: 10, workers: 2, job: 'farmer', buildable: true, walkable: true,
    roof: '#7a5a2a', wall: '#b89a5a',
  },
  {
    type: 'lumber', name: 'Lenhador', icon: '🪓', desc: '2 lenhadores cortam árvores próximas.',
    w: 2, h: 2, cost: { wood: 20, stone: 5 }, buildTime: 10, workers: 2, job: 'lumber', buildable: true,
    roof: '#7b5233', wall: '#a57c4f',
  },
  {
    type: 'quarry', name: 'Pedreira', icon: '⛏️', desc: '2 mineradores quebram rochas próximas.',
    w: 2, h: 2, cost: { wood: 30 }, buildTime: 12, workers: 2, job: 'miner', buildable: true,
    roof: '#5f666e', wall: '#a5a29a',
  },
  {
    type: 'market', name: 'Mercado', icon: '🏮', desc: 'Um comerciante gera ryo.',
    w: 2, h: 2, cost: { wood: 40, stone: 20 }, buildTime: 16, workers: 1, job: 'merchant', buildable: true, lights: true,
    roof: '#c9822b', wall: '#e3cfa3',
  },
  {
    type: 'academy', name: 'Academia Ninja', icon: '📜', desc: 'Recruta novos ninjas e ensina jutsus.',
    w: 3, h: 3, cost: { wood: 60, stone: 40, ryo: 50 }, buildTime: 25, unique: true, buildable: true, lights: true,
    roof: '#d35400', wall: '#f0e0c0',
  },
  {
    type: 'training', name: 'Campo de Treino', icon: '🥋', desc: 'Ninjas treinam e melhoram atributos.',
    w: 3, h: 3, cost: { wood: 40, stone: 10 }, buildTime: 12, buildable: true, walkable: true,
    roof: '#7a5a2a', wall: '#a57c4f',
  },
  {
    type: 'hospital', name: 'Hospital', icon: '⚕️', desc: 'Cura rapidamente ninjas feridos.',
    w: 3, h: 2, cost: { wood: 50, stone: 40, ryo: 40 }, buildTime: 22, unique: true, buildable: true, healRate: 7, lights: true, minLevel: 1,
    roof: '#2e8b57', wall: '#f4f4f0',
  },
  {
    type: 'tower', name: 'Torre de Vigia', icon: '🗼', desc: 'Arremessa kunais em inimigos próximos.',
    w: 1, h: 1, cost: { wood: 25, stone: 25 }, buildTime: 12, buildable: true,
    roof: '#8e3b2a', wall: '#6b4a2b',
  },
  {
    type: 'library', name: 'Biblioteca de Jutsus', icon: '📚', desc: 'Pergaminhos antigos: ninjas aprendem jutsus 50% mais rápido.',
    w: 3, h: 2, cost: { wood: 80, stone: 60, ryo: 150 }, buildTime: 24, unique: true, buildable: true, lights: true, minLevel: 2,
    roof: '#6c3483', wall: '#efe3c8',
  },
];

export const BUILDINGS = Object.fromEntries(LIST.map((b) => [b.type, b])) as Record<BuildingType, BuildingDef>;
export const BUILDING_LIST: readonly BuildingDef[] = LIST;
