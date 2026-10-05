// Serve a pasta dist/ (resultado de `bun run build`) para testar o build de produção.
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const port = Number(process.env.PORT ?? 4173);

Bun.serve({
  port,
  hostname: '0.0.0.0',
  async fetch(req) {
    const path = new URL(req.url).pathname;
    const file = Bun.file(root + (path === '/' ? 'index.html' : path.slice(1)));
    if (!(await file.exists())) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
    // o navegador só aceita o manifesto do PWA com o tipo certo
    return path.endsWith('.webmanifest') ? new Response(file, { headers: { 'Content-Type': 'application/manifest+json' } }) : new Response(file);
  },
});
console.log(`Servindo dist/ em http://localhost:${port}`);
