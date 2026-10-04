import type { Camera } from './camera';

const TAP_SLOP = 10;

/**
 * Gestos de toque/mouse sobre o canvas:
 * - 1 dedo / botão esquerdo arrastando: move a câmera (ou desenha a caixa de seleção, se `boxMode()`)
 * - Shift + arrastar: caixa de seleção
 * - 2 dedos: pinça para zoom · roda do mouse: zoom
 * - toque rápido: onTap(x, y) · botão direito: onContext(x, y) · mouse parado: onHover(x, y)
 * Todas as coordenadas são de tela.
 */
export class Input {
  onTap: (sx: number, sy: number) => void = () => {};
  onContext: (sx: number, sy: number) => void = () => {};
  onHover: (sx: number, sy: number) => void = () => {};
  /** Caixa de seleção: chamada a cada movimento e, com `done`, ao soltar. */
  onBox: (x0: number, y0: number, x1: number, y1: number, done: boolean) => void = () => {};
  onBoxCancel: () => void = () => {};
  /** Se verdadeiro, o próximo arrasto de 1 ponteiro vira caixa de seleção. */
  boxMode: () => boolean = () => false;
  /** Cursor quando nada está sendo arrastado (definido por quem trata o hover). */
  idleCursor = 'grab';

  private pointers = new Map<number, { x: number; y: number }>();
  private downAt: { x: number; y: number } | null = null;
  private moved = false;
  private pinchDist = 0;
  private boxing = false;
  private button = 0;

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

  setCursor(c: string) {
    this.idleCursor = c;
    if (!this.pointers.size) this.el.style.cursor = c;
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
      this.button = e.button;
      this.boxing = e.button === 0 && (e.shiftKey || this.boxMode());
    } else if (this.pointers.size === 2) {
      this.moved = true;
      if (this.boxing) this.endBox(p, false);
      this.pinchDist = this.currentPinch();
    }
  };

  private move = (e: PointerEvent) => {
    const prev = this.pointers.get(e.pointerId);
    const p = this.pos(e);
    if (!prev) {
      if (e.pointerType === 'mouse') this.onHover(p.x, p.y);
      return;
    }
    if (this.pointers.size === 1) {
      if (this.downAt && Math.hypot(p.x - this.downAt.x, p.y - this.downAt.y) > TAP_SLOP) this.moved = true;
      if (this.moved) {
        if (this.boxing) {
          this.el.style.cursor = 'crosshair';
          this.onBox(this.downAt!.x, this.downAt!.y, p.x, p.y, false);
        } else {
          this.el.style.cursor = 'grabbing';
          this.cam.pan(p.x - prev.x, p.y - prev.y);
        }
      }
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
    if (wasSingle) {
      if (this.boxing && this.moved) this.endBox(p, true);
      else if (!this.moved) (this.button === 2 ? this.onContext : this.onTap)(p.x, p.y);
      this.boxing = false;
    }
    if (this.pointers.size < 2) this.pinchDist = 0;
    if (this.pointers.size === 0) {
      this.downAt = null;
      this.el.style.cursor = this.idleCursor;
      if (e.pointerType === 'mouse') this.onHover(p.x, p.y);
    }
  };

  private cancel = (e: PointerEvent) => {
    if (this.boxing && this.pointers.has(e.pointerId)) this.endBox(this.pos(e), false);
    this.pointers.delete(e.pointerId);
    if (this.pointers.size === 0) {
      this.downAt = null;
      this.el.style.cursor = this.idleCursor;
      this.onHover(-1, -1);
    }
  };

  private endBox(p: { x: number; y: number }, commit: boolean) {
    this.boxing = false;
    const a = this.downAt ?? p;
    if (commit) this.onBox(a.x, a.y, p.x, p.y, true);
    else this.onBoxCancel();
  }

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
