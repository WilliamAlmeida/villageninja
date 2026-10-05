// Renegados com função especial: aparecem nas invasões junto com os comuns.

export type RogueRole = 'bomber' | 'medic' | 'spy' | 'puppeteer' | 'summoner' | 'puppet';

export interface RogueRoleDef {
  name: string;
  /** Explicação para o painel do inimigo. */
  desc: string;
  /** Dia a partir do qual pode vir numa invasão (Infinity = só criado por outro, ex.: a marionete). */
  minDay: number;
  /** Ícone da marca no painel. */
  icon: string;
}

export const ROGUE_ROLES: Record<RogueRole, RogueRoleDef> = {
  bomber: {
    name: 'Bombardeiro', icon: '{bomb}', minDay: 5,
    desc: 'Lança papéis-bomba nos prédios: o prédio atingido para de funcionar até os moradores reconstruírem. Derrube-o primeiro.',
  },
  medic: {
    name: 'Médico renegado', icon: '{medic}', minDay: 7,
    desc: 'Fica atrás do grupo e cura os outros invasores. Enquanto ele estiver de pé, a invasão demora a cair.',
  },
  spy: {
    name: 'Espião', icon: '{eye}', minDay: 9,
    desc: 'Invisível com genjutsu: ninguém consegue atacá-lo até ser descoberto perto de uma torre ou de um ninja com Inteligência alta. Sabota um prédio e foge.',
  },
  puppeteer: {
    name: 'Marionetista', icon: '{target}', minDay: 11,
    desc: 'Luta de longe controlando marionetes de madeira que aguentam muitos golpes. Derrubar o marionetista desfaz as marionetes.',
  },
  summoner: {
    name: 'Invocador', icon: '{scroll}', minDay: 13,
    desc: 'No meio da luta invoca lobos que somem depois de um tempo. Quanto antes cair, menos invocações.',
  },
  puppet: {
    name: 'Marionete', icon: '{target}', minDay: Infinity,
    desc: 'Boneco de madeira controlado por um marionetista: aguenta muito, mas desmonta se o dono cair.',
  },
};

/** Bombardeiro: alcance do arremesso, recarga, bombas por invasão e quanto da obra o prédio perde. */
export const BOMB = { range: 95, cd: 4.5, max: 3, damage: 0.5, radius: 46, unitDmg: 14 };
/** Médico: alcance da cura, recarga e quanto cura (fração da vida máxima). */
export const HEAL = { range: 150, cd: 4, amount: 0.3 };
/** Espião: distância em que torre / ninja esperto o descobrem, Inteligência mínima e segundos para sabotar. */
export const SPY = { towerRange: 170, ninjaRange: 110, minInt: 4, sabotage: 5, damage: 0.35 };
/** Marionetista: marionetes vivas ao mesmo tempo, recarga, vida (× a do dono) e distância que mantém do alvo. */
export const PUPPET = { max: 2, cd: 14, hpMult: 1.6, keepAway: 110 };
/** Invocador: quantos lobos por invocação, recarga e quanto tempo duram. */
export const SUMMON = { count: 2, cd: 16, life: 25 };
