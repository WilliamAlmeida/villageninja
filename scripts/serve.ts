// Serve a pasta dist/ (resultado de `bun run build`) para testar o build de produção.
const root = new URL('../dist/', import.meta.url).pathname;
const port = Number(process.env.PORT ?? 4173);

Bun.serve({
  port,
  hostname: '0.0.0.0',
  async fetch(req) {
    const path = new URL(req.url).pathname;
    const file = Bun.file(root + (path === '/' ? 'index.html' : path.slice(1)));
    return (await file.exists()) ? new Response(file) : new Response('Not found', { status: 404 });
  },
});
console.log(`Servindo dist/ em http://localhost:${port}`);
