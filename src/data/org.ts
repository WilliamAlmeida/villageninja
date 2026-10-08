// A Ordem do Eclipse: organização criminosa de 8 ninjas lendários (capas pretas com o eclipse carmesim). Atacam em
// duplas e caçam os ninjas mais fortes da vila; quem cai não volta. Derrotadas as três duplas, o covil aparece no mapa
// da região para a invasão final (os dois que guardam o covil, com o líder).
import type { Nature } from './natures';

export type OrgMemberId = 'goen' | 'tetsuo' | 'mizuchi' | 'raiga' | 'kagero' | 'shiryo' | 'tsuchigumo' | 'yomi';

export interface OrgMemberDef {
  name: string;
  title: string;
  nature: Nature;
  /** Técnica própria (nome e o que faz). */
  art: string;
  desc: string;
  jutsu: [string, string | null];
  /** Recarga (s) da técnica própria. */
  cd: number;
  hpMult: number;
  stats: number;
}

export const ORG = {
  name: 'Ordem do Eclipse',
  /** Nível mínimo da vila para a Ordem começar a aparecer (2 = Vila Oculta). */
  minVillage: 2,
  /** Intervalo (dias) entre as aparições. */
  every: [4, 6] as [number, number],
  /** Quanto tempo (s) uma dupla caça antes de recuar (se ninguém a derrubar). */
  hunt: 150,
  /** Vida a mais por vez que a Ordem se reergueu (+30% a cada ciclo). */
  cycleHp: 0.3,
  /** Dias de sossego depois que o covil cai, até ela se reerguer. */
  restDays: 10,
  /** Recompensa por membro derrotado e pela destruição da Ordem. */
  memberReward: { ryo: 800 },
  finalReward: { ryo: 4000, darksteel: 12, crystal: 12 },
};

export const ORG_MEMBERS: Record<OrgMemberId, OrgMemberDef> = {
  goen: {
    name: 'Gōen', title: 'o Incendiário', nature: 'katon', art: 'Inferno', cd: 9, hpMult: 3.2, stats: 3.2,
    desc: 'Explode o chão em volta do alvo num mar de chamas.', jutsu: ['goukakyuu', 'housenka'],
  },
  tetsuo: {
    name: 'Tetsuo', title: 'o Corpo de Ferro', nature: 'doton', art: 'Corpo de Ferro', cd: 10, hpMult: 4, stats: 3,
    desc: 'Recebe só metade do dano e dá um soco de ferro que arremessa e atordoa.', jutsu: ['senpuu', 'doryuuheki'],
  },
  mizuchi: {
    name: 'Mizuchi', title: 'a Maré', nature: 'suiton', art: "Prisão d'Água", cd: 12, hpMult: 3, stats: 3.2,
    desc: 'Prende o alvo numa bolha de água (não se mexe) e drena o chakra dele.', jutsu: ['suiryuudan', 'mizurappa'],
  },
  raiga: {
    name: 'Raiga', title: 'o Relâmpago', nature: 'raiton', art: 'Trovão Veloz', cd: 7, hpMult: 2.8, stats: 3.4,
    desc: 'Investidas de raio muito rápidas, uma atrás da outra.', jutsu: ['chidori', 'raikyuu'],
  },
  kagero: {
    name: 'Kagerō', title: 'a Miragem', nature: 'fuuton', art: 'Miragem', cd: 14, hpMult: 2.8, stats: 3.4,
    desc: 'Uma ilusão que paralisa todos os ninjas por perto.', jutsu: ['kuroduki', 'shinkuuha'],
  },
  shiryo: {
    name: 'Shiryō', title: 'o Necromante', nature: 'doton', art: 'Mortos-vivos', cd: 16, hpMult: 3, stats: 3,
    desc: 'Levanta mortos-vivos que lutam por ele (desmoronam se ele cair).', jutsu: ['narakumi', 'doryuudan'],
  },
  tsuchigumo: {
    name: 'Tsuchigumo', title: 'a Aranha de Terra', nature: 'doton', art: 'Ninho', cd: 12, hpMult: 3.6, stats: 3.4,
    desc: 'Chama aranhas gigantes e se protege atrás de uma muralha de terra.', jutsu: ['doryuudan', 'doryuuheki'],
  },
  yomi: {
    name: 'Yomi', title: 'o Eclipse, líder da Ordem', nature: 'fuuton', art: 'Repulsão', cd: 10, hpMult: 6, stats: 3.8,
    desc: 'Empurra para longe tudo o que está em volta, ferindo quem for arremessado.', jutsu: ['shinkuuha', 'chisoku'],
  },
};

/** As três duplas que atacam a vila, nesta ordem; os outros dois guardam o covil. */
export const ORG_PAIRS: OrgMemberId[][] = [
  ['goen', 'tetsuo'],
  ['mizuchi', 'raiga'],
  ['kagero', 'shiryo'],
];
export const ORG_LAIR: OrgMemberId[] = ['tsuchigumo', 'yomi'];
