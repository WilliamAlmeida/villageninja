// Partículas só de visual (não entram no estado do jogo): rastro dos projéteis por natureza e explosões
// quando um efeito novo aparece. Tudo em coordenadas de cena (já projetadas). O tempo vem do relógio do
// render, então pausar o jogo congela as partículas também.
import type { Nature } from '../data/natures';
import type { Effect, Projectile } from '../game/types';

type Kind = 'flame' | 'drop' | 'mist' | 'spark' | 'dust' | 'chip' | 'streak' | 'mote' | 'smoke' | 'flash';

interface P {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** altura acima do chão (cai com gravidade e quica) */
  z: number;
  vz: number;
  t: number;
  life: number;
  size: number;
  color: string;
}

const MAX = 900;
const TAU = Math.PI * 2;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

const FIRE = ['#fff3b0', '#ffd24d', '#ff8a2b', '#ff5a1f'];
const WATER = ['#e6f6ff', '#9fd8ff', '#4da6ff'];
const WIND = ['#e8fff0', '#b6f2cc', '#7fe0a0'];
const BOLT = ['#ffffff', '#fff6a8', '#ffe14d'];
const EARTH = ['#d9b77a', '#c39257', '#8a6238'];

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]!;

export class Particles {
  private list: P[] = [];
  private seen = new WeakSet<object>();

  private add(p: Partial<P> & { kind: Kind; x: number; y: number }) {
    if (this.list.length >= MAX) this.list.shift();
    this.list.push({ vx: 0, vy: 0, z: 0, vz: 0, t: 0, life: 0.5, size: 2, color: '#fff', ...p });
  }

  /** Rastro de um projétil (posição já na cena, voando na altura do peito). */
  trail(p: Projectile, x: number, y: number, dt: number) {
    const n = Math.random() < dt * 60 ? 1 : 0;
    const nat = p.nature as Nature | null;
    if (p.kind === 'kunai') return;
    for (let i = 0; i < n + (p.size > 6 ? 1 : 0); i++) {
      const j = () => rnd(-p.size, p.size) * 0.6;
      if (nat === 'katon' || p.kind === 'orb') {
        this.add({ kind: 'flame', x: x + j(), y: y + j(), vx: rnd(-8, 8), vy: rnd(-30, -12), life: rnd(0.3, 0.55), size: rnd(2, 3.5) * (p.size / 5), color: pick(FIRE) });
      } else if (nat === 'suiton' || p.kind === 'dragon') {
        this.add({ kind: 'drop', x: x + j(), y: y + j(), vx: rnd(-14, 14), vy: rnd(-6, 6), z: 6, vz: rnd(10, 30), life: rnd(0.4, 0.7), size: rnd(1.2, 2.2), color: pick(WATER) });
        if (Math.random() < 0.4) this.add({ kind: 'mist', x, y, life: 0.5, size: p.size * 1.2, color: '#9fd8ff' });
      } else if (nat === 'fuuton' || p.kind === 'blade') {
        this.add({ kind: 'streak', x: x + j(), y: y + j(), vx: -p.vx * 0.1, vy: -p.vy * 0.1, life: 0.25, size: rnd(4, 8), color: pick(WIND) });
      } else if (nat === 'raiton' || p.kind === 'spark') {
        this.add({ kind: 'spark', x: x + j(), y: y + j(), vx: rnd(-60, 60), vy: rnd(-60, 60), life: rnd(0.08, 0.18), size: rnd(3, 6), color: pick(BOLT) });
      } else if (nat === 'doton' || p.kind === 'rock') {
        this.add({ kind: 'dust', x: x + j(), y: y + j() + 6, vx: rnd(-6, 6), vy: rnd(-6, 2), life: rnd(0.4, 0.7), size: rnd(2.5, 4.5), color: pick(EARTH) });
      } else {
        this.add({ kind: 'mote', x: x + j(), y: y + j(), vy: -10, life: 0.4, size: 1.6, color: p.color });
      }
    }
  }

  /** Efeito novo do jogo: gera a explosão de partículas uma única vez (pelo objeto original `src`). */
  effect(src: Effect, e: Effect) {
    if (this.seen.has(src)) return;
    this.seen.add(src);
    const r = e.r ?? 16;
    const nat = natureOf(e.color);
    switch (e.kind) {
      case 'burst': {
        this.add({ kind: 'flash', x: e.x, y: e.y, life: 0.12, size: r * 0.75, color: e.color });
        const n = Math.min(48, 16 + r);
        for (let i = 0; i < n; i++) {
          const a = rnd(0, TAU);
          const sp = rnd(30, 90) * (r / 20);
          const base = { x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5 };
          if (nat === 'katon') this.add({ ...base, kind: 'flame', vy: base.vy - 20, life: rnd(0.35, 0.7), size: rnd(2.5, 5), color: pick(FIRE) });
          else if (nat === 'suiton') this.add({ ...base, kind: 'drop', z: 4, vz: rnd(40, 90), life: rnd(0.5, 0.9), size: rnd(1.5, 2.5), color: pick(WATER) });
          else if (nat === 'raiton') this.add({ ...base, kind: 'spark', vx: base.vx * 1.6, vy: base.vy * 1.6, life: rnd(0.1, 0.25), size: rnd(4, 8), color: pick(BOLT) });
          else if (nat === 'doton') this.add({ ...base, kind: 'chip', z: 2, vz: rnd(50, 110), life: rnd(0.6, 1), size: rnd(2, 3.5), color: pick(EARTH) });
          else if (nat === 'fuuton') this.add({ ...base, kind: 'streak', life: 0.3, size: rnd(5, 10), color: pick(WIND) });
          else this.add({ ...base, kind: 'mote', life: rnd(0.3, 0.6), size: rnd(1.5, 2.5), color: e.color });
        }
        for (let i = 0; i < 5; i++) this.add({ kind: 'smoke', x: e.x + rnd(-r, r) * 0.4, y: e.y + rnd(-r, r) * 0.2, vy: rnd(-14, -6), life: rnd(0.6, 1), size: r * rnd(0.35, 0.55), color: nat === 'suiton' ? '#cfe9ff' : '#8a8078' });
        break;
      }
      case 'ring':
        // poeira levantada em volta
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * TAU;
          this.add({ kind: 'dust', x: e.x + Math.cos(a) * r * 0.5, y: e.y + Math.sin(a) * r * 0.25, vx: Math.cos(a) * 25, vy: Math.sin(a) * 12, life: 0.45, size: rnd(2, 3.5), color: '#cdb48a' });
        }
        break;
      case 'bolt':
        for (const [x, y] of [[e.x, e.y], [e.x2 ?? e.x, e.y2 ?? e.y]] as const)
          for (let i = 0; i < 8; i++) this.add({ kind: 'spark', x, y, vx: rnd(-80, 80), vy: rnd(-80, 80), life: rnd(0.1, 0.2), size: rnd(3, 7), color: pick(BOLT) });
        break;
      case 'slash':
        for (let i = 0; i < 6; i++) this.add({ kind: 'spark', x: e.x, y: e.y, vx: rnd(-50, 50), vy: rnd(-50, 20), life: 0.15, size: rnd(2, 4), color: '#ffffff' });
        break;
      case 'smoke':
        for (let i = 0; i < 8; i++) this.add({ kind: 'smoke', x: e.x + rnd(-r, r) * 0.5, y: e.y + rnd(-r, r) * 0.3, vx: rnd(-10, 10), vy: rnd(-16, -4), life: rnd(0.5, 0.9), size: r * rnd(0.3, 0.5), color: e.color });
        break;
      case 'heal':
        for (let i = 0; i < 8; i++) this.add({ kind: 'mote', x: e.x + rnd(-r, r), y: e.y + rnd(-4, 6), vy: rnd(-30, -15), life: rnd(0.6, 1), size: rnd(1.5, 2.5), color: '#9dff9d' });
        break;
      case 'chips':
        for (let i = 0; i < 4; i++) this.add({ kind: 'chip', x: e.x, y: e.y, vx: rnd(-30, 30), vy: rnd(-15, 15), z: 4, vz: rnd(30, 60), life: rnd(0.4, 0.7), size: rnd(1.5, 2.5), color: e.color });
        break;
    }
  }

  update(dt: number) {
    if (dt <= 0) return;
    const out: P[] = [];
    for (const p of this.list) {
      p.t += dt;
      if (p.t >= p.life) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'drop' || p.kind === 'chip') {
        p.vz -= 260 * dt;
        p.z += p.vz * dt;
        if (p.z < 0) {
          p.z = 0;
          p.vz *= -0.35;
          p.vx *= 0.6;
          p.vy *= 0.6;
        }
      } else {
        p.vx *= 1 - dt * 2.5;
        p.vy *= 1 - dt * 2.5;
      }
      out.push(p);
    }
    this.list = out;
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.list) {
      const k = p.t / p.life;
      const y = p.y - p.z;
      const glow = p.kind === 'flame' || p.kind === 'spark' || p.kind === 'flash' || p.kind === 'mote';
      ctx.globalCompositeOperation = glow ? 'lighter' : 'source-over';
      ctx.globalAlpha = 1 - k * k;
      ctx.fillStyle = p.color;
      ctx.strokeStyle = p.color;
      switch (p.kind) {
        case 'flame':
          ctx.fillStyle = k < 0.3 ? FIRE[0]! : k < 0.6 ? p.color : '#ff5a1f';
          ctx.beginPath();
          ctx.arc(p.x, y, p.size * (1 - k * 0.7), 0, TAU);
          ctx.fill();
          break;
        case 'flash': {
          const g = ctx.createRadialGradient(p.x, y, 0, p.x, y, p.size);
          g.addColorStop(0, 'rgba(255,255,255,0.95)');
          g.addColorStop(0.35, p.color);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.x, y, p.size * (0.6 + k * 0.6), 0, TAU);
          ctx.fill();
          break;
        }
        case 'spark': {
          // traço quebrado curto
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.moveTo(p.x, y);
          const a = Math.atan2(p.vy, p.vx);
          const l = p.size;
          ctx.lineTo(p.x + Math.cos(a + 0.6) * l * 0.5, y + Math.sin(a + 0.6) * l * 0.5);
          ctx.lineTo(p.x + Math.cos(a) * l, y + Math.sin(a) * l);
          ctx.stroke();
          break;
        }
        case 'streak': {
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(p.x, y, p.size * (0.6 + k), 0.2 + k * 3, 1.6 + k * 3);
          ctx.stroke();
          break;
        }
        case 'smoke':
        case 'mist':
          ctx.globalAlpha = (1 - k) * (p.kind === 'mist' ? 0.25 : 0.45);
          ctx.beginPath();
          ctx.arc(p.x, y, p.size * (0.6 + k * 0.8), 0, TAU);
          ctx.fill();
          break;
        case 'chip':
        case 'dust':
          ctx.fillRect(p.x - p.size / 2, y - p.size / 2, p.size, p.size * (p.kind === 'dust' ? 0.7 : 1));
          break;
        default:
          ctx.beginPath();
          ctx.arc(p.x, y, p.size, 0, TAU);
          ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

/** Natureza pela cor do efeito (os sistemas usam a cor da natureza ao criar explosões). */
function natureOf(color: string): Nature | null {
  const c = color.toLowerCase();
  if (c === '#ff6a2b' || c.startsWith('#ff8') || c.startsWith('#ff5')) return 'katon';
  if (c === '#4da6ff' || c.startsWith('#4d') || c.startsWith('#9f')) return 'suiton';
  if (c === '#ffe14d' || c.startsWith('#fff') || c.startsWith('#ffe')) return 'raiton';
  if (c === '#c39257' || c.startsWith('#c3') || c.startsWith('#8a6')) return 'doton';
  if (c === '#7fe0a0' || c.startsWith('#7fe')) return 'fuuton';
  return null;
}
