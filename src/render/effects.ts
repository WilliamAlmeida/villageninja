import { plainTokens } from '../core/tokens';
import type { Effect } from '../game/types';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

// pseudo-aleatório estável por efeito (evita "piscar" aleatório a cada frame)
const prand = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

export function drawEffect(ctx: Ctx, e: Effect, zoom: number, snowy = false) {
  const k = e.t / e.life;
  const r = e.r ?? 16;
  switch (e.kind) {
    case 'harvest':
    case 'afterimage':
      return; // canteiro: no chão (drawHarvest); vulto: o renderer desenha o sprite do ninja
    case 'flicker': {
      // redemoinho curto onde o ninja some / aparece (folhas, névoa, água e areia vêm das partículas)
      if (e.variant === 'flash') {
        ctx.globalAlpha = (1 - k) * 0.9;
        const g = ctx.createRadialGradient(e.x, e.y - 10, 0, e.x, e.y - 10, r * 1.6);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.3, e.color);
        g.addColorStop(1, e.color + '00');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(e.x, e.y - 10, r * 1.6, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#fffbe0';
        ctx.fillRect(e.x - 1, e.y - 34 * (1 - k), 2, 34 * (1 - k)); // risco vertical do clarão
        break;
      }
      ctx.globalAlpha = (1 - k) * 0.7;
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 2;
      for (let j = 0; j < 2; j++) {
        ctx.beginPath();
        for (let i = 0; i < 24; i++) {
          const a = i * 0.4 + e.t * 10 + j * Math.PI;
          const rr = (i / 24) * r * (0.6 + k * 0.6);
          ctx.lineTo(e.x + Math.cos(a) * rr, e.y - 8 - k * 10 + Math.sin(a) * rr * 0.5);
        }
        ctx.stroke();
      }
      break;
    }
    case 'log': {
      // tronco do Kawarimi: cai no lugar do ninja, fica um instante e some
      const drop = Math.max(0, 1 - e.t / 0.18) * 10;
      ctx.globalAlpha = k < 0.7 ? 1 : (1 - k) / 0.3;
      const y = e.y - 5 - drop;
      ctx.fillStyle = '#6b4424';
      ctx.fillRect(e.x - 9, y - 4, 16, 8);
      ctx.fillStyle = e.color;
      ctx.fillRect(e.x - 9, y - 4, 16, 3);
      ctx.fillStyle = '#c99a62';
      ctx.beginPath();
      ctx.ellipse(e.x + 7, y, 3, 4, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#7a5530';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.ellipse(e.x + 7, y, 1.4, 2, 0, 0, TAU);
      ctx.stroke();
      if (snowy && !drop) {
        // meio enterrado na neve
        ctx.fillStyle = '#eef4fb';
        ctx.beginPath();
        ctx.ellipse(e.x - 1, e.y - 1.5, 12, 3.6, 0, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 'seal': {
      // chakra se juntando nas mãos durante os selos
      const hx = e.x;
      const hy = e.y - 12;
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU + e.t * 9;
        const d = 12 * (1 - k) + 2;
        ctx.globalAlpha = 0.5 + 0.5 * k;
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(hx + Math.cos(a) * d, hy + Math.sin(a) * d * 0.6, 1.4 + k, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 0.25 + 0.5 * k;
      const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, 6 + k * 4);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.5, e.color);
      g.addColorStop(1, e.color + '00');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(hx, hy, 6 + k * 4, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      break;
    }
    case 'text': {
      const size = (e.big ? 10 : 8.5) * Math.max(1, 1.1 / zoom);
      ctx.globalAlpha = 1 - k * k;
      ctx.font = `bold ${size}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const y = e.y - k * (e.big ? 18 : 24);
      const s = e.big ? 1 + Math.max(0, 0.3 - e.t) : 1;
      ctx.save();
      ctx.translate(e.x, y);
      ctx.scale(s, s);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      const text = plainTokens(e.text ?? '');
      ctx.strokeText(text, 0, 0);
      ctx.fillStyle = e.color;
      ctx.fillText(text, 0, 0);
      ctx.restore();
      break;
    }
    case 'burst': {
      // núcleo curto; o grosso da explosão vem das partículas (render/particles.ts)
      ctx.globalAlpha = (1 - k) * (1 - k) * 0.45;
      const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r * (0.4 + 0.6 * k));
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.4, e.color);
      g.addColorStop(1, e.color + '00');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r * (0.4 + 0.6 * k), 0, TAU);
      ctx.fill();
      break;
    }
    case 'treasure': {
      // coluna de luz dourada subindo do baú
      ctx.globalAlpha = (1 - k) * 0.55;
      const h = r * (1.2 + 1.6 * k);
      const g = ctx.createLinearGradient(e.x, e.y, e.x, e.y - h);
      g.addColorStop(0, '#fff3b0');
      g.addColorStop(0.5, e.color + '88');
      g.addColorStop(1, e.color + '00');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(e.x - r * 0.35, e.y);
      ctx.lineTo(e.x + r * 0.35, e.y);
      ctx.lineTo(e.x + r * 0.6, e.y - h);
      ctx.lineTo(e.x - r * 0.6, e.y - h);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'ring':
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 3 * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r * (0.3 + 0.7 * k), 0, TAU);
      ctx.stroke();
      break;
    case 'slash':
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r * (0.6 + 0.4 * k), -1 + k * 4, 0.6 + k * 4);
      ctx.stroke();
      break;
    case 'smoke':
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        const d = r * k;
        ctx.globalAlpha = (1 - k) * 0.8;
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d * 0.7 - k * 6, r * 0.45 * (0.6 + k), 0, TAU);
        ctx.fill();
      }
      break;
    case 'bolt': {
      const x2 = e.x2 ?? e.x;
      const y2 = e.y2 ?? e.y;
      ctx.globalAlpha = 1 - k;
      for (const [w, c] of [[4, e.color], [1.5, '#ffffff']] as const) {
        ctx.strokeStyle = c;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        const n = 7;
        for (let i = 1; i < n; i++) {
          const t = i / n;
          const j = (prand(i + e.x + Math.floor(e.t * 20)) - 0.5) * 14;
          ctx.lineTo(e.x + (x2 - e.x) * t - ((y2 - e.y) / 100) * j, e.y + (y2 - e.y) * t + ((x2 - e.x) / 100) * j);
        }
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      break;
    }
    case 'hit': {
      // estrela de impacto: 4 pontas que se abrem e somem rápido
      const s = r * (0.6 + k * 0.8);
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + 0.4;
        const l = i % 2 ? s * 0.3 : s;
        ctx.lineTo(e.x + Math.cos(a) * l, e.y + Math.sin(a) * l * 0.8);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      break;
    }
    case 'beam': {
      // feixe: linha brilhante com núcleo branco que se apaga
      const x2 = e.x2 ?? e.x;
      const y2 = e.y2 ?? e.y;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (1 - k) * 0.7;
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 4 * (1 - k) + 1;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      break;
    }
    case 'wave':
      // ondas que se abrem (som, miragem, repulsão): 3 anéis atrasados, achatados no chão
      ctx.strokeStyle = e.color;
      for (let i = 0; i < 3; i++) {
        const kk = k - i * 0.15;
        if (kk <= 0 || kk >= 1) continue;
        ctx.globalAlpha = (1 - kk) * 0.8;
        ctx.lineWidth = 3 * (1 - kk) + 1;
        ctx.beginPath();
        for (let j = 0; j <= 40; j++) {
          const a = (j / 40) * TAU;
          const wob = e.vfx === 'sound' || e.vfx === 'genjutsu' ? 1 + Math.sin(a * 8 + kk * 20) * 0.06 : 1;
          const rr = r * kk * wob;
          ctx.lineTo(e.x + Math.cos(a) * rr, e.y + Math.sin(a) * rr * 0.5);
        }
        ctx.stroke();
      }
      break;
    case 'gust': {
      // rajada em leque: arcos de vento avançando do lançador até o alvo
      const x2 = e.x2 ?? e.x;
      const y2 = e.y2 ?? e.y;
      const a = Math.atan2(y2 - e.y, x2 - e.x);
      const d = Math.hypot(x2 - e.x, y2 - e.y);
      ctx.strokeStyle = e.color;
      for (let i = 0; i < 4; i++) {
        const kk = k * 1.2 - i * 0.12;
        if (kk <= 0 || kk >= 1) continue;
        const cx = e.x + Math.cos(a) * d * kk;
        const cy = e.y + Math.sin(a) * d * kk - 8;
        ctx.globalAlpha = (1 - kk) * 0.9;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cx, cy, 10 + kk * r * 0.6, a - 0.9, a + 0.9);
        ctx.stroke();
      }
      break;
    }
    case 'wind': {
      const x2 = e.x2 ?? e.x;
      const y2 = e.y2 ?? e.y;
      ctx.globalAlpha = (1 - k) * 0.8;
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 2;
      for (let i = -2; i <= 2; i++) {
        const px = -(y2 - e.y);
        const py = x2 - e.x;
        const len = Math.hypot(px, py) || 1;
        const ox = (px / len) * i * 7;
        const oy = (py / len) * i * 7;
        ctx.beginPath();
        ctx.moveTo(e.x + ox, e.y + oy);
        ctx.quadraticCurveTo((e.x + x2) / 2 + ox * 2, (e.y + y2) / 2 + oy * 2, e.x + (x2 - e.x) * (0.3 + k) + ox, e.y + (y2 - e.y) * (0.3 + k) + oy);
        ctx.stroke();
      }
      break;
    }
    case 'heal':
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = e.color;
      for (let i = 0; i < 4; i++) {
        const px = e.x + (prand(i + e.x) - 0.5) * r * 1.6;
        const py = e.y - k * 20 - prand(i * 3 + e.y) * 10;
        ctx.fillRect(px - 1, py - 4, 2, 8);
        ctx.fillRect(px - 4, py - 1, 8, 2);
      }
      break;
    case 'swirl':
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 40; i++) {
        const a = i * 0.35 + e.t * 8;
        const rr = (i / 40) * r;
        ctx.lineTo(e.x + Math.cos(a) * rr, e.y + Math.sin(a) * rr * 0.6);
      }
      ctx.stroke();
      break;
    case 'chips':
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = e.color;
      for (let i = 0; i < 5; i++) {
        const a = prand(i + e.x * 0.37 + e.y) * TAU;
        const d = 4 + k * 12;
        ctx.fillRect(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d - k * 6, 2, 2);
      }
      break;
  }
  ctx.globalAlpha = 1;
}
