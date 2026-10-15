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
function load(): { fontSize?: unknown; weatherFx?: unknown; follow?: unknown; fps?: unknown; fpsPos?: unknown; quality?: unknown; occl?: unknown; sim?: unknown } {
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

/**
 * Personagem atrás de prédio (Configurações → "Atrás de prédios"), cada um liga/desliga e eles combinam: silhueta do
 * personagem por cima do prédio, esmaecer o prédio inteiro (o de sempre, padrão), furo em volta do personagem e
 * pontilhado no lugar da transparência (vale para o esmaecer e o furo). Desenho em render/renderer.ts (`Occlusion`).
 */
export interface OcclusionCfg {
  silhouette: boolean;
  fade: boolean;
  cutout: boolean;
  dither: boolean;
}
const OCCL_DEFAULT: OcclusionCfg = { silhouette: false, fade: true, cutout: false, dither: false };
let occl: OcclusionCfg | null = null;
export function occlusion(): OcclusionCfg {
  const v = load().occl;
  return (occl ??= { ...OCCL_DEFAULT, ...(v && typeof v === 'object' ? (v as Partial<OcclusionCfg>) : {}) });
}
export function setOcclusion(key: keyof OcclusionCfg, on: boolean) {
  occl = { ...occlusion(), [key]: on };
  store({ occl });
}

/**
 * Processamento (Configurações): Normal = a simulação dá 60 passos por segundo de jogo; Reduzido = 30, cada um com o
 * dobro do tempo (metade da conta: para celular fraco, onde a simulação come o quadro). Por aparelho, fora do save.
 */
export type SimRate = 'normal' | 'reduced';
export const simRate = (): SimRate => (load().sim === 'reduced' ? 'reduced' : 'normal');
export const setSimRate = (v: SimRate) => store({ sim: v });

/**
 * Medidor de FPS flutuante (ui/fps.ts), desligado por padrão; "detail" mostra também os ms por quadro de desenho,
 * simulação e interface e as etapas do desenho (para achar o que pesa num aparelho). E onde ele fica na tela.
 */
export type FpsMode = 'off' | 'on' | 'detail';
export function fpsMode(): FpsMode {
  const v = load().fps;
  return v === true || v === 'on' ? 'on' : v === 'detail' ? 'detail' : 'off';
}
export const showFps = () => fpsMode() !== 'off';
export const setFpsMode = (v: FpsMode) => store({ fps: v });
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
