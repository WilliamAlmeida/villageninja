import { plainTokens } from '../core/tokens';
import type { Effect } from '../game/types';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

// pseudo-aleatório estável por efeito (evita "piscar" aleatório a cada frame)
const prand = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

export function drawEffect(ctx: Ctx, e: Effect, zoom: number) {
  const k = e.t / e.life;
  const r = e.r ?? 16;
  switch (e.kind) {
    case 'harvest':
      return; // desenhado no chão pelo renderer (drawHarvest)
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
