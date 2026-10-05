// Arquivos estáticos do PWA (public/): manifesto, ícones e service worker.
// Usado pelo servidor de desenvolvimento; no build a pasta é copiada para dist/.
import { fileURLToPath } from 'node:url';

// fileURLToPath: no Windows, `.pathname` sai como "/C:/..." e o arquivo não é achado
const root = fileURLToPath(new URL('../public/', import.meta.url));
const TYPES: Record<string, string> = { webmanifest: 'application/manifest+json', js: 'text/javascript', png: 'image/png' };

export async function servePublic(path: string): Promise<Response | null> {
  if (path.includes('..')) return null;
  const file = Bun.file(root + decodeURIComponent(path).replace(/^\//, ''));
  if (!(await file.exists())) return null;
  const type = TYPES[path.split('.').pop() ?? ''];
  return new Response(file, { headers: type ? { 'Content-Type': type, 'Cache-Control': 'no-cache' } : {} });
}
