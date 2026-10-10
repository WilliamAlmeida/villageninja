// Ferramentas de desenvolvimento: http://localhost:3011 (início com os três editores); editor de sprites em /spr.
// Monta o ninja em camadas como o jogo (src/render/doll.ts), mostra a animação e deixa editar/mover pixels das camadas
// e de qualquer PNG de src/art (também os de interface em src/art/ui e src/art/ui/art: atlas de ícones e selos,
// ilustrações); "Salvar" grava o arquivo em src/art (o build do jogo se refaz sozinho).
// Só escuta em 127.0.0.1 e fica fora do túnel da Cloudflare: ninguém de fora grava arquivo.
// Antes de sobrescrever, guarda uma cópia em docs/arte/backup-editor/. Arquivos salvos aqui ficam listados em
// src/art/art-edits.json (com a subpasta: "ui/icons.png") e o prepare-art.py / prepare-layers.py / prepare-ui.py não
// os refazem (a não ser com --force).
//   bun scripts/editor.ts   |   pm2 start ecosystem.local.config.cjs --only villageninja-editor
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import home from '../tools/home/index.html';
import page from '../tools/sprite-editor/index.html';
import lab from '../tools/jutsu-lab/index.html';
import cenario from '../tools/scene-editor/index.html';

const ROOT = join(import.meta.dir, '..');
const ART = join(ROOT, 'src', 'art');
const BACKUP = join(ROOT, 'docs', 'arte', 'backup-editor');
const EDITS = join(ART, 'art-edits.json');
const LAYOUT = join(ROOT, 'src', 'data', 'layout.json');
/** Arquivo editável: PNG de src/art, src/art/ui e das pastas dela (art, kit, frame); o nome leva a subpasta. */
const NAME = /^(?:ui\/(?:(?:art|kit|frame)\/)?)?[a-z0-9][a-z0-9-]*\.png$/;
const pngs = (sub: string) =>
  existsSync(join(ART, sub))
    ? readdirSync(join(ART, sub))
        .map((f) => (sub ? `${sub}/${f}` : f))
        .filter((f) => NAME.test(f))
        .sort()
    : [];
/** Caminho do arquivo pedido em /art/<nome> (com subpasta). */
const artFile = (req: Request) => decodeURIComponent(new URL(req.url).pathname.slice('/art/'.length));
const port = Number(process.env.EDITOR_PORT ?? 3011);

const noStore = { 'Cache-Control': 'no-store' };
const edits = (): string[] => (existsSync(EDITS) ? JSON.parse(readFileSync(EDITS, 'utf8')) : []);

Bun.serve({
  port,
  hostname: '127.0.0.1',
  development: { hmr: false, console: true }, // HMR do Bun quebra com o await no topo do editor.ts; recarregue a página
  routes: {
    // início: escolhe entre os editores
    '/': home,
    '/spr': page,
    // laboratório de jutsus: testa jutsus, golpes, técnicas e artes num boneco de treino (código real do jogo)
    '/lab': lab,
    // editor de cenário: peças (camadas), terreno (muro/portão), escala, pontos; grava src/data/layout.json
    '/cenario': cenario,
    '/api/layout': {
      GET: () => new Response(Bun.file(LAYOUT), { headers: { ...noStore, 'Content-Type': 'application/json' } }),
      PUT: async (req) => {
        const text = await req.text();
        let data: { arts?: unknown; types?: unknown };
        try {
          data = JSON.parse(text);
        } catch {
          return new Response('JSON inválido', { status: 400 });
        }
        if (!data || typeof data.arts !== 'object' || typeof data.types !== 'object') return new Response('Formato inválido', { status: 400 });
        mkdirSync(BACKUP, { recursive: true });
        if (existsSync(LAYOUT)) copyFileSync(LAYOUT, join(BACKUP, `layout-${new Date().toISOString().replace(/[:.]/g, '-')}.json`));
        writeFileSync(LAYOUT, JSON.stringify(data, null, 1) + '\n');
        console.log('salvo src/data/layout.json (cópia em docs/arte/backup-editor)');
        return Response.json({ ok: true });
      },
    },
    '/api/art': () =>
      Response.json(
        { files: [...pngs(''), ...pngs('ui'), ...pngs('ui/art'), ...pngs('ui/kit'), ...pngs('ui/frame')], edited: edits() },
        { headers: noStore },
      ),
    '/art/*': {
      GET: (req) => {
        const f = artFile(req);
        if (!NAME.test(f) || !existsSync(join(ART, f))) return new Response('Not found', { status: 404 });
        return new Response(Bun.file(join(ART, f)), { headers: { ...noStore, 'Content-Type': 'image/png' } });
      },
      PUT: async (req) => {
        const f = artFile(req);
        const dst = join(ART, f);
        if (!NAME.test(f) || !existsSync(dst)) return new Response('Arquivo inválido', { status: 400 });
        const body = new Uint8Array(await req.arrayBuffer());
        if (body.length < 8 || body[0] !== 0x89 || body[1] !== 0x50) return new Response('Não é PNG', { status: 400 });
        mkdirSync(BACKUP, { recursive: true });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        copyFileSync(dst, join(BACKUP, `${f.replace(/\.png$/, '').replace(/\//g, '_')}-${stamp}.png`));
        writeFileSync(dst, body);
        // editada à mão: prepare-art.py / prepare-layers.py / prepare-ui.py não a refazem a partir da arte-fonte
        const list = new Set(edits());
        list.add(f);
        writeFileSync(EDITS, JSON.stringify([...list].sort(), null, 2) + '\n');
        console.log(`salvo src/art/${f} (cópia em docs/arte/backup-editor)`);
        return Response.json({ ok: true });
      },
    },
  },
  fetch: () => new Response('Not found', { status: 404 }),
});

console.log(`Editor de sprites em http://localhost:${port}`);
