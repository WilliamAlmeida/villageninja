// Site público (tudo que não é /api nem o jogo em /play): pt-BR na raiz e inglês em /en. Cada página sai pronta do
// servidor e fica no cache (Redis) por um minuto, então abrir o site não espera consulta nenhuma no caminho comum.
import { cache } from '../cache';
import { publicOrigin } from '../config';
import { duels } from '../services/duels';
import type { Lang } from './i18n';
import { homePage, loginPage, notFoundPage, rankingPage } from './pages';
import { serveStatic } from './static';

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
  const path = lang === 'en' ? raw.slice(3) || '/' : raw;
  const origin = publicOrigin(req);
  const cached = (key: string, render: () => Promise<string>) => cache.remember(`site:page:${lang}:${key}:${origin}`, PAGE_TTL, render).then((b) => html(b));
  switch (path) {
    case '/':
      return cached('home', async () => homePage(lang, origin, await publicTop()));
    case '/ranking':
      return cached('ranking', async () => rankingPage(lang, origin, await publicTop()));
    case '/entrar':
      return cached('entrar', async () => loginPage(lang, origin));
  }
  return html(notFoundPage(lang, origin), 404);
}
