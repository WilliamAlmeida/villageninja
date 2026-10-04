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
  newGame(): void;
  save(): boolean;
}
