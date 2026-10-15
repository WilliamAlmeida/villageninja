// Medidor de FPS flutuante (liga em Configurações → "Medidor de FPS"; preferência por dispositivo, fora do save).
// Mostra o FPS atual (último meio segundo), a média dos últimos 10 s e o pior quadro (ms) nesse período; arrasta
// para qualquer canto (a posição fica guardada) e um duplo clique zera a média. `window.fps` dá os mesmos números
// no console (para medir sem olhar a tela). Modo detalhado: ms por quadro de simulação (e passos), desenho e
// interface, as etapas mais caras do desenho (`Renderer.prof`) e a memória do JS, para achar o que pesa num aparelho.
import { rich } from './icons';
import { fpsMode, fpsPos, occlusion, quality, setFpsPos, simRate } from './settings';

/** Uma amostra do medidor detalhado (a cada meio segundo): médias por quadro. */
interface Sample {
  t: number;
  fps: number;
  draw: number;
  sim: number;
  steps: number;
  ui: number;
  prof: Record<string, number>;
  /** Simulação por sistema (ms por quadro). */
  simProf: Record<string, number>;
}
/** Amostras guardadas para o relatório (60 = 30 s). */
const KEEP_SAMPLES = 60;

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
  /** Modo detalhado ligado (Configurações). */
  detail = false;
  /** Etapas do desenho, ms somados desde a última leitura (o renderer soma aqui enquanto `detail`). */
  prof: Record<string, number> = {};
  /** Sistemas da simulação, ms somados desde a última leitura (o `Game` soma aqui enquanto `detail`). */
  simProf: Record<string, number> = {};
  /** Últimas amostras do modo detalhado (para o relatório do botão de salvar). */
  private samples: Sample[] = [];
  /** Situação do jogo e do desenho para o relatório (posto pelo main.ts). */
  info: () => Record<string, unknown> = () => ({});
  private body: HTMLDivElement | null = null;
  private tSim = 0;
  private tDraw = 0;
  private tUi = 0;
  private nSteps = 0;
  private nFrames = 0;

  constructor() {
    (window as unknown as { fps: () => object }).fps = () => this.stats();
  }

  stats() {
    const worst = this.frames.length ? Math.max(...this.frames) : 0;
    return { now: Math.round(this.now), avg: Math.round(this.frames.length ? (1000 * this.frames.length) / this.sum : 0), worstMs: Math.round(worst), frames: this.frames.length };
  }

  /** Tempos (ms) do quadro: simulação (e quantos passos), desenho e interface. */
  times(sim: number, steps: number, draw: number, ui: number) {
    this.tSim += sim;
    this.nSteps += steps;
    this.tDraw += draw;
    this.tUi += ui;
    this.nFrames++;
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
    const mode = fpsMode();
    this.detail = mode === 'detail';
    if (mode === 'off') {
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
    // salvar: manda o relatório do aparelho para o servidor (.perf/devices/)
    const save = document.createElement('button');
    save.className = 'fpssave';
    save.setAttribute('aria-label', 'Enviar relatório de desempenho');
    save.innerHTML = rich('{save}');
    save.addEventListener('click', (e) => {
      e.stopPropagation();
      void this.send(save);
    });
    const body = document.createElement('div');
    body.className = 'fpsbody';
    el.append(save, body);
    this.body = body;
    // arrastar: segue o ponteiro e guarda onde soltou (sempre dentro da tela)
    el.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('.fpssave')) return; // o botão não arrasta
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
    let extra = '';
    if (this.detail && this.nFrames) {
      const n = this.nFrames;
      const avgProf: Record<string, number> = {};
      for (const k in this.prof) avgProf[k] = +(this.prof[k]! / n).toFixed(2);
      const avgSim: Record<string, number> = {};
      for (const k in this.simProf) if (this.simProf[k]! / n >= 0.01) avgSim[k] = +(this.simProf[k]! / n).toFixed(2);
      this.samples.push({ t: Math.round(performance.now()), fps: Math.round(s.now), draw: +(this.tDraw / n).toFixed(2), sim: +(this.tSim / n).toFixed(2), steps: +(this.nSteps / n).toFixed(2), ui: +(this.tUi / n).toFixed(2), prof: avgProf, simProf: avgSim });
      if (this.samples.length > KEEP_SAMPLES) this.samples.shift();
      const f = (v: number) => (v / n).toFixed(1);
      const steps = Object.entries(this.prof)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([k, v]) => `${k} ${f(v)}`)
        .join(' · ');
      const sims = Object.entries(this.simProf)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([k, v]) => `${k} ${f(v)}`)
        .join(' · ');
      const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
      extra =
        `<i>desenho <b>${f(this.tDraw)}</b> · sim <b>${f(this.tSim)}</b> (${(this.nSteps / n).toFixed(1)} passos) · UI <b>${f(this.tUi)}</b> ms</i>` +
        (steps ? `<em>${steps}</em>` : '') +
        (sims ? `<em>sim: ${sims}</em>` : '') +
        (mem ? `<i>memória JS ${Math.round(mem.usedJSHeapSize / 1048576)} MB</i>` : '');
    }
    this.tSim = this.tDraw = this.tUi = this.nSteps = this.nFrames = 0;
    for (const k in this.prof) delete this.prof[k];
    for (const k in this.simProf) delete this.simProf[k];
    this.el.classList.toggle('detail', this.detail);
    if (this.body) this.body.innerHTML = `<b class="${cls(s.now)}">${s.now}</b><span>FPS</span><i>média ${WINDOW}s <b class="${cls(s.avg)}">${s.avg}</b></i><i>pior quadro ${s.worstMs} ms</i>${extra}`;
  }

  /** Relatório do aparelho: o que ele é, como o jogo está configurado e os números do medidor. */
  report(hints: { model?: string; platformVersion?: string } = {}) {
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { effectiveType?: string }; userAgentData?: { platform?: string; mobile?: boolean } };
    const ua = navigator.userAgent;
    // Android: "...; Android 9; LM-X420) ..." → modelo
    // (o Chrome novo esconde o modelo no user agent, que vem como "K": o modelo real chega por `hints`)
    const fromUa = /Android [^;)]*;\s*([^;)]+?)(?:\s+Build\/[^;)]*)?\)/.exec(ua)?.[1];
    const model = hints.model || (fromUa && fromUa !== 'K' ? fromUa : '') || /iPhone|iPad/.exec(ua)?.[0] || nav.userAgentData?.platform || navigator.platform || 'pc';
    const sorted = [...this.frames].sort((a, b) => a - b);
    const pct = (p: number) => (sorted.length ? +sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!.toFixed(1) : 0);
    const buckets: Record<string, number> = { '<17ms': 0, '17-25': 0, '25-34': 0, '34-50': 0, '50-100': 0, '>100': 0 };
    for (const ms of this.frames) buckets[ms < 17 ? '<17ms' : ms < 25 ? '17-25' : ms < 34 ? '25-34' : ms < 50 ? '34-50' : ms < 100 ? '50-100' : '>100']!++;
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
    return {
      device: {
        model,
        userAgent: ua,
        platformVersion: hints.platformVersion,
        mobile: nav.userAgentData?.mobile ?? /Mobi|Android/.test(ua),
        cores: navigator.hardwareConcurrency,
        memoryGB: nav.deviceMemory,
        gpu: gpuName(),
        screen: { w: screen.width, h: screen.height, dpr: devicePixelRatio, viewW: innerWidth, viewH: innerHeight, orientation: screen.orientation?.type },
        pwa: matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches,
        connection: nav.connection?.effectiveType,
      },
      settings: { quality: quality(), occlusion: occlusion(), fps: fpsMode(), sim: simRate() },
      fps: { ...this.stats(), p50: pct(0.5), p95: pct(0.95), p99: pct(0.99), frameMs: buckets },
      memoryMB: mem ? { used: Math.round(mem.usedJSHeapSize / 1048576), total: Math.round(mem.totalJSHeapSize / 1048576), limit: Math.round(mem.jsHeapSizeLimit / 1048576) } : null,
      samples: this.samples,
      game: this.info(),
      sentAt: new Date().toISOString(),
    };
  }

  /** Envia o relatório; o botão mostra se deu certo (ok) ou não (x) por uns segundos. */
  private async send(btn: HTMLButtonElement) {
    if (btn.classList.contains('busy')) return;
    btn.classList.add('busy');
    let ok = false;
    try {
      // modelo e versão do sistema (Chrome): a API dos "client hints"; sem ela, o user agent
      const uad = (navigator as Navigator & { userAgentData?: { getHighEntropyValues?: (h: string[]) => Promise<{ model?: string; platformVersion?: string }> } }).userAgentData;
      const hints = (await uad?.getHighEntropyValues?.(['model', 'platformVersion']).catch(() => ({}))) ?? {};
      const r = await fetch('/api/perf-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(this.report(hints)) });
      ok = r.ok;
    } catch {
      ok = false;
    }
    btn.classList.remove('busy');
    btn.classList.add(ok ? 'sent' : 'fail');
    btn.innerHTML = rich(ok ? '{check}' : '{x}');
    setTimeout(() => {
      btn.classList.remove('sent', 'fail');
      btn.innerHTML = rich('{save}');
    }, 2500);
  }
}

let gpu: string | null | undefined;
/** Nome da GPU pelo WebGL (o Chrome mostra o chip; outros navegadores podem esconder). Calculado uma vez. */
function gpuName(): string | null {
  if (gpu !== undefined) return gpu;
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    gpu = gl ? String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) : null;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    gpu = null;
  }
  return gpu;
}
