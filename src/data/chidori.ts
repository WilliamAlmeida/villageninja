// Etapas compartilhadas entre a simulação e o desenho do Chidori.
export const CHIDORI_CHARGE = .65;
export const CHIDORI_DASH_TIME = CHIDORI_CHARGE + 1;
export function chidoriAge(remaining:number) { return Math.max(0,CHIDORI_DASH_TIME-remaining); }