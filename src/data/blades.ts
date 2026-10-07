// Lâminas lendárias: armas únicas no mundo, cada uma com o efeito do anime. Ficam no espaço de arma (equip.weapon) e
// aparecem no sprite de quem carrega (camada `layer-sword-<id>`). Uma vez conseguida, a lâmina nunca some: se quem a
// carregava cair, ela volta para o estoque (game/blades.ts).
//   - As sete dos Espadachins da Névoa (data/swordsmen.ts): uma por invasão, tomada do espadachim derrotado.
//   - Kusanagi: vem com o Sannin das Serpentes. Sete espadas: achadas ao explorar a Ilha Vulcânica.
//   - Sabre de Chakra, lâminas do Asuma e Raijin (só o Kage): forjadas na Forja nível 3.
import type { ItemDef } from './items';

export type BladeId =
  | 'zabuza' | 'samehada' | 'kiba' | 'hiramekarei' | 'nuibari' | 'kabutowari' | 'shibuki'
  | 'kusanagi' | 'sakumo' | 'asuma' | 'raijin' | 'bee';

/** Efeito em combate de cada lâmina (números em BLADE_FX). */
export const BLADE_FX = {
  /** Kubikiribōchō: cura essa fração do dano do golpe. */
  blood: 0.2,
  /** Samehada: chakra roubado por golpe (e cura essa fração do dano). */
  drain: 10, drainHeal: 0.08,
  /** Kiba: o raio pula para outro inimigo até `chainRange` px com essa fração do dano. */
  chain: 0.6, chainRange: 80,
  /** Hiramekarei: a cada `chargeCd` s o próximo golpe sai multiplicado, em área. */
  chargeCd: 8, charge: 2.5, chargeRadius: 45,
  /** Nuibari: costura quem está até `stitchRange` px do alvo (fração do dano) e prende o alvo; recarga. */
  stitch: 0.5, stitchRange: 45, stitchStun: 0.7, stitchCd: 6,
  /** Kabutowari: ignora a defesa do alvo e bate mais forte em chefes, escudos e no Corpo de Ferro. */
  breakBoss: 1.5,
  /** Shibuki: a cada `blastCd` s o golpe explode em área. */
  blastCd: 6, blast: 30, blastRadius: 55,
  /** Kusanagi: ignora metade da defesa e golpeia mais rápido. */
  pierce: 0.5, kusanagiSpeed: 0.8,
  /** Sabre de Chakra: anda mais rápido e golpeia mais rápido; o golpe quebra os selos. */
  flashMove: 1.12, flashSpeed: 0.9,
  /** Lâminas do Asuma: alcance extra do corpo a corpo e bônus para quem é Fuuton. */
  reach: 14, fuuton: 1.3,
  /** Raijin: raio no alvo a até `thunderRange` px a cada `thunderCd` s. */
  thunder: 45, thunderRange: 170, thunderCd: 5,
  /** Sete espadas: cada golpe acerta de novo com essa fração. */
  flurry: 0.5,
};

export interface BladeDef {
  name: string;
  /** O que faz, para a interface. */
  effect: string;
  /** De onde vem, para a interface. */
  source: string;
  melee: number;
  kunai?: number;
  color: string;
}

export const BLADES: Record<BladeId, BladeDef> = {
  zabuza: { name: 'Kubikiribōchō', melee: 16, color: '#cfd6dd', source: 'Espadachins da Névoa', effect: 'Se refaz com o sangue: cura 20% do dano de cada golpe.' },
  samehada: { name: 'Samehada', melee: 14, color: '#6a8aaa', source: 'Espadachins da Névoa', effect: 'Devora chakra: cada golpe rouba chakra do alvo e cura um pouco.' },
  kiba: { name: 'Kiba', melee: 12, color: '#9fd8ff', source: 'Espadachins da Névoa', effect: 'Espadas de raio: o golpe pula para um segundo inimigo por perto.' },
  hiramekarei: { name: 'Hiramekarei', melee: 13, color: '#e0dccc', source: 'Espadachins da Névoa', effect: 'Guarda chakra: a cada 8 s solta um golpe 2,5× mais forte em área.' },
  nuibari: { name: 'Nuibari', melee: 12, color: '#c0c0c8', source: 'Espadachins da Névoa', effect: 'Costura: o golpe atravessa quem está perto do alvo e o prende um instante.' },
  kabutowari: { name: 'Kabutowari', melee: 15, color: '#8a8a90', source: 'Espadachins da Névoa', effect: 'Quebra-elmos: ignora a defesa e bate 50% mais forte em chefes e escudos.' },
  shibuki: { name: 'Shibuki', melee: 12, color: '#e8dcb0', source: 'Espadachins da Névoa', effect: 'Papéis-bomba na lâmina: a cada 6 s o golpe explode em área.' },
  kusanagi: { name: 'Kusanagi', melee: 14, color: '#9b6bff', source: 'Vem com o Sannin das Serpentes', effect: 'Corta qualquer coisa: ignora metade da defesa e golpeia 20% mais rápido.' },
  sakumo: { name: 'Sabre de Chakra Branco', melee: 11, kunai: 3, color: '#e8e8e8', source: 'Forja nível 3', effect: 'Anda e golpeia mais rápido; o golpe quebra os selos do alvo.' },
  asuma: { name: 'Lâminas de Chakra', melee: 10, kunai: 4, color: '#9fe0c0', source: 'Forja nível 3', effect: 'Alcance maior no corpo a corpo e +30% de dano para quem é Fuuton.' },
  raijin: { name: 'Raijin no Ken', melee: 18, color: '#bfe6ff', source: 'Forja nível 3 (só o Kage)', effect: 'Espada do trovão: a cada 5 s um raio atinge o alvo de longe.' },
  bee: { name: 'Sete espadas', melee: 12, color: '#e8e8e8', source: 'Ilha Vulcânica (explorar)', effect: 'Estilo das sete espadas: cada golpe acerta duas vezes.' },
};

export const BLADE_IDS = Object.keys(BLADES) as BladeId[];
/** As sete dos Espadachins da Névoa. */
export const MIST_BLADES = ['zabuza', 'samehada', 'kiba', 'hiramekarei', 'nuibari', 'kabutowari', 'shibuki'] as const;
export type MistBlade = (typeof MIST_BLADES)[number];
export const bladeItem = (id: BladeId) => `blade-${id}`;

/** Receitas das que se forjam (Forja nível 3). */
const FORGED: Partial<Record<BladeId, Pick<ItemDef, 'cost' | 'craftTime'>>> = {
  sakumo: { cost: { crystal: 8, iron: 20, ryo: 600 }, craftTime: 90 },
  asuma: { cost: { darksteel: 6, crystal: 4, iron: 16, ryo: 500 }, craftTime: 90 },
  raijin: { cost: { darksteel: 10, crystal: 10, iron: 30, ryo: 1500 }, craftTime: 150 },
};

export const BLADE_ITEMS: ItemDef[] = BLADE_IDS.map((id) => {
  const d = BLADES[id];
  const f = FORGED[id];
  return {
    id: bladeItem(id), name: d.name, icon: '{swords}', slot: 'weapon', blade: id, kageOnly: id === 'raijin' || undefined,
    bonus: { melee: d.melee, kunai: d.kunai ?? 2 }, desc: `Lendária, única: +${d.melee} de dano corpo a corpo. ${d.effect}`,
    cost: f?.cost ?? {}, craftTime: f?.craftTime ?? 0, building: f ? 'forge' : undefined, minBuildingLevel: f ? 3 : undefined,
  };
});
