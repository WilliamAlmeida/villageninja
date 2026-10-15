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
  /** Senha do painel do dono (/api/admin/*); sem ela o painel fica desligado. */
  devPassword: Bun.env.DEV_PASSWORD ?? '',
};

export function allowOrigin(origin: string | null): string {
  if (origin && config.origins.includes(origin)) return origin;
  return config.origins[0]!;
}
