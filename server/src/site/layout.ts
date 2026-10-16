// Moldura das páginas do site: cabeçalho, rodapé, metatags (OG, hreflang) e os arquivos estáticos com versão no nome.
// Tudo sai pronto do servidor (rápido e indexável); o que muda a cada pessoa (quem está logado, on-line agora) chega
// depois, pelo site.js, sem segurar a página.
import { altPath, base, type Lang, T } from './i18n';
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
  nav?: 'home' | 'ranking';
  body: string;
  /** Imagem de prévia (OG). */
  image?: string;
  origin: string;
}

export function page(o: PageOpts): string {
  const t = T[o.lang];
  const b = base(o.lang);
  const ptPath = o.path;
  const enPath = altPath('pt', o.path);
  const ptUrl = o.origin + ptPath;
  const enUrl = o.origin + enPath;
  const title = o.title ? `${o.title} · ${t.siteName}` : `${t.siteName} · ${t.tagline}`;
  const desc = o.desc ?? t.metaDesc;
  const img = o.origin + (o.image ?? assetUrl('art/scene-village.png'));
  const nav = (key: PageOpts['nav'], href: string, label: string) => `<a href="${href}"${o.nav === key ? ' aria-current="page"' : ''}>${label}</a>`;
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
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${img}">
<meta property="og:locale" content="${o.lang === 'pt' ? 'pt_BR' : 'en_US'}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#16110d">
<link rel="icon" href="/app-icons/icon-192.png">
<link rel="manifest" href="/app.webmanifest">
<link rel="stylesheet" href="${assetUrl('site.css')}">
<script src="${assetUrl('site.js')}" defer></script>
</head>
<body data-lang="${o.lang}">
<header class="top">
  <a class="brand" href="${b || '/'}"><img src="/app-icons/icon-192.png" alt="" width="32" height="32"><span>${t.siteName}</span></a>
  <nav class="nav">${nav('home', b || '/', t.navHome)}${nav('ranking', `${b}/ranking`, t.navRanking)}</nav>
  <div class="top-r">
    <a class="lang" href="${o.lang === 'pt' ? enPath : ptPath}" data-lang-switch="${o.lang === 'pt' ? 'en' : 'pt'}">${t.langOther}</a>
    <span class="who" data-who hidden></span>
    <a class="btn ghost" href="${b}/entrar" data-login>${t.login}</a>
    <a class="btn play" href="/play">${t.playShort}</a>
  </div>
</header>
<main>${o.body}</main>
<footer class="foot"><span>${t.footer}</span><span><a href="${b || '/'}">${t.navHome}</a> · <a href="${b}/ranking">${t.navRanking}</a> · <a href="/play">${t.playShort}</a></span></footer>
</body>
</html>`;
}
