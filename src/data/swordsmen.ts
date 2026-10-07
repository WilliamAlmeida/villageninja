// Os Sete Espadachins da Névoa: renegados que carregam as sete lâminas lendárias. Da Vila Oculta em diante invadem a
// vila de tempos em tempos (2 deles com uma escolta). Cada invasão rende no máximo UMA espada: o primeiro espadachim
// derrubado cai de vez e a espada fica com a vila; os outros, derrubados, somem na névoa e voltam numa próxima.
// Tomadas as sete, a organização acaba.
import type { MistBlade } from './blades';
import type { Nature } from './natures';

export interface SwordsmanDef {
  name: string;
  title: string;
  blade: MistBlade;
  nature: Nature;
  /** Penteado do sprite (paper doll) e cor do cabelo. */
  style: string;
  hair: string;
}

export const SWORDSMEN_ORG = {
  name: 'Espadachins da Névoa',
  /** Nível mínimo da vila (2 = Vila Oculta). */
  minVillage: 2,
  /** Intervalo (dias) entre as invasões. */
  every: [5, 8] as [number, number],
  /** Espadachins por invasão (os que ainda têm espada) e renegados de escolta. */
  perRaid: 2,
  escort: 3,
  /** Força: atributos e multiplicador de vida (cresce com os Jounins da vila, como a Ordem). */
  stats: 2.8,
  hpMult: 2.6,
  /** Recompensa por espadachim que fugiu na névoa e pela espada tomada. */
  fleeReward: { ryo: 250 },
  bladeReward: { ryo: 600 },
  /** Roupa da Névoa. */
  cloth: '#5a6a7a',
};

/** Nomes originais (o anime fica só nas espadas, como os jutsus). */
export const SWORDSMEN: Record<MistBlade, SwordsmanDef> = {
  zabuza: { name: 'Zanki', title: 'o Demônio da Névoa', blade: 'zabuza', nature: 'suiton', style: 'spiky', hair: '#2a2a30' },
  samehada: { name: 'Fukami', title: 'o Tubarão', blade: 'samehada', nature: 'suiton', style: 'short', hair: '#3a5a8a' },
  kiba: { name: 'Ikazuchi', title: 'o Trovão Gêmeo', blade: 'kiba', nature: 'raiton', style: 'ponytail', hair: '#e8a030' },
  hiramekarei: { name: 'Hyōga', title: 'o Guardião', blade: 'hiramekarei', nature: 'suiton', style: 'long', hair: '#6a4a8a' },
  nuibari: { name: 'Itoe', title: 'a Costureira', blade: 'nuibari', nature: 'fuuton', style: 'buns', hair: '#c0c0c8' },
  kabutowari: { name: 'Gōtetsu', title: 'o Quebra-Elmos', blade: 'kabutowari', nature: 'doton', style: 'bald', hair: '#2a2a30' },
  shibuki: { name: 'Bakuya', title: 'o Explosivo', blade: 'shibuki', nature: 'katon', style: 'spiky', hair: '#c0392b' },
};
