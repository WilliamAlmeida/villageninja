// Conexão com o Postgres (postgres.js) e as migrações: tudo `IF NOT EXISTS`, rodado no boot. Esquema novo = SQL
// idempotente aqui (como no battlecard-server).
import postgres from 'postgres';
import { config } from './config';

export const sql = postgres(config.databaseUrl, { max: 10, idle_timeout: 20, connect_timeout: 10, transform: { undefined: null }, onnotice: () => {} });

export async function testConnection(): Promise<boolean> {
  try {
    await sql`SELECT 1`;
    return true;
  } catch (e) {
    console.error('Banco indisponível:', (e as Error).message);
    return false;
  }
}

export async function migrate() {
  // contas: todo jogador é um convidado até se cadastrar (apelido + senha); conta banida não entra
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      display_name VARCHAR(28) NOT NULL,
      username VARCHAR(20),
      email VARCHAR(120),
      password_hash TEXT,
      registered_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      banned_at TIMESTAMPTZ,
      is_test BOOLEAN NOT NULL DEFAULT FALSE,
      admin_note TEXT
    )
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users (lower(username)) WHERE username IS NOT NULL`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (lower(email)) WHERE email IS NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_users_seen ON users (last_seen_at DESC)`;
  // papel (jogador, moderador, admin: o painel /staff) e a foto vinda do Discord/Google
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(10) NOT NULL DEFAULT 'player'`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`;
  // jeitos de entrar além da senha: uma conta pode ter Discord e Google; um perfil do provedor é de uma conta só
  await sql`
    CREATE TABLE IF NOT EXISTS user_identities (
      provider VARCHAR(10) NOT NULL,
      provider_user_id VARCHAR(64) NOT NULL,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      email VARCHAR(120),
      name VARCHAR(64),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (provider, provider_user_id)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_identities_user ON user_identities (user_id)`;
  // tudo que a equipe faz no painel (quem, o quê, em quem, quando); staff_id nulo = chave de emergência
  await sql`
    CREATE TABLE IF NOT EXISTS staff_actions (
      id BIGSERIAL PRIMARY KEY,
      staff_id UUID REFERENCES users(id) ON DELETE SET NULL,
      action VARCHAR(32) NOT NULL,
      target_id UUID REFERENCES users(id) ON DELETE SET NULL,
      detail JSONB,
      ip VARCHAR(64),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_staff_actions_at ON staff_actions (created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_staff_actions_target ON staff_actions (target_id, created_at DESC)`;
  // país (cabeçalho CF-IPCountry da Cloudflare; o IP não é guardado) e o motivo do banimento
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(2)`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason TEXT`;
  // dias em que cada conta abriu o jogo (uma linha por conta e dia, fuso de Brasília): ativos e retorno
  await sql`
    CREATE TABLE IF NOT EXISTS user_days (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      day DATE NOT NULL,
      PRIMARY KEY (user_id, day)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_user_days_day ON user_days (day)`;
  // contas de antes da tabela: o dia em que nasceram e o último em que foram vistas (uma vez; depois não acha nada)
  await sql`
    INSERT INTO user_days (user_id, day)
    SELECT id, (created_at AT TIME ZONE 'America/Sao_Paulo')::date FROM users UNION
    SELECT id, (last_seen_at AT TIME ZONE 'America/Sao_Paulo')::date FROM users
    ON CONFLICT DO NOTHING
  `;
  // números do painel prontos por dia (refeitos pelo job a cada 5 min para hoje e ontem; o painel só lê)
  await sql`
    CREATE TABLE IF NOT EXISTS daily_stats (
      day DATE PRIMARY KEY,
      new_users INT NOT NULL DEFAULT 0,
      new_registered INT NOT NULL DEFAULT 0,
      active INT NOT NULL DEFAULT 0,
      returning_d1 INT NOT NULL DEFAULT 0,
      duels INT NOT NULL DEFAULT 0,
      duels_flagged INT NOT NULL DEFAULT 0,
      snapshots INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  // avisos da equipe para os jogadores: live = faixa no jogo; inbox = janela uma vez. block_from = manutenção
  // (a partir dali o duelo não começa). notice_views: entregue, lido e clicado por conta.
  await sql`
    CREATE TABLE IF NOT EXISTS notices (
      id SERIAL PRIMARY KEY,
      kind VARCHAR(8) NOT NULL DEFAULT 'inbox',
      tone VARCHAR(8) NOT NULL DEFAULT 'info',
      title_pt VARCHAR(120) NOT NULL,
      text_pt TEXT NOT NULL DEFAULT '',
      title_en VARCHAR(120),
      text_en TEXT,
      action_url VARCHAR(300),
      audience VARCHAR(12) NOT NULL DEFAULT 'all',
      starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ends_at TIMESTAMPTZ,
      block_from TIMESTAMPTZ,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS notice_views (
      notice_id INT NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      read_at TIMESTAMPTZ,
      clicked_at TIMESTAMPTZ,
      PRIMARY KEY (notice_id, user_id)
    )
  `;
  // sessões: o cliente guarda o token; aqui só o SHA-256 dele
  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id)`;
  // retratos: o de ninja (duelo) e, no futuro, o da vila inteira (ataque à vila), um de cada por jogador
  await sql`
    CREATE TABLE IF NOT EXISTS snapshots (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind VARCHAR(10) NOT NULL,
      data JSONB NOT NULL,
      code TEXT NOT NULL,
      power INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, kind)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_snapshots_power ON snapshots (kind, power)`;
  // duelos: o atacante luta no aparelho dele contra a cópia do retrato do defensor; o resultado chega depois
  await sql`
    CREATE TABLE IF NOT EXISTS duels (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      attacker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      defender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      snapshot JSONB NOT NULL,
      attacker_snapshot JSONB,
      won BOOLEAN,
      end_reason VARCHAR(12),
      summary JSONB,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at TIMESTAMPTZ
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_duels_attacker ON duels (attacker_id, started_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_duels_defender ON duels (defender_id, finished_at DESC) WHERE finished_at IS NOT NULL`;
  // placar: ELO próprio do duelo (K 32 para quem ataca, 16 para quem defende)
  await sql`
    CREATE TABLE IF NOT EXISTS duel_stats (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      rating INT NOT NULL DEFAULT 1000,
      wins INT NOT NULL DEFAULT 0,
      losses INT NOT NULL DEFAULT 0,
      def_wins INT NOT NULL DEFAULT 0,
      def_losses INT NOT NULL DEFAULT 0,
      report_seen_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_duel_stats_rating ON duel_stats (rating DESC)`;
}

/** Só para os testes: esvazia tudo. */
export async function truncateAll() {
  await sql`TRUNCATE users, sessions, snapshots, duels, duel_stats, user_identities, staff_actions, user_days, daily_stats, notices, notice_views CASCADE`;
}

export async function closeDb() {
  await sql.end();
}
