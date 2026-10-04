import type { Camera } from './core/camera';
import type { BuildingType } from './data/buildings';
import type { Game } from './game/game';
import type { Ghost } from './render/renderer';

/** Contexto compartilhado entre loop, render e UI. */
export interface App {
  game: Game;
  camera: Camera;
  ghost: Ghost | null;
  buildType: BuildingType | null;
  /** Modo "dar ordem": o próximo toque no mapa vira ordem para estes ninjas. */
  orderMode: { ids: number[]; label: string } | null;
  newGame(): void;
  save(): boolean;
}
