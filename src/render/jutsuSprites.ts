// Sprites dos jutsus: folhas em grade (data/jutsu-fx.json, ajustáveis no painel "Ajuste" do Laboratório) desenhadas
// sobre o projétil do jutsu (`Projectile.fx`, ou o tipo para projéteis antigos) e a Prisão d'Água sobre o preso.
import { art } from './art';
import type { Projectile } from '../game/types';
import { JUTSUS } from '../data/jutsus';
import { FX, spriteFx, type SpriteFx } from '../data/jutsuFx';
import { suiryuudanPose } from './projectileMotion';
import { dragonPoint } from '../game/dragonFlight';
import { project } from '../core/iso';

/** Peças modulares: fonte fixa no chão, corpo com juntas sobrepostas e cabeça na tangente da curva. */
function drawDragonChain(ctx: CanvasRenderingContext2D, p: Projectile, s: SpriteFx, t: number): boolean {
  const f = p.dragon, parts = s.parts;
  if (!f || !parts) return false;
  const head = art(s.sheet), body = art(parts.bodySheet), origin = art(parts.originSheet);
  if (!head || !body || !origin) return false;
  const progress = Math.min(1, f.elapsed / f.duration);
  const growth = Math.min(1, f.elapsed / 0.2);
  const screen = (at: number) => {
    const point = dragonPoint(f, at), xy = project(point.x, point.y);
    return { x: xy.x, y: xy.y - point.z + s.dy };
  };
  const points = [screen(0)];
  // Amostra a curva inteira, retendo juntas espaçadas em pixels de cena (não em tempo).
  for (let i = 1; i <= 64; i++) {
    const next = screen(progress * i / 64), prev = points[points.length - 1]!;
    if (i === 64 || Math.hypot(next.x - prev.x, next.y - prev.y) >= Math.max(3, parts.spacing)) points.push(next);
  }
  const tip = screen(progress), before = screen(Math.max(0, progress - 0.01));
  const angle = Math.atan2(tip.y - before.y, tip.x - before.x);
  const headSize = s.size * growth;
  // O corpo termina na ligação atrás da mandíbula, não dentro da boca aberta.
  let trim = headSize * 0.5;
  while (points.length > 1 && trim > 0) {
    const last = points[points.length - 1]!, prev = points[points.length - 2]!;
    const length = Math.hypot(last.x - prev.x, last.y - prev.y);
    if (length <= trim) { points.pop(); trim -= length; }
    else { last.x += (prev.x - last.x) * trim / length; last.y += (prev.y - last.y) * trim / length; trim = 0; }
  }
  const { cols: bcols, cw: bcw, ch: bch, frames: bframes } = cells(body, s);
  const frame = Math.floor(t * s.fps) % bframes;
  ctx.save();
  ctx.globalAlpha *= s.opacity;
  if (s.blend === 'add') ctx.globalCompositeOperation = 'lighter';
  ctx.imageSmoothingEnabled = false;
  let distanceAlong = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!, b = points[i]!;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length < 0.01) continue;
    ctx.save();
    ctx.translate((a.x + b.x) / 2, (a.y + b.y) / 2);
    ctx.rotate(Math.atan2(b.y - a.y, b.x - a.x));
    const width = parts.bodyWidth * growth;
    // A textura percorre o comprimento do corpo: cada junta pega só seu trecho da faixa,
    // evitando comprimir uma célula inteira em cada junta e formar "contas" separadas.
    const textureScale = Math.max(0.01, width / (bch * 0.375));
    let sourceX = (((distanceAlong - 1.5) / textureScale - t * 36) % bcw + bcw) % bcw;
    let remaining = length + 3, painted = 0;
    while (remaining > 0.001) {
      const sourceWidth = Math.min(bcw - sourceX, remaining / textureScale);
      const drawWidth = sourceWidth * textureScale;
      ctx.drawImage(body, frame % bcols * bcw + sourceX, Math.floor(frame / bcols) * bch + bch * 0.3125,
        sourceWidth, bch * 0.375, -(length + 3) / 2 + painted, -width / 2, drawWidth, width);
      remaining -= drawWidth; painted += drawWidth; sourceX = 0;
    }
    distanceAlong += length;
    ctx.restore();
  }
  ctx.restore();
  const source = project(f.sx, f.sy);
  drawSpriteFx(ctx, { ...s, sheet: parts.originSheet, size: parts.originSize, anchorX: 0.5, anchorY: 0.78,
    rotate: false, flip: false, dy: 0 }, source.x, source.y + s.dy, 0, t, p.id);
  if (growth > 0) drawSpriteFx(ctx, { ...s, size: headSize, dy: 0 }, tip.x, tip.y, angle, t, p.id);
  return true;
}

/** Célula da folha e quantos quadros ela tem. */
function cells(img: HTMLImageElement, s: SpriteFx) {
  const cols = Math.max(1, s.cols), rows = Math.max(1, s.rows);
  return { cols, cw: img.naturalWidth / cols, ch: img.naturalHeight / rows, frames: Math.max(1, Math.min(s.frames, cols * rows)) };
}

/** Quadro em loop no ponto (x, y), girando com `angle` se a folha pede; preserva o estado do canvas. */
export function drawSpriteFx(ctx: CanvasRenderingContext2D, s: SpriteFx, x: number, y: number, angle: number, t: number, phase: number): boolean {
  const img = art(s.sheet);
  if (!img) return false;
  const { cols, cw, ch, frames } = cells(img, s);
  const frame = (Math.floor(t * s.fps) + (phase % frames)) % frames;
  const w = s.size, h = (s.size * ch) / cw;
  const left = Math.cos(angle) < 0;
  ctx.save();
  ctx.translate(x, y + s.dy);
  if (s.rotate) {
    ctx.rotate(angle);
    if (s.flip && left) ctx.scale(1, -1); // indo para a esquerda: a arte não fica de cabeça para baixo
  } else if (s.flip && left) ctx.scale(-1, 1);
  ctx.globalAlpha *= s.opacity;
  if (s.blend === 'add') ctx.globalCompositeOperation = 'lighter';
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, (frame % cols) * cw, Math.floor(frame / cols) * ch, cw, ch, -w * s.anchorX, -h * s.anchorY, w, h);
  ctx.restore();
  return true;
}

/** Dragão (Suiryuudan): a sequência vai da fonte ao alvo pelo progresso do voo, em pé e sem esticar. */
function drawDragon(ctx: CanvasRenderingContext2D, p: Projectile, s: SpriteFx, id: string): boolean {
  const img = art(s.sheet);
  if (!img) return false;
  const { cols, cw, ch, frames } = cells(img, s);
  const def = JUTSUS[id];
  const initialLife = def ? (def.range * 1.4) / (def.projSpeed ?? 250) : p.life;
  const pose = suiryuudanPose(p, initialLife, { originX: s.anchorX, targetX: s.targetX, minSize: s.minSize, maxSize: s.maxSize, shear: s.shear, frames });
  const w = pose.size, h = (pose.size * ch) / cw;
  ctx.save();
  ctx.translate(pose.x, pose.y + s.dy); // dy: a base nasce no chão, compensando a altura de voo do Renderer
  if (pose.side < 0 && s.flip) ctx.scale(-1, 1);
  ctx.rotate(pose.turn);
  ctx.transform(1, pose.shear, 0, 1, 0, 0);
  ctx.globalAlpha *= s.opacity;
  if (s.blend === 'add') ctx.globalCompositeOperation = 'lighter';
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, (pose.frame % cols) * cw, Math.floor(pose.frame / cols) * ch, cw, ch, -w * s.anchorX, -h * s.anchorY, w, h);
  ctx.restore();
  return true;
}

/** Velocidade e posição já projetadas pelo Renderer. false = sem sprite (desenho procedural). */
export function drawJutsuProjectile(ctx: CanvasRenderingContext2D, p: Projectile, t: number): boolean {
  const id = p.fx ?? p.kind;
  const s = spriteFx(id);
  if (!s) return false;
  if (p.dragon && s.parts && s.motion === 'dragon') return drawDragonChain(ctx, p, s, t);
  if (s.motion === 'dragon') return drawDragon(ctx, p, s, id);
  return drawSpriteFx(ctx, s, p.x, p.y, Math.atan2(p.vy, p.vx), t, p.id);
}

/** Esfera de água sobre o corpo; alpha adicional deixa o ninja legível dentro. */
export function drawWaterPrison(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, id: number): boolean {
  const s = FX.status.water;
  return !!s && drawSpriteFx(ctx, s, x, y, 0, t, id);
}
