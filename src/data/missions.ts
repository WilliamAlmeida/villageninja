import type { AnimalType } from './animals';
import type { Rank } from './ninja';

export type MissionType = 'herbs' | 'hunt' | 'escort' | 'camp' | 'wanted';

/** Rank de missão: D, C, B, A, S (índices 0–4). */
export const MISSION_RANKS = [
  { label: 'D', color: '#7ddc6b', ryo: 60, xp: 20, rep: 1, power: 12 },
  { label: 'C', color: '#4da6ff', ryo: 120, xp: 40, rep: 2, power: 25 },
  { label: 'B', color: '#b36bff', ryo: 250, xp: 80, rep: 4, power: 45 },
  { label: 'A', color: '#ff8a2b', ryo: 450, xp: 140, rep: 7, power: 75 },
  { label: 'S', color: '#ff4d4d', ryo: 800, xp: 250, rep: 12, power: 120 },
] as const;

export interface Enemy {
  rank: Rank;
  /** Bônus somado a cada atributo. */
  stats?: number;
  hpMult?: number;
  jutsu?: number;
  boss?: boolean;
}

export interface MissionTemplate {
  type: MissionType;
  rank: number;
  title: string;
  desc: string;
  /** Onde o objetivo aparece. */
  site: 'forest' | 'edge';
  animals?: { type: AnimalType; count: number; hpMult?: number };
  herbs?: number;
  enemies?: Enemy[];
  /** Escolta: bandidos que emboscam no meio do caminho. */
  ambush?: Enemy[];
  bonus?: { food?: number; wood?: number; stone?: number };
}

/** Bandidos comuns são mais fracos que ninjas do mesmo rank. */
const bandit = (rank: Rank = 'genin', stats = 0): Enemy => ({
  rank,
  stats: stats - (rank === 'genin' ? 0.7 : 0),
  hpMult: rank === 'genin' ? 0.7 : 1,
  jutsu: rank === 'genin' ? 0 : 1,
});

export const MISSION_TEMPLATES: MissionTemplate[] = [
  // ---- D
  {
    type: 'herbs', rank: 0, title: 'Coleta de ervas medicinais', site: 'forest', herbs: 3,
    animals: { type: 'wolf', count: 2 }, bonus: { food: 30 },
    desc: 'O hospital precisa de ervas raras da floresta. Cuidado com os lobos da região.',
  },
  {
    type: 'hunt', rank: 0, title: 'Javalis na plantação vizinha', site: 'forest',
    animals: { type: 'boar', count: 2 }, bonus: { food: 40 },
    desc: 'Dois javalis estão destruindo plantações de um vilarejo próximo. Cace-os.',
  },
  // ---- C
  {
    type: 'hunt', rank: 1, title: 'O urso da montanha', site: 'forest',
    animals: { type: 'bear', count: 1, hpMult: 1.5 }, bonus: { food: 60 },
    desc: 'Um urso enorme ataca lenhadores. Elimine a fera.',
  },
  {
    type: 'escort', rank: 1, title: 'Escolta de mercador', site: 'edge',
    ambush: [bandit(), bandit()], bonus: { wood: 60, stone: 40 },
    desc: 'Proteja um mercador da borda do mapa até a vila. Há rumores de bandidos na estrada.',
  },
  {
    type: 'camp', rank: 1, title: 'Acampamento de bandidos', site: 'edge',
    enemies: [bandit(), bandit(), bandit()],
    desc: 'Bandidos montaram acampamento perto da estrada. Desmonte o grupo.',
  },
  {
    type: 'herbs', rank: 1, title: 'Ervas do vale dos lobos', site: 'forest', herbs: 4,
    animals: { type: 'wolf', count: 4 }, bonus: { food: 50 },
    desc: 'Ervas valiosas crescem num vale infestado de lobos.',
  },
  // ---- B
  {
    type: 'camp', rank: 2, title: 'Covil de bandidos', site: 'edge',
    enemies: [bandit(), bandit(), bandit('genin', 1), { rank: 'chunin', stats: 1, hpMult: 1.5, jutsu: 2, boss: true }],
    desc: 'Um ninja renegado lidera um bando de saqueadores. Derrote todos.',
  },
  {
    type: 'escort', rank: 2, title: 'Caravana valiosa', site: 'edge',
    ambush: [bandit(), bandit('genin', 1), bandit('chunin'), bandit('chunin')], bonus: { wood: 120, stone: 80 },
    desc: 'Uma caravana carregada de ouro precisa chegar à vila. A emboscada será pesada.',
  },
  {
    type: 'hunt', rank: 2, title: 'A cobra gigante do pântano', site: 'forest',
    animals: { type: 'snake', count: 1, hpMult: 1.3 },
    desc: 'Uma serpente colossal devora viajantes. Só ninjas experientes devem ir.',
  },
  {
    type: 'wanted', rank: 2, title: 'Procurado: desertor', site: 'edge',
    enemies: [{ rank: 'chunin', stats: 1.5, hpMult: 2, jutsu: 2, boss: true }],
    desc: 'Um chunin desertor está escondido nos arredores. Capture-o (vivo ou não).',
  },
  // ---- A
  {
    type: 'wanted', rank: 3, title: 'Nukenin rank A', site: 'edge',
    enemies: [{ rank: 'jounin', stats: 2, hpMult: 3, jutsu: 2, boss: true }, bandit('chunin', 1), bandit('chunin', 1)],
    desc: 'Um jounin renegado e seus guarda-costas. Extremamente perigoso.',
  },
  {
    type: 'camp', rank: 3, title: 'Fortaleza dos mercenários', site: 'edge',
    enemies: [bandit('chunin', 1), bandit('chunin', 1), bandit('chunin', 1), bandit('chunin', 2), { rank: 'jounin', stats: 1.5, hpMult: 2.5, jutsu: 2, boss: true }],
    desc: 'Mercenários fortificados ameaçam todas as rotas de comércio.',
  },
  // ---- S
  {
    type: 'wanted', rank: 4, title: 'O ninja lendário', site: 'edge',
    enemies: [{ rank: 'jounin', stats: 4, hpMult: 4, jutsu: 2, boss: true }, bandit('jounin', 1), bandit('jounin', 1)],
    desc: 'Um ninja de lenda, com recompensa por sua cabeça em todas as nações.',
  },
];

/** Ranks de missão que o quadro oferece em cada nível da vila (com pesos). */
export const OFFER_RANKS: Record<number, [number, number][]> = {
  0: [[0, 3], [1, 1]],
  1: [[0, 2], [1, 3], [2, 1]],
  2: [[1, 2], [2, 3], [3, 1]],
  3: [[2, 2], [3, 3], [4, 1]],
};

export const MISSION_TYPE_LABEL: Record<MissionType, string> = {
  herbs: 'Coleta', hunt: 'Caça', escort: 'Escolta', camp: 'Acampamento', wanted: 'Procurado',
};
