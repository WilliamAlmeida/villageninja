// Medidor de FPS flutuante (liga em Configurações → "Medidor de FPS"; preferência por dispositivo, fora do save).
// Mostra o FPS atual (último meio segundo), a média dos últimos 10 s e o pior quadro (ms) nesse período; arrasta
// para qualquer canto (a posição fica guardada) e um duplo clique zera a média. `window.fps` dá os mesmos números
// no console (para medir sem olhar a tela).
import { fpsPos, setFpsPos, showFps } from './settings';

const WINDOW = 10; // segundos da média

export class FpsMeter {
  private el: HTMLDivElement | null = null;
  /** Duração de cada quadro dos últimos WINDOW segundos (ms). */
  private frames: number[] = [];
  private sum = 0;
  private acc = 0;
  private count = 0;
  private now = 0;
  private last = 0;

  constructor() {
    (window as unknown as { fps: () => object }).fps = () => this.stats();
  }

  stats() {
    const worst = this.frames.length ? Math.max(...this.frames) : 0;
    return { now: Math.round(this.now), avg: Math.round(this.frames.length ? (1000 * this.frames.length) / this.sum : 0), worstMs: Math.round(worst), frames: this.frames.length };
  }

  /** Chamado a cada quadro com o tempo do requestAnimationFrame. */
  tick(t: number) {
    const ms = this.last ? t - this.last : 0;
    this.last = t;
    if (ms <= 0 || ms > 1000) return; // aba escondida: não conta a volta
    this.frames.push(ms);
    this.sum += ms;
    while (this.sum > WINDOW * 1000 && this.frames.length > 1) this.sum -= this.frames.shift()!;
    this.acc += ms;
    this.count++;
    if (this.acc < 500) return;
    this.now = (1000 * this.count) / this.acc;
    this.acc = 0;
    this.count = 0;
    this.render();
  }

  private reset() {
    this.frames = [];
    this.sum = 0;
    this.render();
  }

  /** Liga/desliga conforme a preferência. */
  sync() {
    if (!showFps()) {
      this.el?.remove();
      this.el = null;
      return;
    }
    if (this.el) return;
    const el = document.createElement('div');
    el.id = 'fps';
    const p = fpsPos();
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y}px`;
    el.addEventListener('dblclick', () => this.reset());
    // arrastar: segue o ponteiro e guarda onde soltou (sempre dentro da tela)
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      el.setPointerCapture(e.pointerId);
      const ox = e.clientX - el.offsetLeft;
      const oy = e.clientY - el.offsetTop;
      const move = (ev: PointerEvent) => {
        const x = Math.max(0, Math.min(window.innerWidth - el.offsetWidth, ev.clientX - ox));
        const y = Math.max(0, Math.min(window.innerHeight - el.offsetHeight, ev.clientY - oy));
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
      };
      const up = () => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
        setFpsPos({ x: el.offsetLeft, y: el.offsetTop });
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    });
    document.body.appendChild(el);
    this.el = el;
    this.render();
  }

  private render() {
    if (!this.el) return;
    const s = this.stats();
    const cls = (v: number) => (v >= 50 ? 'ok' : v >= 30 ? 'mid' : 'bad');
    this.el.innerHTML = `<b class="${cls(s.now)}">${s.now}</b><span>FPS</span><i>média ${WINDOW}s <b class="${cls(s.avg)}">${s.avg}</b></i><i>pior quadro ${s.worstMs} ms</i>`;
  }
}
