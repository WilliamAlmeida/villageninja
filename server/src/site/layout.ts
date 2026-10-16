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
  const nav = (key: PageOpts['nav'], url: string, label: string) => `<a href="${url}"${o.nav === key ? ' aria-current="page"' : ''}>${label}</a>`;
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
<link rel="stylesheet" href="${assetUrl('site.css')}">
<script src="${assetUrl('site.js')}" defer></script>
</head>
<body data-lang="${o.lang}">
<header class="top">
  <a class="brand" href="${h('/')}"><img src="${assetUrl('img/emblem-64.png')}" alt="" width="36" height="36"><span><b>${t.siteName}</b><small>${t.short}</small></span></a>
  <nav class="nav">${nav('home', h('/'), t.navHome)}${nav('ranking', h('/ranking'), t.navRanking)}${nav('news', h('/novidades'), t.navNews)}</nav>
  <div class="top-r">
    <a class="lang" href="${o.lang === 'pt' ? enPath : ptPath}" data-lang-switch="${o.lang === 'pt' ? 'en' : 'pt'}">${t.langOther}</a>
    <span class="who" data-who hidden></span>
    <a class="btn ghost" href="${h('/entrar')}" data-login>${t.login}</a>
    <a class="btn play" href="/play">${t.playShort}</a>
  </div>
</header>
<main>${o.body}</main>
<footer class="foot">
  <span class="foot-brand"><img src="${assetUrl('img/emblem-64.png')}" alt="" width="28" height="28">${t.footer}</span>
  <span><a href="${h('/')}">${t.navHome}</a> · <a href="${h('/ranking')}">${t.navRanking}</a> · <a href="${h('/novidades')}">${t.navNews}</a> · <a href="${h('/privacidade')}">${t.privacy}</a> · <a href="${h('/termos')}">${t.terms}</a> · <a href="/play">${t.playShort}</a></span>
</footer>
</body>
</html>`;
}
