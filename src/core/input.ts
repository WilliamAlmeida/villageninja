import type { Camera } from './camera';

const TAP_SLOP = 10;

/**
 * Gestos de toque/mouse sobre o canvas:
 * - 1 dedo arrastando: move a câmera
 * - 2 dedos: pinça para zoom
 * - toque rápido: onTap(x, y) em coordenadas de tela
 * - roda do mouse: zoom
 */
export class Input {
  onTap: (sx: number, sy: number) => void = () => {};
  private pointers = new Map<number, { x: number; y: number }>();
  private downAt: { x: number; y: number } | null = null;
  private moved = false;
  private pinchDist = 0;

  constructor(
    private el: HTMLElement,
    private cam: Camera,
  ) {
    el.addEventListener('pointerdown', this.down);
    el.addEventListener('pointermove', this.move);
    el.addEventListener('pointerup', this.up);
    el.addEventListener('pointercancel', this.cancel);
    el.addEventListener('pointerleave', this.cancel);
    el.addEventListener('wheel', this.wheel, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private pos(e: PointerEvent) {
    const r = this.el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private down = (e: PointerEvent) => {
    this.el.setPointerCapture?.(e.pointerId);
    const p = this.pos(e);
    this.pointers.set(e.pointerId, p);
    if (this.pointers.size === 1) {
      this.downAt = p;
      this.moved = false;
    } else if (this.pointers.size === 2) {
      this.moved = true;
      this.pinchDist = this.currentPinch();
    }
  };

  private move = (e: PointerEvent) => {
    const prev = this.pointers.get(e.pointerId);
    if (!prev) return;
    const p = this.pos(e);
    if (this.pointers.size === 1) {
      if (this.downAt && Math.hypot(p.x - this.downAt.x, p.y - this.downAt.y) > TAP_SLOP) this.moved = true;
      if (this.moved) this.cam.pan(p.x - prev.x, p.y - prev.y);
      this.pointers.set(e.pointerId, p);
    } else if (this.pointers.size === 2) {
      const before = this.center();
      this.pointers.set(e.pointerId, p);
      const after = this.center();
      const d = this.currentPinch();
      if (this.pinchDist > 0 && d > 0) this.cam.zoomAt(d / this.pinchDist, after.x, after.y);
      this.cam.pan((after.x - before.x) / 1, (after.y - before.y) / 1);
      this.pinchDist = d;
    }
  };

  private up = (e: PointerEvent) => {
    const p = this.pos(e);
    const wasSingle = this.pointers.size === 1;
    this.pointers.delete(e.pointerId);
    if (wasSingle && !this.moved) this.onTap(p.x, p.y);
    if (this.pointers.size < 2) this.pinchDist = 0;
    if (this.pointers.size === 0) this.downAt = null;
  };

  private cancel = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size === 0) this.downAt = null;
  };

  private wheel = (e: WheelEvent) => {
    e.preventDefault();
    const r = this.el.getBoundingClientRect();
    this.cam.zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
  };

  private center() {
    const ps = [...this.pointers.values()];
    return { x: (ps[0]!.x + ps[1]!.x) / 2, y: (ps[0]!.y + ps[1]!.y) / 2 };
  }
  private currentPinch() {
    const ps = [...this.pointers.values()];
    return ps.length < 2 ? 0 : Math.hypot(ps[0]!.x - ps[1]!.x, ps[0]!.y - ps[1]!.y);
  }
}
