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
import house2 from '../art/house-2.png';
import house3 from '../art/house-3.png';
import lumber2 from '../art/lumber-2.png';
import lumber3 from '../art/lumber-3.png';
import quarry2 from '../art/quarry-2.png';
import quarry3 from '../art/quarry-3.png';
import market2 from '../art/market-2.png';
import market3 from '../art/market-3.png';
import tower2 from '../art/tower-2.png';
import tower3 from '../art/tower-3.png';
import hospital2 from '../art/hospital-2.png';
import hospital3 from '../art/hospital-3.png';
import farm2 from '../art/farm-2.png';
import farm3 from '../art/farm-3.png';
import training2 from '../art/training-2.png';
import training3 from '../art/training-3.png';
import towerGuard from '../art/tower-guard.png';
import academy2 from '../art/academy-2.png';
import academy3 from '../art/academy-3.png';
import hokage2 from '../art/hokage-2.png';
import hokage3 from '../art/hokage-3.png';
import hokage4 from '../art/hokage-4.png';
import hairSpiky from '../art/ninja-hair-spiky.png';
import hairPonytail from '../art/ninja-hair-ponytail.png';
import hairShort from '../art/ninja-hair-short.png';
import hairLong from '../art/ninja-hair-long.png';
import hairBuns from '../art/ninja-hair-buns.png';
import hairBald from '../art/ninja-hair-bald.png';
import snake from '../art/snake.png';
import crow from '../art/crow.png';
import monkey from '../art/monkey.png';
import spider from '../art/spider.png';
import tiger from '../art/tiger.png';
import rhino from '../art/rhino.png';
import hydra from '../art/hydra.png';
import golem from '../art/golem.png';
import puppet from '../art/puppet.png';
import ruin from '../art/ruin.png';
import chest from '../art/chest.png';
import cave from '../art/cave.png';
import port from '../art/port.png';
import kennel from '../art/kennel.png';
import arena from '../art/arena.png';
import orgGoen from '../art/org-goen.png';
import orgTetsuo from '../art/org-tetsuo.png';
import orgMizuchi from '../art/org-mizuchi.png';
import orgRaiga from '../art/org-raiga.png';
import orgKagero from '../art/org-kagero.png';
import orgShiryo from '../art/org-shiryo.png';
import orgTsuchigumo from '../art/org-tsuchigumo.png';
import orgYomi from '../art/org-yomi.png';
import forge2 from '../art/forge-2.png';
import forge3 from '../art/forge-3.png';
import pharmacy2 from '../art/pharmacy-2.png';
import pharmacy3 from '../art/pharmacy-3.png';
import sealshop2 from '../art/sealshop-2.png';
import sealshop3 from '../art/sealshop-3.png';
import intel from '../art/intel.png';
import puppetshop from '../art/puppetshop.png';
import dog from '../art/dog.png';
import dogWhite from '../art/dog-white.png';
import dogPug from '../art/dog-pug.png';
import dogBull from '../art/dog-bull.png';
import toad from '../art/toad.png';
import slug from '../art/slug.png';

const URLS: Record<string, string> = { hokage, house, lumber, quarry, market, academy, hospital, tower, library, missions, ironmine, forge, pharmacy, sealshop, monument, farm, training, herbgarden, ninja, villager, rogue, boar, wolf, bear, tree0, tree1, rock, ore, herb,
  'villager-chop': chop, 'villager-mine': mine, 'villager-farm': hoe, stump, 'rock-cracked': rockCracked,
  // níveis de upgrade dos prédios e o guarda da torre
  'house-2': house2, 'house-3': house3, 'lumber-2': lumber2, 'lumber-3': lumber3, 'quarry-2': quarry2, 'quarry-3': quarry3, 'market-2': market2, 'market-3': market3, 'tower-2': tower2, 'tower-3': tower3, 'hospital-2': hospital2, 'hospital-3': hospital3, 'farm-2': farm2, 'farm-3': farm3, 'training-2': training2, 'training-3': training3, 'tower-guard': towerGuard,
  'academy-2': academy2, 'academy-3': academy3, 'forge-2': forge2, 'forge-3': forge3, 'pharmacy-2': pharmacy2, 'pharmacy-3': pharmacy3, 'sealshop-2': sealshop2, 'sealshop-3': sealshop3, 'hokage-2': hokage2, 'hokage-3': hokage3, 'hokage-4': hokage4,
  'ninja-hair-spiky': hairSpiky, 'ninja-hair-ponytail': hairPonytail, 'ninja-hair-short': hairShort, 'ninja-hair-long': hairLong, 'ninja-hair-buns': hairBuns, 'ninja-hair-bald': hairBald, snake, crow, monkey, spider, tiger, rhino, hydra, golem, puppet, ruin, chest, cave, port, kennel, arena, intel, puppetshop, dog, 'dog-white': dogWhite, 'dog-pug': dogPug, 'dog-bull': dogBull, toad, slug,
  // Ordem do Eclipse
  'org-goen': orgGoen, 'org-tetsuo': orgTetsuo, 'org-mizuchi': orgMizuchi, 'org-raiga': orgRaiga, 'org-kagero': orgKagero, 'org-shiryo': orgShiryo, 'org-tsuchigumo': orgTsuchigumo, 'org-yomi': orgYomi };

/**
 * Folhas de sprite no padrão de scripts/sprite-template.py: 4 quadros (ciclo de caminhada) × 3 linhas
 * (0 = de lado olhando para a direita, 1 = de frente, 2 = de costas). O quadro parado é a coluna 1.
 */
export const SHEET_ROWS = { side: 0, front: 1, back: 2 } as const;
const SHEET = { frames: 4, rows: 3, idle: 1 };
/** Bases de ninja (uma por penteado) desenhadas em cores-chave: cabelo verde e roupa azul, recoloridas por ninja. */
export const NINJA_HAIRSTYLES = ['spiky', 'ponytail', 'short', 'long', 'buns', 'bald'] as const;
const SHEETS = new Set(['ninja', 'villager', 'rogue', 'boar', 'wolf', 'bear', 'snake', 'crow', 'monkey', 'spider', 'tiger', 'rhino', 'hydra', 'golem', 'puppet', 'dog', 'dog-white', 'dog-pug', 'dog-bull', 'toad', 'slug', 'villager-chop', 'villager-mine', 'villager-farm', 'tower-guard', 'org-goen', 'org-tetsuo', 'org-mizuchi', 'org-raiga', 'org-kagero', 'org-shiryo', 'org-tsuchigumo', 'org-yomi', ...NINJA_HAIRSTYLES.map((h) => `ninja-hair-${h}`)]);

const images = new Map<string, HTMLImageElement>();
let enabled = true;

/** URL do PNG (para usar no DOM, ex.: fundo dos cards de construção). */
/**
 * Escala extra de alguns sprites de prédio em relação à largura da base. Usado quando os níveis de upgrade
 * ganham alas laterais: sem isso o corpo do prédio encolhe para caber na mesma largura e parece que diminuiu.
 */
export const ART_SCALE: Record<string, number> = {
  hospital: 0.85, 'hospital-2': 1.05, 'hospital-3': 1.22,
  quarry: 0.8, 'quarry-2': 1.08, 'quarry-3': 1.26,
  'tower-3': 1.06,
  'hokage-4': 1.12,
  missions: 1.25,
  'forge-2': 1.08, 'forge-3': 1.16, 'pharmacy-2': 1.08, 'pharmacy-3': 1.16, 'sealshop-2': 1.08, 'sealshop-3': 1.16,
};

export const artUrl = (name: string): string | null => URLS[name] ?? null;

export function setArtEnabled(v: boolean) {
  enabled = v;
}

/** Imagem pronta para desenhar, ou null (arte desligada, nome sem imagem, ainda carregando). */
/**
 * Carrega todas as imagens antes do jogo começar a desenhar (senão, enquanto um PNG não chega, aparece o
 * desenho antigo no lugar). `onProgress` recebe 0..1. Imagem que falhar não trava: o jogo usa o desenho antigo nela.
 */
export function preloadArt(onProgress: (k: number) => void = () => {}): Promise<void> {
  const names = Object.keys(URLS);
  let done = 0;
  return new Promise((resolve) => {
    if (typeof Image === 'undefined' || !names.length) return resolve();
    for (const name of names) {
      art(name); // cria o <img> e começa a baixar
      const img = images.get(name)!;
      const finish = () => {
        done++;
        onProgress(done / names.length);
        if (done === names.length) resolve();
      };
      if (img.complete) finish();
      else {
        img.addEventListener('load', finish, { once: true });
        img.addEventListener('error', finish, { once: true });
      }
    }
  });
}

export function art(name: string): HTMLImageElement | null {
  if (typeof Image === 'undefined' || !(name in URLS)) return null;
  let img = images.get(name);
  if (!img) {
    img = new Image();
    img.src = URLS[name]!;
    img.dataset.name = name;
    images.set(name, img);
  }
  return enabled && img.complete && img.naturalWidth > 0 ? img : null;
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
