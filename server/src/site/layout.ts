// Moldura das páginas do site: cabeçalho, rodapé, metatags (OG, hreflang) e os arquivos estáticos com versão no nome.
// Tudo sai pronto do servidor (rápido e indexável); o que muda a cada pessoa (quem está logado, on-line agora) chega
// depois, pelo site.js, sem segurar a página.
import { altPath, href, type Lang, T } from './i18n';
import { assetUrl } from './static';

export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export interface PageOpts {
  lang: Lang;
  /** Caminho em português, sem o /en (para o hreflang e a troca de língua). */
  path: string;
  title?: string;
  desc?: string;
  /** Item do menu marcado. */
  nav?: 'home' | 'ranking' | 'news';
  body: string;
  /** Imagem de prévia (OG). */
  image?: string;
  origin: string;
}

/**
 * Roda antes de desenhar a página: a troca automática de língua (quem não usa português vai para /en na primeira visita)
 * acontece aqui, sem mostrar a página em português antes; e liga a abertura do pergaminho na primeira página da visita.
 */
function bootScript(lang: Lang, enPath: string): string {
  const toEn = lang === 'pt' ? `if(!s.getItem('vn_site_lang')&&!location.hash&&!/^pt/i.test((navigator.languages&&navigator.languages[0])||navigator.language||'pt')){s.setItem('vn_site_lang','en');location.replace(${JSON.stringify(enPath)}+location.search)}` : '';
  return `(function(){var d=document.documentElement;try{var s=localStorage;${toEn}if(!sessionStorage.getItem('vn_splash')&&!matchMedia('(prefers-reduced-motion: reduce)').matches)d.classList.add('splash')}catch(e){}})()`;
}

/**
 * Quem está logado, desenhado no menu SEM esperar a rede: `vnWho(a)` (a = conta guardada em `vn_site_me` pelo site.js na
 * última visita, presa ao token) roda logo depois do cabeçalho e do rodapé, antes de a página aparecer; o site.js confere
 * com /api/me depois e chama de novo (ou `vnWho(null)` se a conta saiu). Assim "Entrar" e o Ranking não piscam.
 */
const WHO_SCRIPT = `window.vnWho=function(a){var d=document,q=function(s){return d.querySelectorAll(s)},e=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return'&#'+c.charCodeAt(0)+';'})};var w=d.querySelector('[data-who]');if(w){w.innerHTML=a?(a.avatarUrl?'<img src="'+e(a.avatarUrl)+'" alt="" referrerpolicy="no-referrer" onerror="this.remove()">':'')+'<span>'+e(a.displayName)+'</span>'+(a.role==='mod'||a.role==='admin'?' · <a href="/staff">'+(d.body.dataset.lang==='pt'?'Painel':'Staff')+'</a>':''):'';w.hidden=!a}q('[data-login]').forEach(function(x){x.hidden=!!a});q('[data-needs-account]').forEach(function(x){x.hidden=!a})};window.vnWhoCached=function(){try{var t=localStorage.getItem('vn_arena_token'),m=t&&JSON.parse(localStorage.getItem('vn_site_me')||'null');if(m&&m.k===t.slice(-16))vnWho(m)}catch(e){}}`;

/** Pergaminho que se abre ao carregar (folha img/scroll-sheet.png; site.js abre as duas metades quando a página carrega). */
function splash(loading: string): string {
  const half = (side: string) => `<div class="sp-half ${side}"><div class="sp-scroll"></div></div>`;
  // enquanto carrega aparece uma peça só (sem emenda no meio); as metades só entram na hora de abrir
  return `<div class="sp" aria-hidden="true" style="--sheet:url('${assetUrl('img/scroll-sheet.png')}')">${half('whole')}${half('l')}${half('r')}<span class="sp-load">${loading}</span></div>`;
}

export function page(o: PageOpts): string {
  const t = T[o.lang];
  const ptPath = o.path;
  const enPath = altPath('pt', o.path);
  const ptUrl = o.origin + ptPath;
  const enUrl = o.origin + enPath;
  const title = o.title ? `${o.title} · ${t.siteName}` : `${t.siteName} (${t.short}) · ${t.tagline}`;
  const desc = o.desc ?? t.metaDesc;
  const img = o.origin + (o.image ?? assetUrl('img/hero.webp'));
  const h = (p: string) => href(o.lang, p);
  // Ranking só aparece para quem entrou com conta (site.js mostra): a página é a mesma para todo mundo (cache)
  const nav = (key: PageOpts['nav'], url: string, label: string, needsAccount = false) =>
    `<a href="${url}"${o.nav === key ? ' aria-current="page"' : ''}${needsAccount ? ' data-needs-account hidden' : ''}>${label}</a>`;
  return `<!doctype html>
<html lang="${t.htmlLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${o.lang === 'pt' ? ptUrl : enUrl}">
<link rel="alternate" hreflang="pt-BR" href="${ptUrl}">
<link rel="alternate" hreflang="en" href="${enUrl}">
<link rel="alternate" hreflang="x-default" href="${ptUrl}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${t.siteName}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${img}">
<meta property="og:locale" content="${o.lang === 'pt' ? 'pt_BR' : 'en_US'}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#16110d">
<link rel="icon" href="${assetUrl('img/emblem-64.png')}">
<link rel="manifest" href="/app.webmanifest">
<link rel="preload" as="image" href="${assetUrl('img/hero.webp')}">
<link rel="preload" as="image" href="${assetUrl('img/scroll-sheet.png')}">
<link rel="stylesheet" href="${assetUrl('site.css')}">
<script>${bootScript(o.lang, enPath)};${WHO_SCRIPT}</script>
<script src="${assetUrl('site.js')}" defer></script>
</head>
<body data-lang="${o.lang}">
${splash(t.loading)}
<div class="progress" aria-hidden="true"><i data-progress></i></div>
<header class="top" data-top>
  <a class="brand" href="${h('/')}"><img src="${assetUrl('img/emblem-64.png')}" alt="" width="36" height="36"><span><b>${t.siteName}</b><small>${t.short}</small></span></a>
  <nav class="nav">${nav('home', h('/'), t.navHome)}${nav('ranking', h('/ranking'), t.navRanking, true)}${nav('news', h('/novidades'), t.navNews)}</nav>
  <div class="top-r">
    <a class="lang" href="${o.lang === 'pt' ? enPath : ptPath}" data-lang-switch="${o.lang === 'pt' ? 'en' : 'pt'}">${t.langOther}</a>
    <span class="who" data-who hidden></span>
    <a class="btn ghost" href="${h('/login')}" data-login>${t.login}</a>
    <a class="btn play" href="/play">${t.playShort}</a>
  </div>
</header>
<script>vnWhoCached()</script>
<main>${o.body}</main>
<footer class="foot">
  <span class="foot-brand"><img src="${assetUrl('img/emblem-64.png')}" alt="" width="28" height="28">${t.footer}</span>
  <span><a href="${h('/')}">${t.navHome}</a> · <a href="${h('/ranking')}" data-needs-account hidden>${t.navRanking} · </a><a href="${h('/novidades')}">${t.navNews}</a> · <a href="${h('/privacidade')}">${t.privacy}</a> · <a href="${h('/termos')}">${t.terms}</a> · <a href="/play">${t.playShort}</a></span>
</footer>
<script>vnWhoCached()</script>
</body>
</html>`;
}
