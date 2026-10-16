// Site público (tudo que não é /api nem o jogo em /play): pt-BR na raiz e inglês em /en. Cada página sai pronta do
// servidor e fica no cache (Redis) por um minuto, então abrir o site não espera consulta nenhuma no caminho comum.
import { cache } from '../cache';
import { publicOrigin } from '../config';
import { duels } from '../services/duels';
import { type Lang, ptOf } from './i18n';
import { privacyPage, termsPage } from './legal';
import { news } from '../services/news';
import { homePage, loginPage, newsListPage, newsPage, notFoundPage, profilePage, rankingPage } from './pages';
import { assetUrl, serveStatic } from './static';

const PAGE_TTL = 60;
const html = (body: string, status = 200, maxAge = PAGE_TTL) =>
  new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': status === 200 ? `public, max-age=${maxAge}` : 'no-store' } });

/** Ranking do site, guardado 30 s (a home e a página do ranking usam o mesmo). */
export const publicTop = () => cache.remember('site:top50', 30, () => duels.publicTop(50));

export async function handleSite(req: Request, url: URL): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
  const stat = await serveStatic(url.pathname, url);
  if (stat) return stat;
  const raw = url.pathname.replace(/\/+$/, '') || '/';
  const lang: Lang = raw === '/en' || raw.startsWith('/en/') ? 'en' : 'pt';
  const path = lang === 'en' ? ptOf(raw.slice(3) || '/') : raw;
  // endereços antigos da página de login (/entrar, /en/sign-in) continuam valendo
  if (raw === '/entrar' || raw === '/en/sign-in') {
    return new Response(null, { status: 301, headers: { Location: `${lang === 'en' ? '/en' : ''}/login${url.search}` } });
  }
  const origin = publicOrigin(req);
  // painel da equipe: casca estática (os dados chegam pela API, um quadro por vez); fora do Google e sem cache
  if (raw === '/staff') return staffShell();
  const cached = (key: string, render: () => Promise<string>) => cache.remember(`site:page:${lang}:${key}:${origin}`, PAGE_TTL, render).then((b) => html(b));
  switch (path) {
    case '/':
      return cached('home', async () => homePage(lang, origin, [], await news.published(3)));
    case '/novidades':
      return cached('novidades', async () => newsListPage(lang, origin, await news.published(50)));
    case '/ranking':
      return cached('ranking', async () => rankingPage(lang, origin, []));
    case '/login':
      return cached('login', async () => loginPage(lang, origin));
    case '/privacidade':
      return cached('privacidade', async () => privacyPage(lang, origin));
    case '/termos':
      return cached('termos', async () => termsPage(lang, origin));
  }
  const nw = /^\/novidades\/([a-z0-9-]{1,80})$/.exec(path);
  if (nw) {
    const n = await cache.remember(`site:news:${nw[1]}`, 60, async () => (await news.bySlug(nw[1]!)) ?? false);
    if (n) return html(newsPage(lang, origin, n));
  }
  const prof = /^\/jogador\/([0-9a-f-]{36})$/i.exec(path);
  if (prof) {
    const id = prof[1]!.toLowerCase();
    const p = await cache.remember(`site:profile:${id}`, 60, async () => (await duels.publicProfile(id)) ?? false);
    if (p) return html(profilePage(lang, origin, p));
  }
  return html(notFoundPage(lang, origin), 404);
}

function staffShell(): Response {
  const body = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Painel · NCF RPG</title>
<link rel="icon" href="${assetUrl('img/emblem-64.png')}">
<link rel="stylesheet" href="${assetUrl('site.css')}">
<link rel="stylesheet" href="${assetUrl('staff.css')}">
<script src="${assetUrl('staff.js')}" defer></script>
</head>
<body class="staff">
<header class="top">
  <a class="brand" href="#/"><img src="${assetUrl('img/emblem-64.png')}" alt="" width="32" height="32"><span><b>Painel</b><small>NCF RPG</small></span></a>
  <nav class="nav" data-nav hidden>
    <a href="#/">Visão geral</a><a href="#/jogadores">Jogadores</a><a href="#/suspeitos">Suspeitos</a><a href="#/avisos">Avisos</a><a href="#/noticias">Novidades</a><a href="#/registro">Registro</a>
  </nav>
  <div class="top-r"><span class="who" data-who></span><a class="btn ghost" href="/">Site</a><a class="btn play" href="/play">Jogo</a></div>
</header>
<main id="app"><div class="sec"><span class="spin"></span></div></main>
</body>
</html>`;
  return new Response(body, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}
