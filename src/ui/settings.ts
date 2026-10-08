// Preferências de interface (por dispositivo, fora do save do jogo).
import { setLightWeatherFx } from '../render/seasonal';

const KEY = 'villageninja.ui';

export type FontSize = 's' | 'm' | 'l';
export const FONT_SIZES: { id: FontSize; label: string }[] = [
  { id: 's', label: 'Pequeno' },
  { id: 'm', label: 'Médio' },
  { id: 'l', label: 'Grande' },
];

/** Desktop (mouse + tela larga) começa no médio; celular, no pequeno. */
function load(): { fontSize?: unknown; weatherFx?: unknown; follow?: unknown; fps?: unknown; fpsPos?: unknown; quality?: unknown } {
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

/** Câmera segue o ninja selecionado (suave), ligado por padrão. */
let follow: boolean | null = null; // lido a cada quadro: guardado em memória
export const followCam = () => (follow ??= load().follow !== false);
export function setFollowCam(v: boolean) {
  follow = v;
  store({ follow: v });
}

/**
 * Qualidade do desenho (por aparelho): Alta = resolução até 2×; Equilibrada = até 1,5× e menos partículas; Leve =
 * 1×, metade das partículas, clima leve e no máximo 30 quadros por segundo. Celular começa em Equilibrada.
 */
export type Quality = 'high' | 'balanced' | 'light';
export const QUALITIES: { id: Quality; label: string }[] = [
  { id: 'high', label: 'Alta' },
  { id: 'balanced', label: 'Equilibrada' },
  { id: 'light', label: 'Leve' },
];
export const QUALITY_CFG: Record<Quality, { dpr: number; particles: number; fpsCap: number }> = {
  high: { dpr: 2, particles: 1, fpsCap: 0 },
  balanced: { dpr: 1.5, particles: 0.7, fpsCap: 0 },
  light: { dpr: 1, particles: 0.45, fpsCap: 30 },
};
export function quality(): Quality {
  const v = load().quality;
  if (v === 'high' || v === 'balanced' || v === 'light') return v;
  return window.matchMedia('(pointer: coarse)').matches ? 'balanced' : 'high';
}
export function setQuality(v: Quality) {
  store({ quality: v });
  setLightWeatherFx(weatherFxLight());
}

/** Medidor de FPS flutuante (ui/fps.ts), desligado por padrão; e onde ele fica na tela. */
export const showFps = () => load().fps === true;
export const setShowFps = (v: boolean) => store({ fps: v });
export function fpsPos(): { x: number; y: number } {
  const p = load().fpsPos as { x?: unknown; y?: unknown } | undefined;
  return typeof p?.x === 'number' && typeof p?.y === 'number' ? { x: p.x, y: p.y } : { x: 12, y: 64 };
}
export const setFpsPos = (p: { x: number; y: number }) => store({ fpsPos: p });

/** Efeitos de clima leves: sem pegadas, bafo, fumaça das chaminés e névoa da nevasca (poupa bateria). Qualidade Leve liga. */
export const weatherFxLight = () => load().weatherFx === 'light' || quality() === 'light';
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
  setLightWeatherFx(weatherFxLight());
}
