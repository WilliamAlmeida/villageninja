// Renegados com função especial: aparecem nas invasões junto com os comuns.

export type RogueRole = 'bomber' | 'medic';

export interface RogueRoleDef {
  name: string;
  /** Explicação para o painel do inimigo. */
  desc: string;
  /** Dia a partir do qual pode vir numa invasão. */
  minDay: number;
}

export const ROGUE_ROLES: Record<RogueRole, RogueRoleDef> = {
  bomber: {
    name: 'Bombardeiro',
    desc: 'Lança papéis-bomba nos prédios: o prédio atingido para de funcionar até os moradores reconstruírem. Derrube-o primeiro.',
    minDay: 5,
  },
  medic: {
    name: 'Médico renegado',
    desc: 'Fica atrás do grupo e cura os outros invasores. Enquanto ele estiver de pé, a invasão demora a cair.',
    minDay: 7,
  },
};

/** Bombardeiro: alcance do arremesso, recarga, bombas por invasão e quanto da obra o prédio perde. */
export const BOMB = { range: 95, cd: 4.5, max: 3, damage: 0.5, radius: 46, unitDmg: 14 };
/** Médico: alcance da cura, recarga e quanto cura (fração da vida máxima). */
export const HEAL = { range: 150, cd: 4, amount: 0.3 };
