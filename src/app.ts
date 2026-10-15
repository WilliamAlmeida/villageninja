import type { Camera } from './core/camera';
import type { BuildingType } from './data/buildings';
import type { Game } from './game/game';
import type { Ghost } from './render/renderer';
import type { RoadDraft } from './game/roads';

/** Retângulo em coordenadas de tela. */
export interface ScreenBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Contexto compartilhado entre loop, render e UI. */
export interface App {
  /** Jogo que está na tela: a vila ou, quando o jogador olha a invasão, o mapa de missão. */
  readonly game: Game;
  /** A vila (recursos, velocidade, janelas de gestão e o save são sempre dela). */
  readonly home: Game;
  /** Olhando o mapa de missão (invasão) em vez da vila. */
  viewScene: boolean;
  /** Troca a tela entre a vila e o mapa de missão (cada um guarda a própria câmera). */
  setView(scene: boolean): void;
  camera: Camera;
  ghost: Ghost | null;
  buildType: BuildingType | null;
  /** Pintando no mapa: rua, limpar área ou aterrar/cavar (o toque em cima do que já está marcado tira). */
  roadMode: 'pave' | 'clear' | 'fill' | 'dig' | null;
  /** Ruas pintadas e ainda não confirmadas (só valem no "Pronto"; game/roads.ts). */
  roadDraft: RoadDraft;
  /** Tile sob o mouse nos modos de pintar (a prévia de onde o toque vai cair). */
  roadHover: { tx: number; ty: number; del?: boolean } | null;
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
  /** Ninja aberto a partir de uma lista da janela: o painel dele mostra "Voltar" para essa tela. */
  back: { view: { kind: string; id?: number }; id: number } | null;
  newGame(): void;
  save(): boolean;
}
