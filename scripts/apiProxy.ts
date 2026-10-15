// Proxy de /api/* para o servidor de duelos (server/, porta ARENA_PORT ou 3012): o jogo e a API saem pela mesma origem
// (localhost:3010 ou o túnel Cloudflare), sem CORS e sem expor outra porta. O relatório do medidor de FPS
// (/api/perf-report) continua sendo do próprio script de servir.
const target = `http://127.0.0.1:${process.env.ARENA_PORT ?? 3012}`;
const NO_STORE = { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' } as const;

export async function proxyApi(req: Request, ip?: string): Promise<Response | null> {
  const url = new URL(req.url);
  if (!(url.pathname === '/api' || url.pathname.startsWith('/api/')) || url.pathname === '/api/perf-report') return null;
  const headers = new Headers(req.headers);
  headers.delete('host');
  if (ip && !headers.has('x-forwarded-for')) headers.set('x-forwarded-for', ip);
  try {
    const res = await fetch(target + url.pathname + url.search, {
      method: req.method,
      headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.arrayBuffer(),
      redirect: 'manual',
    });
    const out = new Headers(res.headers);
    out.set('Cache-Control', 'no-store');
    return new Response(res.body, { status: res.status, headers: out });
  } catch {
    // servidor de duelos parado: o jogo mostra "sem conexão" e segue (o duelo manual continua funcionando)
    return new Response(JSON.stringify({ error: 'OFFLINE' }), { status: 503, headers: NO_STORE });
  }
}
