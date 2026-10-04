import { ITEMS } from '../data/items';
import type { Unit } from './types';

const ZERO = { melee: 0, kunai: 0, defense: 0, hp: 0 };

/** Soma dos bônus passivos de arma + colete (sem dependências, usado por entities e combate). */
export function gearBonus(u: Unit) {
  const e = u.ninja?.equip;
  if (!e) return ZERO;
  const out = { ...ZERO };
  for (const id of [e.weapon, e.armor]) {
    const b = id ? ITEMS[id]?.bonus : undefined;
    if (!b) continue;
    out.melee += b.melee ?? 0;
    out.kunai += b.kunai ?? 0;
    out.defense += b.defense ?? 0;
    out.hp += b.hp ?? 0;
  }
  return out;
}
