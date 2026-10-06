// Copia do Phosphor Icons (MIT, dependência só de desenvolvimento) os glifos de interface usados pelo jogo e grava
// src/ui/glyphs.ts com o miolo de cada SVG (viewBox 0 0 256 256, fill = currentColor). O jogo segue sem dependência
// em runtime. Glifos = controles monocromáticos (fechar, voltar, menu, relógio, cadeado…); ícones-objeto coloridos
// (recursos, itens, ranks) ficam no atlas pixel art. Uso: node scripts/glyphs.mjs
import fs from 'fs';
import path from 'path';

const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')));
const BASE = path.join(ROOT, 'node_modules', '@phosphor-icons', 'core', 'assets');

/** nome no jogo → [peso, nome no Phosphor] */
const MAP = {
  x: ['bold', 'x'],
  back: ['bold', 'arrow-left'],
  menu: ['bold', 'list'],
  pause: ['fill', 'pause'],
  play: ['fill', 'play'],
  plus: ['bold', 'plus'],
  minus: ['bold', 'minus'],
  refresh: ['bold', 'arrows-clockwise'],
  gear: ['fill', 'gear-six'],
  eye: ['fill', 'eye'],
  pin: ['fill', 'map-pin'],
  hourglass: ['fill', 'hourglass-medium'],
  lock: ['fill', 'lock-simple'],
  select: ['bold', 'selection'],
  fullscreen: ['bold', 'corners-out'],
  save: ['fill', 'floppy-disk'],
  text: ['fill', 'text-align-left'],
  phone: ['fill', 'device-mobile'],
  todo: ['bold', 'square'],
  info: ['fill', 'info'],
  run: ['fill', 'person-simple-run'],
  trash: ['fill', 'trash'],
  chart: ['fill', 'chart-bar'],
  home: ['fill', 'house'],
  calendar: ['fill', 'calendar-blank'],
  clock: ['fill', 'clock'],
  question: ['fill', 'question'],
};

const out = ['// Gerado por scripts/glyphs.mjs a partir do Phosphor Icons (MIT): glifos de interface (viewBox 256).', '', 'export const GLYPHS: Record<string, string> = {'];
for (const [name, [weight, src]] of Object.entries(MAP)) {
  const file = path.join(BASE, weight, `${src}${weight === 'regular' ? '' : `-${weight}`}.svg`);
  const svg = fs.readFileSync(file, 'utf8');
  const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').trim();
  out.push(`  ${/^[a-z]+$/.test(name) ? name : `'${name}'`}: '${inner.replace(/'/g, "\\'")}',`);
}
out.push('};', '');
fs.writeFileSync(path.join(ROOT, 'src', 'ui', 'glyphs.ts'), out.join('\n'));
console.log(`ok src/ui/glyphs.ts (${Object.keys(MAP).length} glifos)`);
