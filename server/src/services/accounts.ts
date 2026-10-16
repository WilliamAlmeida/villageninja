// Contas e sessões (molde do battlecard-server): todo jogador entra como convidado sem senha; cadastrar-se é ganhar
// apelido + senha (e e-mail opcional) na mesma conta; login em outro aparelho abre outra sessão da mesma conta.
import { cache } from '../cache';
import { sql } from '../db';
import { ApiError } from '../errors';

export interface Account {
  id: string;
  displayName: string;
  username: string | null;
  email: string | null;
  isGuest: boolean;
  createdAt: Date;
  registeredAt: Date | null;
  role: Role;
  avatarUrl: string | null;
  /** Discord/Google ligados à conta; `password` quando tem senha. */
  logins: string[];
}

export type Role = 'player' | 'mod' | 'admin';
export const ROLES: Role[] = ['player', 'mod', 'admin'];
export const isStaff = (a: Pick<Account, 'role'> | null | undefined) => a?.role === 'mod' || a?.role === 'admin';

const USERNAME_RE = /^[A-Za-z0-9_]{3,16}$/;
const DISPLAY_NAME_RE = /^[\p{L}\p{N} _.\-]{2,24}$/u;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,100}\.[^\s@]{2,20}$/;
const PASSWORD_MIN = 6;
const PASSWORD_MAX = 72;
let dummyHash: Promise<string> | null = null;

export const hashToken = (token: string) => new Bun.CryptoHasher('sha256').update(token).digest('hex');

function newToken(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
}

const COLUMNS = sql`
  id, display_name as "displayName", username, email,
  (registered_at IS NULL) as "isGuest", created_at as "createdAt", registered_at as "registeredAt",
  role, avatar_url as "avatarUrl",
  ARRAY(SELECT provider FROM user_identities i WHERE i.user_id = users.id ORDER BY provider)
    || CASE WHEN password_hash IS NULL THEN ARRAY[]::varchar[] ELSE ARRAY['password']::varchar[] END as logins
`;

const ADJ = ['Veloz', 'Oculto', 'Bravo', 'Sereno', 'Rubro', 'Dourado', 'Silente', 'Feroz', 'Astuto', 'Nobre', 'Errante', 'Vigilante'];
const NOUN = ['Shinobi', 'Genin', 'Kunai', 'Shuriken', 'Lótus', 'Trovão', 'Névoa', 'Falcão', 'Lobo', 'Dragão', 'Cedro', 'Bambu'];
export function guestName(): string {
  const pick = <T>(l: T[]) => l[Math.floor(Math.random() * l.length)]!;
  return `${pick(NOUN)} ${pick(ADJ)} ${Math.floor(Math.random() * 900) + 100}`;
}

/** Tentativas por chave (IP, conta) na janela: no Redis, então valem entre reinícios e entre processos. */
export async function rateLimit(key: string, max = 10, windowMs = 10 * 60_000): Promise<void> {
  if ((await cache.hit(`rl:${key}`, Math.ceil(windowMs / 1000))) > max) throw new ApiError(429, 'TOO_MANY_ATTEMPTS');
}

export function validateDisplayName(raw: unknown): string {
  const name = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';
  if (!DISPLAY_NAME_RE.test(name)) throw new ApiError(400, 'INVALID_NAME');
  return name;
}

export const accounts = {
  async createGuest(): Promise<{ token: string; account: Account }> {
    const [account] = await sql<Account[]>`INSERT INTO users (display_name) VALUES (${guestName()}) RETURNING ${COLUMNS}`;
    await sql`INSERT INTO user_days (user_id, day) VALUES (${account!.id}, (NOW() AT TIME ZONE 'America/Sao_Paulo')::date) ON CONFLICT DO NOTHING`;
    const token = await this.createSession(account!.id);
    return { token, account: account! };
  },

  async createSession(userId: string): Promise<string> {
    const token = newToken();
    await sql`INSERT INTO sessions (token_hash, user_id) VALUES (${hashToken(token)}, ${userId})`;
    return token;
  },

  /**
   * Conta dona do token (null se não existe ou está banida). Atualiza o "visto por último" no máximo a cada 30 s e,
   * junto, marca o dia de hoje (user_days) e o país (cabeçalho da Cloudflare).
   */
  async fromToken(token: string | null | undefined, country: string | null = null): Promise<Account | null> {
    if (!token || token.length < 20 || token.length > 100) return null;
    const hash = hashToken(token);
    const rows = await sql<Account[]>`
      SELECT ${COLUMNS} FROM users WHERE id = (SELECT user_id FROM sessions WHERE token_hash = ${hash}) AND banned_at IS NULL
    `;
    const account = rows[0] ?? null;
    if (account) {
      await sql`UPDATE sessions SET last_used_at = NOW() WHERE token_hash = ${hash} AND last_used_at < NOW() - interval '30 seconds'`;
      const cc = country && /^[A-Z]{2}$/.test(country) && country !== 'XX' ? country : null;
      const seen = await sql`
        UPDATE users SET last_seen_at = NOW(), country = COALESCE(${cc}, country)
        WHERE id = ${account.id} AND last_seen_at < NOW() - interval '30 seconds' RETURNING id
      `;
      if (seen.length) await sql`INSERT INTO user_days (user_id, day) VALUES (${account.id}, (NOW() AT TIME ZONE 'America/Sao_Paulo')::date) ON CONFLICT DO NOTHING`;
    }
    return account;
  },

  async get(userId: string): Promise<Account | null> {
    const rows = await sql<Account[]>`SELECT ${COLUMNS} FROM users WHERE id = ${userId}`;
    return rows[0] ?? null;
  },

  /** Convidado vira conta: apelido (para entrar) + senha (+ e-mail opcional). O nome mostrado continua o mesmo. */
  async register(userId: string, input: { username?: unknown; password?: unknown; email?: unknown }): Promise<Account> {
    const username = typeof input.username === 'string' ? input.username.trim() : '';
    const password = typeof input.password === 'string' ? input.password : '';
    const email = typeof input.email === 'string' && input.email.trim() ? input.email.trim().toLowerCase() : null;
    if (!USERNAME_RE.test(username)) throw new ApiError(400, 'INVALID_USERNAME');
    if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) throw new ApiError(400, 'INVALID_PASSWORD');
    if (email && !EMAIL_RE.test(email)) throw new ApiError(400, 'INVALID_EMAIL');
    const cur = await this.get(userId);
    if (!cur) throw new ApiError(401, 'UNAUTHORIZED');
    if (cur.logins.includes('password')) throw new ApiError(409, 'ALREADY_REGISTERED');
    const [taken] = await sql`SELECT 1 FROM users WHERE lower(username) = lower(${username})`;
    if (taken) throw new ApiError(409, 'USERNAME_TAKEN');
    if (email) {
      const [emailTaken] = await sql`SELECT 1 FROM users WHERE lower(email) = ${email}`;
      if (emailTaken) throw new ApiError(409, 'EMAIL_TAKEN');
    }
    const hash = await Bun.password.hash(password, { algorithm: 'argon2id' });
    try {
      const [account] = await sql<Account[]>`
        UPDATE users SET username = ${username}, email = COALESCE(${email}, email), password_hash = ${hash}, registered_at = COALESCE(registered_at, NOW())
        WHERE id = ${userId} RETURNING ${COLUMNS}
      `;
      return account!;
    } catch (e) {
      if ((e as { code?: string }).code === '23505') throw new ApiError(409, 'USERNAME_TAKEN');
      throw e;
    }
  },

  /** Entrar por apelido ou e-mail: sessão nova da conta. */
  async login(input: { login?: unknown; password?: unknown }): Promise<{ token: string; account: Account }> {
    const login = typeof input.login === 'string' ? input.login.trim() : '';
    const password = typeof input.password === 'string' ? input.password : '';
    if (!login || !password) throw new ApiError(400, 'INVALID_CREDENTIALS');
    const rows = await sql<Array<{ id: string; passwordHash: string | null; banned: boolean }>>`
      SELECT id, password_hash as "passwordHash", (banned_at IS NOT NULL) as banned FROM users
      WHERE password_hash IS NOT NULL AND (lower(username) = lower(${login}) OR lower(email) = lower(${login})) LIMIT 1
    `;
    const row = rows[0];
    // confere mesmo sem usuário: o tempo de resposta não revela se o apelido existe
    dummyHash ??= Bun.password.hash('not-a-password', { algorithm: 'argon2id' });
    const ok = await Bun.password.verify(password, row?.passwordHash ?? (await dummyHash)).catch(() => false);
    if (!row || !ok) throw new ApiError(401, 'INVALID_CREDENTIALS');
    if (row.banned) throw new ApiError(403, 'ACCOUNT_BANNED');
    const token = await this.createSession(row.id);
    return { token, account: (await this.get(row.id))! };
  },

  async logout(token: string): Promise<void> {
    await sql`DELETE FROM sessions WHERE token_hash = ${hashToken(token)}`;
  },

  async setDisplayName(userId: string, raw: unknown): Promise<string> {
    const name = validateDisplayName(raw);
    await sql`UPDATE users SET display_name = ${name} WHERE id = ${userId}`;
    return name;
  },

  /** Jogadores com o jogo aberto nos últimos 2 minutos. */
  async onlineCount(): Promise<number> {
    const [row] = await sql<Array<{ n: number }>>`SELECT count(*)::int as n FROM users WHERE last_seen_at > NOW() - interval '2 minutes'`;
    return row?.n ?? 0;
  },
};
