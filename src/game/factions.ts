import type { Faction, Unit } from './types';

/**
 * A vila é hostil a animais e renegados; animais e renegados não brigam entre si.
 * Convidados (ninjas de outras vilas no Exame Chunin) são neutros.
 */
export const isHostile = (a: Faction, b: Faction) =>
  a !== b && a !== 'guest' && b !== 'guest' && (a === 'village' || b === 'village');

/**
 * Regra única de alvo, usada por IA, projéteis e dano em área.
 * - Duelistas da arena (arenaSide 1/2) só atingem o adversário.
 * - Participantes do exame não são alvo de mais ninguém.
 */
export function canHit(faction: Faction, side: number | undefined, t: Unit): boolean {
  if (side) return !!t.arenaSide && t.arenaSide !== side;
  if (t.arenaSide != null) return false;
  if (t.cloak) return false; // espião invisível: ninguém mira nele até ser descoberto
  if (t.captiveOf != null) return false; // raptado sendo carregado
  return isHostile(faction, t.faction);
}
