// Atualiza um pedaço do DOM para ficar igual a um HTML novo mexendo só no que mudou (texto, atributos, nós a mais ou
// a menos), em vez de trocar tudo com innerHTML. Assim o botão sob o dedo/mouse continua sendo o mesmo elemento (o
// clique não se perde quando o painel se atualiza no meio dele), a rolagem fica onde está e imagens já carregadas
// não piscam.

const tpl = typeof document !== 'undefined' ? document.createElement('template') : null;

/** Deixa `root` com os filhos descritos por `html`. */
export function morph(root: Element, html: string) {
  if (!tpl) return;
  tpl.innerHTML = html;
  morphChildren(root, tpl.content);
}

function morphChildren(from: Node, to: Node) {
  const a = Array.from(from.childNodes);
  const b = Array.from(to.childNodes);
  for (let i = 0; i < b.length; i++) {
    const cur = a[i];
    const next = b[i]!;
    if (!cur) {
      from.appendChild(next.cloneNode(true));
      continue;
    }
    if (!same(cur, next)) {
      from.replaceChild(next.cloneNode(true), cur);
      continue;
    }
    if (cur.nodeType === Node.TEXT_NODE || cur.nodeType === Node.COMMENT_NODE) {
      if (cur.nodeValue !== next.nodeValue) cur.nodeValue = next.nodeValue;
      continue;
    }
    const el = cur as Element;
    syncAttrs(el, next as Element);
    // canvas (interior dos prédios) e SVG desenhados por código: só os atributos importam
    if (el.tagName === 'CANVAS') continue;
    morphChildren(el, next);
  }
  for (let i = a.length - 1; i >= b.length; i--) from.removeChild(a[i]!);
}

/** Mesmo tipo de nó e mesma tag (e o mesmo `src` em imagens: trocar a imagem é trocar o elemento). */
function same(x: Node, y: Node) {
  if (x.nodeType !== y.nodeType) return false;
  if (x.nodeType !== Node.ELEMENT_NODE) return true;
  const ex = x as Element;
  const ey = y as Element;
  if (ex.tagName !== ey.tagName) return false;
  if (ex.tagName === 'IMG' && ex.getAttribute('src') !== ey.getAttribute('src')) return false;
  return true;
}

function syncAttrs(el: Element, next: Element) {
  for (const { name, value } of Array.from(next.attributes)) {
    let v = value;
    // imagem que já carregou mantém a marca de carregada (senão o esqueleto voltaria a cada atualização)
    if (name === 'class' && el.tagName === 'IMG' && el.classList.contains('ok')) v = `${value} ok`;
    if (el.getAttribute(name) !== v) el.setAttribute(name, v);
  }
  // `open` de <details> é estado do usuário (dropdown aberto): a atualização periódica não fecha
  for (const { name } of Array.from(el.attributes)) if (!next.hasAttribute(name) && !(name === 'open' && el.tagName === 'DETAILS')) el.removeAttribute(name);
  // o texto das barras/números dinâmicos é escrito depois (data-t/data-b): não apagar o estilo calculado
}
