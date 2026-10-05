// Tela cheia e instalação como app (PWA).
// - Android/desktop: Fullscreen API (botão) e "Instalar app" (evento beforeinstallprompt).
// - iPhone/iPad: o Safari não deixa sites ficarem em tela cheia; o caminho é "Adicionar à Tela de Início".

type InstallPrompt = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };
let installEvent: InstallPrompt | null = null;
let onChange: () => void = () => {};

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); // guarda para mostrar no nosso botão
  installEvent = e as InstallPrompt;
  onChange();
});
window.addEventListener('appinstalled', () => {
  installEvent = null;
  onChange();
});

/** Avisa quando muda algo (tela cheia, app instalável) para a interface se atualizar. */
export function watchFullscreen(fn: () => void) {
  onChange = fn;
  document.addEventListener('fullscreenchange', fn);
  document.addEventListener('webkitfullscreenchange', fn);
}

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** Aberto como app instalado (já sem a barra do navegador). */
export const isStandalone = () =>
  matchMedia('(display-mode: fullscreen)').matches ||
  matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

type FsDoc = Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => Promise<void>; webkitFullscreenEnabled?: boolean };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };

export const canFullscreen = () => !!(document.fullscreenEnabled || (document as FsDoc).webkitFullscreenEnabled);
export const isFullscreen = () => !!(document.fullscreenElement || (document as FsDoc).webkitFullscreenElement);

export async function toggleFullscreen() {
  const d = document as FsDoc;
  try {
    if (isFullscreen()) {
      await (document.exitFullscreen?.() ?? d.webkitExitFullscreen?.());
      return;
    }
    const el = document.documentElement as FsEl;
    await (el.requestFullscreen?.({ navigationUI: 'hide' }) ?? el.webkitRequestFullscreen?.());
    // no celular, trava deitado (nem todo navegador permite)
    const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    await o.lock?.('landscape').catch(() => {});
  } catch {
    /* navegador recusou */
  }
}

export const canInstall = () => !!installEvent;

export async function install() {
  if (!installEvent) return false;
  await installEvent.prompt();
  const { outcome } = await installEvent.userChoice;
  installEvent = null;
  onChange();
  return outcome === 'accepted';
}

export const IOS_HINT = 'No iPhone: toque em Compartilhar e depois em "Adicionar à Tela de Início" para jogar em tela cheia.';
