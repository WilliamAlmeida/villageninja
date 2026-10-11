// Abrir e fechar com animação (janela, drawer, avisos, menu, barra de construção). Abrir só tira o `hidden` (a entrada é
// a `animation` do CSS, que roda sempre que o elemento volta a aparecer). Fechar põe a classe `closing` (o CSS anima a
// saída) e só esconde no fim; reabrir no meio cancela. Sem animação (preferência do sistema): esconde na hora.

/** Duração máxima da saída (ms); o CSS usa até 0,16 s. */
const OUT_MS = 170;
const timers = new WeakMap<HTMLElement, number>();
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function setShown(el: HTMLElement, show: boolean) {
  const t = timers.get(el);
  if (show) {
    if (t != null) {
      clearTimeout(t);
      timers.delete(el);
    }
    el.classList.remove('closing');
    el.hidden = false;
    return;
  }
  if (el.hidden || t != null) return; // já fechado ou fechando
  if (reduced()) {
    el.hidden = true;
    return;
  }
  el.classList.add('closing');
  timers.set(
    el,
    window.setTimeout(() => {
      timers.delete(el);
      el.classList.remove('closing');
      el.hidden = true;
    }, OUT_MS),
  );
}

/** Aberto de verdade (ignora o que está só terminando de fechar). */
export const isShown = (el: HTMLElement | null) => !!el && !el.hidden && !el.classList.contains('closing');
