// Pedaços de interface comuns às ferramentas de desenvolvimento: ícones (glifos do jogo + os das ferramentas),
// botões com ícone por `data-ico`, teclas `<kbd>`, estado de "não salvo" no botão Salvar e o diálogo de atalhos ("?").
import { GLYPHS } from '../../src/ui/glyphs';
import { TOOL_GLYPHS } from './glyphs';

/** SVG inline de um glifo (do jogo ou só das ferramentas). */
export function ico(name: string, cls = 'ic') {
  const body = TOOL_GLYPHS[name] ?? GLYPHS[name];
  return body ? `<svg class="${cls}" viewBox="0 0 256 256" aria-hidden="true">${body}</svg>` : '';
}

/** Põe o ícone em todo elemento com `data-ico` (uma vez; chame de novo depois de trocar HTML). */
export function applyIcons(root: ParentNode = document) {
  for (const el of root.querySelectorAll<HTMLElement>('[data-ico]')) {
    if (el instanceof SVGElement) {
      // o próprio <svg class="ic" data-ico="…"> vira o glifo
      if (!el.innerHTML.trim()) el.innerHTML = TOOL_GLYPHS[el.dataset.ico!] ?? GLYPHS[el.dataset.ico!] ?? '';
      continue;
    }
    if (el.querySelector(':scope > svg.ic')) continue;
    el.insertAdjacentHTML('afterbegin', ico(el.dataset.ico!));
  }
}

export const kbd = (k: string) => `<kbd>${k}</kbd>`;

/**
 * Dicas instantâneas: um elemento fixo só (#tip) que aparece ao passar o mouse em qualquer `[data-tip]`, do lado pedido
 * em `data-tip-pos` (top, bottom, right) e preso dentro da janela: nunca é cortado por painel que rola nem pela borda.
 */
function initTips() {
  const tip = document.createElement('div');
  tip.id = 'tip';
  tip.hidden = true;
  document.body.appendChild(tip);
  let cur: HTMLElement | null = null;
  const hide = () => {
    tip.hidden = true;
    cur = null;
  };
  const show = (el: HTMLElement) => {
    cur = el;
    tip.textContent = el.dataset.tip ?? '';
    tip.hidden = false;
    const r = el.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    const pos = el.dataset.tipPos ?? 'top';
    const M = 6;
    let x = r.left + r.width / 2 - t.width / 2;
    let y = r.top - t.height - 7;
    if (pos === 'bottom') y = r.bottom + 7;
    else if (pos === 'right') {
      x = r.right + 8;
      y = r.top + r.height / 2 - t.height / 2;
    }
    if (y < M) y = pos === 'top' ? r.bottom + 7 : M;
    x = Math.max(M, Math.min(window.innerWidth - t.width - M, x));
    y = Math.max(M, Math.min(window.innerHeight - t.height - M, y));
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
  };
  document.addEventListener('mouseover', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]');
    if (el && el !== cur) show(el);
    else if (!el && cur) hide();
  });
  document.addEventListener('mousedown', hide);
  document.addEventListener('scroll', hide, true);
  window.addEventListener('blur', hide);
}
initTips();

/** Marca o botão Salvar (ponto amarelo) e o texto de estado quando há mudança não salva. */
export function markDirty(dirty: boolean, text = '') {
  document.getElementById('save')?.classList.toggle('dirty', dirty);
  const s = document.getElementById('status');
  if (s && text !== null) {
    s.textContent = text;
    s.className = `status${dirty ? ' dirty' : ''}`;
  }
}
/** Texto de estado com cor: ok (verde), err (vermelho) ou neutro. */
export function setStatus(text: string, kind: '' | 'ok' | 'err' | 'dirty' = '') {
  const s = document.getElementById('status');
  if (!s) return;
  s.textContent = text;
  s.className = `status${kind ? ` ${kind}` : ''}`;
}

export type HelpGroup = [title: string, rows: [keys: string, what: string][]];

/**
 * Diálogo de atalhos e dicas: grupos com tabela tecla → o que faz. Abre pelo botão `#help` e pela tecla "?"
 * (fora de campos de texto); fecha com Esc ou pelo X.
 */
export function helpDialog(title: string, groups: HelpGroup[]) {
  const d = document.createElement('dialog');
  d.className = 'help';
  const keys = (k: string) =>
    k
      .split(/\s*\|\s*/)
      .map((alt) => alt.split('+').map((p) => kbd(p.trim())).join('<span class="plus">+</span>'))
      .join(' <small>ou</small> ');
  d.innerHTML = `<div class="hd">${ico('keyboard')}<b>${title}</b><span class="grow"></span><button class="icon ghost" data-close aria-label="Fechar">${ico('x')}</button></div>
    <div class="bd">${groups
      .map(([t, rows]) => `<section><h3>${t}</h3><table>${rows.map(([k, w]) => `<tr><td>${keys(k)}</td><td>${w}</td></tr>`).join('')}</table></section>`)
      .join('')}</div>`;
  document.body.appendChild(d);
  d.querySelector<HTMLButtonElement>('[data-close]')!.onclick = () => d.close();
  d.addEventListener('click', (e) => {
    if (e.target === d) d.close(); // clique fora
  });
  const open = () => (d.open ? d.close() : d.showModal());
  document.getElementById('help')?.addEventListener('click', open);
  window.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    if (e.key === '?' && !(t.tagName === 'INPUT' && (t as HTMLInputElement).type !== 'checkbox')) {
      e.preventDefault();
      open();
    }
  });
  return { open };
}
