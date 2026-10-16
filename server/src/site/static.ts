// Arquivos do site em /site/...: CSS/JS/imagens de server/site/ e as ilustrações do jogo (src/art/ui/art, só leitura)
// em /site/art/. O endereço leva a versão do conteúdo (`?v=`), então pode ficar em cache por um ano.
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SITE_DIR = fileURLToPath(new URL('../../site/', import.meta.url));
const GAME_ART = fileURLToPath(new URL('../../../src/art/ui/art/', import.meta.url));
const SAFE = /^[a-z0-9][a-z0-9._-]*(\/[a-z0-9][a-z0-9._-]*)*$/i;

/** Arquivo no disco para um caminho de /site/ (null se não existe ou é suspeito). */
function fileFor(rel: string): string | null {
  if (!SAFE.test(rel) || rel.includes('..')) return null;
  return rel.startsWith('art/') ? GAME_ART + rel.slice(4) : SITE_DIR + rel;
}

const versions = new Map<string, { mtime: number; v: string }>();

/** `/site/<rel>?v=<hash do conteúdo>` (refeito quando o arquivo muda). */
export function assetUrl(rel: string): string {
  const file = fileFor(rel);
  if (!file) return `/site/${rel}`;
  try {
    const mtime = statSync(file).mtimeMs;
    let e = versions.get(rel);
    if (!e || e.mtime !== mtime) {
      e = { mtime, v: new Bun.CryptoHasher('sha1').update(readFileSync(file)).digest('hex').slice(0, 10) };
      versions.set(rel, e);
    }
    return `/site/${rel}?v=${e.v}`;
  } catch {
    return `/site/${rel}`;
  }
}

export async function serveStatic(path: string, url: URL): Promise<Response | null> {
  if (!path.startsWith('/site/')) return null;
  const file = fileFor(path.slice('/site/'.length));
  if (!file) return null;
  const f = Bun.file(file);
  if (!(await f.exists())) return null;
  return new Response(f, {
    headers: {
      'Content-Type': f.type,
      'Cache-Control': url.searchParams.has('v') ? 'public, max-age=31536000, immutable' : 'public, max-age=300',
    },
  });
}
