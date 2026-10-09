// Copia do Phosphor Icons (MIT, dependência só de desenvolvimento) os glifos de interface usados pelo jogo e grava
// src/ui/glyphs.ts com o miolo de cada SVG (viewBox 0 0 256 256, fill = currentColor). O jogo segue sem dependência
// em runtime. Glifos = controles monocromáticos (fechar, voltar, menu, relógio, cadeado…); ícones-objeto coloridos
// (recursos, itens, ranks) ficam no atlas pixel art. Uso: node scripts/glyphs.mjs
import fs from 'fs';
import path from 'path';
import { CUSTOM } from './custom-glyphs.mjs';

const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')));
const BASE = path.join(ROOT, 'node_modules', '@phosphor-icons', 'core', 'assets');

/** nome no jogo → [peso, nome no Phosphor] */
const MAP = {
  // controles
  x: ['bold', 'x'], back: ['bold', 'arrow-left'], menu: ['bold', 'list'], pause: ['fill', 'pause'], play: ['fill', 'play'],
  plus: ['bold', 'plus'], minus: ['bold', 'minus'], refresh: ['bold', 'arrows-clockwise'], gear: ['fill', 'gear-six'],
  eye: ['fill', 'eye'], pin: ['fill', 'map-pin'], hourglass: ['fill', 'hourglass-medium'], lock: ['fill', 'lock-simple'],
  select: ['bold', 'selection'], fullscreen: ['bold', 'corners-out'], save: ['fill', 'floppy-disk'], text: ['fill', 'text-align-left'],
  phone: ['fill', 'device-mobile'], todo: ['bold', 'square'], info: ['fill', 'info'], run: ['fill', 'person-simple-run'],
  trash: ['fill', 'trash'], chart: ['fill', 'chart-bar'], home: ['fill', 'house'], calendar: ['fill', 'calendar-blank'],
  clock: ['fill', 'clock'], question: ['fill', 'question'], check: ['fill', 'check-circle'], fail: ['fill', 'x-circle'],
  alert: ['fill', 'warning'], up: ['fill', 'arrow-fat-up'], bell: ['fill', 'bell'], megaphone: ['fill', 'megaphone'],
  // vila, gente e símbolos
  castle: ['fill', 'bank'], houses: ['fill', 'buildings'], house: ['fill', 'house'], hut: ['fill', 'tent'], tower: ['fill', 'castle-turret'],
  monument: ['fill', 'mountains'], users: ['fill', 'users-three'], baby: ['fill', 'baby'], smile: ['fill', 'smiley'], frown: ['fill', 'smiley-sad'],
  star: ['fill', 'star'], crown: ['fill', 'crown'], trophy: ['fill', 'trophy'], medal: ['fill', 'medal'], skull: ['fill', 'skull'],
  swords: ['fill', 'sword'], shield: ['fill', 'shield'], target: ['fill', 'target'], flag: ['fill', 'flag'], scroll: ['fill', 'scroll'],
  clipboard: ['fill', 'clipboard-text'], books: ['fill', 'books'], map: ['fill', 'map-trifold'], party: ['fill', 'confetti'],
  leaf: ['fill', 'leaf'], dna: ['fill', 'dna'], drop: ['fill', 'drop'], medic: ['fill', 'first-aid'], pill: ['fill', 'pill'],
  flask: ['fill', 'flask'], paw: ['fill', 'paw-print'], ship: ['fill', 'sailboat'], cart: ['fill', 'shopping-cart'], luggage: ['fill', 'backpack'],
  hammer: ['fill', 'hammer'], axe: ['fill', 'axe'], wheat: ['fill', 'grains'], lantern: ['fill', 'lamp'],
  sun: ['fill', 'sun'], moon: ['fill', 'moon'], snow: ['fill', 'snowflake'], rain: ['fill', 'cloud-rain'], storm: ['fill', 'cloud-lightning'],
  fire: ['fill', 'flame'], coins: ['fill', 'coins'], handshake: ['fill', 'handshake'], fist: ['fill', 'hand-fist'], sparkle: ['fill', 'sparkle'],
  userplus: ['fill', 'user-plus'], lightning: ['fill', 'lightning'], tree: ['fill', 'tree'], barbell: ['fill', 'barbell'],
};

/** Só das ferramentas de desenvolvimento (tools/): não entram no jogo. nome → [peso, nome no Phosphor] */
const TOOLS = {
  pencil: ['fill', 'pencil-simple'], eraser: ['fill', 'eraser'], line: ['bold', 'line-segment'], bucket: ['fill', 'paint-bucket'],
  picker: ['fill', 'eyedropper'], move: ['bold', 'arrows-out-cardinal'], crosshair: ['bold', 'crosshair-simple'], footprints: ['fill', 'footprints'],
  undo: ['bold', 'arrow-u-up-left'], redo: ['bold', 'arrow-u-up-right'], keyboard: ['fill', 'keyboard'], image: ['fill', 'image'],
  stack: ['fill', 'stack'], folder: ['fill', 'folder'], search: ['bold', 'magnifying-glass'], polygon: ['bold', 'polygon'],
  wall: ['fill', 'wall'], anchor: ['fill', 'anchor-simple'], grid: ['bold', 'grid-four'], ruler: ['fill', 'ruler'],
  wand: ['fill', 'magic-wand'], person: ['fill', 'person'], palette: ['fill', 'palette'], step: ['fill', 'skip-forward'], stop: ['fill', 'stop'], hand: ['fill', 'hand'],
};

function inner(weight, src) {
  const file = path.join(BASE, weight, `${src}${weight === 'regular' ? '' : `-${weight}`}.svg`);
  return fs.readFileSync(file, 'utf8').replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').trim();
}
const tout = ['// Gerado por scripts/glyphs.mjs (Phosphor Icons, MIT): glifos só das ferramentas de desenvolvimento.', '', 'export const TOOL_GLYPHS: Record<string, string> = {'];
for (const [name, [weight, src]] of Object.entries(TOOLS)) tout.push(`  ${name}: '${inner(weight, src).replace(/'/g, "\\'")}',`);
tout.push('};', '');
fs.mkdirSync(path.join(ROOT, 'tools', 'shared'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'tools', 'shared', 'glyphs.ts'), tout.join('\n'));
console.log(`ok tools/shared/glyphs.ts (${Object.keys(TOOLS).length} glifos)`);

const out = ['// Gerado por scripts/glyphs.mjs a partir do Phosphor Icons (MIT): glifos de interface (viewBox 256).', '', 'export const GLYPHS: Record<string, string> = {'];
for (const [name, [weight, src]] of Object.entries(MAP)) {
  const file = path.join(BASE, weight, `${src}${weight === 'regular' ? '' : `-${weight}`}.svg`);
  const svg = fs.readFileSync(file, 'utf8');
  const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').trim();
  out.push(`  ${/^[a-z]+$/.test(name) ? name : `'${name}'`}: '${inner.replace(/'/g, "\\'")}',`);
}
// desenhados à mão para o que o Phosphor não tem (chapéu do Kage, cabeça de ninja, lápide)
for (const [name, inner] of Object.entries(CUSTOM)) out.push(`  ${name}: '${inner.replace(/'/g, "\'")}',`);
out.push('};', '');
fs.writeFileSync(path.join(ROOT, 'src', 'ui', 'glyphs.ts'), out.join('\n'));
console.log(`ok src/ui/glyphs.ts (${Object.keys(MAP).length + Object.keys(CUSTOM).length} glifos)`);
