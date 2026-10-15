// Relatórios de desempenho enviados pelo botão de salvar do Medidor de FPS (ui/fps.ts): cada envio vira um JSON em
// .perf/devices/ (fora do git), com a data e o modelo do aparelho no nome. Usado pelos dois servidores (live.ts e dev.ts).
// O endereço é público (túnel da Cloudflare): limite de tamanho, um envio a cada 5 s por IP e no máximo MAX_FILES
// arquivos na pasta (os mais antigos saem).
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PERF_REPORT_PATH = '/api/perf-report';
const DIR = fileURLToPath(new URL('../.perf/devices/', import.meta.url));
const MAX_BYTES = 256 * 1024;
const MAX_FILES = 300;
const EVERY_MS = 5000;
const lastBy = new Map<string, number>();

const NO_STORE = { 'Cache-Control': 'no-store' } as const;
const reply = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers: { ...NO_STORE, 'Content-Type': 'application/json' } });

/** Trata o POST do relatório; devolve null se a requisição não é para cá. */
export async function perfReport(req: Request, ip = ''): Promise<Response | null> {
  if (new URL(req.url).pathname !== PERF_REPORT_PATH) return null;
  if (req.method !== 'POST') return reply(405, { ok: false, error: 'só POST' });
  const who = req.headers.get('cf-connecting-ip') ?? ip;
  const now = Date.now();
  if (now - (lastBy.get(who) ?? 0) < EVERY_MS) return reply(429, { ok: false, error: 'espere uns segundos' });
  lastBy.set(who, now);
  const text = await req.text();
  if (text.length > MAX_BYTES) return reply(413, { ok: false, error: 'grande demais' });
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
  } catch {
    return reply(400, { ok: false, error: 'JSON inválido' });
  }
  const device = (data.device ?? {}) as { model?: unknown };
  const model = String(device.model ?? 'aparelho').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 40) || 'aparelho';
  // hora local do PC no nome (a ISO sai em UTC e confunde na hora de achar o arquivo)
  const d = new Date(now);
  const p2 = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}_${p2(d.getHours())}-${p2(d.getMinutes())}-${p2(d.getSeconds())}`;
  const name = `${stamp}_${model}.json`;
  mkdirSync(DIR, { recursive: true });
  writeFileSync(join(DIR, name), JSON.stringify({ receivedAt: new Date(now).toISOString(), ...data }, null, 2));
  // pasta com teto: apaga os mais antigos (o nome começa pela data, então a ordem alfabética é a do tempo)
  const files = readdirSync(DIR).filter((f) => f.endsWith('.json')).sort();
  for (const f of files.slice(0, Math.max(0, files.length - MAX_FILES))) rmSync(join(DIR, f), { force: true });
  console.log(`relatório de desempenho salvo: .perf/devices/${name}`);
  return reply(200, { ok: true, file: name });
}
