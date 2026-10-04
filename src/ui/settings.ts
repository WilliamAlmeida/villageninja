// Preferências de interface (por dispositivo, fora do save do jogo).
const KEY = 'villageninja.ui';

export type FontSize = 's' | 'm' | 'l';
export const FONT_SIZES: { id: FontSize; label: string }[] = [
  { id: 's', label: 'Pequeno' },
  { id: 'm', label: 'Médio' },
  { id: 'l', label: 'Grande' },
];

/** Desktop (mouse + tela larga) começa no médio; celular, no pequeno. */
function defaultFontSize(): FontSize {
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches && window.innerWidth >= 1000 ? 'm' : 's';
}

export function fontSize(): FontSize {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}').fontSize;
    if (v === 's' || v === 'm' || v === 'l') return v;
  } catch {
    /* preferência corrompida: usa o padrão */
  }
  return defaultFontSize();
}

export function setFontSize(v: FontSize) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ fontSize: v }));
  } catch {
    /* sem armazenamento: vale só nesta sessão */
  }
  applySettings(v);
}

export function applySettings(v: FontSize = fontSize()) {
  document.documentElement.dataset.fs = v;
}
