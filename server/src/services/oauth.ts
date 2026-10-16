// Entrar com Discord ou Google (OAuth 2 com PKCE, sem biblioteca). O fluxo é por navegação, então o jogo e o site
// recebem o token no fragmento do endereço de volta (`#vn_token=…`, que não vai para servidor nem para log):
//   1. (opcional, para vincular a conta atual) POST /api/auth/link-ticket com o token → bilhete de uso único (5 min);
//   2. GET /api/auth/<provedor>/start?return=/play[&ticket=…] → guarda o estado (10 min) e manda para o provedor;
//   3. GET /api/auth/<provedor>/callback → troca o código, acha ou cria a conta, abre sessão e volta para `return`.
// Quem já entrou com esse perfil cai na mesma conta; um convidado que vincula vira conta cadastrada sem perder nada.
import { cache } from '../cache';
import { config } from '../config';
import { sql } from '../db';
import { ApiError } from '../errors';
import { accounts, guestName, type Account } from './accounts';
import { staffLog } from './staff';

export type ProviderId = 'discord' | 'google';

interface Profile {
  id: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  avatarUrl: string | null;
}

interface ProviderDef {
  name: string;
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  /** Parâmetros extras do pedido de autorização. */
  extra?: Record<string, string>;
  creds: () => { clientId: string; clientSecret: string };
  profile: (accessToken: string) => Promise<Profile>;
}

async function getJson(url: string, accessToken: string): Promise<Record<string, any>> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new ApiError(502, 'OAUTH_PROFILE_FAILED');
  return (await res.json()) as Record<string, any>;
}

export const PROVIDERS: Record<ProviderId, ProviderDef> = {
  discord: {
    name: 'Discord',
    authorizeUrl: 'https://discord.com/oauth2/authorize',
    tokenUrl: 'https://discord.com/api/oauth2/token',
    scope: 'identify email',
    extra: { prompt: 'none' },
    creds: () => config.discord,
    async profile(token) {
      const u = await getJson('https://discord.com/api/users/@me', token);
      return {
        id: String(u.id),
        email: typeof u.email === 'string' ? u.email.toLowerCase() : null,
        emailVerified: u.verified === true,
        name: (u.global_name as string | null) ?? (u.username as string | null) ?? null,
        avatarUrl: u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=128` : null,
      };
    },
  },
  google: {
    name: 'Google',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
    extra: { prompt: 'select_account' },
    creds: () => config.google,
    async profile(token) {
      const u = await getJson('https://openidconnect.googleapis.com/v1/userinfo', token);
      return {
        id: String(u.sub),
        email: typeof u.email === 'string' ? u.email.toLowerCase() : null,
        emailVerified: u.email_verified === true,
        name: (u.name as string | null) ?? null,
        avatarUrl: (u.picture as string | null) ?? null,
      };
    },
  },
};

const STATE_TTL = 600;
const TICKET_TTL = 300;

const enabled = (id: ProviderId) => {
  const c = PROVIDERS[id].creds();
  return !!(c.clientId && c.clientSecret);
};

export const isProvider = (id: string): id is ProviderId => id in PROVIDERS;

const randomToken = (bytes = 32) => Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString('base64url');
const challengeOf = (verifier: string) => new Bun.CryptoHasher('sha256').update(verifier).digest('base64url');

/** Só caminhos do próprio site (nada de `//outro.site` nem `https://…`). */
export function safeReturn(raw: string | null | undefined): string {
  const r = (raw ?? '').trim();
  if (!r.startsWith('/') || r.startsWith('//') || r.startsWith('/\\') || r.length > 200) return '/play';
  return r.replace(/#.*$/, '');
}

interface StateData {
  provider: ProviderId;
  verifier: string;
  returnTo: string;
  linkUserId: string | null;
}

/** Nome mostrado a partir do perfil (cabe nas regras do jogo) ou um nome de convidado. */
function displayNameOf(p: Profile): string {
  const clean = (p.name ?? '').replace(/[^\p{L}\p{N} _.\-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 24);
  return clean.length >= 2 ? clean : guestName();
}

export const oauth = {
  providers(): Array<{ id: ProviderId; name: string }> {
    return (Object.keys(PROVIDERS) as ProviderId[]).filter(enabled).map((id) => ({ id, name: PROVIDERS[id].name }));
  },

  /** Bilhete de uso único para vincular Discord/Google à conta do token (a navegação não leva o cabeçalho). */
  async linkTicket(userId: string): Promise<string> {
    const ticket = randomToken(24);
    await cache.set(`oauth-ticket:${ticket}`, userId, TICKET_TTL);
    return ticket;
  },

  /** Endereço do provedor para onde o navegador vai. */
  async start(provider: ProviderId, origin: string, query: URLSearchParams): Promise<string> {
    if (!enabled(provider)) throw new ApiError(404, 'PROVIDER_DISABLED');
    const ticket = query.get('ticket');
    const linkUserId = ticket ? await cache.take(`oauth-ticket:${ticket}`) : null;
    const state = randomToken();
    const verifier = randomToken(48);
    const data: StateData = { provider, verifier, returnTo: safeReturn(query.get('return')), linkUserId };
    await cache.setJson(`oauth-state:${state}`, data, STATE_TTL);
    const def = PROVIDERS[provider];
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: def.creds().clientId,
      redirect_uri: `${origin}/api/auth/${provider}/callback`,
      scope: def.scope,
      state,
      code_challenge: challengeOf(verifier),
      code_challenge_method: 'S256',
      ...def.extra,
    });
    return `${def.authorizeUrl}?${params}`;
  },

  /** Volta do provedor: devolve o endereço final (com o token ou o erro no fragmento). */
  async callback(provider: ProviderId, origin: string, query: URLSearchParams, ip: string): Promise<string> {
    const state = query.get('state') ?? '';
    const data = state ? await cache.getJson<StateData>(`oauth-state:${state}`) : null;
    if (data) await cache.del(`oauth-state:${state}`);
    const back = (hash: string) => `${origin}${data?.returnTo ?? '/play'}#${hash}`;
    if (!data || data.provider !== provider) return back('vn_error=OAUTH_STATE');
    // a pessoa cancelou no provedor
    if (query.get('error') || !query.get('code')) return back('vn_error=OAUTH_CANCELLED');
    try {
      const profile = await this.exchange(provider, origin, query.get('code')!, data.verifier);
      const { account, linked } = await this.resolve(provider, profile, data.linkUserId);
      const token = await accounts.createSession(account.id);
      if (account.role !== 'player') await staffLog(account.id, 'login', null, { provider }, ip);
      return back(`vn_token=${encodeURIComponent(token)}${linked ? '&vn_linked=1' : ''}`);
    } catch (e) {
      const code = e instanceof ApiError ? e.code : 'OAUTH_FAILED';
      if (!(e instanceof ApiError)) console.error('[oauth]', provider, e);
      return back(`vn_error=${code}`);
    }
  },

  async exchange(provider: ProviderId, origin: string, code: string, verifier: string): Promise<Profile> {
    const def = PROVIDERS[provider];
    const { clientId, clientSecret } = def.creds();
    const res = await fetch(def.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${origin}/api/auth/${provider}/callback`,
        client_id: clientId,
        client_secret: clientSecret,
        code_verifier: verifier,
      }),
    });
    if (!res.ok) throw new ApiError(502, 'OAUTH_TOKEN_FAILED');
    const body = (await res.json()) as { access_token?: string };
    if (!body.access_token) throw new ApiError(502, 'OAUTH_TOKEN_FAILED');
    return def.profile(body.access_token);
  },

  /**
   * Conta para o perfil: a que já tem esse perfil; senão a do vínculo (convidado ou conta que pediu); senão a conta
   * com o mesmo e-mail confirmado; senão uma conta nova. `linked` = o perfil foi ligado agora a uma conta que já existia.
   */
  async resolve(provider: ProviderId, p: Profile, linkUserId: string | null): Promise<{ account: Account; linked: boolean }> {
    const email = p.email && p.emailVerified ? p.email : null;
    const [known] = await sql<Array<{ userId: string }>>`
      SELECT user_id as "userId" FROM user_identities WHERE provider = ${provider} AND provider_user_id = ${p.id}
    `;
    let userId = known?.userId ?? null;
    let linked = false;
    if (!userId && linkUserId && (await accounts.get(linkUserId))) {
      userId = linkUserId;
      linked = true;
    }
    if (!userId && email) {
      const [byEmail] = await sql<Array<{ id: string }>>`SELECT id FROM users WHERE lower(email) = ${email} LIMIT 1`;
      if (byEmail) {
        userId = byEmail.id;
        linked = true;
      }
    }
    if (!userId) {
      const [row] = await sql<Array<{ id: string }>>`
        INSERT INTO users (display_name, registered_at) VALUES (${displayNameOf(p)}, NOW()) RETURNING id
      `;
      userId = row!.id;
    }
    const [banned] = await sql`SELECT 1 FROM users WHERE id = ${userId} AND banned_at IS NOT NULL`;
    if (banned) throw new ApiError(403, 'ACCOUNT_BANNED');
    await sql`
      INSERT INTO user_identities (provider, provider_user_id, user_id, email, name)
      VALUES (${provider}, ${p.id}, ${userId}, ${p.email}, ${p.name?.slice(0, 64) ?? null})
      ON CONFLICT (provider, provider_user_id) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name, last_login_at = NOW()
    `;
    // convidado que vinculou vira cadastrado; e-mail confirmado entra se a conta não tem e ninguém usa
    await sql`
      UPDATE users SET registered_at = COALESCE(registered_at, NOW()), avatar_url = COALESCE(${p.avatarUrl}, avatar_url),
        email = CASE WHEN email IS NULL AND ${email}::text IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM users o WHERE lower(o.email) = ${email} AND o.id <> ${userId}) THEN ${email} ELSE email END
      WHERE id = ${userId}
    `;
    if (email && config.adminEmails.includes(email)) await sql`UPDATE users SET role = 'admin' WHERE id = ${userId} AND role <> 'admin'`;
    return { account: (await accounts.get(userId))!, linked };
  },

  /** Desliga um provedor da conta, desde que sobre outro jeito de entrar. */
  async unlink(userId: string, provider: string): Promise<Account> {
    if (!isProvider(provider)) throw new ApiError(400, 'INVALID_PROVIDER');
    const me = await accounts.get(userId);
    if (!me?.logins.includes(provider)) throw new ApiError(404, 'NOT_LINKED');
    if (me.logins.length < 2) throw new ApiError(409, 'LAST_LOGIN');
    await sql`DELETE FROM user_identities WHERE user_id = ${userId} AND provider = ${provider}`;
    return (await accounts.get(userId))!;
  },
};
