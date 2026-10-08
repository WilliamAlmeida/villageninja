// Constantes globais do jogo. Ajuste aqui para balancear sem mexer nos sistemas.
export const TILE = 32;
export const MAP_W = 72;
export const MAP_H = 48;
/** Colisão e caminhos em meio tile: cada tile tem SUB×SUB células de CELL px (muros do Editor de cenário em 16 px). */
export const SUB = 2;
export const CELL = 32 / SUB;
export const FINE_W = MAP_W * SUB;
export const FINE_H = MAP_H * SUB;
export const WORLD_W = MAP_W * TILE;
export const WORLD_H = MAP_H * TILE;

/** Passo fixo da simulação (s). */
export const SIM_DT = 1 / 60;
/** Duração de um dia de jogo em segundos reais (velocidade 1x). */
export const DAY_LENGTH = 180;
/** Comida consumida por habitante por dia. */
export const FOOD_PER_DAY = 5;
/** Margem (tiles) ao redor das construções que conta como "dentro da vila". */
export const VILLAGE_MARGIN = 5;

export const SAVE_KEY = 'villageninja.save.v1';
export const SAVE_VERSION = 27;
export const AUTOSAVE_INTERVAL = 20;

export const MAX_DPR = 2;
export const MIN_ZOOM = 0.45;
export const MAX_ZOOM = 2.5;
