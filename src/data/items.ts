import type { Cost } from '../game/types';
import type { BuildingType } from './buildings';

export type ItemSlot = 'weapon' | 'armor' | 'item';

export interface ItemDef {
  id: string;
  name: string;
  icon: string;
  slot: ItemSlot;
  desc: string;
  cost: Cost;
  /** Segundos de trabalho na oficina. */
  craftTime: number;
  building: BuildingType;
  minLevel?: number;
  /** Bônus passivos de armas e coletes. */
  bonus?: { melee?: number; kunai?: number; defense?: number; hp?: number };
  /** Efeito de consumível (usado sozinho em combate). */
  use?: { kind: 'heal' | 'chakra' | 'bomb'; amount: number; radius?: number };
}

const LIST: ItemDef[] = [
  {
    id: 'kunai', name: 'Kunais afiadas', icon: '{kunai}', slot: 'weapon', building: 'forge', craftTime: 20,
    cost: { iron: 6, wood: 4 }, bonus: { melee: 3, kunai: 3 }, desc: '+3 de dano corpo a corpo e +3 nas kunais.',
  },
  {
    id: 'ninjato', name: 'Ninjatō', icon: '{swords}', slot: 'weapon', building: 'forge', craftTime: 35, minLevel: 2,
    cost: { iron: 15, wood: 6 }, bonus: { melee: 7, kunai: 2 }, desc: 'Espada ninja: +7 de dano corpo a corpo.',
  },
  {
    id: 'vest', name: 'Colete leve', icon: '{vest}', slot: 'armor', building: 'forge', craftTime: 25,
    cost: { iron: 6, wood: 10 }, bonus: { defense: 0.08, hp: 15 }, desc: '+15 de vida e 8% menos dano recebido.',
  },
  {
    id: 'flakvest', name: 'Colete tático', icon: '{shield}', slot: 'armor', building: 'forge', craftTime: 40, minLevel: 2,
    cost: { iron: 18, wood: 10 }, bonus: { defense: 0.15, hp: 30 }, desc: '+30 de vida e 15% menos dano recebido.',
  },
  {
    id: 'soldierpill', name: 'Pílula de soldado', icon: '{pill}', slot: 'item', building: 'pharmacy', craftTime: 15,
    cost: { herbs: 4 }, use: { kind: 'heal', amount: 0.45 }, desc: 'Recupera 45% da vida quando o ninja está quase caindo.',
  },
  {
    id: 'chakrapill', name: 'Pílula de chakra', icon: '{drop}', slot: 'item', building: 'pharmacy', craftTime: 15,
    cost: { herbs: 5 }, use: { kind: 'chakra', amount: 0.6 }, desc: 'Recupera 60% do chakra quando ele acaba.',
  },
  {
    id: 'bombtag', name: 'Papel-bomba', icon: '{bomb}', slot: 'item', building: 'sealshop', craftTime: 20,
    cost: { paper: 2, iron: 1 }, use: { kind: 'bomb', amount: 38, radius: 52 }, desc: 'Kunai com selo explosivo: 38 de dano em área.',
  },
  // ---- lendários: materiais raros das minas
  {
    id: 'blackblade', name: 'Lâmina de aço negro', icon: '{darksteel}', slot: 'weapon', building: 'forge', craftTime: 60, minLevel: 2,
    cost: { darksteel: 6, iron: 10 }, bonus: { melee: 13, kunai: 4 }, desc: 'Lendária: +13 de dano corpo a corpo e +4 nas kunais.',
  },
  {
    id: 'crystalvest', name: 'Colete de cristal', icon: '{crystal}', slot: 'armor', building: 'forge', craftTime: 60, minLevel: 2,
    cost: { crystal: 6, iron: 8 }, bonus: { defense: 0.22, hp: 50 }, desc: 'Lendário: +50 de vida e 22% menos dano recebido.',
  },
  {
    id: 'chakracrystal', name: 'Cristal de chakra', icon: '{crystal}', slot: 'item', building: 'pharmacy', craftTime: 25,
    cost: { crystal: 2, herbs: 3 }, use: { kind: 'chakra', amount: 1 }, desc: 'Recupera todo o chakra quando ele acaba.',
  },
];

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(LIST.map((i) => [i.id, i]));
export const ITEM_LIST: readonly ItemDef[] = LIST;
export const SLOT_LABEL: Record<ItemSlot, string> = { weapon: 'Arma', armor: 'Colete', item: 'Consumível' };
/** Fila máxima de fabricação por oficina. */
export const MAX_QUEUE = 5;
