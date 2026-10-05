export function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (html) e.innerHTML = html;
  return e;
}

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ESC[c]!);

export const fmt = (n: number) => (n >= 10000 ? `${(n / 1000).toFixed(1)}k` : String(Math.floor(n)));

/** Desktop largo: a janela central e o painel lateral cabem juntos (a janela encolhe para a esquerda). Igual ao CSS. */
export const SIDE_BY_SIDE = '(hover: hover) and (min-width: 1100px)';
export const sideBySide = () => window.matchMedia(SIDE_BY_SIDE).matches;
