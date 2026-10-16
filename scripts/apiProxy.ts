// Proxy para o servidor do jogo (server/, porta ARENA_PORT ou 3012): a API (/api/*) e as páginas do site (início,
// ranking, perfis, /staff) saem pela mesma origem do jogo (localhost:3010 ou o túnel Cloudflare), sem CORS e sem expor
// outra porta. O jogo fica em /play; o relatório do medidor de FPS (/api/perf-report) continua sendo do script de servir.
const target = `http://127.0.0.1:${process.env.ARENA_PORT ?? 3012}`;
const NO_STORE = { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' } as const;

/** Repassa o pedido ao servidor, dizendo a origem pública (o login do Discord/Google monta o endereço de volta com ela). */
async function forward(req: Request, url: URL, ip?: string): Promise<Response> {
  const headers = new Headers(req.headers);
  headers.delete('host');
  if (ip && !headers.has('x-forwarded-for')) headers.set('x-forwarded-for', ip);
  if (!headers.has('x-forwarded-host')) headers.set('x-forwarded-host', url.host);
  if (!headers.has('x-forwarded-proto')) headers.set('x-forwarded-proto', url.protocol.replace(':', ''));
  return fetch(target + url.pathname + url.search, {
    method: req.method,
    headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.arrayBuffer(),
    redirect: 'manual',
  });
}

export async function proxyApi(req: Request, ip?: string): Promise<Response | null> {
  const url = new URL(req.url);
  if (!(url.pathname === '/api' || url.pathname.startsWith('/api/')) || url.pathname === '/api/perf-report') return null;
  try {
    const res = await forward(req, url, ip);
    const out = new Headers(res.headers);
    out.set('Cache-Control', 'no-store');
    return new Response(res.body, { status: res.status, headers: out });
  } catch {
    // servidor de duelos parado: o jogo mostra "sem conexão" e segue (o duelo manual continua funcionando)
    return new Response(JSON.stringify({ error: 'OFFLINE' }), { status: 503, headers: NO_STORE });
  }
}

/** Páginas do site (tudo que não é do jogo): o servidor decide o cache de cada uma. */
export async function proxySite(req: Request, ip?: string): Promise<Response> {
  const url = new URL(req.url);
  try {
    const res = await forward(req, url, ip);
    return new Response(res.body, { status: res.status, headers: res.headers });
  } catch {
    return new Response('<!doctype html><meta charset="utf-8"><title>Vila Ninja</title><p>Site fora do ar por instantes. <a href="/play">Jogar</a></p>', {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}

/** Endereços antigos do jogo na raiz (`/?demo`, `/?tela=…`) continuam abrindo o jogo. */
export function legacyGameRedirect(url: URL): Response | null {
  if (url.pathname !== '/') return null;
  const q = url.searchParams;
  if (!['demo', 'tela', 'arena', 'dev', 'perf'].some((k) => q.has(k))) return null;
  return new Response(null, { status: 302, headers: { Location: `/play${url.search}`, 'Cache-Control': 'no-store' } });
}
