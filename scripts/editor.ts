// Editor de sprites (ferramenta de desenvolvimento): http://localhost:3011
// Monta o ninja em camadas como o jogo (src/render/doll.ts), mostra a animação e deixa editar/mover pixels das camadas
// e de qualquer PNG de src/art; "Salvar" grava o arquivo em src/art (o build do jogo se refaz sozinho).
// Só escuta em 127.0.0.1 e fica fora do túnel da Cloudflare: ninguém de fora grava arquivo.
// Antes de sobrescrever, guarda uma cópia em docs/arte/backup-editor/. Camadas editadas à mão ficam listadas em
// src/art/layer-edits.json e o scripts/prepare-layers.py não as refaz (a não ser com --force).
//   bun scripts/editor.ts   |   pm2 start ecosystem.local.config.cjs --only villageninja-editor
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import page from '../tools/sprite-editor/index.html';

const ROOT = join(import.meta.dir, '..');
const ART = join(ROOT, 'src', 'art');
const BACKUP = join(ROOT, 'docs', 'arte', 'backup-editor');
const EDITS = join(ART, 'layer-edits.json');
const NAME = /^[a-z0-9][a-z0-9-]*\.png$/;
const port = Number(process.env.EDITOR_PORT ?? 3011);

const noStore = { 'Cache-Control': 'no-store' };
const edits = (): string[] => (existsSync(EDITS) ? JSON.parse(readFileSync(EDITS, 'utf8')) : []);

Bun.serve({
  port,
  hostname: '127.0.0.1',
  development: { hmr: false, console: true }, // HMR do Bun quebra com o await no topo do editor.ts; recarregue a página
  routes: {
    '/': page,
    '/api/art': () =>
      Response.json(
        { files: readdirSync(ART).filter((f) => NAME.test(f)).sort(), edited: edits() },
        { headers: noStore },
      ),
    '/art/:file': {
      GET: (req) => {
        const f = req.params.file;
        if (!NAME.test(f) || !existsSync(join(ART, f))) return new Response('Not found', { status: 404 });
        return new Response(Bun.file(join(ART, f)), { headers: { ...noStore, 'Content-Type': 'image/png' } });
      },
      PUT: async (req) => {
        const f = req.params.file;
        const dst = join(ART, f);
        if (!NAME.test(f) || !existsSync(dst)) return new Response('Arquivo inválido', { status: 400 });
        const body = new Uint8Array(await req.arrayBuffer());
        if (body.length < 8 || body[0] !== 0x89 || body[1] !== 0x50) return new Response('Não é PNG', { status: 400 });
        mkdirSync(BACKUP, { recursive: true });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        copyFileSync(dst, join(BACKUP, `${f.replace(/\.png$/, '')}-${stamp}.png`));
        writeFileSync(dst, body);
        if (f.startsWith('layer-') || f === 'ninja-body.png') {
          const list = new Set(edits());
          list.add(f);
          writeFileSync(EDITS, JSON.stringify([...list].sort(), null, 2) + '\n');
        }
        console.log(`salvo src/art/${f} (cópia em docs/arte/backup-editor)`);
        return Response.json({ ok: true });
      },
    },
  },
  fetch: () => new Response('Not found', { status: 404 }),
});

console.log(`Editor de sprites em http://localhost:${port}`);
