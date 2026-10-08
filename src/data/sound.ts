// O Quinteto do Som: ninjas de uma vila escondida que vêm RAPTAR o ninja mais talentoso da vila (nunca o Kage nem um
// Sannin). Quatro invadem; o líder fica no esconderijo. Um carrega o raptado enquanto os outros dão cobertura: derrubar
// quem carrega solta o ninja. Se fugirem com ele, o Esconderijo do Som aparece na Região com prazo para o resgate (mapa
// jogável com o líder); passado o prazo, o ninja volta com o selo amaldiçoado, do lado deles, nas próximas invasões
// (derrotado, ele volta para a vila). Eles não acabam: voltam sempre.
import type { Cost } from '../game/types';
import type { Nature } from './natures';

export type SoundId = 'iwao' | 'kumomaru' | 'kanade' | 'sokon' | 'hakkotsu';

export interface SoundDef {
  name: string;
  title: string;
  nature: Nature;
  art: string;
  desc: string;
  /** Recarga (s) da técnica. */
  cd: number;
  hpMult: number;
}

export const SOUND = {
  name: 'Quinteto do Som',
  minVillage: 2,
  /** Intervalo (dias) entre as invasões. */
  every: [6, 9] as [number, number],
  /** Segundos tentando pegar o alvo antes de desistir e ir embora. */
  patience: 180,
  /** Dias para resgatar o raptado no esconderijo. */
  rescueDays: 3,
  /** Velocidade de quem carrega o raptado e de onde os ninjas da vila o veem e correm atrás. */
  carrySpeed: 0.55,
  /** Quem carrega está com as mãos ocupadas: recebe mais dano. */
  carryHurt: 2,
  chaseRange: 420,
  /** Quantos ninjas da vila (os mais perto) são chamados ao mesmo tempo para perseguir quem carrega. */
  chasers: 6,
  /** Força: multiplicador dos renegados e atributo base de cada membro (Jounins fortes, não lendários como a Ordem). */
  stats: 2,
  attr: 3.5,
  level: 16,
  /** Recompensas: por membro derrubado e por impedir o rapto. */
  memberReward: { ryo: 300 } as Cost,
  stopReward: { ryo: 800 } as Cost,
  stopHonor: 3,
  /** Selo amaldiçoado: atributos a mais do ninja que passou para o lado deles (até o teto 10). */
  curse: 1.5,
  /** Eles matam até `maxKills` ninjas por invasão; daí em diante quem derrubam fica nocauteado `knockout` segundos. */
  maxKills: 4,
  knockout: 8,
  /** Roupa da vila do Som (bege com a corda roxa). */
  cloth: '#d8c8a0',
};

/** Os quatro que invadem (o líder fica no esconderijo). */
export const SOUND_RAIDERS: SoundId[] = ['iwao', 'kumomaru', 'kanade', 'sokon'];

export const SOUND_MEMBERS: Record<SoundId, SoundDef> = {
  iwao: { name: 'Iwao', title: 'o Muro', nature: 'doton', art: 'Cúpula de Terra', cd: 14, hpMult: 1.6, desc: 'Prende o alvo numa cúpula de terra: não se mexe e perde chakra.' },
  kumomaru: { name: 'Kumomaru', title: 'o Arqueiro de Seis Braços', nature: 'fuuton', art: 'Flecha Dourada', cd: 9, hpMult: 1.2, desc: 'Flecha de longe que fere muito e prende na teia.' },
  kanade: { name: 'Kanade', title: 'a Flautista', nature: 'fuuton', art: 'Melodia Demoníaca', cd: 15, hpMult: 1.2, desc: 'A flauta paralisa quem está por perto e chama dois ogros.' },
  sokon: { name: 'Sōkon', title: 'os Gêmeos', nature: 'katon', art: 'Separação', cd: 999, hpMult: 1.3, desc: 'Ferido, o irmão sai do corpo dele e luta junto.' },
  hakkotsu: { name: 'Hakkotsu', title: 'o Último do Clã dos Ossos', nature: 'doton', art: 'Sawarabi no Mai', cd: 8, hpMult: 3, desc: 'Uma floresta de ossos brota do chão em volta do alvo: fere e prende quem estiver ali.' },
};
