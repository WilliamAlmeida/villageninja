import { MAX_ZOOM, MIN_ZOOM, WORLD_H, WORLD_W } from '../config';
import { clamp } from './math';

/** Câmera 2D: (x,y) é o centro da tela em coordenadas de mundo. */
export class Camera {
  x = WORLD_W / 2;
  y = WORLD_H / 2;
  zoom = 1.1;
  viewW = 800;
  viewH = 400;
  private follow: { x: number; y: number } | null = null;

  resize(w: number, h: number) {
    this.viewW = w;
    this.viewH = h;
    this.clamp();
  }

  get left() {
    return this.x - this.viewW / (2 * this.zoom);
  }
  get top() {
    return this.y - this.viewH / (2 * this.zoom);
  }

  screenToWorld(sx: number, sy: number) {
    return { x: this.left + sx / this.zoom, y: this.top + sy / this.zoom };
  }
  worldToScreen(wx: number, wy: number) {
    return { x: (wx - this.left) * this.zoom, y: (wy - this.top) * this.zoom };
  }

  pan(dxScreen: number, dyScreen: number) {
    this.follow = null;
    this.x -= dxScreen / this.zoom;
    this.y -= dyScreen / this.zoom;
    this.clamp();
  }

  zoomAt(factor: number, sx: number, sy: number) {
    const before = this.screenToWorld(sx, sy);
    this.zoom = clamp(this.zoom * factor, this.minZoom(), MAX_ZOOM);
    const after = this.screenToWorld(sx, sy);
    this.x += before.x - after.x;
    this.y += before.y - after.y;
    this.clamp();
  }

  /** Move suavemente até o ponto. */
  focus(x: number, y: number) {
    this.follow = { x, y };
  }

  update(dt: number) {
    if (!this.follow) return;
    const k = 1 - Math.exp(-dt * 8);
    this.x += (this.follow.x - this.x) * k;
    this.y += (this.follow.y - this.y) * k;
    if (Math.hypot(this.follow.x - this.x, this.follow.y - this.y) < 1) this.follow = null;
    this.clamp();
  }

  private minZoom() {
    return Math.max(MIN_ZOOM, this.viewW / WORLD_W, this.viewH / WORLD_H);
  }

  private clamp() {
    this.zoom = clamp(this.zoom, this.minZoom(), MAX_ZOOM);
    const hw = this.viewW / (2 * this.zoom);
    const hh = this.viewH / (2 * this.zoom);
    this.x = clamp(this.x, hw, WORLD_W - hw);
    this.y = clamp(this.y, hh, WORLD_H - hh);
  }
}
