// Constantes globais do jogo. Ajuste aqui para balancear sem mexer nos sistemas.
export const TILE = 32;
/**
 * Tamanho do mapa em tiles: cada mapa guarda o seu (`GameState.mapW/mapH`; `World.W/H`). A vila é 102×68 (save v35:
 * era 72×48 e cresceu em volta, com a vila no meio); os mapas de missão (mina, ilha, saque, covil, prova) ficam 72×48.
 */
export const VILLAGE_W = 102;
export const VILLAGE_H = 68;
export const SCENE_W = 72;
export const SCENE_H = 48;
/** Maior mapa possível (buffers de rascunho da busca de caminho). */
export const MAX_MAP_W = VILLAGE_W;
export const MAX_MAP_H = VILLAGE_H;
/** Colisão e caminhos em meio tile: cada tile tem SUB×SUB células de CELL px (muros do Editor de cenário em 16 px). */
export const SUB = 2;
export const CELL = 32 / SUB;

/** Passo fixo da simulação (s). */
export const SIM_DT = 1 / 60;
/** Duração de um dia de jogo em segundos reais (velocidade 1x). */
export const DAY_LENGTH = 180;
/** Comida consumida por habitante por dia. */
export const FOOD_PER_DAY = 5;
/** Margem (tiles) ao redor das construções que conta como "dentro da vila". */
export const VILLAGE_MARGIN = 5;

export const SAVE_KEY = 'villageninja.save.v1';
export const SAVE_VERSION = 35;
export const AUTOSAVE_INTERVAL = 20;

export const MAX_DPR = 2;
export const MIN_ZOOM = 0.45;
export const MAX_ZOOM = 2.5;
