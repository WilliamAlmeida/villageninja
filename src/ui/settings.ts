// Preferências de interface (por dispositivo, fora do save do jogo).
import { setArtEnabled } from '../render/art';
import { setLightWeatherFx } from '../render/seasonal';

const KEY = 'villageninja.ui';

export type FontSize = 's' | 'm' | 'l';
export const FONT_SIZES: { id: FontSize; label: string }[] = [
  { id: 's', label: 'Pequeno' },
  { id: 'm', label: 'Médio' },
  { id: 'l', label: 'Grande' },
];

/** Desktop (mouse + tela larga) começa no médio; celular, no pequeno. */
function load(): { fontSize?: unknown; art?: unknown; weatherFx?: unknown } {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {};
  } catch {
    return {}; // preferência corrompida: usa o padrão
  }
}
function store(patch: object) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...load(), ...patch }));
  } catch {
    /* sem armazenamento: vale só nesta sessão */
  }
}

/** Arte ilustrada (PNG) ou o desenho procedural antigo. */
export const artOn = () => load().art !== false;
export function setArtOn(v: boolean) {
  store({ art: v });
  setArtEnabled(v);
}

/** Efeitos de clima leves: sem pegadas, bafo, fumaça das chaminés e névoa da nevasca (poupa bateria). */
export const weatherFxLight = () => load().weatherFx === 'light';
export function setWeatherFxLight(v: boolean) {
  store({ weatherFx: v ? 'light' : 'full' });
  setLightWeatherFx(v);
}

function defaultFontSize(): FontSize {
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches && window.innerWidth >= 1000 ? 'm' : 's';
}

export function fontSize(): FontSize {
  const v = load().fontSize;
  return v === 's' || v === 'm' || v === 'l' ? v : defaultFontSize();
}

export function setFontSize(v: FontSize) {
  store({ fontSize: v });
  applySettings(v);
}

export function applySettings(v: FontSize = fontSize()) {
  document.documentElement.dataset.fs = v;
  setArtEnabled(artOn());
  setLightWeatherFx(weatherFxLight());
}
