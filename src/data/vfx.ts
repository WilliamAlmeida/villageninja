// Estilo visual dos golpes (só desenho): diz que partículas o rastro, o impacto e os estados (atordoado, escudo)
// usam. Antes a natureza era adivinhada pela cor — água com rastro de fogo, Chidori espirrando água. Agora cada
// jutsu/arte tem o seu (`JutsuDef.vfx`; sem: o da natureza), e projéteis/efeitos/estados levam o estilo junto.
import type { Nature } from './natures';

export type Vfx =
  | 'fire' | 'water' | 'lightning' | 'earth' | 'wind'
  /** kekkei genkai: gelo, lava, calor, madeira, tempestade (Ranton) */
  | 'ice' | 'lava' | 'heat' | 'wood' | 'storm'
  /** proibidos e especiais */
  | 'dark' | 'blood' | 'needle' | 'leaf' | 'genjutsu'
  /** golpes e artes: impacto de taijutsu, metal (kunai, lâmina, Corpo de Ferro), ouro, som, osso, teia */
  | 'impact' | 'metal' | 'gold' | 'sound' | 'bone' | 'web';

export const NATURE_VFX: Record<Nature, Vfx> = { katon: 'fire', suiton: 'water', raiton: 'lightning', doton: 'earth', fuuton: 'wind' };

/** Estilo de um jutsu: o próprio, senão o da natureza, senão impacto (taijutsu) ou genjutsu. */
export function jutsuVfx(def: { vfx?: Vfx; nature: Nature | null; type: string }): Vfx | undefined {
  if (def.vfx) return def.vfx;
  if (def.nature) return NATURE_VFX[def.nature];
  if (def.type === 'taijutsu') return 'impact';
  if (def.type === 'genjutsu') return 'genjutsu';
  return undefined;
}
