// Desenho provisório dos campos cercados (game/fields.ts), até a arte do Codex (folha de 32×32 por cultura e etapa,
// chão do canteiro e peças de cerca): o chão de cada canteiro no losango do tile (crua, arada, úmida), as plantas em
// quatro touceiras por canteiro conforme a etapa e a cultura, e a cerca nas bordas do cercado (portão na frente).
import { TILE } from '../config';
import { project } from '../core/iso';
import { CROPS, growStage } from '../data/crops';
import type { FieldDraft } from '../game/fields';
import type { Game } from '../game/game';
import { isExplored } from '../game/explore';
import type { Field, Plot } from '../game/types';
import { idx } from '../game/world';

type Ctx = CanvasRenderingContext2D;
const P = (x: number, y: number) => project(x * TILE, y * TILE);

function diamond(ctx: Ctx, tx: number, ty: number, inset = 0) {
  const a = P(tx + inset, ty + inset);
  const b = P(tx + 1 - inset, ty + inset);
  const c = P(tx + 1 - inset, ty + 1 - inset);
  const d = P(tx + inset, ty + 1 - inset);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
}

/** Chão do canteiro: terra crua (capim ralo), arada (sulcos) ou úmida (mais escura). */
function soil(ctx: Ctx, p: Plot, winter: boolean) {
  const wet = !!(p.wet && p.wet > 0) && p.st >= 1;
  diamond(ctx, p.tx, p.ty, 0.04);
  ctx.fillStyle = p.st === 0 ? (winter ? '#b9ad94' : '#9d8a57') : wet ? '#5b4129' : '#7a5a36';
  ctx.fill();
  if (p.st === 0) return;
  // sulcos ao longo do canteiro
  ctx.strokeStyle = wet ? '#3f2c1a' : '#5a4026';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let k = 1; k < 4; k++) {
    const a = P(p.tx + 0.1, p.ty + k / 4);
    const b = P(p.tx + 0.9, p.ty + k / 4);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();
}

const SPOTS: [number, number][] = [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]];

/** Uma touceira da planta em (x, y) da cena, na etapa `st` (0 semente … 4 madura). */
function plant(ctx: Ctx, crop: Plot['crop'], st: number, x: number, y: number, sway: number) {
  const c = CROPS[crop ?? 'wheat'];
  if (st === 0) {
    ctx.fillStyle = '#3a2814';
    ctx.fillRect(x - 2, y - 1, 1.5, 1.5);
    ctx.fillRect(x + 1, y, 1.5, 1.5);
    return;
  }
  const h = [0, 3, 6, 9, 11][st]!;
  ctx.strokeStyle = c.leaf;
  ctx.fillStyle = c.leaf;
  ctx.lineWidth = 1.2;
  if (c.id === 'wheat' || c.id === 'rice') {
    // talos, com a espiga na ponta (dourada madura, esverdeada antes)
    ctx.beginPath();
    for (const dx of [-3, -1, 1, 3]) {
      ctx.moveTo(x + dx, y);
      ctx.lineTo(x + dx + sway, y - h);
    }
    ctx.stroke();
    if (st >= 3) {
      ctx.fillStyle = st === 4 ? c.fruit : '#b9c96a';
      for (const dx of [-3, -1, 1, 3]) ctx.fillRect(x + dx + sway - 1, y - h - 2, 2, 3);
    }
    return;
  }
  // folhas em leque
  ctx.beginPath();
  for (const dx of [-3, 0, 3]) {
    ctx.moveTo(x, y);
    ctx.lineTo(x + dx * (0.6 + st * 0.15), y - h * 0.8);
  }
  ctx.stroke();
  if (st < 3) return;
  const r = st === 4 ? 1 : 0.7;
  ctx.fillStyle = c.fruit;
  ctx.beginPath();
  if (c.id === 'cabbage') ctx.ellipse(x, y - 3, 4.5 * r, 3.5 * r, 0, 0, Math.PI * 2);
  else if (c.id === 'pumpkin') ctx.ellipse(x + 1, y - 2, 5 * r, 3.5 * r, 0, 0, Math.PI * 2);
  else if (c.id === 'turnip') ctx.ellipse(x, y - 1, 2.6 * r, 2.2 * r, 0, 0, Math.PI * 2);
  else for (const [dx, dy] of [[-2, -h], [2, -h + 1], [0, -h - 2]] as const) ctx.rect(x + dx - 1, y + dy - 1, 2.2, 2.2); // ervas: florzinhas
  ctx.fill();
  if (c.id === 'pumpkin' || c.id === 'cabbage') {
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
}

/** Trecho de cerca entre dois pontos do mundo (tiles): postes nas pontas e no meio, duas ripas. `gate` = só os postes. */
function fence(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, gate: boolean) {
  const a = P(x0, y0);
  const b = P(x1, y1);
  const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const H = 7;
  if (!gate) {
    ctx.strokeStyle = '#4a2e16';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (const k of [3, 6]) {
      ctx.moveTo(a.x, a.y - k);
      ctx.lineTo(b.x, b.y - k);
    }
    ctx.stroke();
    ctx.strokeStyle = '#a8743c';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  for (const p of gate ? [a, b] : [a, m, b]) {
    ctx.fillStyle = '#4a2e16';
    ctx.fillRect(p.x - 1.5, p.y - H - (gate ? 2 : 0), 3, H + (gate ? 2 : 0) + 1);
    ctx.fillStyle = gate ? '#c48a4a' : '#9a6634';
    ctx.fillRect(p.x - 0.8, p.y - H - (gate ? 2 : 0) + 0.6, 1.6, H + (gate ? 2 : 0) - 0.4);
  }
}

/** Bordas do cercado: atrás (cima/esquerda, desenhadas antes das plantas) e na frente (depois), com o portão. */
function fences(ctx: Ctx, f: Field, has: (tx: number, ty: number) => boolean, front: boolean) {
  // portão: no canteiro mais à frente (maior tx+ty), na borda de baixo
  let gate: Plot | undefined;
  for (const p of f.plots) if (!has(p.tx, p.ty + 1) && (!gate || p.tx + p.ty > gate.tx + gate.ty)) gate = p;
  for (const p of f.plots) {
    const { tx, ty } = p;
    if (!front) {
      if (!has(tx, ty - 1)) fence(ctx, tx, ty, tx + 1, ty, false);
      if (!has(tx - 1, ty)) fence(ctx, tx, ty, tx, ty + 1, false);
    } else {
      if (!has(tx + 1, ty)) fence(ctx, tx + 1, ty, tx + 1, ty + 1, false);
      if (!has(tx, ty + 1)) fence(ctx, tx, ty + 1, tx + 1, ty + 1, p === gate);
    }
  }
}

export function drawFields(ctx: Ctx, g: Game, draft: FieldDraft | null, time: number, winter: boolean) {
  const s = g.state;
  const fields = s.fields ?? [];
  if (!fields.length && !draft?.size) return;
  const W = s.mapW;
  for (const f of fields) {
    const own = new Set(f.plots.map((p) => idx(s, p.tx, p.ty)));
    const has = (tx: number, ty: number) => tx >= 0 && ty >= 0 && tx < W && own.has(ty * W + tx);
    const shown = f.plots.filter((p) => isExplored(s, p.tx, p.ty));
    if (!shown.length) continue;
    for (const p of shown) soil(ctx, p, winter);
    fences(ctx, f, has, false);
    // plantas de trás para a frente (cada canteiro, as touceiras pela profundidade)
    const order = [...shown].sort((a, b) => a.tx + a.ty - (b.tx + b.ty));
    for (const p of order) {
      if (p.st < 2) continue;
      const st = p.st === 3 ? 4 : growStage(p.g);
      const sway = st >= 3 ? Math.sin(time * 1.6 + p.tx * 0.7 + p.ty) * 0.8 : 0;
      for (const [ox, oy] of SPOTS) {
        const q = P(p.tx + ox, p.ty + oy);
        plant(ctx, p.crop ?? f.crop, st, q.x, q.y, sway);
      }
    }
    fences(ctx, f, has, true);
  }
  if (!draft?.size) return;
  // rascunho: o que vai virar canteiro (contorno amarelo) e o que vai sair (vermelho)
  ctx.save();
  ctx.lineWidth = 1.4;
  ctx.setLineDash([3, 2]);
  for (const [i, on] of draft) {
    const tx = i % W;
    const ty = Math.floor(i / W);
    diamond(ctx, tx, ty);
    ctx.fillStyle = on ? 'rgba(122,90,54,0.55)' : 'rgba(220,60,50,0.45)';
    ctx.fill();
    ctx.strokeStyle = on ? 'rgba(255,211,77,0.95)' : 'rgba(255,110,90,0.95)';
    ctx.stroke();
  }
  ctx.restore();
}
