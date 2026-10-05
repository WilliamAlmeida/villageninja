// Os Três Sannin: título lendário para até 3 Jounins, um por caminho (sapo, serpente, lesma). Cada caminho dá o
// contrato do animal e uma técnica lendária própria.
import type { Cost } from '../game/types';
import type { ContractKind } from './region';

export type SanninPath = ContractKind;

export const SANNIN = {
  minLevel: 20,
  /** Nível mínimo da vila (2 = Vila Oculta). */
  minVillage: 2,
  max: 3,
  /** Teto de atributo de um Sannin (igual ao do Kage). */
  statCap: 10,
  cost: { ryo: 4000, food: 200 } as Cost,
  /** Recarga da invocação do contrato de um Sannin (fração da normal). */
  summonCd: 0.6,
};

export interface SanninDef {
  title: string;
  art: string;
  shout: string;
  desc: string;
  color: string;
  cooldown: number;
}

export const SANNIN_PATHS: Record<SanninPath, SanninDef> = {
  toad: {
    title: 'Sannin dos Sapos', art: 'Modo Sábio', shout: 'Modo Sábio!', color: '#ff9a3b', cooldown: 45,
    desc: 'Junta a energia da natureza: por 15 s causa +40% de dano e anda 30% mais rápido.',
  },
  snake: {
    title: 'Sannin das Serpentes', art: 'Troca de Pele', shout: 'Troca de Pele!', color: '#9b6bff', cooldown: 120,
    desc: 'Um golpe que seria fatal vira uma troca de pele: volta com a vida cheia.',
  },
  slug: {
    title: 'Sannin das Lesmas', art: 'Selo da Força de Cem', shout: 'Byakugō!', color: '#7dff9a', cooldown: 40,
    desc: 'Com menos da metade da vida, libera o selo: cura a si mesmo e os aliados por perto em 50% da vida.',
  },
};

/** Modo Sábio: duração (s) e bônus. */
export const SAGE = { time: 15, damage: 1.4, speed: 1.3 };
/** Selo da Força de Cem: raio (px) e quanto cura (fração da vida máxima). */
export const HUNDRED = { range: 150, heal: 0.5 };
