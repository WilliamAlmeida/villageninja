// Dicas e avisos próprios do jogo (nada de alert/title nativo, que no celular fica feio ou nem aparece).
// - Dica: qualquer elemento com `data-tip` (texto com tokens {ícone}; `data-tip-title` opcional).
//   Mouse: aparece ao passar por cima. Toque: segurar o dedo; com `data-tip-tap`, um toque já mostra.
// - Aviso: `showAlert` abre um cartão no centro (título, texto, linhas com o que falta e botões).
// - Botão bloqueado: `aria-disabled="true"` + `data-why` (linhas separadas por \n). Tocar nele mostra o motivo.
import type { Cost } from '../game/types';
import type { Game } from '../game/game';
import { RES_INFO, RES_KEYS } from '../data/resources';
import { el, esc } from './dom';
import { rich } from './icons';
import { isShown, setShown } from './anim';

let tip: HTMLElement | null = null;
let tipFor: HTMLElement | null = null;
let showTimer = 0;
let hideTimer = 0;

function tipEl() {
  if (!tip) {
    tip = el('div', { id: 'tip', role: 'tooltip', hidden: '' });
    document.body.appendChild(tip);
  }
  return tip;
}

export function hideTip() {
  clearTimeout(showTimer);
  clearTimeout(hideTimer);
  tipFor = null;
  if (tip) tip.hidden = true;
}

/** Mostra a dica do elemento logo acima dele (ou abaixo, se não couber). */
export function showTip(target: HTMLElement, autoHide = 0) {
  const text = target.dataset.tip;
  if (!text) return;
  const t = tipEl();
  const title = target.dataset.tipTitle;
  t.innerHTML = rich(`${title ? `<b>${esc(title)}</b>` : ''}<span>${esc(text).replace(/\n/g, '<br>')}</span>`);
  t.hidden = false;
  tipFor = target;
  const r = target.getBoundingClientRect();
  const w = t.offsetWidth;
  const h = t.offsetHeight;
  const m = 8;
  let x = r.left + r.width / 2 - w / 2;
  x = Math.max(m, Math.min(innerWidth - w - m, x));
  let y = r.top - h - 6;
  if (y < m) y = r.bottom + 6;
  y = Math.max(m, Math.min(innerHeight - h - m, y));
  t.style.left = `${x}px`;
  t.style.top = `${y}px`;
  clearTimeout(hideTimer);
  if (autoHide) hideTimer = window.setTimeout(hideTip, autoHide);
}

/** Liga as dicas na página inteira (uma vez, por delegação de eventos). */
export function installTips() {
  let press = 0;
  let pressAt: { x: number; y: number } | null = null;
  /** O toque longo já mostrou a dica: o clique que vem depois não deve agir. */
  let swallow = false;

  document.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]');
    if (t === tipFor) return;
    clearTimeout(showTimer);
    if (!t) return hideTip();
    if (tip && !tip.hidden) showTip(t);
    else showTimer = window.setTimeout(() => showTip(t), 280);
  });
  document.addEventListener(
    'pointerdown',
    (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]');
      if (e.pointerType === 'mouse') {
        if (!t) hideTip();
        return;
      }
      if (t !== tipFor) hideTip();
      clearTimeout(press);
      swallow = false;
      if (!t) return;
      pressAt = { x: e.clientX, y: e.clientY };
      press = window.setTimeout(() => {
        swallow = true;
        showTip(t, 4000);
      }, 450);
    },
    true,
  );
  document.addEventListener(
    'pointermove',
    (e) => {
      if (pressAt && Math.hypot(e.clientX - pressAt.x, e.clientY - pressAt.y) > 10) clearTimeout(press);
    },
    true,
  );
  const up = () => {
    clearTimeout(press);
    pressAt = null;
  };
  document.addEventListener('pointerup', up, true);
  document.addEventListener('pointercancel', up, true);
  document.addEventListener(
    'click',
    (e) => {
      if (swallow) {
        swallow = false;
        e.stopPropagation();
        e.preventDefault();
        return;
      }
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-tip-tap]');
      if (t) showTip(t, 3500);
    },
    true,
  );
  // o menu de contexto do toque longo atrapalha a dica
  document.addEventListener('contextmenu', (e) => {
    if ((e.target as HTMLElement).closest('[data-tip]') && matchMedia('(pointer: coarse)').matches) e.preventDefault();
  });
  window.addEventListener('scroll', hideTip, true);
}

// ------------------------------------------------------------------ aviso central
export interface AlertOpts {
  title: string;
  /** Texto com tokens {ícone}. */
  text?: string;
  /** Linhas destacadas (o que falta, requisitos). */
  rows?: string[];
  /** HTML extra já pronto (imagem, etc.). */
  extra?: string;
  kind?: 'warn' | 'info';
  /** Botão principal opcional (ex.: "Construir"). */
  action?: { label: string; run: () => void; disabled?: boolean };
}

let box: HTMLElement | null = null;

export function closeAlert() {
  if (box) setShown(box, false);
}

export const alertOpen = () => isShown(box);

export function showAlert(o: AlertOpts) {
  hideTip();
  if (!box) {
    box = el('div', { id: 'alertbox', hidden: '' });
    box.addEventListener('click', (e) => {
      if (e.target === box || (e.target as HTMLElement).closest('[data-close]')) closeAlert();
    });
    box.addEventListener('pointerdown', (e) => e.stopPropagation());
    document.body.appendChild(box);
  }
  const rows = o.rows?.length ? `<ul class="need">${o.rows.map((r) => `<li>${r}</li>`).join('')}</ul>` : '';
  box.innerHTML = rich(`<div class="card ${o.kind ?? 'warn'}" role="alertdialog" aria-modal="true">
    <button class="x" data-close aria-label="Fechar"></button><div class="at">${o.kind === 'info' ? '' : '{alert} '}${esc(o.title)}</div>${o.extra ?? ''}
    ${o.text ? `<p>${o.text}</p>` : ''}${rows}
    <div class="ab">${o.action ? `<button class="btn primary" data-go ${o.action.disabled ? 'aria-disabled="true"' : ''}>${o.action.label}</button>` : ''}
    <button class="btn" data-close>${o.action ? 'Fechar' : 'Entendi'}</button></div></div>`);
  const go = box.querySelector<HTMLElement>('[data-go]');
  if (go && o.action && !o.action.disabled) {
    const run = o.action.run;
    go.addEventListener('click', () => {
      closeAlert();
      run();
    });
  }
  setShown(box, true);
  box.querySelector<HTMLElement>(o.action && !o.action.disabled ? '[data-go]' : '[data-close]')?.focus({ preventScroll: true });
}

/**
 * Mostra o motivo de um botão bloqueado (`aria-disabled` + `data-why` / `data-cost`). Retorna true se estava bloqueado.
 * O que falta do custo é calculado na hora do toque (o HTML do painel não muda a cada recurso que entra).
 */
export function blockedClick(g: Game, btn: HTMLElement | null): boolean {
  if (!btn || btn.getAttribute('aria-disabled') !== 'true') return false;
  const why = (btn.dataset.why ?? '').split('\n').filter(Boolean);
  const lack = btn.dataset.cost ? lackRows(g, JSON.parse(btn.dataset.cost) as Cost) : [];
  const rows = [...why, ...lack];
  const title = btn.dataset.whyTitle ?? (lack.length && !why.length ? 'Recursos insuficientes' : 'Ainda não dá');
  showAlert({ title, rows, text: rows.length ? undefined : 'Esta ação não está disponível agora.' });
  return true;
}

// ------------------------------------------------------------------ o que falta
/** Linhas "{wood} Madeira: 12 de 30 (faltam 18)" para cada recurso que não dá.  */
export function lackRows(g: Game, cost: Cost): string[] {
  return RES_KEYS.filter((k) => (cost[k] ?? 0) > (g.state.res[k] ?? 0)).map((k) => {
    const need = cost[k]!;
    const have = Math.floor(g.state.res[k] ?? 0);
    return `${RES_INFO[k].icon} ${RES_INFO[k].name}: tem ${have} de ${need} <b>(faltam ${need - have})</b>`;
  });
}

/**
 * Atributos de um botão: nada se pode; senão bloqueado, com os motivos (texto, aceita tokens) e o custo que não dá.
 * Uso: `<button ... ${blocked(g, [cond && 'motivo'], cost)}>`.
 */
export function blocked(g: Game, reasons: (string | false | null | undefined)[], cost?: Cost, title?: string): string {
  const why = reasons.filter((r): r is string => !!r);
  const poor = !!cost && !g.canAfford(cost);
  if (!why.length && !poor) return '';
  return `aria-disabled="true"${why.length ? ` data-why="${attr(why.map(esc).join('\n'))}"` : ''}${poor ? ` data-cost="${attr(JSON.stringify(cost))}"` : ''}${
    title ? ` data-why-title="${attr(title)}"` : ''
  }`;
}

/** Valor seguro para atributo: escapado e com `{` codificado (o `rich()` do painel não troca tokens dentro dele). */
export const attr = (s: string) => esc(s).replace(/\{/g, '&#123;');

/** Atributos de dica: `<span ${tipAttr('Madeira', 'Usada em...')}>`. `tap` = um toque já mostra (elementos sem ação). */
export const tipAttr = (title: string, text: string, tap = false) =>
  `data-tip-title="${attr(title)}" data-tip="${attr(text)}"${tap ? ' data-tip-tap' : ''}`;
