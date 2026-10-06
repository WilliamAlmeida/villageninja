// Ícones SVG (traço, 24×24) — iguais em qualquer dispositivo, ao contrário de emoji.
// Textos usam tokens `{nome}`; `rich()` troca cada token pelo SVG correspondente.
import { TOKEN_RE } from '../core/tokens';
import { ICONS } from './pxicons';

const I: Record<string, string> = {
  // recursos
  wood: '<ellipse cx="6" cy="12" rx="3" ry="5"/><path d="M6 7h11c1.700 0 3 2.200 3 5s-1.300 5-3 5H6"/><path d="M12 11h4"/>',
  stone: '<path d="M4 17l2-7 5-4 6 2 3 6-2 4H6z"/><path d="M11 6l1 5 6-3"/>',
  food: '<path d="M12 4c2 0 8 9 8 13 0 2-2 3-8 3s-8-1-8-3c0-4 6-13 8-13z"/><path d="M9 20v-5h6v5"/>',
  ryo: '<circle cx="12" cy="12" r="8"/><rect x="10" y="10" width="4" height="4"/>',
  iron: '<path d="M7 9h10l3 7H4z"/><path d="M8 9l1 7M16 9l-1 7"/>',
  herbs: '<path d="M12 21V10"/><path d="M12 14c-5 0-7-3-7-7 4 0 7 2 7 7z"/><path d="M12 10c0-4 2-6 6-6 0 4-2 6-6 6z"/>',
  paper: '<rect x="7" y="3" width="10" height="18" rx="1"/><path d="M10 8h4M12 8v8M10 13h4"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.300 2.700-6 6-6s6 2.700 6 6"/><circle cx="17" cy="9" r="2.500"/><path d="M17 14c2.500 0 4.500 2 4.500 5"/>',
  ninja: '<circle cx="12" cy="12" r="8"/><path d="M4.500 10h15v4h-15z"/><path d="M9 12h.010M15 12h.010"/><path d="M19.500 11l2.500-2M19.500 13l2.500 1"/>',
  // interface
  hammer: '<path d="M13 5l6 6-2 2-6-6z"/><path d="M12.500 9.500L4 18l2 2 8.500-8.500"/>',
  castle: '<path d="M3 10l9-6 9 6"/><path d="M6 10v4M18 10v4"/><path d="M2 15l3-1h14l3 1"/><path d="M6 15v6h12v-6"/><path d="M10 21v-3h4v3"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M9 10h6M9 14h6M9 18h3"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.500 1.500M17.500 17.500L19 19M19 5l-1.500 1.500M6.500 17.500L5 19"/>',
  moon: '<path d="M20 14.500A8.500 8.500 0 0 1 9.500 4 8.500 8.500 0 1 0 20 14.500z"/>',
  alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.500"/>',
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
  skull: '<path d="M5 11a7 7 0 0 1 14 0c0 3-1 4-2 5v3H7v-3c-1-1-2-2-2-5z"/><circle cx="9" cy="11" r="1.500"/><circle cx="15" cy="11" r="1.500"/><path d="M12 19v-2"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H4c0 3 1.500 5 4 5M16 6h4c0 3-1.500 5-4 5"/><path d="M12 13v4M8 20h8M9 17h6"/>',
  pin: '<path d="M12 21s7-6.500 7-12a7 7 0 0 0-14 0c0 5.500 7 12 7 12z"/><circle cx="12" cy="9" r="2.500"/>',
  run: '<path d="M9 14l-5-5 5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  gear: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.900 4.900L7 7M17 17l2.100 2.100M19.100 4.900L17 7M7 17l-2.100 2.100"/>',
  scroll: '<path d="M6 4h12v16H6z"/><path d="M4 4h16M4 20h16M9 9h6M9 13h6"/>',
  medal: '<circle cx="12" cy="15" r="5"/><path d="M9 10L6 3h4l2 4 2-4h4l-3 7"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
  crown: '<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  todo: '<rect x="5" y="5" width="14" height="14" rx="3"/>',
  fail: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
  star: '<path d="M12 3l2.700 5.800 6.300.800-4.600 4.400 1.200 6.300L12 17.200l-5.600 3.100 1.200-6.300L3 9.600l6.300-.800z"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  megaphone: '<path d="M4 10v4h3l8 5V5l-8 5z"/><path d="M18 9a4 4 0 0 1 0 6"/>',
  save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
  fullscreen: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.300-5.600"/><path d="M20 4v5h-5"/>',
  leaf: '<path d="M5 19C5 9 11 4 20 4c0 9-5 15-15 15z"/><path d="M5 19l9-9"/>',
  flag: '<path d="M6 21V4"/><path d="M6 5h12l-3 4 3 4H6"/>',
  dna: '<path d="M7 3c0 6 10 6 10 12 0 3-2 5-5 6M17 3c0 6-10 6-10 12 0 3 2 5 5 6"/><path d="M8.500 7h7M8.500 17h7"/>',
  hourglass: '<path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9"/>',
  swords: '<path d="M5 4l10 10M19 4L9 14"/><path d="M12 17l5-5M7 12l5 5"/><path d="M6 20l3.500-3.500M18 20l-3.500-3.500"/>',
  phone: '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  select: '<path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4"/><path d="M10 10l8 3-3.500 1.500L13 18z"/>',
  text: '<path d="M3 18L8 6l5 12M5 14h6M15 18l3-7 3 7M16 16h4"/>',
  party: '<path d="M12 12V4M12 12l6-5M12 12L6 7M12 12l7 3M12 12l-7 3M12 12v8"/>',
  // prédios e níveis
  arena: '<ellipse cx="12" cy="12" rx="9" ry="6"/><ellipse cx="12" cy="12" rx="4" ry="2.500"/>',
  monument: '<path d="M3 20l5-13 4 4 3-6 6 15z"/><path d="M10 15h.010M14 15h.010M11 18h3"/>',
  house: '<path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/><path d="M10 20v-5h4v5"/>',
  wheat: '<path d="M12 21V8"/><path d="M12 8c-2-1-2-3 0-5 2 2 2 4 0 5zM12 13c-3 0-4-2-4-4 3 0 4 2 4 4zM12 13c3 0 4-2 4-4-3 0-4 2-4 4zM12 18c-3 0-4-2-4-4 3 0 4 2 4 4zM12 18c3 0 4-2 4-4-3 0-4 2-4 4z"/>',
  axe: '<path d="M5 20L15 8"/><path d="M12 5l7 7c2-3 2-6 0-8s-5-1-7 1z"/>',
  pickaxe: '<path d="M5 20L15 9"/><path d="M7 6c5-3 11-1 13 6-3-3-8-5-13-6z"/>',
  lantern: '<path d="M9 3h6M12 3v2"/><rect x="7" y="5" width="10" height="13" rx="4"/><path d="M10 5v13M14 5v13M10 18v3h4v-3"/>',
  dummy: '<circle cx="12" cy="6" r="3"/><path d="M12 9v12M6 13h12M8 21h8"/>',
  medic: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/>',
  tower: '<path d="M8 21l1-11h6l1 11M7 10h10V6H7zM7 6V4M12 6V4M17 6V4M10 21v-4h4v4"/>',
  books: '<path d="M4 4h4v16H4zM8 4h4v16H8zM13.500 5.500l3.800-1 3.700 14.500-3.800 1z"/>',
  anvil: '<path d="M3 8h14v3c0 2-2 3-4 3h-2c-3 0-5-2-8-3z"/><path d="M17 9h4M9 14v3M13 14v3M6 20h10v-3H6z"/>',
  flask: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/><path d="M7.500 15h9"/>',
  hut: '<path d="M3 12l9-8 9 8"/><path d="M6 11v9h12v-9"/><path d="M10 20v-4a2 2 0 0 1 4 0v4"/>',
  houses: '<path d="M2 12l5-5 5 5M4 11v8h6v-8"/><path d="M12 10l4-4 6 6M14 12v7h6v-8"/>',
  // itens
  kunai: '<path d="M12 2l3 9-3 3-3-3z"/><path d="M12 14v4"/><circle cx="12" cy="20" r="2"/>',
  vest: '<path d="M8 3l4 4 4-4 3 3-2 4v10H7V10L5 6z"/><path d="M12 7v13"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.500 8-8 9-4.500-1-8-4-8-9V6z"/>',
  pill: '<rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-45 12 12)"/><path d="M9.900 9.900l4.200 4.200"/>',
  drop: '<path d="M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z"/>',
  bomb: '<rect x="6" y="5" width="12" height="16" rx="1"/><path d="M12 10v5M9.500 12.500h5"/><path d="M12 5V3l2-1"/>',
  // eventos
  beast: '<path d="M4 6l4 3 4-5 4 5 4-3-2 9-6 5-6-5z"/><path d="M9.500 12h.010M14.500 12h.010"/>',
  baby: '<circle cx="12" cy="12" r="8"/><path d="M9 14c1.500 2 4.500 2 6 0"/><path d="M9 10h.010M15 10h.010"/><path d="M12 4c-1 1-1 2 0 3"/>',
  luggage: '<rect x="5" y="8" width="14" height="12" rx="2"/><path d="M9 8V5h6v3M9 12v4M15 12v4"/>',
  paw: '<ellipse cx="12" cy="16" rx="4" ry="3"/><circle cx="6.500" cy="11" r="1.800"/><circle cx="10" cy="7" r="1.800"/><circle cx="14" cy="7" r="1.800"/><circle cx="17.500" cy="11" r="1.800"/>',
  cart: '<path d="M3 5h3l2 10h10l2-7H7"/><circle cx="9" cy="19" r="1.500"/><circle cx="17" cy="19" r="1.500"/>',
  candle: '<rect x="9" y="10" width="6" height="11" rx="1"/><path d="M12 10V8M12 2c2 2 2 4 0 5-2-1-2-3 0-5z"/>',
  crystal: '<path d="M12 2l5 6-5 14-5-14z"/><path d="M7 8h10M12 2v20"/>',
  gold: '<path d="M3 17l3-6h12l3 6z"/><path d="M8 11l2-4h4l2 4"/>',
  darksteel: '<path d="M5 19L19 5"/><path d="M15 5h4v4"/><path d="M8 16l-3 3M6 13l5 5"/>',
  pickaxe2: '<path d="M4 20l9-9"/><path d="M8 5c4-2 8-1 11 2-3-1-6-1-9 1"/>',
  snow: '<path d="M12 3v18M4.200 7.500l15.600 9M4.200 16.500l15.600-9"/><path d="M9.500 4.500L12 7l2.500-2.500M9.500 19.500L12 17l2.500 2.500"/>',
  rain: '<path d="M7 15a4 4 0 0 1 .5-8 5 5 0 0 1 9.500 1.500A3.500 3.500 0 0 1 17 15z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>',
  storm: '<path d="M7 14a4 4 0 0 1 .5-8 5 5 0 0 1 9.500 1.500A3.500 3.500 0 0 1 17 14z"/><path d="M12 13l-2 4h4l-2 4"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8.500 14c1 1.500 6 1.500 7 0"/><path d="M9 10h.010M15 10h.010"/>',
  frown: '<circle cx="12" cy="12" r="9"/><path d="M8.500 16c1-1.500 6-1.500 7 0"/><path d="M9 10h.010M15 10h.010"/>',
  ship: '<path d="M3 15h18l-3 5H6z"/><path d="M12 3v12M12 4l6 9h-6"/>',
  map: '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.500h.010"/>',
};

/**
 * Ícone: o PNG em pixel art (src/art/ui/icons, gerado pelo Codex) quando existe; senão o `<svg>` de traço
 * (herda a cor do texto; alguns têm cor própria via `.ic-nome`).
 */
export function ico(name: string, cls = '') {
  const px = ICONS[name];
  if (px) return `<img class="ic px ic-${name}${cls ? ` ${cls}` : ''}" src="${px}" alt="" draggable="false">`;
  const body = I[name];
  if (!body) return '';
  return `<svg class="ic ic-${name}${cls ? ` ${cls}` : ''}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
}

/** Troca os tokens `{nome}` de um texto/HTML pelos SVGs. Tokens desconhecidos ficam como estão. */
export const rich = (html: string) => html.replace(TOKEN_RE, (m, k: string) => ico(k) || m);

export const hasIcon = (name: string) => name in I;
