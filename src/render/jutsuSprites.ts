// Sprites dos jutsus: folhas em grade (data/jutsu-fx.json, ajustáveis no painel "Ajuste" do Laboratório) desenhadas
// sobre o projétil do jutsu (`Projectile.fx`, ou o tipo para projéteis antigos) e a Prisão d'Água sobre o preso.
import { art } from './art';
import type { Effect, Projectile } from '../game/types';
import { JUTSUS } from '../data/jutsus';
import { FX, PARTS_DEFAULT, spriteFx, type SpriteFx } from '../data/jutsuFx';
import { suiryuudanPose } from './projectileMotion';
import { dragonPoint } from '../game/dragonFlight';
import { project, projectAngle } from '../core/iso';
import { wallEnds } from '../game/walls';
import { jukaiFrame, sandCoffinFrame, wallFrame, wallView } from './earthSandMotion';

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
  // O corpo termina no pescoço (ponto `neck` da célula da cabeça), não dentro da boca aberta: corta a curva até a
  // distância do pescoço à ponta e encaixa a última junta exatamente no pescoço (com o mesmo giro/espelho da cabeça).
  const headImg = cells(head, s);
  const hw = headSize, hh = (headSize * headImg.ch) / headImg.cw;
  const lx = ((parts.neckX ?? PARTS_DEFAULT.neckX) - s.anchorX) * hw;
  let ly = ((parts.neckY ?? PARTS_DEFAULT.neckY) - s.anchorY) * hh;
  if (s.flip && Math.cos(angle) < 0) ly = -ly;
  const neck = { x: tip.x + Math.cos(angle) * lx - Math.sin(angle) * ly, y: tip.y + Math.sin(angle) * lx + Math.cos(angle) * ly };
  let trim = Math.max(0, -lx);
  while (points.length > 1 && trim > 0) {
    const last = points[points.length - 1]!, prev = points[points.length - 2]!;
    const length = Math.hypot(last.x - prev.x, last.y - prev.y);
    if (length <= trim) { points.pop(); trim -= length; }
    else { last.x += (prev.x - last.x) * trim / length; last.y += (prev.y - last.y) * trim / length; trim = 0; }
  }
  if (points.length > 1) points[points.length - 1] = neck;
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
    const bandTop = parts.bandTop ?? PARTS_DEFAULT.bandTop, bandH = parts.bandHeight ?? PARTS_DEFAULT.bandHeight;
    const textureScale = Math.max(0.01, width / (bch * bandH));
    let sourceX = (((distanceAlong - 1.5) / textureScale - t * 36) % bcw + bcw) % bcw;
    let remaining = length + 3, painted = 0;
    while (remaining > 0.001) {
      const sourceWidth = Math.min(bcw - sourceX, remaining / textureScale);
      const drawWidth = sourceWidth * textureScale;
      ctx.drawImage(body, frame % bcols * bcw + sourceX, Math.floor(frame / bcols) * bch + bch * bandTop,
        sourceWidth, bch * bandH, -(length + 3) / 2 + painted, -width / 2, drawWidth, width);
      remaining -= drawWidth; painted += drawWidth; sourceX = 0;
    }
    distanceAlong += length;
    ctx.restore();
  }
  ctx.restore();
  const source = project(f.sx, f.sy);
  drawSpriteFx(ctx, { ...s, sheet: parts.originSheet, size: parts.originSize,
    anchorX: parts.originX ?? PARTS_DEFAULT.originX, anchorY: parts.originY ?? PARTS_DEFAULT.originY,
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
export function drawSpriteFx(ctx: CanvasRenderingContext2D, s: SpriteFx, x: number, y: number, angle: number, t: number, phase: number, behind?: number, frameOverride?: number): boolean {
  const img = art(s.sheet);
  if (!img) return false;
  const { cols, cw, ch, frames } = cells(img, s);
  const frame = frameOverride == null ? (Math.floor(t * s.fps) + (phase % frames)) % frames : Math.max(0, Math.min(frames - 1, frameOverride));
  const w = s.size, h = (s.size * ch) / cw;
  const left = Math.cos(angle) < 0;
  ctx.save();
  ctx.translate(x + (s.dx ?? 0) + Math.cos(angle) * (s.forward ?? 0) - Math.sin(angle) * (s.side ?? 0),
    y + s.dy + Math.sin(angle) * (s.forward ?? 0) + Math.cos(angle) * (s.side ?? 0));
  if (s.rotate) {
    ctx.rotate(angle);
    if (s.flip && left) ctx.scale(1, -1); // indo para a esquerda: a arte não fica de cabeça para baixo
  } else if (s.flip && left) ctx.scale(-1, 1);
  if (behind != null && s.rotate) {
    // nasce da mão: o que ainda está atrás do ponto de lançamento não aparece (o corpo sai do punho)
    ctx.beginPath();
    ctx.rect(-behind, -h * 4, w * 8 + behind, h * 8);
    ctx.clip();
  }
  ctx.globalAlpha *= s.opacity;
  if (s.blend === 'add') ctx.globalCompositeOperation = 'lighter';
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, (frame % cols) * cw, Math.floor(frame / cols) * ch, cw, ch, -w * s.anchorX, -h * s.anchorY, w, h);
  ctx.restore();
  return true;
}

/** Quanto o projétil já andou desde o lançamento (px de cena; o Renderer passa a velocidade já projetada). */
function traveled(p: Projectile, id: string) {
  const def = JUTSUS[id];
  if (!def) return Infinity;
  const life0 = (def.range * 1.4) / (def.projSpeed ?? 250);
  return Math.hypot(p.vx, p.vy) * Math.max(0, life0 - p.life);
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
  return drawSpriteFx(ctx, s, p.x, p.y, Math.atan2(p.vy, p.vx), t, p.id, s.emerge ? traveled(p, id) : undefined);
}

/** Esfera de água sobre o corpo; alpha adicional deixa o ninja legível dentro. */
export function drawWaterPrison(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, id: number): boolean {
  const s = FX.status.water;
  return !!s && drawSpriteFx(ctx, s, x, y, 0, t, id);
}

/** Folhas direcionais com volume próprio; nenhuma face é comprimida ou inclinada por código. */
export function drawEarthWall(ctx: CanvasRenderingContext2D, e: Effect): boolean {
  const s = spriteFx('doryuuheki');
  if (!s || !art(s.sheet)) return false;
  const [wa, wb] = wallEnds(e);
  let a = project(wa.x, wa.y), b = project(wb.x, wb.y);
  if (a.x > b.x) [a, b] = [b, a];
  const config = FX.jutsus.doryuuheki;
  const view = wallView(b.x - a.x, b.y - a.y);
  const directional = view === 'profile' ? config?.profile : view === 'oblique' ? config?.oblique : s;
  const frame = wallFrame(e.t, e.life - e.t);
  if (!directional || !art(directional.sheet)) return false;
  // A diagonal desenhada sobe para a direita. Espelhar pela inclinação da base,
  // não pelo lado do atacante, mantém a orientação mesmo ao inverter o dono.
  const angle = b.y > a.y ? Math.PI : 0;
  return drawSpriteFx(ctx, directional, (a.x + b.x) / 2, (a.y + b.y) / 2,
    angle, 0, 0, undefined, frame);
}

/** Deslocamento visual em pixels de cena na direção do disparo. */
function originPosition(e: Effect, forward: number) {
  const p = project(e.x, e.y), angle = projectAngle(e.facing ?? 0);
  return { x: p.x + Math.cos(angle) * forward, y: p.y + Math.sin(angle) * forward };
}

/** Posição projetada da base para ordenar a fonte fixa com os personagens. */
export function jutsuOriginBase(e: Effect) {
  const s = e.fx ? FX.jutsus[e.fx]?.origin : undefined;
  const p = originPosition(e, s?.forward ?? 0);
  if (!s) return p;
  const side = Math.cos(projectAngle(e.facing ?? 0)) < 0 ? -1 : 1;
  const angle = projectAngle(e.facing ?? 0);
  return { x: p.x + side * (s.anchorX - s.mouthX) * s.size + (s.dx ?? 0) - Math.sin(angle) * (s.side ?? 0),
    y: p.y + s.dy + (s.anchorY - s.mouthY) * s.size + Math.cos(angle) * (s.side ?? 0) };
}

/** Boca registrada na origem visual, inclusive ao espelhar a cabeça. */
export function drawJutsuOrigin(ctx: CanvasRenderingContext2D, e: Effect): boolean {
  const s = e.fx ? FX.jutsus[e.fx]?.origin : undefined;
  if (!s) return false;
  const p = originPosition(e, s.forward ?? 0), fade = Math.min(1, Math.max(0, (e.life - e.t) / 0.15));
  return drawSpriteFx(ctx, { ...s, forward: 0, anchorX: s.mouthX, anchorY: s.mouthY, opacity: s.opacity * fade },
    p.x, p.y, projectAngle(e.facing ?? 0), 0, 0, undefined, Math.min(7, 3 + Math.floor(e.t * s.fps)));
}

export function drawSandShield(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, t: number, id: number): boolean {
  const s = spriteFx('sunanotate');
  return !!s && drawSpriteFx(ctx, s, x, y + 9, angle + Math.PI, t, id);
}

export function drawSandCoffin(ctx: CanvasRenderingContext2D, x: number, y: number, remaining: number): boolean {
  const s = spriteFx('sabakukyu');
  if (!s) return false;
  const frame = sandCoffinFrame(remaining, JUTSUS.sabakukyu!.duration ?? 2.4);
  return drawSpriteFx(ctx, s, x, y + 9, 0, 0, 0, undefined, frame);
}

export function drawJukaiRoots(ctx: CanvasRenderingContext2D, x: number, y: number, remaining: number): boolean {
  const s = spriteFx('jukai');
  return !!s && drawSpriteFx(ctx, s, x, y + 9, 0, 0, 0, undefined,
    jukaiFrame(remaining, JUTSUS.jukai!.duration ?? 2.5));
}

/** Formação na mão: folha e tamanho definidos na configuração do jutsu. */
export function drawHandJutsu(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, t: number, uid: number, growth = 1): boolean {
  const s = spriteFx(id);
  return !!s && drawSpriteFx(ctx, { ...s, size: s.size * Math.max(0.2, growth) }, x, y, 0, t, uid);
}

/** Rajada em execução única entre os pontos já projetados do efeito. */
export function drawJutsuGust(ctx: CanvasRenderingContext2D, e: Effect): boolean {
  const s = e.fx ? FX.jutsus[e.fx]?.gust : undefined;
  if (!s) return false;
  const angle = Math.atan2((e.y2 ?? e.y) - e.y, (e.x2 ?? e.x) - e.x);
  const fade = Math.min(1, Math.max(0, (e.life - e.t) / .15));
  return drawSpriteFx(ctx, { ...s, opacity: s.opacity * fade }, e.x, e.y - 10,
    angle, e.t, 0, undefined, Math.floor(e.t * s.fps));
}

export function drawJutsuImpact(ctx: CanvasRenderingContext2D, e: Effect): boolean {
  const s = e.fx ? FX.jutsus[e.fx]?.impact : undefined;
  if (!s) return false;
  ctx.save();
  ctx.globalAlpha = 1;
  const fade = ['rasenshuriken', 'kirin', 'chidorinagashi'].includes(e.fx ?? '')
    ? Math.max(0, Math.min(1, (e.life - e.t) / 0.16)) : 1;
  const drawn = drawSpriteFx(ctx, { ...s, opacity: s.opacity * fade }, e.x, e.y, 0, e.t, 0, undefined, Math.floor(e.t * s.fps));
  ctx.restore();
  return drawn;
}

/** Decalque já em perspectiva 2:1; chamado no chão, com posição projetada. */
export function drawJutsuCrater(ctx: CanvasRenderingContext2D, e: Effect): boolean {
  const s = e.fx ? FX.jutsus[e.fx]?.crater : undefined;
  if (!s) return false;
  const fade = Math.max(0, Math.min(1, (1 - e.t / e.life) / 0.3));
  const growth = Math.min(1, e.t / 0.12);
  if (growth <= 0) return true;
  ctx.save();
  ctx.globalAlpha = 1;
  const drawn = drawSpriteFx(ctx, { ...s, size: s.size * growth, opacity: s.opacity * fade }, e.x, e.y, 0, 0, 0);
  ctx.restore();
  return drawn;
}
