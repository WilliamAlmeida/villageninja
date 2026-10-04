// Arte em pixel art (PNG pequenos em src/art, gerados por IA e preparados por scripts/prepare-art.py).
// Cada desenho procedural tenta primeiro a imagem; sem ela (ou com a arte desligada no menu,
// ou fora do navegador) cai no desenho antigo.
import hokage from '../art/hokage.png';
import house from '../art/house.png';
import lumber from '../art/lumber.png';
import quarry from '../art/quarry.png';
import market from '../art/market.png';
import academy from '../art/academy.png';
import hospital from '../art/hospital.png';
import tower from '../art/tower.png';
import library from '../art/library.png';
import missions from '../art/missions.png';
import ironmine from '../art/ironmine.png';
import forge from '../art/forge.png';
import pharmacy from '../art/pharmacy.png';
import sealshop from '../art/sealshop.png';
import monument from '../art/monument.png';
import farm from '../art/farm.png';
import training from '../art/training.png';
import herbgarden from '../art/herbgarden.png';
import ninja from '../art/ninja.png';
import villager from '../art/villager.png';
import rogue from '../art/rogue.png';
import boar from '../art/boar.png';
import wolf from '../art/wolf.png';
import bear from '../art/bear.png';
import tree0 from '../art/tree0.png';
import tree1 from '../art/tree1.png';
import rock from '../art/rock.png';
import ore from '../art/ore.png';
import herb from '../art/herb.png';
import chop from '../art/villager-chop.png';
import mine from '../art/villager-mine.png';
import hoe from '../art/villager-farm.png';
import stump from '../art/stump.png';
import rockCracked from '../art/rock-cracked.png';
import hairSpiky from '../art/ninja-hair-spiky.png';
import hairPonytail from '../art/ninja-hair-ponytail.png';
import hairShort from '../art/ninja-hair-short.png';
import hairLong from '../art/ninja-hair-long.png';
import hairBuns from '../art/ninja-hair-buns.png';

const URLS: Record<string, string> = { hokage, house, lumber, quarry, market, academy, hospital, tower, library, missions, ironmine, forge, pharmacy, sealshop, monument, farm, training, herbgarden, ninja, villager, rogue, boar, wolf, bear, tree0, tree1, rock, ore, herb,
  'villager-chop': chop, 'villager-mine': mine, 'villager-farm': hoe, stump, 'rock-cracked': rockCracked,
  'ninja-hair-spiky': hairSpiky, 'ninja-hair-ponytail': hairPonytail, 'ninja-hair-short': hairShort, 'ninja-hair-long': hairLong, 'ninja-hair-buns': hairBuns };

/**
 * Folhas de sprite no padrão de scripts/sprite-template.py: 4 quadros (ciclo de caminhada) × 3 linhas
 * (0 = de lado olhando para a direita, 1 = de frente, 2 = de costas). O quadro parado é a coluna 1.
 */
export const SHEET_ROWS = { side: 0, front: 1, back: 2 } as const;
const SHEET = { frames: 4, rows: 3, idle: 1 };
/** Bases de ninja (uma por penteado) desenhadas em cores-chave: cabelo verde e roupa azul, recoloridas por ninja. */
export const NINJA_HAIRSTYLES = ['spiky', 'ponytail', 'short', 'long', 'buns'] as const;
const SHEETS = new Set(['ninja', 'villager', 'rogue', 'boar', 'wolf', 'bear', 'villager-chop', 'villager-mine', 'villager-farm', ...NINJA_HAIRSTYLES.map((h) => `ninja-hair-${h}`)]);

const images = new Map<string, HTMLImageElement>();
let enabled = true;

/** URL do PNG (para usar no DOM, ex.: fundo dos cards de construção). */
export const artUrl = (name: string): string | null => URLS[name] ?? null;

export function setArtEnabled(v: boolean) {
  enabled = v;
}

/** Imagem pronta para desenhar, ou null (arte desligada, nome sem imagem, ainda carregando). */
export function art(name: string): HTMLImageElement | null {
  if (!enabled || typeof Image === 'undefined' || !(name in URLS)) return null;
  let img = images.get(name);
  if (!img) {
    img = new Image();
    img.src = URLS[name]!;
    img.dataset.name = name;
    images.set(name, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

type Pic = HTMLImageElement | HTMLCanvasElement;
const size = (img: Pic) => (img instanceof HTMLImageElement ? { w: img.naturalWidth, h: img.naturalHeight } : { w: img.width, h: img.height });

export const artFrames = (img: Pic) => (SHEETS.has(img.dataset.name ?? '') ? SHEET : { frames: 1, rows: 1, idle: 0 });

/**
 * Desenha a imagem (ou o quadro `frame` da linha `row` de uma folha) com a base centrada em (x, baseY), na altura pedida.
 * `flip` espelha na horizontal. Sem suavização: pixel art amplia sem borrar.
 */
export function drawArt(ctx: CanvasRenderingContext2D, img: Pic, x: number, baseY: number, height: number, flip = false, frame = 0, row = 0) {
  const sheet = artFrames(img);
  const { w: iw, h: ih } = size(img);
  const fw = iw / sheet.frames;
  const fh = ih / sheet.rows;
  const w = (fw / fh) * height;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(x, 0);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(img, fw * frame, fh * row, fw, fh, -w / 2, baseY - height, w, height);
  ctx.restore();
}

// ------------------------------------------------------------------ recoloração ("paper doll")
const tinted = new Map<string, HTMLCanvasElement>();

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) as [number, number, number];

function hsv(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max / 255 };
}

/**
 * Folha recolorida: troca as cores-chave da base (cabelo verde, roupa azul) e o tom de pele pelas cores pedidas,
 * mantendo o sombreado (a luminosidade relativa de cada pixel). Fica em cache por combinação.
 */
export function tintedArt(name: string, colors: { hair: string; cloth: string; skin: string }): HTMLCanvasElement | null {
  const key = `${name}|${colors.hair}|${colors.cloth}|${colors.skin}`;
  const hit = tinted.get(key);
  if (hit) return hit;
  const img = art(name);
  if (!img) return null;
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  c.dataset.name = name;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const px = data.data;
  // [cor nova, brilho (v) do tom médio da cor-chave na base]
  const hair: [number[], number] = [hex(colors.hair), 0.8];
  const cloth: [number[], number] = [hex(colors.cloth), 1];
  const skin: [number[], number] = [hex(colors.skin), 0.96];
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3]! < 10) continue;
    const { h, s, v } = hsv(px[i]!, px[i + 1]!, px[i + 2]!);
    const to = s > 0.35 && h >= 85 && h <= 165 ? hair : s > 0.35 && h >= 200 && h <= 255 ? cloth : h >= 10 && h <= 45 && s > 0.12 && s < 0.6 && v > 0.6 ? skin : null;
    if (!to) continue;
    const k = v / to[1];
    for (let j = 0; j < 3; j++) {
      const base = to[0][j]! * k;
      // acima do tom médio clareia em direção ao branco (brilhos), abaixo escurece
      px[i + j] = k <= 1 ? base : to[0][j]! + (255 - to[0][j]!) * Math.min(1, k - 1);
    }
  }
  ctx.putImageData(data, 0, 0);
  tinted.set(key, c);
  return c;
}
