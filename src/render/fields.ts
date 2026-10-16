// Campos cercados (game/fields.ts): o chão de cada canteiro no losango do tile (crua, arada, úmida; passada do chão), as
// plantas pela etapa e a cultura e a cerca nas bordas do cercado (portão na frente; em pé, na ordem de profundidade). Arte: atlas src/art/props/fields.png
// (scripts/field-art.py, Codex); enquanto ele não carrega (e nos testes) fica o desenho à mão de antes.
import { DAY_LENGTH, TILE } from '../config';
import { project } from '../core/iso';
import { CROP_LIST, CROPS, FIELD, growStage } from '../data/crops';
import type { FieldDraft } from '../game/fields';
import type { Game } from '../game/game';
import { isExplored } from '../game/explore';
import type { Field, Plot } from '../game/types';
import { idx } from '../game/world';
import { art, drawShrunk } from './art';

type Ctx = CanvasRenderingContext2D;
const P = (x: number, y: number) => project(x * TILE, y * TILE);

// Atlas (scripts/field-art.py): casas de 112 px em 2× = 56 px na cena, o losango do tile com a ponta de cima em (28, 28)
// da casa. Linhas 0..5 = culturas na ordem de CROP_LIST, colunas = etapa (0 semente … 4 madura, 5 passando do ponto);
// linha 6 = chão e cerca (GROUND).
const FCELL = 56;
const GROUND = { raw: 0, tilled: 1, wet: 2, winter: 3, fenceA: 4, fenceB: 5, gate: 6, post: 7 } as const;
const CROP_ROW = Object.fromEntries(CROP_LIST.map((c, i) => [c.id, i])) as Record<Plot['crop'] & string, number>;

/** Peça (linha, coluna) do atlas na casa do tile (tx, ty). */
function piece(ctx: Ctx, atlas: HTMLImageElement, row: number, col: number, tx: number, ty: number) {
  const a = P(tx, ty);
  const c = atlas.naturalWidth / 8;
  drawShrunk(ctx, atlas, col * c, row * c, c, c, a.x - FCELL / 2, a.y - FCELL / 2, FCELL, FCELL);
}

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
function soil(ctx: Ctx, p: Plot, winter: boolean, atlas: HTMLImageElement | null) {
  const wet = !!(p.wet && p.wet > 0) && p.st >= 1;
  if (atlas) {
    const col = p.st === 0 ? (winter ? GROUND.winter : GROUND.raw) : wet ? GROUND.wet : GROUND.tilled;
    return piece(ctx, atlas, 6, col, p.tx, p.ty);
  }
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
function fence(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, gate: boolean, atlas: HTMLImageElement | null) {
  if (atlas) {
    // a cerca "\" do atlas fica no lado de baixo-esquerdo do tile e a "/" no de baixo-direito: o trecho ao longo de x
    // é o lado de baixo-esquerdo do tile de cima (x0, y0 - 1); o ao longo de y, o de baixo-direito do da esquerda
    if (y0 === y1) piece(ctx, atlas, 6, gate ? GROUND.gate : GROUND.fenceA, x0, y0 - 1);
    else piece(ctx, atlas, 6, GROUND.fenceB, x0 - 1, y0);
    return;
  }
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

/** Planta de um canteiro ou trecho de cerca: entram na ordem de profundidade com as unidades (renderer, passada "em
 * pé"), para quem trabalha dentro do campo ficar atrás da cerca da frente e na frente da de trás. */
export type FieldItem =
  | { kind: 'plant'; f: Field; p: Plot }
  | { kind: 'fence'; x0: number; y0: number; x1: number; y1: number; gate: boolean };

/**
 * Plantas e cercas dos campos à vista, cada uma com o ponto da cena em que toca o chão (a profundidade): a planta no
 * meio do tile, o trecho de cerca no meio do lado. O portão fica no canteiro mais à frente (maior tx+ty), na borda de
 * baixo.
 */
export function fieldItems(g: Game, push: (x: number, y: number, item: FieldItem) => void) {
  const s = g.state;
  const W = s.mapW;
  for (const f of s.fields ?? []) {
    const shown = f.plots.filter((p) => isExplored(s, p.tx, p.ty));
    if (!shown.length) continue;
    const own = new Set(f.plots.map((p) => idx(s, p.tx, p.ty)));
    const has = (tx: number, ty: number) => tx >= 0 && ty >= 0 && tx < W && own.has(ty * W + tx);
    let gate: Plot | undefined;
    for (const p of f.plots) if (!has(p.tx, p.ty + 1) && (!gate || p.tx + p.ty > gate.tx + gate.ty)) gate = p;
    const side = (x0: number, y0: number, x1: number, y1: number, isGate = false) => {
      const m = P((x0 + x1) / 2, (y0 + y1) / 2);
      push(m.x, m.y, { kind: 'fence', x0, y0, x1, y1, gate: isGate });
    };
    for (const p of shown) {
      const { tx, ty } = p;
      if (p.st >= 2) {
        const c = P(tx + 0.5, ty + 0.5);
        push(c.x, c.y, { kind: 'plant', f, p });
      }
      if (!has(tx, ty - 1)) side(tx, ty, tx + 1, ty);
      if (!has(tx - 1, ty)) side(tx, ty, tx, ty + 1);
      if (!has(tx + 1, ty)) side(tx + 1, ty, tx + 1, ty + 1);
      if (!has(tx, ty + 1)) side(tx, ty + 1, tx + 1, ty + 1, p === gate);
    }
  }
}

/** Desenha uma planta ou trecho de cerca de `fieldItems`. */
export function drawFieldItem(ctx: Ctx, it: FieldItem, time: number) {
  const atlas = art('fields');
  if (it.kind === 'fence') return fence(ctx, it.x0, it.y0, it.x1, it.y1, it.gate, atlas);
  const { f, p } = it;
  const st = p.st === 3 ? 4 : growStage(p.g);
  if (atlas) {
    // madura há mais de meio prazo: a etapa "passando do ponto" avisa que vai murchar
    const late = p.st === 3 && (p.ripe ?? 0) > (FIELD.witherDays * DAY_LENGTH) / 2;
    return piece(ctx, atlas, CROP_ROW[p.crop ?? f.crop], late ? 5 : st, p.tx, p.ty);
  }
  const sway = st >= 3 ? Math.sin(time * 1.6 + p.tx * 0.7 + p.ty) * 0.8 : 0;
  for (const [ox, oy] of SPOTS) {
    const q = P(p.tx + ox, p.ty + oy);
    plant(ctx, p.crop ?? f.crop, st, q.x, q.y, sway);
  }
}

/** Passada do chão: o chão de cada canteiro e o rascunho do modo "Cercar campo" (plantas e cerca: `fieldItems`). */
export function drawFields(ctx: Ctx, g: Game, draft: FieldDraft | null, winter: boolean) {
  const s = g.state;
  const fields = s.fields ?? [];
  if (!fields.length && !draft?.size) return;
  const W = s.mapW;
  const atlas = art('fields');
  for (const f of fields) for (const p of f.plots) if (isExplored(s, p.tx, p.ty)) soil(ctx, p, winter, atlas);
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
