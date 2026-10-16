// Servidor de desenvolvimento com HMR, acessível pela rede local
// (abra http://IP-DO-PC:3010/play no celular, na mesma Wi-Fi). A raiz e as outras páginas são do site (server/).
import { networkInterfaces } from 'node:os';
import index from '../index.html';
import { perfReport } from './perfReport';
import { legacyGameRedirect, proxyApi, proxySite } from './apiProxy';
import { servePublic } from './public';

const port = Number(process.env.PORT ?? 3010);
Bun.serve({
  port,
  hostname: '0.0.0.0',
  routes: { '/play': index },
  development: { hmr: true, console: true },
  // manifesto, ícones e service worker do PWA (public/)
  // 404 com no-store: a Cloudflare guardaria o erro em cache por horas
  // relatório do botão de salvar do Medidor de FPS (.perf/devices/)
  // /api/* vai para o servidor de duelos (server/, scripts/apiProxy.ts)
  fetch: async (req, server) =>
    (await perfReport(req, server.requestIP(req)?.address)) ??
    (await proxyApi(req, server.requestIP(req)?.address)) ??
    legacyGameRedirect(new URL(req.url)) ??
    (await servePublic(new URL(req.url).pathname)) ??
    (await proxySite(req, server.requestIP(req)?.address)),
});

const ips = Object.values(networkInterfaces())
  .flat()
  .filter((i) => i && i.family === 'IPv4' && !i.internal)
  .map((i) => `http://${i!.address}:${port}`);
console.log(`Vila Ninja rodando em http://localhost:${port}/play`);
for (const ip of ips) console.log(`No celular: ${ip}/play`);
