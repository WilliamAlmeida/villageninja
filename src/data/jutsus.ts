import type { Cost, ProjectileKind } from '../game/types';
import type { Nature } from './natures';
import type { KekkeiId } from './kekkei';
import type { StatKey, Stats } from './ninja';
import type { Vfx } from './vfx';
import type { JutsuMove } from './moves';
import type { ModeKind } from './bijuu';

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
  | 'bind' // dano + prende o alvo (Mokuton)
  | 'mode'; // veste um modo de combate (Oito Portões, manto de Raiton; game/modes.ts)

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
  /** Tamanho do projétil (sem: 9 com área, 6 sem). */
  projSize?: number;
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
  /**
   * Coreografia do golpe no ninja em camadas (só desenho, data/moves.ts): quadros das folhas de pose em sequência, com
   * altura (salto) e giro. Taijutsu: toca ao acertar; investida: o 1º passo na corrida, a coreografia ao chegar;
   * projétil/área: ao soltar.
   */
  moves?: JutsuMove[];
  /** Investida: ao chegar, o golpe pega todos em volta neste raio (calcanhar da Tsunade, Ōkashō, Nikudan Sensha). */
  dashRadius?: number;
  /** Corpo a corpo/investida: o alvo é lançado ao alto (reação `hurt-launch`) e fica atordoado `stun` s. */
  launch?: boolean;
  /** Efeito 'mode': qual modo veste. */
  mode?: ModeKind;
  /** Esfera de chakra na mão durante a investida (Rasengan): a cor dela. */
  handOrb?: string;
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
    // a mão do raio cravada no alvo e recupera
    moves: [['strike', 2, 0.3], ['strike', 3, 0.15]],
  },
  {
    id: 'senpuu', name: 'Konoha Senpuu', shout: 'Konoha Senpuu!', desc: 'Chute giratório de taijutsu.',
    nature: null, type: 'taijutsu', rank: 1, chakra: 6, cooldown: 3.5, range: 28, power: 16, effect: 'melee',
    // chute giratório do Rock Lee: prepara, chute alto, rasteiro e volta à guarda
    moves: [['kick', 0, 0.1], ['kick', 1, 0.16], ['kick', 2, 0.16], ['kick', 3, 0.12]],
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
    // chega com um chute alto voador e cai na guarda
    moves: [['kick', 1, 0.3], ['kick', 3, 0.15]],
  },
  {
    id: 'senbari', name: 'Kinjutsu: Mil Agulhas', shout: 'Mil Agulhas!', desc: 'Chuva de agulhas de chakra que cobre uma área inteira.',
    nature: null, type: 'ninjutsu', rank: 4, chakra: 46, cooldown: 12, range: 170, power: 13, effect: 'multi', forbidden: true,
    count: 10, projSpeed: 380, projKind: 'needle', color: '#d9d9ff', req: { ninjutsu: 5, selos: 4 }, cost: { ryo: 300, paper: 10 }, learnTime: 60, vfx: 'needle',
  },
  // ---- taijutsu do anime (coreografias com as folhas de soco, chute, no ar e selos; ver docs/taijutsu.md)
  {
    id: 'reppuu', name: 'Konoha Reppuu', shout: 'Konoha Reppuu!', desc: 'Rasteira giratória que derruba o alvo.',
    nature: null, type: 'taijutsu', rank: 0, chakra: 4, cooldown: 3, range: 26, power: 10, effect: 'melee', stun: 0.6,
    moves: [['kick', 0, 0.08], ['kick', 2, 0.22], ['kick', 3, 0.12]],
    color: '#ffb067', req: { taijutsu: 2 }, cost: { ryo: 30 }, learnTime: 12,
  },
  {
    id: 'shofu', name: 'Konoha Shōfū', shout: 'Konoha Shōfū!', desc: 'Chute de baixo para cima que lança o alvo ao alto.',
    nature: null, type: 'taijutsu', rank: 1, chakra: 8, cooldown: 4.5, range: 26, power: 18, effect: 'melee', stun: 0.9, launch: true,
    moves: [['kick', 2, 0.1], ['kick', 1, 0.22, 4], ['kick', 3, 0.14]],
    color: '#ffb067', req: { taijutsu: 3, forca: 2 }, cost: { ryo: 60 }, learnTime: 18,
  },
  {
    id: 'daisenpuu', name: 'Konoha Daisenpuu', shout: 'Konoha Daisenpuu!', desc: 'Furacão de chutes girando que acerta todos em volta.',
    nature: null, type: 'taijutsu', rank: 2, chakra: 14, cooldown: 7, range: 34, power: 20, effect: 'aoe', radius: 40, vfx: 'impact',
    moves: [['kick', 1, 0.12, 0, 'spin'], ['kick', 2, 0.12, 0, 'spin'], ['kick', 1, 0.12, 0, 'spin'], ['kick', 2, 0.12, 0, 'spin'], ['kick', 3, 0.12]],
    color: '#ffb067', req: { taijutsu: 4, velocidade: 3 }, cost: { ryo: 110 }, learnTime: 28,
  },
  {
    id: 'dynamic', name: 'Dainamikku Entorī', shout: 'Dynamic Entry!', desc: 'Entra voando com um chute no alvo.',
    nature: null, type: 'taijutsu', rank: 2, chakra: 12, cooldown: 7, range: 140, power: 26, effect: 'dash',
    moves: [['air', 2, 0.2, 9], ['air', 3, 0.2]],
    color: '#5fbf5f', req: { taijutsu: 4, velocidade: 3 }, cost: { ryo: 120 }, learnTime: 30,
  },
  {
    id: 'shishi', name: 'Shishi Rendan', shout: 'Shishi Rendan!', desc: 'Lança o alvo ao alto e termina o combo com o calcanhar.',
    nature: null, type: 'taijutsu', rank: 3, chakra: 18, cooldown: 8, range: 28, power: 34, effect: 'melee', stun: 1, launch: true,
    moves: [['kick', 2, 0.1], ['air', 1, 0.16, 14], ['kick', 1, 0.16, 18], ['air', 2, 0.18, 10], ['air', 3, 0.16]],
    color: '#6a8cff', req: { taijutsu: 5, velocidade: 4 }, cost: { ryo: 180 }, learnTime: 40,
  },
  {
    id: 'okasho', name: 'Ōkashō', shout: 'Shannaro!', desc: 'Soco no chão que racha a terra e acerta todos em volta.',
    nature: null, type: 'taijutsu', rank: 3, chakra: 20, cooldown: 9, range: 120, power: 36, effect: 'dash', dashRadius: 46, stun: 0.5, vfx: 'earth',
    moves: [['strike', 0, 0.12], ['strike', 2, 0.3], ['strike', 3, 0.14]],
    color: '#ff8fb0', req: { taijutsu: 4, forca: 5 }, cost: { ryo: 200 }, learnTime: 42,
  },
  {
    id: 'tsutenkyaku', name: 'Tsūtenkyaku', shout: 'Tsūtenkyaku!', desc: 'Salta e desce o calcanhar rachando o chão em volta.',
    nature: null, type: 'taijutsu', rank: 4, chakra: 28, cooldown: 11, range: 130, power: 46, effect: 'dash', dashRadius: 54, stun: 0.7, vfx: 'earth',
    moves: [['air', 1, 0.18, 16], ['kick', 1, 0.16, 12], ['air', 3, 0.28]],
    color: '#ff8fb0', req: { taijutsu: 6, forca: 6 }, cost: { ryo: 320 }, learnTime: 58,
  },
  {
    id: 'omoterenge', name: 'Omote Renge', shout: 'Omote Renge!', desc: 'Chuta o alvo para o alto, agarra e crava de cabeça no chão.',
    nature: null, type: 'taijutsu', rank: 4, chakra: 30, cooldown: 12, range: 28, power: 52, effect: 'melee', stun: 1.4, launch: true,
    moves: [['kick', 2, 0.1], ['air', 1, 0.24, 20], ['air', 2, 0.24, 12], ['air', 3, 0.24]],
    color: '#5fbf5f', req: { taijutsu: 6, velocidade: 5, stamina: 5 }, cost: { ryo: 340 }, learnTime: 60,
  },
  {
    id: 'urarenge', name: 'Kinjutsu: Ura Renge', shout: 'Ura Renge!', desc: 'Abre os portões e despeja golpes rápidos demais para os olhos.',
    nature: null, type: 'taijutsu', rank: 5, chakra: 40, cooldown: 16, range: 120, power: 76, effect: 'dash', forbidden: true, stun: 1, launch: true, vfx: 'blood',
    moves: [['strike', 1, 0.06, 6], ['strike', 2, 0.06, 6], ['strike', 1, 0.06, 10], ['strike', 2, 0.06, 10], ['kick', 1, 0.16, 12], ['air', 3, 0.22]],
    color: '#c0182b', req: { taijutsu: 7, velocidade: 7, stamina: 6 }, cost: { ryo: 420, herbs: 12 }, learnTime: 70,
  },
  {
    id: 'asakujaku', name: 'Asa Kujaku', shout: 'Asa Kujaku!', desc: 'Centenas de socos tão rápidos que pegam fogo, num leque.',
    nature: null, type: 'taijutsu', rank: 5, chakra: 36, cooldown: 13, range: 110, power: 12, effect: 'multi', count: 9, projSpeed: 300, projKind: 'orb', vfx: 'fire',
    moves: [['strike', 1, 0.05], ['strike', 2, 0.05], ['strike', 1, 0.05], ['strike', 2, 0.05], ['strike', 1, 0.05], ['strike', 2, 0.1], ['strike', 3, 0.12]],
    color: '#ff7a3b', req: { taijutsu: 7, velocidade: 6 }, cost: { ryo: 400 }, learnTime: 66,
  },
  {
    id: 'hirudora', name: 'Hirudora', shout: 'Hirudora!', desc: 'Um soco solta um tigre de ar comprimido que explode no alvo.',
    nature: null, type: 'taijutsu', rank: 5, chakra: 42, cooldown: 16, range: 160, power: 66, effect: 'projectile', radius: 56, projSpeed: 210, projKind: 'orb', projSize: 13, vfx: 'wind',
    moves: [['cast', 0, 0.2], ['strike', 2, 0.35], ['strike', 3, 0.15]],
    color: '#d8f0ff', req: { taijutsu: 8, forca: 7 }, cost: { ryo: 480 }, learnTime: 75,
  },
  {
    id: 'sekizo', name: 'Sekizō', shout: 'Sekizō!', desc: 'Cinco socos que viram colunas de ar.',
    nature: null, type: 'taijutsu', rank: 4, chakra: 30, cooldown: 12, range: 140, power: 22, effect: 'multi', count: 5, projSpeed: 280, projKind: 'jet', vfx: 'wind',
    moves: [['strike', 0, 0.06], ['strike', 2, 0.08], ['strike', 0, 0.06], ['strike', 2, 0.08], ['strike', 2, 0.14], ['strike', 3, 0.12]],
    color: '#d8f0ff', req: { taijutsu: 7, forca: 6 }, cost: { ryo: 360 }, learnTime: 62,
  },
  {
    id: 'kusho', name: 'Hakke Kūshō', shout: 'Hakke Kūshō!', desc: 'Palma que dispara um golpe de ar à distância.',
    nature: null, type: 'taijutsu', rank: 2, chakra: 12, cooldown: 5, range: 130, power: 20, effect: 'projectile', projSpeed: 380, projKind: 'jet', stun: 0.3, vfx: 'wind',
    moves: [['cast', 3, 0.3], ['strike', 3, 0.12]],
    color: '#bfe0ff', req: { taijutsu: 3, inteligencia: 3 }, cost: { ryo: 100 }, learnTime: 26,
  },
  {
    id: 'rokujuyon', name: 'Hakke Rokujūyon Shō', shout: '64 Palmas!', desc: 'Golpes de palma nos pontos de chakra: o alvo fica travado.',
    nature: null, type: 'taijutsu', rank: 4, chakra: 26, cooldown: 12, range: 28, power: 40, effect: 'melee', stun: 1.6, vfx: 'wind',
    moves: [['cast', 3, 0.06], ['strike', 1, 0.06], ['cast', 3, 0.06], ['strike', 1, 0.06], ['cast', 3, 0.06], ['strike', 1, 0.06], ['cast', 3, 0.16], ['strike', 3, 0.12]],
    color: '#bfe0ff', req: { taijutsu: 6, inteligencia: 5 }, cost: { ryo: 320 }, learnTime: 58,
  },
  {
    id: 'kaiten', name: 'Hakkeshō Kaiten', shout: 'Kaiten!', desc: 'Gira soltando chakra: um domo que segura os golpes.',
    nature: null, type: 'taijutsu', rank: 3, chakra: 20, cooldown: 14, range: 0, power: 0, effect: 'shield', duration: 2.5, vfx: 'wind',
    moves: [['cast', 1, 0.9, 0, 'spin'], ['cast', 3, 0.15]],
    color: '#bfe0ff', req: { taijutsu: 5, inteligencia: 4, stamina: 4 }, cost: { ryo: 220 }, learnTime: 44,
  },
  {
    id: 'soshiken', name: 'Jūho Sōshiken', shout: 'Sōshiken!', desc: 'Punhos de leão de chakra que travam o alvo.',
    nature: null, type: 'taijutsu', rank: 4, chakra: 28, cooldown: 11, range: 28, power: 44, effect: 'melee', stun: 0.6, vfx: 'wind',
    moves: [['strike', 0, 0.1], ['strike', 2, 0.16], ['strike', 0, 0.08], ['strike', 2, 0.18], ['strike', 3, 0.12]],
    color: '#7fb0ff', req: { taijutsu: 6, inteligencia: 5 }, cost: { ryo: 330 }, learnTime: 58,
  },
  {
    id: 'gatsuga', name: 'Gatsūga', shout: 'Gatsūga!', desc: 'Gira como uma broca e atravessa o alvo.',
    nature: null, type: 'taijutsu', rank: 3, chakra: 18, cooldown: 8, range: 150, power: 38, effect: 'dash', vfx: 'impact',
    moves: [['air', 1, 0.25, 4, 'roll'], ['air', 3, 0.2]],
    color: '#c8a070', req: { taijutsu: 5, velocidade: 5 }, cost: { ryo: 200 }, learnTime: 42,
  },
  {
    id: 'nikudan', name: 'Nikudan Sensha', shout: 'Nikudan Sensha!', desc: 'Vira uma bola gigante e rola por cima de todos.',
    nature: null, type: 'taijutsu', rank: 3, chakra: 20, cooldown: 10, range: 140, power: 32, effect: 'dash', dashRadius: 34, vfx: 'impact',
    moves: [['air', 1, 0.3, 0, 'roll'], ['air', 3, 0.2]],
    color: '#c8a070', req: { taijutsu: 4, stamina: 6 }, cost: { ryo: 190 }, learnTime: 40,
  },
  {
    id: 'lariat', name: 'Raiton: Lariat', shout: 'Lariat!', desc: 'Corre coberto de raios e acerta com o braço esticado.',
    nature: 'raiton', type: 'taijutsu', rank: 4, chakra: 32, cooldown: 12, range: 150, power: 54, effect: 'dash', stun: 0.5,
    moves: [['strike', 2, 0.3], ['strike', 3, 0.15]],
    color: '#ffe066', req: { taijutsu: 6, forca: 6, velocidade: 5 }, cost: { ryo: 340 }, learnTime: 60,
  },
  // ---- modos (manto de chakra)
  {
    id: 'hachimon', name: 'Kinjutsu: Hachimon Tonkō', shout: 'Portões, abram!', desc: 'Abre os Oito Portões: força e velocidade enormes, mas a vida escorre.',
    nature: null, type: 'taijutsu', rank: 5, chakra: 30, cooldown: 40, range: 0, power: 0, effect: 'mode', mode: 'gates', forbidden: true, vfx: 'blood',
    moves: [['cast', 1, 0.3], ['cast', 3, 0.25]],
    color: '#5fe07a', req: { taijutsu: 8, stamina: 7 }, cost: { ryo: 500, herbs: 15 }, learnTime: 80,
  },
  {
    id: 'raitonyoroi', name: 'Raiton no Yoroi', shout: 'Raiton no Yoroi!', desc: 'Cobre o corpo de raios: rápido e difícil de acertar.',
    nature: 'raiton', type: 'taijutsu', rank: 4, chakra: 28, cooldown: 30, range: 0, power: 0, effect: 'mode', mode: 'raiton',
    moves: [['cast', 0, 0.3], ['cast', 3, 0.2]],
    color: '#ffe066', req: { taijutsu: 6, ninjutsu: 5, velocidade: 5 }, cost: { ryo: 380 }, learnTime: 66,
  },
  // ---- Rasengan
  {
    id: 'rasengan', name: 'Rasengan', shout: 'Rasengan!', desc: 'Esfera de chakra girando na palma, cravada no alvo.',
    nature: null, type: 'ninjutsu', rank: 4, chakra: 40, cooldown: 11, range: 130, power: 56, effect: 'dash', launch: true, stun: 0.6, vfx: 'wind', handOrb: '#5fb4ff',
    moves: [['cast', 3, 0.3], ['strike', 3, 0.15]],
    color: '#7fc8ff', req: { ninjutsu: 6, inteligencia: 4 }, cost: { ryo: 360 }, learnTime: 64,
  },
  {
    id: 'rasenshuriken', name: 'Fuuton: Rasenshuriken', shout: 'Rasenshuriken!', desc: 'Rasengan de vento em forma de shuriken: corta tudo numa área enorme.',
    nature: 'fuuton', type: 'ninjutsu', rank: 5, chakra: 60, cooldown: 18, range: 170, power: 80, effect: 'projectile', radius: 70, projSpeed: 200, projKind: 'spinner', projSize: 14,
    moves: [['cast', 1, 0.35], ['cast', 3, 0.3]],
    color: '#bff0ff', req: { ninjutsu: 8, inteligencia: 6, selos: 6 }, cost: { ryo: 560 }, learnTime: 85,
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
