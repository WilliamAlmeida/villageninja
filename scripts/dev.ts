// Servidor de desenvolvimento com HMR, acessível pela rede local
// (abra http://IP-DO-PC:3010 no celular, na mesma Wi-Fi).
import { networkInterfaces } from 'node:os';
import index from '../index.html';
import { perfReport } from './perfReport';
import { proxyApi } from './apiProxy';
import { servePublic } from './public';

const port = Number(process.env.PORT ?? 3010);
Bun.serve({
  port,
  hostname: '0.0.0.0',
  routes: { '/': index },
  development: { hmr: true, console: true },
  // manifesto, ícones e service worker do PWA (public/)
  // 404 com no-store: a Cloudflare guardaria o erro em cache por horas
  // relatório do botão de salvar do Medidor de FPS (.perf/devices/)
  // /api/* vai para o servidor de duelos (server/, scripts/apiProxy.ts)
  fetch: async (req, server) =>
    (await perfReport(req, server.requestIP(req)?.address)) ??
    (await proxyApi(req, server.requestIP(req)?.address)) ??
    (await servePublic(new URL(req.url).pathname)) ??
    new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } }),
});

const ips = Object.values(networkInterfaces())
  .flat()
  .filter((i) => i && i.family === 'IPv4' && !i.internal)
  .map((i) => `http://${i!.address}:${port}`);
console.log(`Vila Ninja rodando em http://localhost:${port}`);
for (const ip of ips) console.log(`No celular: ${ip}`);
