// Configuração do servidor por variáveis de ambiente. O Bun carrega o `.env` da pasta de onde foi chamado; quando o
// servidor sobe de outra pasta (testes na raiz do jogo, PM2), lemos o `server/.env` à mão.
const ENV_FILE = new URL('../.env', import.meta.url);

async function loadEnvFile() {
  try {
    const text = await Bun.file(ENV_FILE).text();
    for (const line of text.split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (m && Bun.env[m[1]!] === undefined) Bun.env[m[1]!] = m[2]!.replace(/^"(.*)"$/, '$1');
    }
  } catch {
    /* sem .env: só o ambiente */
  }
}
await loadEnvFile();

/** Origens que podem chamar a API (CORS): o jogo local, o editor e o túnel. */
const origins = (Bun.env.CLIENT_ORIGIN ?? 'http://localhost:3010,http://localhost:3011,https://ninja.wmst.com.br').split(',').map((s) => s.trim()).filter(Boolean);

export const config = {
  port: Number(Bun.env.PORT ?? 3012),
  /** Banco do servidor (Postgres). Lido na hora: os testes trocam para `TEST_DATABASE_URL` antes de abrir a conexão. */
  get databaseUrl() {
    return Bun.env.ARENA_DATABASE_URL ?? Bun.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5433/villageninja';
  },
  testDatabaseUrl: Bun.env.TEST_DATABASE_URL ?? '',
  origins,
  /** Chave de emergência do painel (/api/admin/* pelo header X-Dev-Key); o normal é entrar com uma conta de staff. */
  devPassword: Bun.env.DEV_PASSWORD ?? '',
  /** Redis (cache, limites, estado do login); vazio = memória do processo. */
  redisUrl: Bun.env.REDIS_URL ?? '',
  /** Lido na hora: os testes usam `vntest:` (e apagam só as chaves deles). */
  get redisPrefix() {
    return Bun.env.REDIS_PREFIX ?? 'vn:';
  },
  /** Login social: cada provedor só aparece com id e segredo preenchidos. */
  discord: { clientId: Bun.env.DISCORD_CLIENT_ID ?? '', clientSecret: Bun.env.DISCORD_CLIENT_SECRET ?? '' },
  google: { clientId: Bun.env.GOOGLE_CLIENT_ID ?? '', clientSecret: Bun.env.GOOGLE_CLIENT_SECRET ?? '' },
  /** E-mails (confirmados pelo Discord/Google) que viram admin ao entrar: o dono não depende da chave de emergência. */
  adminEmails: (Bun.env.ADMIN_EMAILS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
};

/**
 * Origem pública de quem chamou (o proxy do jogo manda X-Forwarded-Host/Proto), só se for uma das permitidas: o endereço
 * de volta do login é montado com ela, então um Host forjado não pode desviar o retorno para outro site.
 */
export function publicOrigin(req: Request): string {
  const url = new URL(req.url);
  const host = req.headers.get('x-forwarded-host') ?? url.host;
  const proto = (req.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '')).split(',')[0]!.trim();
  const origin = `${proto}://${host}`;
  if (config.origins.includes(origin)) return origin;
  // proxy que não informou o protocolo: vale a origem permitida com o mesmo host
  return config.origins.find((o) => new URL(o).host === host) ?? config.origins[0]!;
}

export function allowOrigin(origin: string | null): string {
  if (origin && config.origins.includes(origin)) return origin;
  return config.origins[0]!;
}
