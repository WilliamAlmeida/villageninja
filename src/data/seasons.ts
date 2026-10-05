// Estações (derivadas do dia), clima do dia e festivais.
import type { Nature } from './natures';
import type { Cost } from '../game/types';

/** Dias por estação. */
export const SEASON_DAYS = 5;

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type Weather = 'clear' | 'rain' | 'storm' | 'snow';

export interface SeasonDef {
  name: string;
  icon: string;
  /** Multiplicador da colheita e do consumo de comida. */
  harvest: number;
  food: number;
  /** Felicidade extra. */
  mood: number;
  /** Chance de cada clima. */
  weather: [Weather, number][];
  festival: string;
  desc: string;
}

export const SEASONS: Record<Season, SeasonDef> = {
  spring: {
    name: 'Primavera', icon: '{leaf}', harvest: 1.15, food: 1, mood: 3, weather: [['clear', 5], ['rain', 4], ['storm', 1]],
    festival: 'Festival das Flores', desc: 'Colheita +15% e chuvas frequentes.',
  },
  summer: {
    name: 'Verão', icon: '{sun}', harvest: 1, food: 1, mood: 2, weather: [['clear', 7], ['rain', 1], ['storm', 2]],
    festival: 'Festival dos Fogos', desc: 'Dias longos e secos; tempestades de raios às vezes.',
  },
  autumn: {
    name: 'Outono', icon: '{wheat}', harvest: 1.3, food: 1, mood: 0, weather: [['clear', 5], ['rain', 3], ['storm', 1]],
    festival: 'Festival da Colheita', desc: 'Colheita +30%: hora de estocar comida para o inverno.',
  },
  winter: {
    name: 'Inverno', icon: '{snow}', harvest: 0.4, food: 1.25, mood: -5, weather: [['clear', 3], ['snow', 6], ['storm', 1]],
    festival: 'Festival das Lanternas', desc: 'Colheita 60% menor e todo mundo come 25% mais. Neve deixa todos mais lentos.',
  },
};
export const SEASON_ORDER: Season[] = ['spring', 'summer', 'autumn', 'winter'];

export interface WeatherDef {
  name: string;
  icon: string;
  desc: string;
  /** Multiplicador da colheita e da velocidade de quem anda. */
  harvest: number;
  speed: number;
  /** Naturezas que ficam mais fortes (+20% de dano). */
  boost: Nature[];
}

export const WEATHERS: Record<Weather, WeatherDef> = {
  clear: { name: 'Tempo bom', icon: '{sun}', harvest: 1, speed: 1, boost: ['katon'], desc: 'Katon (fogo) +20% de dano.' },
  rain: { name: 'Chuva', icon: '{rain}', harvest: 1.1, speed: 0.95, boost: ['suiton'], desc: 'Nuvens de chuva cruzam o mapa. Embaixo delas: colheita +10% e Suiton (água) +20% de dano.' },
  storm: { name: 'Tempestade', icon: '{storm}', harvest: 0.9, speed: 0.9, boost: ['raiton', 'fuuton'], desc: 'Nuvens de tempestade cruzam o mapa. Embaixo delas: Raiton e Fuuton +20% de dano e todos 10% mais lentos.' },
  snow: { name: 'Neve', icon: '{snow}', harvest: 0.8, speed: 0.85, boost: ['suiton'], desc: 'Todos 15% mais lentos. Suiton +20% de dano.' },
};

/** Nuvens de chuva: quantas por dia de chuva/tempestade, tamanho (raio em px de mundo) e velocidade (px/s). */
export const CLOUDS = { count: { rain: 3, storm: 5 }, rMin: 170, rMax: 330, speed: [12, 24] as [number, number] };

/** Neve no chão: dias nevando para cobrir tudo e dias para derreter (inverno sem neve, primavera, resto do ano). */
export const SNOW = { cover: 1.2, meltWinter: 4, meltSpring: 1.2, meltWarm: 0.4 };

/** Festival: custo, quanto dura (dias) e intervalo mínimo entre festivais (dias). */
export const FESTIVAL = { cost: { food: 80, ryo: 120 } as Cost, days: 1, every: 3, mood: 22 };

/** Felicidade: limites para emigração e para o bônus de nascimentos. */
export const MOOD = { leave: 25, happy: 75 };
