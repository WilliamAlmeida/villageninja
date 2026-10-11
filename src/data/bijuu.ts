// Bestas com cauda (Bijuu): a Fera Colossal é uma delas, de 1 a 9 caudas (mais caudas, mais forte, aparece com a vila
// maior). Vencida, fica selada num jarro até o Kage escolher um ninja para guardá-la (o Jinchuuriki), que em combate
// veste o manto de chakra da fera (`mode` 'bijuu', game/modes.ts). Arte: src/art/bijuu-<caudas>.png (folha de bicho).

export interface BijuuDef {
  tails: number;
  name: string;
  /** O que é (dica e Bingo). */
  desc: string;
  /** Cor do manto de chakra e das caudas. */
  color: string;
}

export const BIJUU: BijuuDef[] = [
  { tails: 1, name: 'Shukaku', desc: 'Tanuki de areia com marcas de maldição.', color: '#d8b46a' },
  { tails: 2, name: 'Matatabi', desc: 'Gata feita de chamas azuis.', color: '#4a8cff' },
  { tails: 3, name: 'Isobu', desc: 'Tartaruga de casco de coral.', color: '#7fa0a8' },
  { tails: 4, name: 'Son Gokū', desc: 'Macaco de pelo vermelho e lava.', color: '#e0452a' },
  { tails: 5, name: 'Kokuō', desc: 'Cavalo-golfinho de vapor.', color: '#e8e0d0' },
  { tails: 6, name: 'Saiken', desc: 'Lesma de ácido e bolhas.', color: '#b8d890' },
  { tails: 7, name: 'Chōmei', desc: 'Besouro de seis asas.', color: '#7fe0c0' },
  { tails: 8, name: 'Gyūki', desc: 'Touro com tentáculos de polvo.', color: '#a06ad0' },
  { tails: 9, name: 'Kurama', desc: 'Raposa de nove caudas.', color: '#ff7a1a' },
];
export const bijuu = (tails: number) => BIJUU[Math.max(1, Math.min(9, tails)) - 1]!;

/** Até quantas caudas a fera que aparece pode ter, por nível da vila (Aldeia, Vila, Oculta, Grande). */
export const BIJUU_MAX_TAILS = [2, 4, 7, 9];

/** Fera Colossal de `tails` caudas: vida, dano e tamanho crescem com as caudas. */
export const bijuuScale = (tails: number) => ({ hp: 0.7 + tails * 0.22, damage: 0.8 + tails * 0.09, size: 1.15 + tails * 0.07 });

/** Selar a fera num ninja (aba Kage): custo, nível mínimo do ninja. */
export const SEAL = { cost: { ryo: 600, paper: 20 }, minLevel: 12 };

/** Modos de combate (manto de chakra): bônus enquanto duram (game/modes.ts). */
export type ModeKind = 'bijuu' | 'gates' | 'raiton';
export const MODES: Record<ModeKind, { name: string; color: string; time: number; cooldown: number; damage: number; speed: number; guard: number; dodge: number; drain: number }> = {
  /** Manto da fera: dano e velocidade (crescem com as caudas, em `modeDamage`), segura golpes e regenera. */
  bijuu: { name: 'Manto de chakra', color: '#ff3a1a', time: 14, cooldown: 45, damage: 1.15, speed: 1.25, guard: 0.75, dodge: 0, drain: -0.01 },
  /** Oito Portões: muito mais dano e velocidade, mas a vida escorre enquanto duram. */
  gates: { name: 'Oito Portões', color: '#5fe07a', time: 10, cooldown: 0, damage: 1.5, speed: 1.4, guard: 1, dodge: 0, drain: 0.025 },
  /** Manto de Raiton: corpo coberto de raios, rápido e difícil de acertar. */
  raiton: { name: 'Manto de Raiton', color: '#ffe066', time: 12, cooldown: 0, damage: 1.1, speed: 1.35, guard: 0.9, dodge: 0.25, drain: 0 },
};

/** Manto da fera: a partir de 4 caudas solta ondas de chakra em volta; a chance de perder o controle cresce com elas
 *  (descontrolado, as ondas pegam também os aliados). */
export const BIJUU_MODE = { blastEvery: 2.5, blastFrom: 4, wildPerTail: 0.06 };
