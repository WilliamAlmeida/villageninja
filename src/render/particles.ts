// Partículas só de visual (não entram no estado do jogo): rastro dos projéteis por natureza e explosões
// quando um efeito novo aparece. Tudo em coordenadas de cena (já projetadas). O tempo vem do relógio do
// render, então pausar o jogo congela as partículas também.
import type { Nature } from '../data/natures';
import { NATURE_VFX, type Vfx } from '../data/vfx';
import type { Effect, Projectile } from '../game/types';

type Kind = 'flame' | 'drop' | 'mist' | 'spark' | 'dust' | 'chip' | 'streak' | 'mote' | 'smoke' | 'flash' | 'leaf'
  /** gelo (losango), brasa (cai brilhando), nota musical, agulha (traço fino na direção do voo) */
  | 'shard' | 'ember' | 'note' | 'needle';

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
const LEAVES = ['#d8f27a', '#a8e05f', '#7cc444', '#f0d860']; // claras: aparecem sobre a grama
const SAND = ['#f0d9a0', '#d9b77a', '#c39257'];
const GOLD = ['#fff3b0', '#ffd34d', '#f0b429', '#c98a1a'];
const CONFETTI = ['#ff5a5a', '#ffd34d', '#4da6ff', '#7ddc6b', '#e05ad1', '#ffffff'];

const ICE = ['#ffffff', '#e0f7ff', '#9fe8ff'];
const LAVA = ['#ffe08a', '#ff8a2b', '#ff3a1a', '#b32a0a'];
const HEAT = ['#fff3b0', '#ffcf6a', '#ffb347'];
const WOOD = ['#8a5a2e', '#a8743d', '#8fcf6a', '#5f9a3a'];
const STORM = ['#ffffff', '#e6d9ff', '#c8a6ff', '#9a6bff'];
const DARK = ['#3a1858', '#5a2a8a', '#8a4ad0'];
const BLOOD = ['#ff5a6a', '#c0182b', '#7a0a18'];
const METAL = ['#ffffff', '#dfe6ec', '#9aa4ad'];
const BONE = ['#ffffff', '#efe6d0', '#d8ccb0'];
const GENJ = ['#e6d0ff', '#b36bff', '#8a4ad0'];
const SOUNDP = ['#ffe9a0', '#ffd34d', '#ffffff'];

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]!;
/** Estilo do efeito: o que veio junto (`vfx`), senão adivinhado pela cor (efeitos antigos). */
const styleOf = (e: { vfx?: Vfx; color: string }): Vfx | null => e.vfx ?? (natureOf(e.color) ? NATURE_VFX[natureOf(e.color)!] : null);

export class Particles {
  private list: P[] = [];
  private seen = new WeakSet<object>();
  /** Chão com neve: o Shunshin levanta neve. */
  snowy = false;
  /** Fração das partículas criadas (qualidade e zoom): 1 = todas; 0,5 = metade, sorteada. */
  density = 1;

  /** Fumaça de chaminé: sobe devagar, levada pelo vento. */
  chimney(x: number, y: number) {
    this.add({ kind: 'smoke', x: x + rnd(-1, 1), y, vx: rnd(4, 9), vy: rnd(-14, -9), life: rnd(1.8, 2.6), size: rnd(2.5, 4), color: '#d9d9de' });
  }

  /** Bafo de frio: nuvenzinha branca na frente do rosto. */
  /** Poeira no chão (árvore que caiu). */
  dust(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++)
      this.add({ kind: 'dust', x: x + rnd(-14, 14), y: y + rnd(-4, 4), vx: rnd(-18, 18), vy: rnd(-6, 2), life: rnd(0.5, 0.9), size: rnd(3, 5), color: pick(EARTH) });
  }

  /** Puf de fumaça clara subindo, com umas faíscas douradas (baú aberto que some). */
  puff(x: number, y: number) {
    for (let i = 0; i < 7; i++)
      this.add({ kind: 'smoke', x: x + rnd(-9, 9), y: y + rnd(-6, 2), vx: rnd(-10, 10), vy: rnd(-18, -8), life: rnd(0.5, 0.8), size: rnd(5, 8), color: '#f2efe6' });
    for (let i = 0; i < 5; i++)
      this.add({ kind: 'spark', x: x + rnd(-10, 10), y: y - rnd(4, 16), vx: 0, vy: rnd(-14, -6), life: rnd(0.25, 0.45), size: rnd(2.5, 4), color: '#fff3b0' });
  }

  breath(x: number, y: number, dir: number) {
    this.add({ kind: 'mist', x, y, vx: dir * rnd(8, 14), vy: rnd(-4, -1), life: rnd(0.5, 0.8), size: rnd(2.5, 3.5), color: '#ffffff' });
  }

  private add(p: Partial<P> & { kind: Kind; x: number; y: number }) {
    if (this.density < 1 && Math.random() > this.density) return;
    if (this.list.length >= MAX) this.list.shift();
    this.list.push({ vx: 0, vy: 0, z: 0, vz: 0, t: 0, life: 0.5, size: 2, color: '#fff', ...p });
  }

  /** Rastro dos estilos que não são as 5 naturezas básicas (e água/fogo/raio corrigidos). true = tratou. */
  private trailStyle(st: Vfx, p: Projectile, x: number, y: number, j: () => number): boolean {
    switch (st) {
      case 'fire':
        if (p.kind === 'kunai') {
          this.add({ kind: 'spark', x, y, vx: rnd(-20, 20), vy: rnd(-20, 5), life: 0.12, size: 2.5, color: pick(FIRE) }); // pavio do papel-bomba
          return true;
        }
        this.add({ kind: 'flame', x: x + j(), y: y + j(), vx: rnd(-8, 8), vy: rnd(-30, -12), life: rnd(0.3, 0.55), size: rnd(2, 3.5) * (p.size / 5), color: pick(FIRE) });
        return true;
      case 'water':
        this.add({ kind: 'drop', x: x + j(), y: y + j(), vx: rnd(-14, 14), vy: rnd(-6, 6), z: 6, vz: rnd(10, 30), life: rnd(0.4, 0.7), size: rnd(1.2, 2.2), color: pick(WATER) });
        if (Math.random() < 0.4) this.add({ kind: 'mist', x, y, life: 0.5, size: p.size * 1.2, color: '#9fd8ff' });
        return true;
      case 'lightning':
        this.add({ kind: 'spark', x: x + j(), y: y + j(), vx: rnd(-60, 60), vy: rnd(-60, 60), life: rnd(0.08, 0.18), size: rnd(3, 6), color: pick(BOLT) });
        return true;
      case 'storm':
        this.add({ kind: 'spark', x: x + j(), y: y + j(), vx: rnd(-70, 70), vy: rnd(-70, 70), life: rnd(0.08, 0.18), size: rnd(3, 7), color: pick(STORM) });
        return true;
      case 'ice':
        this.add({ kind: 'shard', x: x + j(), y: y + j(), vx: -p.vx * 0.05 + rnd(-10, 10), vy: -p.vy * 0.05 + rnd(-10, 10), life: rnd(0.25, 0.45), size: rnd(1.2, 2), color: pick(ICE) });
        return true;
      case 'lava':
        this.add({ kind: 'ember', x: x + j(), y: y + j(), vx: rnd(-20, 20), vy: rnd(-10, 10), z: 2, vz: rnd(20, 50), life: rnd(0.4, 0.8), size: rnd(1.5, 2.8), color: pick(LAVA) });
        if (Math.random() < 0.5) this.add({ kind: 'smoke', x, y, vy: -10, life: 0.6, size: p.size * 0.9, color: '#5a4038' });
        return true;
      case 'needle':
        this.add({ kind: 'mote', x, y, life: 0.15, size: 1, color: '#ffffff' });
        return true;
      case 'gold':
        this.add({ kind: 'mote', x: x + j(), y: y + j(), vy: -6, life: 0.35, size: 1.6, color: pick(GOLD) });
        return true;
      case 'dark':
        this.add({ kind: 'smoke', x: x + j(), y: y + j(), vy: -8, life: 0.5, size: p.size, color: pick(DARK) });
        return true;
    }
    return false;
  }

  /** Rastro de um projétil (posição já na cena, voando na altura do peito). */
  trail(p: Projectile, x: number, y: number, dt: number) {
    const n = Math.random() < dt * 60 ? 1 : 0;
    const nat = p.nature as Nature | null;
    if (p.kind === 'kunai' && p.vfx !== 'fire') return;
    const st = p.vfx ?? (nat ? NATURE_VFX[nat] : null);
    for (let i = 0; i < n + (p.size > 6 ? 1 : 0); i++) {
      const j = () => rnd(-p.size, p.size) * 0.6;
      if (st && this.trailStyle(st, p, x, y, j)) continue;
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
    const vs = styleOf(e);
    const nat: Nature | null = vs === 'fire' ? 'katon' : vs === 'water' ? 'suiton' : vs === 'lightning' ? 'raiton' : vs === 'earth' ? 'doton' : vs === 'wind' ? 'fuuton' : null;
    switch (e.kind) {
      case 'treasure': {
        // baú aberto: clarão, moedas que pulam e quicam, confete subindo e caindo, estrelinhas
        this.add({ kind: 'flash', x: e.x, y: e.y - 4, life: 0.25, size: 26, color: '#fff3b0' });
        for (let i = 0; i < 14; i++)
          this.add({ kind: 'chip', x: e.x + rnd(-4, 4), y: e.y, vx: rnd(-40, 40), vy: rnd(-10, 14), z: 4, vz: rnd(70, 130), life: rnd(0.8, 1.2), size: rnd(2, 3), color: pick(GOLD) });
        for (let i = 0; i < 26; i++)
          this.add({ kind: 'leaf', x: e.x + rnd(-6, 6), y: e.y, vx: rnd(-45, 45), vy: rnd(-12, 12), z: 6, vz: rnd(70, 120), life: rnd(1.2, 1.8), size: rnd(1.6, 2.6), color: pick(CONFETTI) });
        for (let i = 0; i < 8; i++)
          this.add({ kind: 'spark', x: e.x + rnd(-14, 14), y: e.y - rnd(6, 26), vx: 0, vy: rnd(-12, -4), life: rnd(0.25, 0.5), size: rnd(3, 5), color: '#fff6a8' });
        break;
      }
      case 'flicker': {
        // Shunshin: cada vila / natureza some de um jeito
        const swirl = (i: number, n: number, sp: number) => {
          const a = (i / n) * TAU + rnd(-0.3, 0.3);
          return { x: e.x + Math.cos(a) * r * 0.4, y: e.y - 8 + Math.sin(a) * r * 0.2, vx: -Math.sin(a) * sp + Math.cos(a) * sp * 0.4, vy: Math.cos(a) * sp * 0.5 - 18 };
        };
        // na neve, o redemoinho levanta neve junto
        if (this.snowy)
          for (let i = 0; i < 10; i++) this.add({ ...swirl(i, 10, rnd(30, 60)), kind: 'chip', z: 2, vz: rnd(40, 80), life: rnd(0.5, 0.9), size: rnd(1.5, 2.5), color: '#f4f8ff' });
        if (e.variant === 'leaf') {
          // Konoha: puf de fumaça com folhas girando
          for (let i = 0; i < 4; i++) this.add({ kind: 'smoke', x: e.x + rnd(-r, r) * 0.4, y: e.y - 8 + rnd(-4, 4), vx: rnd(-10, 10), vy: rnd(-12, -4), life: rnd(0.4, 0.7), size: r * rnd(0.35, 0.55), color: '#f2f2ea' });
          for (let i = 0; i < 16; i++) this.add({ ...swirl(i, 16, rnd(45, 80)), kind: 'leaf', life: rnd(0.7, 1.1), size: rnd(2.6, 3.8), color: pick(LEAVES) });
        }
        else if (e.variant === 'water') {
          for (let i = 0; i < 14; i++) this.add({ ...swirl(i, 14, rnd(30, 60)), kind: 'drop', z: 6, vz: rnd(40, 90), life: rnd(0.4, 0.8), size: rnd(1.4, 2.4), color: pick(WATER) });
          this.add({ kind: 'mist', x: e.x, y: e.y - 6, life: 0.5, size: r * 1.2, color: '#9fd8ff' });
        } else if (e.variant === 'fire') {
          // Katon: redemoinho de chamas subindo, brasas pulando e um puf de fumaça escura
          for (let i = 0; i < 5; i++) this.add({ ...swirl(i, 5, rnd(30, 50)), kind: 'flame', life: rnd(0.3, 0.5), size: rnd(1.4, 2.2), color: pick(FIRE.slice(1)) });
          for (let i = 0; i < 14; i++) this.add({ ...swirl(i, 14, rnd(40, 70)), kind: 'ember', life: rnd(0.4, 0.7), size: rnd(1.6, 2.6), color: pick(['#ffd24d', '#ff8a2b', '#ff5a1f', '#ff3a1a']) });
          for (let i = 0; i < 8; i++) this.add({ ...swirl(i, 8, rnd(20, 50)), kind: 'ember', z: 4, vz: rnd(40, 90), life: rnd(0.5, 0.9), size: rnd(1.3, 2.2), color: pick(LAVA) });
          for (let i = 0; i < 3; i++) this.add({ kind: 'smoke', x: e.x + rnd(-r, r) * 0.3, y: e.y - 10, vx: rnd(-8, 8), vy: rnd(-20, -10), life: rnd(0.5, 0.8), size: r * rnd(0.2, 0.3), color: '#4a3c38' });
        } else if (e.variant === 'spark') {
          // Raiton: estalo de faíscas em volta do corpo e um clarão curto, sem fumaça
          this.add({ kind: 'flash', x: e.x, y: e.y - 10, life: 0.1, size: r * 1.1, color: '#e6f4ff' });
          for (let i = 0; i < 16; i++) {
            const a = rnd(0, TAU);
            this.add({ kind: 'spark', x: e.x + Math.cos(a) * r * 0.3, y: e.y - 10 + Math.sin(a) * r * 0.5, vx: Math.cos(a) * rnd(60, 120), vy: Math.sin(a) * rnd(40, 90), life: rnd(0.08, 0.2), size: rnd(3, 7), color: pick(BOLT) });
          }
        } else if (e.variant === 'wind') {
          // Fuuton: riscos de vento girando em volta (o redemoinho do desenho) e poeira levantada no chão
          for (let i = 0; i < 14; i++) this.add({ ...swirl(i, 14, rnd(70, 110)), kind: 'streak', life: rnd(0.25, 0.4), size: rnd(5, 9), color: pick(WIND) });
          for (let i = 0; i < 6; i++) this.add({ ...swirl(i, 6, rnd(25, 45)), y: e.y + rnd(-2, 2), kind: 'dust', life: rnd(0.4, 0.7), size: rnd(1.8, 2.8), color: '#d8cdb0' });
        } else if (e.variant === 'sand') for (let i = 0; i < 16; i++) this.add({ ...swirl(i, 16, rnd(40, 80)), kind: 'dust', life: rnd(0.5, 0.9), size: rnd(1.8, 3.2), color: pick(SAND) });
        else if (e.variant === 'flash') {
          this.add({ kind: 'flash', x: e.x, y: e.y - 10, life: 0.15, size: r * 1.4, color: '#ffd34d' });
          for (let i = 0; i < 10; i++) this.add({ kind: 'spark', x: e.x, y: e.y - 10, vx: rnd(-90, 90), vy: rnd(-90, 60), life: rnd(0.1, 0.22), size: rnd(3, 7), color: pick(BOLT) });
        } else {
          // névoa (renegados) ou fumaça
          const mist = e.variant === 'mist';
          for (let i = 0; i < 8; i++)
            this.add({ kind: mist ? 'mist' : 'smoke', x: e.x + rnd(-r, r) * 0.5, y: e.y - 6 + rnd(-r, r) * 0.25, vx: rnd(-14, 14), vy: rnd(-12, -2), life: rnd(0.5, 0.9), size: r * rnd(0.4, 0.7), color: e.color });
        }
        break;
      }
      case 'hit': {
        // golpe corpo a corpo: estrelinha de faíscas e lascas na cor do estilo
        const st = styleOf(e) ?? 'impact';
        const pal = st === 'metal' ? METAL : st === 'blood' ? BLOOD : st === 'wood' ? WOOD : st === 'bone' ? BONE : ['#ffffff', '#fff3d0', e.color];
        this.add({ kind: 'flash', x: e.x, y: e.y, life: 0.1, size: r * 1.1, color: '#ffffff' });
        for (let i = 0; i < 7 + r / 3; i++) {
          const a = rnd(0, TAU);
          const sp = rnd(50, 110) * (r / 12);
          this.add({ kind: 'spark', x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7, life: rnd(0.08, 0.18), size: rnd(3, 6), color: pick(pal) });
        }
        if (st === 'blood') for (let i = 0; i < 5; i++) this.add({ kind: 'drop', x: e.x, y: e.y, vx: rnd(-40, 40), vy: rnd(-10, 10), z: 6, vz: rnd(30, 70), life: rnd(0.4, 0.7), size: rnd(1.4, 2.2), color: pick(BLOOD) });
        break;
      }
      case 'beam': {
        // partículas correndo pelo feixe (cura, dreno, ilusão)
        const x2 = e.x2 ?? e.x;
        const y2 = e.y2 ?? e.y;
        const st = styleOf(e);
        for (let i = 0; i < 10; i++) {
          const k = Math.random();
          this.add({ kind: st === 'leaf' ? 'leaf' : 'mote', x: e.x + (x2 - e.x) * k, y: e.y + (y2 - e.y) * k, vx: (x2 - e.x) * 0.6, vy: (y2 - e.y) * 0.6, life: rnd(0.25, 0.45), size: rnd(1.4, 2.2), color: st === 'leaf' ? pick(LEAVES) : e.color });
        }
        break;
      }
      case 'wave': {
        const st = styleOf(e);
        if (st === 'sound') for (let i = 0; i < 10; i++) {
          const a = rnd(0, TAU);
          this.add({ kind: 'note', x: e.x + Math.cos(a) * r * 0.3, y: e.y + Math.sin(a) * r * 0.15 - 10, vx: Math.cos(a) * 40, vy: Math.sin(a) * 20 - 15, life: rnd(0.8, 1.2), size: rnd(3, 4), color: pick(SOUNDP) });
        }
        else for (let i = 0; i < 16; i++) {
          const a = (i / 16) * TAU;
          this.add({ kind: 'dust', x: e.x + Math.cos(a) * r * 0.3, y: e.y + Math.sin(a) * r * 0.15, vx: Math.cos(a) * r * 1.2, vy: Math.sin(a) * r * 0.6, life: 0.5, size: rnd(2.5, 4), color: st === 'genjutsu' || st === 'dark' ? pick(GENJ) : '#cdb48a' });
        }
        break;
      }
      case 'gust':
        // rajada: riscos de vento correndo do lançador até o alvo
        for (let i = 0; i < 14; i++) {
          const k = Math.random() * 0.4;
          const x2 = e.x2 ?? e.x;
          const y2 = e.y2 ?? e.y;
          this.add({ kind: 'streak', x: e.x + (x2 - e.x) * k + rnd(-10, 10), y: e.y + (y2 - e.y) * k + rnd(-6, 6) - 8, vx: (x2 - e.x) * 2, vy: (y2 - e.y) * 2, life: rnd(0.25, 0.4), size: rnd(5, 10), color: pick(WIND) });
        }
        break;
      case 'burst': {
        const st = styleOf(e);
        if (st && st !== 'fire' && st !== 'water' && st !== 'lightning' && st !== 'earth' && st !== 'wind') {
          this.burstStyle(st, e, r);
          break;
        }
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
          for (let i = 0; i < 8; i++) this.add({ kind: 'spark', x, y, vx: rnd(-80, 80), vy: rnd(-80, 80), life: rnd(0.1, 0.2), size: rnd(3, 7), color: pick(e.vfx === 'storm' ? STORM : BOLT) });
        break;
      case 'slash':
        for (let i = 0; i < 6; i++) this.add({ kind: 'spark', x: e.x, y: e.y, vx: rnd(-50, 50), vy: rnd(-50, 20), life: 0.15, size: rnd(2, 4), color: '#ffffff' });
        break;
      case 'smoke':
        for (let i = 0; i < 8; i++) this.add({ kind: 'smoke', x: e.x + rnd(-r, r) * 0.5, y: e.y + rnd(-r, r) * 0.3, vx: rnd(-10, 10), vy: rnd(-16, -4), life: rnd(0.5, 0.9), size: r * rnd(0.3, 0.5), color: e.color });
        break;
      case 'heal':
        for (let i = 0; i < 8 + r / 6; i++) this.add({ kind: 'mote', x: e.x + rnd(-r, r), y: e.y + rnd(-4, 6), vy: rnd(-30, -15), life: rnd(0.6, 1), size: rnd(1.5, 2.5), color: e.color });
        break;
      case 'chips':
        for (let i = 0; i < 4; i++) this.add({ kind: 'chip', x: e.x, y: e.y, vx: rnd(-30, 30), vy: rnd(-15, 15), z: 4, vz: rnd(30, 60), life: rnd(0.4, 0.7), size: rnd(1.5, 2.5), color: e.color });
        break;
    }
  }

  /** Explosão dos estilos especiais (gelo, lava, calor, madeira, tempestade, sangue, agulha, sombra…). */
  private burstStyle(st: Vfx, e: Effect, r: number) {
    const n = Math.min(44, 14 + r);
    const ring = (sp: number) => {
      const a = rnd(0, TAU);
      const v = rnd(0.4, 1) * sp * (r / 20);
      return { x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.5 };
    };
    const flash = (c: string) => this.add({ kind: 'flash', x: e.x, y: e.y, life: 0.14, size: r * 0.8, color: c });
    switch (st) {
      case 'ice':
        flash('#e0f7ff');
        for (let i = 0; i < n; i++) this.add({ ...ring(90), kind: 'shard', z: 3, vz: rnd(30, 80), life: rnd(0.5, 0.9), size: rnd(1.6, 3), color: pick(ICE) });
        for (let i = 0; i < 4; i++) this.add({ kind: 'mist', x: e.x + rnd(-r, r) * 0.4, y: e.y, vy: -6, life: 0.8, size: r * 0.5, color: '#e0f7ff' });
        break;
      case 'lava':
        flash('#ff8a2b');
        for (let i = 0; i < n; i++) this.add({ ...ring(80), kind: 'ember', z: 3, vz: rnd(60, 130), life: rnd(0.7, 1.2), size: rnd(2, 3.5), color: pick(LAVA) });
        for (let i = 0; i < n / 2; i++) this.add({ ...ring(50), kind: 'flame', life: rnd(0.4, 0.7), size: rnd(3, 6), color: pick(LAVA) });
        for (let i = 0; i < 6; i++) this.add({ kind: 'smoke', x: e.x + rnd(-r, r) * 0.4, y: e.y, vy: rnd(-18, -8), life: rnd(0.8, 1.2), size: r * rnd(0.35, 0.55), color: '#4a3530' });
        break;
      case 'heat':
        // Shakuton: esferas incandescentes que estouram em volta do alvo
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU;
          this.add({ kind: 'flash', x: e.x + Math.cos(a) * r * 0.55, y: e.y + Math.sin(a) * r * 0.28, life: rnd(0.3, 0.5), size: r * 0.4, color: '#ffcf6a' });
        }
        for (let i = 0; i < n; i++) this.add({ ...ring(60), kind: 'mote', vy: rnd(-40, -15), life: rnd(0.5, 0.9), size: rnd(2, 3.5), color: pick(HEAT) });
        break;
      case 'wood':
        for (let i = 0; i < n; i++) this.add({ ...ring(70), kind: Math.random() < 0.4 ? 'leaf' : 'chip', z: 2, vz: rnd(40, 90), life: rnd(0.6, 1), size: rnd(2, 3.5), color: pick(WOOD) });
        break;
      case 'storm':
        flash('#c8a6ff');
        for (let i = 0; i < n; i++) this.add({ ...ring(140), kind: 'spark', life: rnd(0.1, 0.25), size: rnd(4, 8), color: pick(STORM) });
        break;
      case 'blood':
        for (let i = 0; i < n; i++) this.add({ ...ring(70), kind: 'drop', z: 4, vz: rnd(40, 90), life: rnd(0.5, 0.9), size: rnd(1.5, 2.5), color: pick(BLOOD) });
        break;
      case 'needle':
        for (let i = 0; i < n / 2; i++) this.add({ ...ring(120), kind: 'needle', life: rnd(0.15, 0.3), size: rnd(4, 7), color: pick(METAL) });
        break;
      case 'metal':
        for (let i = 0; i < 8; i++) this.add({ ...ring(110), kind: 'spark', life: rnd(0.08, 0.16), size: rnd(2, 4), color: pick(METAL) });
        break;
      case 'gold':
        flash('#ffd34d');
        for (let i = 0; i < n; i++) this.add({ ...ring(90), kind: 'spark', life: rnd(0.1, 0.22), size: rnd(3, 6), color: pick(GOLD) });
        break;
      case 'dark':
      case 'genjutsu':
        for (let i = 0; i < n; i++) this.add({ ...ring(40), kind: 'smoke', vy: rnd(-16, -6), life: rnd(0.6, 1), size: rnd(3, 6), color: pick(st === 'dark' ? DARK : GENJ) });
        break;
      case 'leaf':
        for (let i = 0; i < n; i++) this.add({ ...ring(60), kind: 'leaf', life: rnd(0.8, 1.3), size: rnd(2.4, 3.6), color: pick(LEAVES) });
        break;
      case 'bone':
        for (let i = 0; i < n / 2; i++) this.add({ ...ring(80), kind: 'chip', z: 2, vz: rnd(40, 90), life: rnd(0.5, 0.9), size: rnd(2, 3.5), color: pick(BONE) });
        break;
      case 'web':
        for (let i = 0; i < n / 2; i++) this.add({ ...ring(100), kind: 'streak', life: 0.4, size: rnd(5, 10), color: '#ffffff' });
        break;
      case 'sound':
        for (let i = 0; i < 8; i++) this.add({ ...ring(50), kind: 'note', vy: rnd(-30, -10), life: rnd(0.7, 1.1), size: rnd(3, 4), color: pick(SOUNDP) });
        break;
      default:
        for (let i = 0; i < n; i++) this.add({ ...ring(80), kind: 'spark', life: rnd(0.08, 0.18), size: rnd(3, 6), color: '#ffffff' });
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
      if (p.kind === 'drop' || p.kind === 'chip' || p.kind === 'ember' || p.kind === 'shard') {
        p.vz -= 260 * dt;
        p.z += p.vz * dt;
        if (p.z < 0) {
          p.z = 0;
          p.vz *= -0.35;
          p.vx *= 0.6;
          p.vy *= 0.6;
        }
      } else if (p.kind === 'leaf' && p.z > 0) {
        // confete: sobe, flutua e cai devagar até o chão
        p.vz -= 110 * dt;
        p.z = Math.max(0, p.z + p.vz * dt);
        p.vx *= 1 - dt * 1.5;
        p.vy *= 1 - dt * 1.5;
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
      const glow = p.kind === 'flame' || p.kind === 'spark' || p.kind === 'flash' || p.kind === 'mote' || p.kind === 'ember' || p.kind === 'shard';
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
        case 'shard': {
          // losango de gelo
          const s = p.size;
          ctx.beginPath();
          ctx.moveTo(p.x, y - s * 1.6);
          ctx.lineTo(p.x + s * 0.7, y);
          ctx.lineTo(p.x, y + s * 1.6);
          ctx.lineTo(p.x - s * 0.7, y);
          ctx.closePath();
          ctx.fill();
          break;
        }
        case 'ember':
          ctx.fillRect(p.x - p.size / 2, y - p.size / 2, p.size, p.size);
          break;
        case 'note': {
          // nota musical: cabeça + haste
          ctx.beginPath();
          ctx.ellipse(p.x, y, p.size * 0.6, p.size * 0.45, -0.4, 0, TAU);
          ctx.fill();
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x + p.size * 0.5, y);
          ctx.lineTo(p.x + p.size * 0.5, y - p.size * 2);
          ctx.lineTo(p.x + p.size * 1.2, y - p.size * 1.6);
          ctx.stroke();
          break;
        }
        case 'needle': {
          const a = Math.atan2(p.vy, p.vx);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x - Math.cos(a) * p.size, y - Math.sin(a) * p.size);
          ctx.lineTo(p.x + Math.cos(a) * p.size, y + Math.sin(a) * p.size);
          ctx.stroke();
          break;
        }
        case 'leaf':
          ctx.save();
          ctx.translate(p.x, y);
          ctx.rotate(p.t * 9 + p.size * 3);
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, TAU);
          ctx.fill();
          ctx.restore();
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
export function natureOf(color: string): Nature | null {
  const c = color.toLowerCase();
  if (c === '#ff6a2b' || c.startsWith('#ff8') || c.startsWith('#ff5')) return 'katon';
  if (c === '#4da6ff' || c.startsWith('#4d') || c.startsWith('#9f')) return 'suiton';
  if (c === '#ffe14d' || c.startsWith('#fff') || c.startsWith('#ffe')) return 'raiton';
  if (c === '#c39257' || c.startsWith('#c3') || c.startsWith('#8a6')) return 'doton';
  if (c === '#7fe0a0' || c.startsWith('#7fe')) return 'fuuton';
  return null;
}
