import type { Camera } from './core/camera';
import type { BuildingType } from './data/buildings';
import type { Game } from './game/game';
import type { Ghost } from './render/renderer';

/** Retângulo em coordenadas de tela. */
export interface ScreenBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Contexto compartilhado entre loop, render e UI. */
export interface App {
  game: Game;
  camera: Camera;
  ghost: Ghost | null;
  buildType: BuildingType | null;
  /** Modo "dar ordem": o próximo toque no mapa vira ordem para estes ninjas. */
  orderMode: { ids: number[]; label: string } | null;
  /** Ninjas selecionados em grupo (caixa de seleção). */
  group: number[];
  /** Unidade em destaque: mouse sobre ela no mapa ou sobre a linha dela no painel. */
  hoverUnitId: number | null;
  /** Caixa de seleção sendo arrastada. */
  selectBox: ScreenBox | null;
  /** Ferramenta "Selecionar" ligada: arrastar desenha a caixa em vez de mover a câmera. */
  selectTool: boolean;
  newGame(): void;
  save(): boolean;
}
