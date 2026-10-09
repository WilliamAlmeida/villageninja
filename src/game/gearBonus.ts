import { ITEMS, WEAR } from '../data/items';
import type { Unit } from './types';

const ZERO = { melee: 0, kunai: 0, defense: 0, hp: 0 };

export type GearSlot = 'weapon' | 'armor';
/** Estado de uma peça pelo desgaste: nova/boa, gasta (metade do bônus), quebrada (nada) ou cega (lâmina lendária em 0). */
export type WearStage = 'ok' | 'worn' | 'broken' | 'blunt';

/** Durabilidade da peça equipada (1 = nova, 0 = quebrada). */
export const duraOf = (u: Unit, slot: GearSlot) => u.ninja?.equip.dura?.[slot] ?? 1;

export function stageOf(itemId: string | null | undefined, dura: number): WearStage {
  const d = itemId ? ITEMS[itemId] : undefined;
  if (!d?.dura) return 'ok';
  if (dura <= 0) return d.blade ? 'blunt' : 'broken';
  return dura < WEAR.worn && !d.blade ? 'worn' : 'ok';
}
export const wearStage = (u: Unit, slot: GearSlot) => stageOf(u.ninja?.equip[slot], duraOf(u, slot));
const STAGE_MULT: Record<WearStage, number> = { ok: 1, worn: WEAR.wornMult, broken: 0, blunt: WEAR.blunt };

/** Soma dos bônus passivos de arma + colete, já com o desgaste (sem dependências, usado por entities e combate). */
export function gearBonus(u: Unit) {
  const e = u.ninja?.equip;
  if (!e) return ZERO;
  const out = { ...ZERO };
  for (const slot of ['weapon', 'armor'] as const) {
    const id = e[slot];
    const b = id ? ITEMS[id]?.bonus : undefined;
    if (!b) continue;
    const k = STAGE_MULT[wearStage(u, slot)];
    out.melee += Math.round((b.melee ?? 0) * k);
    out.kunai += Math.round((b.kunai ?? 0) * k);
    out.defense += (b.defense ?? 0) * k;
    out.hp += Math.round((b.hp ?? 0) * k);
  }
  return out;
}
