import { MAX_ZOOM, MIN_ZOOM, WORLD_H, WORLD_W } from '../config';
import { project, SCENE, unproject } from './iso';
import { clamp } from './math';

/**
 * Câmera 2D sobre a cena isométrica: (x,y) é o centro da tela em coordenadas de cena.
 * Quem está fora do render fala em coordenadas de mundo (focus, screenToWorld, worldToScreen).
 */
export class Camera {
  x = project(WORLD_W / 2, WORLD_H / 2).x;
  y = project(WORLD_W / 2, WORLD_H / 2).y;
  zoom = 1.1;
  viewW = 800;
  viewH = 400;
  private follow: { x: number; y: number } | null = null;

  resize(w: number, h: number) {
    this.viewW = w;
    this.viewH = h;
    this.clamp();
  }

  /** Canto superior esquerdo da tela, em cena. */
  get left() {
    return this.x - this.viewW / (2 * this.zoom);
  }
  get top() {
    return this.y - this.viewH / (2 * this.zoom);
  }

  screenToScene(sx: number, sy: number) {
    return { x: this.left + sx / this.zoom, y: this.top + sy / this.zoom };
  }
  sceneToScreen(x: number, y: number) {
    return { x: (x - this.left) * this.zoom, y: (y - this.top) * this.zoom };
  }
  /** Ponto do chão (mundo) sob um ponto da tela. */
  screenToWorld(sx: number, sy: number) {
    const s = this.screenToScene(sx, sy);
    return unproject(s.x, s.y);
  }
  worldToScreen(wx: number, wy: number) {
    const p = project(wx, wy);
    return this.sceneToScreen(p.x, p.y);
  }
  /** Ponto do mundo no centro da tela. */
  centerWorld() {
    return unproject(this.x, this.y);
  }

  pan(dxScreen: number, dyScreen: number) {
    this.follow = null;
    this.x -= dxScreen / this.zoom;
    this.y -= dyScreen / this.zoom;
    this.clamp();
  }

  zoomAt(factor: number, sx: number, sy: number) {
    const before = this.screenToScene(sx, sy);
    this.zoom = clamp(this.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    const after = this.screenToScene(sx, sy);
    this.x += before.x - after.x;
    this.y += before.y - after.y;
    this.clamp();
  }

  /** Move suavemente até o ponto (mundo). */
  focus(wx: number, wy: number) {
    this.follow = project(wx, wy);
  }

  /** Centraliza já no ponto (mundo). */
  jump(wx: number, wy: number) {
    const p = project(wx, wy);
    this.follow = null;
    this.x = p.x;
    this.y = p.y;
    this.clamp();
  }

  update(dt: number) {
    if (!this.follow) return;
    const k = 1 - Math.exp(-dt * 8);
    this.x += (this.follow.x - this.x) * k;
    this.y += (this.follow.y - this.y) * k;
    if (Math.hypot(this.follow.x - this.x, this.follow.y - this.y) < 1) this.follow = null;
    this.clamp();
  }

  /** O mapa vira um losango: o centro da tela fica sempre dentro da caixa dele. */
  private clamp() {
    this.zoom = clamp(this.zoom, MIN_ZOOM, MAX_ZOOM);
    this.x = clamp(this.x, SCENE.minX, SCENE.maxX);
    this.y = clamp(this.y, SCENE.minY, SCENE.maxY);
  }
}
