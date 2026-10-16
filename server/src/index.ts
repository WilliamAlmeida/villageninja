// Servidor do Vila Ninja: contas, retratos e duelos (docs/gdd-escala-ilhas-pvp.md, seção 6) e o site público (src/site,
// pt-BR e inglês). Bun + Postgres + Redis (cache.ts).
// Sobe com `bun src/index.ts` (ou pelo PM2, ecosystem.local.config.cjs); o jogo chega por /api/* (scripts/live.ts e
// scripts/dev.ts fazem o proxy, então o túnel Cloudflare expõe tudo numa origem só).
import { config } from './config';
import { migrate, testConnection } from './db';
import { handleApi } from './http/api';
import { handleSite } from './site';

export function createServer(port = config.port) {
  return Bun.serve({
    port,
    hostname: '0.0.0.0',
    fetch(req, server) {
      const url = new URL(req.url);
      if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return handleApi(req, url, server.requestIP(req)?.address ?? null);
      return handleSite(req, url);
    },
  });
}

if (import.meta.main) {
  if (!(await testConnection())) {
    console.error('Sem banco: confira DATABASE_URL em server/.env (o postgres_16 do WSL está no ar?).');
    process.exit(1);
  }
  await migrate();
  const server = createServer();
  console.log(`Servidor do Vila Ninja em http://localhost:${server.port}/api/health (origens: ${config.origins.join(', ')})`);
}
