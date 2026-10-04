import type { Faction } from './types';

/** A vila é hostil a todos; animais e renegados não brigam entre si. */
export const isHostile = (a: Faction, b: Faction) => a !== b && (a === 'village' || b === 'village');
