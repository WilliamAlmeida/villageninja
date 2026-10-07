import type { Cost, ProjectileKind } from '../game/types';
import type { Nature } from './natures';
import type { KekkeiId } from './kekkei';
import type { StatKey, Stats } from './ninja';
import type { Vfx } from './vfx';

export type JutsuType = 'ninjutsu' | 'taijutsu' | 'genjutsu' | 'iryo';
export type JutsuEffect =
  | 'projectile' // um projétil (opcionalmente explode em área)
  | 'multi' // vários projéteis em leque
  | 'aoe' // explosão instantânea no alvo, com empurrão
  | 'dash' // investida até o alvo
  | 'melee' // golpe corpo a corpo forte
  | 'stun' // paralisa (genjutsu)
  | 'clone' // invoca clones temporários
  | 'heal' // cura um aliado
  | 'shield' // reduz dano recebido
  | 'bind'; // dano + prende o alvo (Mokuton)

export interface JutsuDef {
  id: string;
  name: string;
  /** Grito exibido em cima do ninja ao usar. */
  shout: string;
  desc: string;
  nature: Nature | null;
  /** Só quem tem esta kekkei genkai pode aprender. */
  kekkei?: KekkeiId;
  type: JutsuType;
  /** 0=E 1=D 2=C 3=B 4=A 5=S */
  rank: number;
  chakra: number;
  cooldown: number;
  range: number;
  power: number;
  effect: JutsuEffect;
  radius?: number;
  count?: number;
  duration?: number;
  stun?: number;
  projSpeed?: number;
  projKind?: ProjectileKind;
  color: string;
  /** Atributos mínimos para aprender. */
  req: Partial<Record<StatKey, number>>;
  cost: Cost;
  /** Segundos de estudo na Academia (antes do bônus de inteligência). */
  learnTime: number;
  /** Jutsu proibido: só aparece depois de achar o pergaminho nas ruínas e pode deixar sequela ao aprender. */
  forbidden?: boolean;
  /** Estilo visual (rastro, impacto, estado). Sem: o da natureza (`jutsuVfx`). */
  vfx?: Vfx;
}

/** Chance de o ninja ficar com sequela (perde Stamina) ao terminar de aprender um jutsu proibido. */
export const FORBIDDEN_RISK = 0.35;

const LIST: JutsuDef[] = [
  {
    id: 'housenka', name: 'Katon: Housenka no Jutsu', shout: 'Housenka!', desc: 'Leque de pequenas chamas.',
    nature: 'katon', type: 'ninjutsu', rank: 1, chakra: 16, cooldown: 5, range: 140, power: 9, effect: 'multi',
    count: 5, projSpeed: 260, projKind: 'orb', color: '#ff9a3b', req: { ninjutsu: 2, selos: 2 }, cost: { ryo: 50 }, learnTime: 18,
  },
  {
    id: 'goukakyuu', name: 'Katon: Goukakyuu no Jutsu', shout: 'Goukakyuu no Jutsu!', desc: 'Bola de fogo gigante que explode em área.',
    nature: 'katon', type: 'ninjutsu', rank: 2, chakra: 22, cooldown: 6, range: 150, power: 24, effect: 'projectile',
    radius: 42, projSpeed: 230, projKind: 'orb', color: '#ff6a2b', req: { ninjutsu: 3 }, cost: { ryo: 80 }, learnTime: 25,
  },
  {
    id: 'mizurappa', name: 'Suiton: Mizurappa', shout: 'Mizurappa!', desc: 'Jato de água concentrado.',
    nature: 'suiton', type: 'ninjutsu', rank: 1, chakra: 12, cooldown: 4, range: 135, power: 15, effect: 'projectile',
    projSpeed: 280, projKind: 'jet', color: '#4da6ff', req: { ninjutsu: 2 }, cost: { ryo: 45 }, learnTime: 16,
  },
  {
    id: 'suiryuudan', name: 'Suiton: Suiryuudan no Jutsu', shout: 'Suiryuudan no Jutsu!', desc: 'Dragão de água devastador em área.',
    nature: 'suiton', type: 'ninjutsu', rank: 3, chakra: 38, cooldown: 10, range: 175, power: 40, effect: 'projectile',
    radius: 48, projSpeed: 200, projKind: 'dragon', color: '#3d8bff', req: { ninjutsu: 5, selos: 5 }, cost: { ryo: 180 }, learnTime: 40,
  },
  {
    id: 'daitoppa', name: 'Fuuton: Daitoppa', shout: 'Daitoppa!', desc: 'Rajada de vento que fere e empurra.',
    nature: 'fuuton', type: 'ninjutsu', rank: 2, chakra: 20, cooldown: 7, range: 110, power: 18, effect: 'aoe',
    radius: 60, color: '#9ff0c0', req: { ninjutsu: 3 }, cost: { ryo: 80 }, learnTime: 24,
  },
  {
    id: 'shinkuuha', name: 'Fuuton: Shinkuu Ha', shout: 'Shinkuu Ha!', desc: 'Lâminas de vento rápidas e cortantes.',
    nature: 'fuuton', type: 'ninjutsu', rank: 3, chakra: 26, cooldown: 6, range: 160, power: 15, effect: 'multi',
    count: 3, projSpeed: 340, projKind: 'blade', color: '#7fe0a0', req: { ninjutsu: 4, velocidade: 4 }, cost: { ryo: 150 }, learnTime: 34,
  },
  {
    id: 'doryuuheki', name: 'Doton: Doryuuheki', shout: 'Doryuuheki!', desc: 'Muralha de terra: reduz muito o dano recebido.',
    nature: 'doton', type: 'ninjutsu', rank: 1, chakra: 14, cooldown: 14, range: 0, power: 0, effect: 'shield',
    duration: 6, color: '#a87b45', req: { ninjutsu: 2, stamina: 2 }, cost: { ryo: 50 }, learnTime: 18,
  },
  {
    id: 'doryuudan', name: 'Doton: Doryuudan', shout: 'Doryuudan!', desc: 'Projétil de lama e rocha em área.',
    nature: 'doton', type: 'ninjutsu', rank: 2, chakra: 20, cooldown: 6, range: 150, power: 26, effect: 'projectile',
    radius: 30, projSpeed: 210, projKind: 'rock', color: '#b0844d', req: { ninjutsu: 3, forca: 2 }, cost: { ryo: 80 }, learnTime: 24,
  },
  {
    id: 'raikyuu', name: 'Raiton: Raikyuu', shout: 'Raikyuu!', desc: 'Esfera elétrica que paralisa por um instante.',
    nature: 'raiton', type: 'ninjutsu', rank: 1, chakra: 14, cooldown: 5, range: 140, power: 12, effect: 'projectile',
    stun: 0.8, projSpeed: 300, projKind: 'spark', color: '#ffe14d', req: { ninjutsu: 2 }, cost: { ryo: 50 }, learnTime: 18,
  },
  {
    id: 'chidori', name: 'Raiton: Chidori', shout: 'Chidori!', desc: 'Investida relâmpago de altíssimo dano.',
    nature: 'raiton', type: 'ninjutsu', rank: 4, chakra: 45, cooldown: 12, range: 150, power: 58, effect: 'dash',
    color: '#9fd8ff', req: { ninjutsu: 6, velocidade: 6 }, cost: { ryo: 320 }, learnTime: 60,
  },
  {
    id: 'senpuu', name: 'Konoha Senpuu', shout: 'Konoha Senpuu!', desc: 'Chute giratório de taijutsu.',
    nature: null, type: 'taijutsu', rank: 1, chakra: 6, cooldown: 3.5, range: 28, power: 16, effect: 'melee',
    color: '#ffb067', req: { taijutsu: 3 }, cost: { ryo: 40 }, learnTime: 15,
  },
  {
    id: 'narakumi', name: 'Magen: Narakumi no Jutsu', shout: 'Magen: Narakumi!', desc: 'Ilusão aterrorizante que paralisa o alvo.',
    nature: null, type: 'genjutsu', rank: 2, chakra: 18, cooldown: 10, range: 130, power: 0, effect: 'stun',
    duration: 3, color: '#b36bff', req: { genjutsu: 4 }, cost: { ryo: 90 }, learnTime: 28, vfx: 'leaf',
  },
  {
    id: 'kagebunshin', name: 'Kage Bunshin no Jutsu', shout: 'Kage Bunshin no Jutsu!', desc: 'Clones sólidos que lutam ao seu lado.',
    nature: null, type: 'ninjutsu', rank: 3, chakra: 40, cooldown: 22, range: 200, power: 0, effect: 'clone',
    count: 2, duration: 12, color: '#ffffff', req: { ninjutsu: 4, stamina: 5 }, cost: { ryo: 200 }, learnTime: 45,
  },
  {
    id: 'shousen', name: 'Shousen no Jutsu', shout: 'Shousen no Jutsu!', desc: 'Ninjutsu médico: cura um aliado ferido.',
    nature: null, type: 'iryo', rank: 3, chakra: 24, cooldown: 6, range: 110, power: 30, effect: 'heal',
    color: '#7dff9a', req: { ninjutsu: 4, inteligencia: 5 }, cost: { ryo: 160 }, learnTime: 38,
  },
  // ---- kekkei genkai (exclusivos)
  {
    id: 'sensatsu', name: 'Hyōton: Sensatsu Suishō', shout: 'Sensatsu Suishō!', desc: 'Agulhas de gelo em leque que congelam por instantes.',
    nature: null, kekkei: 'hyoton', type: 'ninjutsu', rank: 2, chakra: 22, cooldown: 6, range: 150, power: 11, effect: 'multi',
    count: 6, stun: 0.5, projSpeed: 320, projKind: 'shard', color: '#9fe8ff', req: { ninjutsu: 3 }, cost: { ryo: 120 }, learnTime: 30, vfx: 'ice',
  },
  {
    id: 'jukai', name: 'Mokuton: Jukai Kōtan', shout: 'Jukai Kōtan!', desc: 'Raízes gigantes prendem e esmagam o alvo.',
    nature: null, kekkei: 'mokuton', type: 'ninjutsu', rank: 3, chakra: 30, cooldown: 10, range: 150, power: 22, effect: 'bind',
    duration: 2.5, color: '#8fcf6a', req: { ninjutsu: 4 }, cost: { ryo: 180 }, learnTime: 40, vfx: 'wood',
  },
  {
    id: 'yokai', name: 'Yōton: Yōkai no Jutsu', shout: 'Yōkai no Jutsu!', desc: 'Lava ardente que explode numa área enorme.',
    nature: null, kekkei: 'yoton', type: 'ninjutsu', rank: 3, chakra: 34, cooldown: 9, range: 160, power: 36, effect: 'projectile',
    radius: 56, projSpeed: 190, projKind: 'rock', color: '#ff5a1f', req: { ninjutsu: 4 }, cost: { ryo: 180 }, learnTime: 40, vfx: 'lava',
  },
  {
    id: 'reiza', name: 'Ranton: Reiza Sākasu', shout: 'Reiza Sākasu!', desc: 'Feixes de tempestade velozes que paralisam.',
    nature: null, kekkei: 'ranton', type: 'ninjutsu', rank: 3, chakra: 28, cooldown: 7, range: 170, power: 15, effect: 'multi',
    count: 4, stun: 0.35, projSpeed: 380, projKind: 'spark', color: '#c8a6ff', req: { ninjutsu: 4 }, cost: { ryo: 180 }, learnTime: 40, vfx: 'storm',
  },
  {
    id: 'kajosatsu', name: 'Shakuton: Kajōsatsu', shout: 'Kajōsatsu!', desc: 'Esferas de calor que queimam tudo ao redor do alvo.',
    nature: null, kekkei: 'shakuton', type: 'ninjutsu', rank: 3, chakra: 30, cooldown: 8, range: 130, power: 30, effect: 'aoe',
    radius: 70, color: '#ffb347', req: { ninjutsu: 4 }, cost: { ryo: 180 }, learnTime: 40, vfx: 'heat',
  },
  // ---- proibidos (pergaminhos achados nas ruínas)
  {
    id: 'kuroduki', name: 'Kinjutsu: Lua Negra', shout: 'Lua Negra!', desc: 'Ilusão proibida: mergulha o alvo num pesadelo que o paralisa por muito tempo.',
    nature: null, type: 'genjutsu', rank: 3, chakra: 38, cooldown: 14, range: 160, power: 0, effect: 'stun', forbidden: true,
    duration: 5.5, color: '#8a4ad0', req: { genjutsu: 4 }, cost: { ryo: 220, paper: 6 }, learnTime: 50, vfx: 'dark',
  },
  {
    id: 'chisoku', name: 'Kinjutsu: Passo de Sangue', shout: 'Passo de Sangue!', desc: 'Força o corpo além do limite numa investida brutal.',
    nature: null, type: 'taijutsu', rank: 4, chakra: 30, cooldown: 11, range: 160, power: 62, effect: 'dash', forbidden: true,
    color: '#c0182b', req: { taijutsu: 5, velocidade: 4 }, cost: { ryo: 280, herbs: 10 }, learnTime: 55, vfx: 'blood',
  },
  {
    id: 'senbari', name: 'Kinjutsu: Mil Agulhas', shout: 'Mil Agulhas!', desc: 'Chuva de agulhas de chakra que cobre uma área inteira.',
    nature: null, type: 'ninjutsu', rank: 4, chakra: 46, cooldown: 12, range: 170, power: 13, effect: 'multi', forbidden: true,
    count: 10, projSpeed: 380, projKind: 'needle', color: '#d9d9ff', req: { ninjutsu: 5, selos: 4 }, cost: { ryo: 300, paper: 10 }, learnTime: 60, vfx: 'needle',
  },
];

export const JUTSUS: Record<string, JutsuDef> = Object.fromEntries(LIST.map((j) => [j.id, j]));
export const JUTSU_LIST: readonly JutsuDef[] = LIST;

export const JUTSU_TYPE_LABEL: Record<JutsuType, string> = {
  ninjutsu: 'Ninjutsu',
  taijutsu: 'Taijutsu',
  genjutsu: 'Genjutsu',
  iryo: 'Iryō Ninjutsu',
};

export function jutsuPower(def: JutsuDef, s: Stats): number {
  switch (def.type) {
    case 'taijutsu':
      return def.power * (0.6 + s.taijutsu * 0.1 + s.forca * 0.05);
    case 'genjutsu':
      return def.power * (0.6 + s.genjutsu * 0.1);
    case 'iryo':
      return def.power * (0.6 + s.ninjutsu * 0.05 + s.inteligencia * 0.08);
    default:
      return def.power * (0.6 + s.ninjutsu * 0.1);
  }
}
export const jutsuDuration = (def: JutsuDef, s: Stats) =>
  (def.duration ?? 0) * (def.type === 'genjutsu' ? 0.7 + s.genjutsu * 0.08 : 1);
export const jutsuCooldown = (def: JutsuDef, s: Stats) => def.cooldown * Math.max(0.55, 1.15 - s.selos * 0.05);
export const jutsuChakra = (def: JutsuDef, s: Stats) => Math.round(def.chakra * Math.max(0.6, 1.1 - s.inteligencia * 0.04));
export const isRangedJutsu = (def: JutsuDef) =>
  def.effect === 'projectile' || def.effect === 'multi' || def.effect === 'aoe' || def.effect === 'stun' || def.effect === 'dash' || def.effect === 'bind';
