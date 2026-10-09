// Profissões ninja: especializações que um Chunin+ aprende num prédio próprio. Habilidade usada sozinha em combate
// (ver game/specs.ts). O invocador vem do contrato (data/contracts.ts), não daqui.
import type { BuildingType } from './buildings';
import type { Cost } from '../game/types';

export type SpecKind = 'medic' | 'spy' | 'puppeteer';

export interface SpecDef {
  name: string;
  icon: string;
  desc: string;
  /** Prédio que ensina (e nível mínimo dele). */
  building: BuildingType;
  buildingLevel?: number;
  cost: Cost;
}

export const SPECS: Record<SpecKind, SpecDef> = {
  medic: {
    name: 'Médico', icon: '{medic}', building: 'hospital', buildingLevel: 2, cost: { ryo: 150, herbs: 20 },
    desc: 'Em combate, cura o aliado mais ferido por perto a cada poucos segundos.',
  },
  spy: {
    name: 'Espião', icon: '{eye}', building: 'intel', cost: { ryo: 150, paper: 10 },
    desc: 'Descobre espiões invisíveis de longe e marca os inimigos por perto: todos causam +15% de dano neles.',
  },
  puppeteer: {
    name: 'Marionete', icon: '{target}', building: 'puppetshop', cost: { ryo: 150, wood: 80, iron: 10 },
    desc: 'Em combate, monta uma marionete de madeira que luta ao lado dele e aguenta muitos golpes.',
  },
};

/** Recargas e números das habilidades. */
export const SPEC = {
  healCd: 5, healRange: 140, healAmount: 0.25,
  spyReveal: 230, markRange: 160, markBonus: 1.15,
  puppetCd: 18, puppetLife: 25, puppetHp: 1.4,
};
