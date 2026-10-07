// Máscaras da ANBU: o animal mostra o melhor atributo do ninja (camada `layer-mask-<animal>` no sprite).
import type { StatKey } from './ninja';

export const ANBU_MASKS: Record<StatKey, string> = {
  ninjutsu: 'fox', taijutsu: 'tiger', genjutsu: 'crow', inteligencia: 'owl', forca: 'boar', velocidade: 'hawk', stamina: 'bear', selos: 'monkey',
};
export const MASK_NAMES: Record<string, string> = {
  fox: 'Raposa', tiger: 'Tigre', crow: 'Corvo', owl: 'Coruja', boar: 'Javali', hawk: 'Falcão', bear: 'Urso', monkey: 'Macaco',
};

/** Atributo que a máscara representa: o maior (empate: o primeiro da lista). */
export function maskStat(stats?: Partial<Record<string, number>>): StatKey {
  let best: StatKey = 'ninjutsu';
  if (stats) for (const k of Object.keys(ANBU_MASKS) as StatKey[]) if ((stats[k] ?? 0) > (stats[best] ?? 0)) best = k;
  return best;
}
export const anbuMask = (stats?: Partial<Record<string, number>>) => ANBU_MASKS[maskStat(stats)];
export const MASK_LIST = Object.values(ANBU_MASKS);
/** Atributo que o animal representa. */
export const maskKey = (animal: string) => (Object.keys(ANBU_MASKS) as StatKey[]).find((k) => ANBU_MASKS[k] === animal) ?? 'ninjutsu';
