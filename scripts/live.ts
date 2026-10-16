// Servidor do acesso externo (https://ninja.wmst.com.br via túnel Cloudflare → PM2, porta 3010).
// Serve o BUILD de produção (dist/) e refaz o build sozinho quando o código muda. O jogo fica em /play; o que não é
// arquivo do build (início, ranking, perfis, /staff) vai para o site do server/ (scripts/apiProxy.ts).
//
// Por que não o servidor de desenvolvimento (scripts/dev.ts)? Ele mantém o mesmo nome de arquivo para o
// CSS/JS mesmo quando o conteúdo muda, e a Cloudflare guarda esses arquivos em cache por horas: o celular
// recebia CSS antigo. Aqui os arquivos têm hash do conteúdo no nome (podem ficar em cache para sempre)
// e o index.html sai com no-store (sempre busca a versão nova).
import { copyFileSync, mkdirSync, readdirSync, rmSync, watch } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { perfReport } from './perfReport';
import { legacyGameRedirect, proxyApi, proxySite } from './apiProxy';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DIST = `${ROOT}dist/`;
const port = Number(process.env.PORT ?? 3010);

/**
 * Copia public/ para dist/ arquivo por arquivo. O cpSync do Bun no Windows às vezes tentava recriar uma pasta que já
 * existia (EEXIST em dist/app-icons) e derrubava o servidor; o PM2 reiniciava e o site ficava fora do ar por instantes.
 */
function copyDir(from: string, to: string) {
  mkdirSync(to, { recursive: true });
  for (const e of readdirSync(from, { withFileTypes: true })) {
    if (e.isDirectory()) copyDir(join(from, e.name), join(to, e.name));
    else copyFileSync(join(from, e.name), join(to, e.name));
  }
}

let building: Promise<void> | null = null;
let again = false;

async function build() {
  if (building) {
    again = true;
    return building;
  }
  building = (async () => {
    const t0 = performance.now();
    try {
      // o jogo e o Laboratório de jutsus (só lê e roda o jogo: dá para abrir pelo túnel em /lab); os editores de sprite e
      // de cenário gravam arquivos e ficam só no localhost:3011 (scripts/editor.ts)
      const r = await Bun.build({ entrypoints: [`${ROOT}index.html`, `${ROOT}tools/jutsu-lab/index.html`], root: ROOT, outdir: DIST, minify: true });
      if (!r.success) {
        console.error('build falhou (continua servindo a versão anterior):');
        for (const m of r.logs) console.error(String(m));
        return;
      }
      copyDir(join(ROOT, 'public'), DIST);
      console.log(`build ok em ${Math.round(performance.now() - t0)} ms`);
    } catch (e) {
      // nunca derruba o servidor por causa de um build: segue servindo o que já está em dist/
      console.error('build falhou (continua servindo a versão anterior):', e);
    }
  })();
  await building;
  building = null;
  if (again) {
    again = false;
    await build();
  }
}

rmSync(DIST, { recursive: true, force: true });
await build();

// refaz o build quando src/, public/ ou o index.html mudam (com um pequeno atraso para juntar salvamentos)
let timer: ReturnType<typeof setTimeout> | undefined;
const schedule = () => {
  clearTimeout(timer);
  timer = setTimeout(build, 300);
};
for (const dir of ['src', 'public', 'tools/jutsu-lab', 'tools/shared']) watch(`${ROOT}${dir}`, { recursive: true }, schedule);
watch(`${ROOT}index.html`, schedule);

const NO_STORE = { 'Cache-Control': 'no-store' } as const;
const TYPES: Record<string, string> = { webmanifest: 'application/manifest+json' };

Bun.serve({
  port,
  hostname: '0.0.0.0',
  async fetch(req, server) {
    // botão de salvar do Medidor de FPS: relatório do aparelho em .perf/devices/
    const report = await perfReport(req, server.requestIP(req)?.address);
    if (report) return report;
    // /api/* vai para o servidor de duelos (server/), pela mesma origem (o túnel expõe os dois)
    const api = await proxyApi(req, server.requestIP(req)?.address);
    if (api) return api;
    const url = new URL(req.url);
    const legacy = legacyGameRedirect(url);
    if (legacy) return legacy;
    const path = decodeURIComponent(url.pathname);
    if (path.includes('..')) return new Response('Not found', { status: 404, headers: NO_STORE });
    // /play/ com barra quebraria os caminhos relativos do build (./chunk-x.js)
    if (path === '/play/') return new Response(null, { status: 301, headers: { Location: `/play${url.search}` } });
    // o jogo fica em /play; a raiz e as outras páginas são do site (server/, proxySite)
    const name = path === '/play' ? 'index.html' : path === '/lab' || path === '/lab/' ? 'tools/jutsu-lab/index.html' : path.slice(1);
    const file = Bun.file(DIST + name);
    if (name === 'index.html' && path !== '/play') return proxySite(req, server.requestIP(req)?.address);
    if (!(await file.exists())) return proxySite(req, server.requestIP(req)?.address);
    const ext = name.split('.').pop() ?? '';
    // arquivo com hash do conteúdo no nome (index-ab12cd34.js, house-xyz.png): pode ficar em cache para sempre
    const hashed = /-[a-z0-9]{8}\.[a-z0-9]+$/.test(name);
    // cabeçalhos novos a cada resposta (um objeto compartilhado vazava o tipo de um arquivo para os outros)
    const headers: Record<string, string> = {
      'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'no-store',
      'Content-Type': TYPES[ext] ?? (file.type || 'application/octet-stream'),
    };
    return new Response(file, { headers });
  },
});
console.log(`Vila Ninja (build de produção, atualiza sozinho) em http://localhost:${port}`);
