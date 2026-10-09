import type { Cost } from '../game/types';
import LAYOUT_RAW from './layout.json';

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
  | 'library'
  | 'missions'
  | 'ironmine'
  | 'herbgarden'
  | 'forge'
  | 'pharmacy'
  | 'sealshop'
  | 'arena'
  | 'monument'
  | 'port'
  | 'intel'
  | 'puppetshop'
  | 'kennel';

export type JobType = 'farmer' | 'lumber' | 'miner' | 'merchant' | 'ironminer' | 'gardener' | 'crafter';

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
    type: 'hokage', name: 'Residência do Hokage', icon: '{castle}', desc: 'Centro da vila. Abriga 2 pessoas, serve de refúgio e seus guardas arremessam kunais.',
    w: 3, h: 3, cost: {}, buildTime: 0, housing: 2, unique: true, buildable: false, healRate: 2, lights: true,
    roof: '#c0392b', wall: '#eadcb8',
  },
  {
    type: 'house', name: 'Casa', icon: '{house}', desc: 'Abriga 4 moradores.',
    w: 2, h: 2, cost: { wood: 30, stone: 10 }, buildTime: 14, housing: 4, buildable: true, lights: true,
    roof: '#5b7fa6', wall: '#dccaa2',
  },
  {
    type: 'farm', name: 'Fazenda', icon: '{wheat}', desc: '2 fazendeiros cultivam comida.',
    w: 3, h: 3, cost: { wood: 25 }, buildTime: 10, workers: 2, job: 'farmer', buildable: true, walkable: true,
    roof: '#7a5a2a', wall: '#b89a5a',
  },
  {
    type: 'lumber', name: 'Lenhador', icon: '{axe}', desc: '2 lenhadores cortam árvores próximas.',
    w: 2, h: 2, cost: { wood: 20, stone: 5 }, buildTime: 10, workers: 2, job: 'lumber', buildable: true,
    roof: '#7b5233', wall: '#a57c4f',
  },
  {
    type: 'quarry', name: 'Pedreira', icon: '{pickaxe}', desc: '2 mineradores quebram rochas próximas.',
    w: 2, h: 2, cost: { wood: 30 }, buildTime: 12, workers: 2, job: 'miner', buildable: true,
    roof: '#5f666e', wall: '#a5a29a',
  },
  {
    type: 'market', name: 'Mercado', icon: '{lantern}', desc: 'Um comerciante gera ryo.',
    w: 2, h: 2, cost: { wood: 40, stone: 20 }, buildTime: 16, workers: 1, job: 'merchant', buildable: true, lights: true,
    roof: '#c9822b', wall: '#e3cfa3',
  },
  {
    type: 'academy', name: 'Academia Ninja', icon: '{scroll}', desc: 'Recruta novos ninjas e ensina jutsus.',
    w: 3, h: 3, cost: { wood: 60, stone: 40, ryo: 50 }, buildTime: 25, unique: true, buildable: true, lights: true,
    roof: '#d35400', wall: '#f0e0c0',
  },
  {
    type: 'training', name: 'Campo de Treino', icon: '{barbell}', desc: 'Ninjas treinam e melhoram atributos.',
    w: 3, h: 3, cost: { wood: 40, stone: 10 }, buildTime: 12, buildable: true, walkable: true,
    roof: '#7a5a2a', wall: '#a57c4f',
  },
  {
    type: 'hospital', name: 'Hospital', icon: '{medic}', desc: 'Cura rapidamente ninjas feridos.',
    w: 3, h: 2, cost: { wood: 50, stone: 40, ryo: 40 }, buildTime: 22, unique: true, buildable: true, healRate: 7, lights: true, minLevel: 1,
    roof: '#2e8b57', wall: '#f4f4f0',
  },
  {
    type: 'tower', name: 'Torre de Vigia', icon: '{tower}', desc: 'Arremessa kunais em inimigos próximos.',
    w: 1, h: 1, cost: { wood: 25, stone: 25 }, buildTime: 12, buildable: true,
    roof: '#8e3b2a', wall: '#6b4a2b',
  },
  {
    type: 'library', name: 'Biblioteca de Jutsus', icon: '{books}', desc: 'Guarda os pergaminhos: abra um aqui para os ninjas poderem estudar aquele jutsu (rank C em diante). Estudo mais rápido.',
    w: 3, h: 2, cost: { wood: 80, stone: 60, ryo: 150 }, buildTime: 24, unique: true, buildable: true, lights: true, minLevel: 1,
    roof: '#6c3483', wall: '#efe3c8',
  },
  {
    type: 'missions', name: 'Mesa de Missões', icon: '{clipboard}', desc: 'Recebe pedidos de missões. Envie equipes para cumpri-las.',
    w: 2, h: 2, cost: { wood: 40, stone: 20, ryo: 30 }, buildTime: 14, unique: true, buildable: true, lights: true,
    roof: '#2c3e50', wall: '#e8dcc0',
  },
  {
    type: 'ironmine', name: 'Mina de Ferro', icon: '{iron}', desc: '2 mineiros extraem ferro de veios de minério próximos.',
    w: 2, h: 2, cost: { wood: 40, stone: 30 }, buildTime: 16, workers: 2, job: 'ironminer', buildable: true, minLevel: 1,
    roof: '#4a4f57', wall: '#8b8378',
  },
  {
    type: 'herbgarden', name: 'Horta de Ervas', icon: '{herbs}', desc: '2 jardineiros cultivam ervas medicinais.',
    w: 2, h: 2, cost: { wood: 30, stone: 10 }, buildTime: 10, workers: 2, job: 'gardener', buildable: true, walkable: true, minLevel: 1,
    roof: '#3c6e3c', wall: '#8fbf6a',
  },
  {
    type: 'forge', name: 'Forja', icon: '{anvil}', desc: 'Um ferreiro fabrica armas e coletes com ferro.',
    w: 2, h: 2, cost: { wood: 50, stone: 40, ryo: 60 }, buildTime: 18, workers: 1, job: 'crafter', unique: true, buildable: true, lights: true, minLevel: 1,
    roof: '#5a3a2a', wall: '#9a8a7a',
  },
  {
    type: 'pharmacy', name: 'Farmácia', icon: '{flask}', desc: 'Um boticário prepara pílulas com ervas.',
    w: 2, h: 2, cost: { wood: 40, stone: 20, ryo: 50 }, buildTime: 16, workers: 1, job: 'crafter', unique: true, buildable: true, lights: true, minLevel: 1,
    roof: '#2e7d6b', wall: '#f0ead8',
  },
  {
    type: 'sealshop', name: 'Oficina de Selos', icon: '{paper}', desc: 'Faz papel de selo com madeira e papéis-bomba.',
    w: 2, h: 2, cost: { wood: 60, stone: 30, ryo: 120 }, buildTime: 20, workers: 1, job: 'crafter', unique: true, buildable: true, lights: true, minLevel: 2,
    roof: '#8e2a22', wall: '#f3e7cf',
  },
  {
    type: 'port', name: 'Porto', icon: '{ship}', desc: 'Barcos para as ilhas e os lugares sagrados da região (janela Mundo → Região).',
    w: 3, h: 2, cost: { wood: 150, stone: 60, ryo: 100 }, buildTime: 30, unique: true, buildable: true, lights: true, minLevel: 1,
    roof: '#3d5a80', wall: '#c8a26a',
  },
  {
    type: 'intel', name: 'Torre de Inteligência', icon: '{eye}', desc: 'Vê longe: revela a névoa ao redor e descobre espiões invisíveis. Forma ninjas espiões (Chunin+).',
    w: 2, h: 2, cost: { wood: 80, stone: 80, ryo: 150 }, buildTime: 26, unique: true, buildable: true, lights: true, minLevel: 1,
    roof: '#2d3a55', wall: '#6b4a2b',
  },
  {
    type: 'puppetshop', name: 'Oficina de Marionetes', icon: '{target}', desc: 'Forma ninjas marionetistas (Chunin+), que lutam com bonecos de madeira.',
    w: 2, h: 2, cost: { wood: 100, iron: 20, ryo: 150 }, buildTime: 24, unique: true, buildable: true, minLevel: 2,
    roof: '#5a2a6a', wall: '#c8a26a',
  },
  {
    type: 'kennel', name: 'Canil', icon: '{paw}', desc: 'Cria ninken: cães ninja que acompanham o dono, lutam junto, farejam espiões e acham ervas.',
    w: 2, h: 2, cost: { wood: 80, food: 40, ryo: 80 }, buildTime: 18, unique: true, buildable: true, minLevel: 1,
    roof: '#2f4a6b', wall: '#c8a26a',
  },
  {
    type: 'arena', name: 'Arena do Exame', icon: '{arena}', desc: 'Sedia o Exame Chunin: genins lutam 1×1 e os melhores são promovidos.',
    w: 6, h: 6, cost: { wood: 80, stone: 60, ryo: 50 }, buildTime: 22, unique: true, buildable: true, walkable: true, minLevel: 1,
    roof: '#8a6a3a', wall: '#c9a66b',
  },
  {
    type: 'monument', name: 'Monte dos Kages', icon: '{monument}', desc: 'Rostos dos Kages esculpidos na rocha: +30% de XP no treino e +1 de reputação por dia.',
    w: 4, h: 2, cost: { wood: 100, stone: 250, ryo: 200 }, buildTime: 30, unique: true, buildable: true, minLevel: 2,
    roof: '#8d8174', wall: '#6e6358',
  },
];

// tamanho do terreno ajustado no Editor de cenário (layout.json)
for (const b of LIST) {
  const t = (LAYOUT_RAW as { types: Record<string, { w?: number; h?: number }> }).types[b.type];
  if (t?.w) b.w = t.w;
  if (t?.h) b.h = t.h;
}
export const BUILDINGS = Object.fromEntries(LIST.map((b) => [b.type, b])) as Record<BuildingType, BuildingDef>;
export const BUILDING_LIST: readonly BuildingDef[] = LIST;
