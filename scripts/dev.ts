// Servidor de desenvolvimento com HMR, acessível pela rede local
// (abra http://IP-DO-PC:3010 no celular, na mesma Wi-Fi).
import { networkInterfaces } from 'node:os';
import index from '../index.html';

const port = Number(process.env.PORT ?? 3010);
Bun.serve({
  port,
  hostname: '0.0.0.0',
  routes: { '/': index },
  development: { hmr: true, console: true },
});

const ips = Object.values(networkInterfaces())
  .flat()
  .filter((i) => i && i.family === 'IPv4' && !i.internal)
  .map((i) => `http://${i!.address}:${port}`);
console.log(`Vila Ninja rodando em http://localhost:${port}`);
for (const ip of ips) console.log(`No celular: ${ip}`);
