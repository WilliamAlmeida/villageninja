// Conexão com o Postgres (postgres.js) e as migrações: tudo `IF NOT EXISTS`, rodado no boot. Esquema novo = SQL
// idempotente aqui (como no battlecard-server).
import postgres from 'postgres';
import { config } from './config';

export const sql = postgres(config.databaseUrl, { max: 10, idle_timeout: 20, connect_timeout: 10, transform: { undefined: null } });

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
  await sql`TRUNCATE users, sessions, snapshots, duels, duel_stats CASCADE`;
}

export async function closeDb() {
  await sql.end();
}
