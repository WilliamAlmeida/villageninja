// Servidor do acesso externo (https://ninja.wmst.com.br via túnel Cloudflare → PM2, porta 3010).
// Serve o BUILD de produção (dist/) e refaz o build sozinho quando o código muda.
//
// Por que não o servidor de desenvolvimento (scripts/dev.ts)? Ele mantém o mesmo nome de arquivo para o
// CSS/JS mesmo quando o conteúdo muda, e a Cloudflare guarda esses arquivos em cache por horas: o celular
// recebia CSS antigo. Aqui os arquivos têm hash do conteúdo no nome (podem ficar em cache para sempre)
// e o index.html sai com no-store (sempre busca a versão nova).
import { cpSync, rmSync, watch } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DIST = `${ROOT}dist/`;
const port = Number(process.env.PORT ?? 3010);

let building: Promise<void> | null = null;
let again = false;

async function build() {
  if (building) {
    again = true;
    return building;
  }
  building = (async () => {
    const t0 = performance.now();
    const r = await Bun.build({ entrypoints: [`${ROOT}index.html`], outdir: DIST, minify: true });
    if (!r.success) {
      console.error('build falhou (continua servindo a versão anterior):');
      for (const m of r.logs) console.error(String(m));
      return;
    }
    cpSync(`${ROOT}public`, DIST, { recursive: true });
    console.log(`build ok em ${Math.round(performance.now() - t0)} ms`);
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
for (const dir of ['src', 'public']) watch(`${ROOT}${dir}`, { recursive: true }, schedule);
watch(`${ROOT}index.html`, schedule);

const NO_STORE = { 'Cache-Control': 'no-store' } as const;
const TYPES: Record<string, string> = { webmanifest: 'application/manifest+json' };

Bun.serve({
  port,
  hostname: '0.0.0.0',
  async fetch(req) {
    const path = decodeURIComponent(new URL(req.url).pathname);
    if (path.includes('..')) return new Response('Not found', { status: 404, headers: NO_STORE });
    const name = path === '/' ? 'index.html' : path.slice(1);
    const file = Bun.file(DIST + name);
    if (!(await file.exists())) return new Response('Not found', { status: 404, headers: NO_STORE });
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
