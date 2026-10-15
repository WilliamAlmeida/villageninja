// Rotas HTTP (/api/...). Autenticação: `Authorization: Bearer <token>` (sessão de convidado ou de conta).
// Erros: { error: CODIGO } com o status HTTP; o jogo traduz o código (ui/arenaClient.ts).
import { timingSafeEqual } from 'node:crypto';
import { allowOrigin, config } from '../config';
import { ApiError } from '../errors';
import { type Account, accounts, hashToken, rateLimit } from '../services/accounts';
import { duels } from '../services/duels';
import { routeAdmin } from './admin';

type Json = Record<string, unknown>;

function headersFor(req: Request): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': allowOrigin(req.headers.get('origin')),
    Vary: 'Origin',
  };
}

async function readBody(req: Request): Promise<Json> {
  if (req.method === 'GET' || req.method === 'DELETE') return {};
  const text = await req.text();
  if (text.length > 64 * 1024) throw new ApiError(413, 'BODY_TOO_LARGE');
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? (parsed as Json) : {};
  } catch {
    throw new ApiError(400, 'INVALID_JSON');
  }
}

const bearer = (req: Request) => req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || null;

/** IP de quem chamou: o que o proxy informou (Cloudflare, X-Real-IP, X-Forwarded-For) ou o da conexão. */
export const clientIp = (req: Request, socketIp: string | null) =>
  req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip')?.trim() ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? socketIp ?? 'local';

/** Senha do painel confere? (comparação em tempo constante) */
export function isDevKey(key: string | null | undefined): boolean {
  if (!config.devPassword || !key) return false;
  return timingSafeEqual(Buffer.from(hashToken(key)), Buffer.from(hashToken(config.devPassword)));
}

async function requireAccount(req: Request): Promise<Account> {
  const account = await accounts.fromToken(bearer(req));
  if (!account) throw new ApiError(401, 'UNAUTHORIZED');
  return account;
}

export async function handleApi(req: Request, url: URL, socketIp: string | null = null): Promise<Response> {
  const headers = headersFor(req);
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: { ...headers, 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Dev-Key' },
    });
  }
  try {
    return await route(req, url, clientIp(req, socketIp), json);
  } catch (error) {
    if (error instanceof ApiError) return json({ error: error.code, detail: error.detail }, error.status);
    console.error('[API]', req.method, url.pathname, error);
    return json({ error: 'SERVER_ERROR' }, 500);
  }
}

async function route(req: Request, url: URL, ip: string, json: (data: unknown, status?: number) => Response): Promise<Response> {
  const path = url.pathname.replace(/\/+$/, '');
  const method = req.method;
  const body = await readBody(req);
  const is = (m: string, p: string) => method === m && path === p;

  if (is('GET', '/api/health')) return json({ ok: true, online: await accounts.onlineCount() });

  // ---------- conta ----------
  if (is('POST', '/api/auth/guest')) {
    rateLimit(`guest:${ip}`, 30, 60 * 60_000);
    const { token, account } = await accounts.createGuest();
    return json({ token, account });
  }
  if (is('POST', '/api/auth/login')) {
    rateLimit(`login:${ip}`);
    const { token, account } = await accounts.login(body);
    return json({ token, account });
  }

  // painel do dono (só a senha; sem conta de jogador)
  if (path === '/api/admin' || path.startsWith('/api/admin/')) {
    if (!isDevKey(req.headers.get('x-dev-key'))) {
      rateLimit(`dev:${ip}`);
      throw new ApiError(403, 'FORBIDDEN');
    }
    return routeAdmin(method, path, body, json);
  }

  // ---------- daqui em diante precisa de sessão ----------
  const me = await requireAccount(req);
  if (is('GET', '/api/me')) {
    const [stats, snapshot, online] = await Promise.all([duels.stats(me.id), duels.mine(me.id), accounts.onlineCount()]);
    return json({ account: me, stats, snapshot, online });
  }
  if (is('POST', '/api/auth/register')) {
    rateLimit(`register:${ip}`);
    return json({ account: await accounts.register(me.id, body) });
  }
  if (is('POST', '/api/auth/logout')) {
    await accounts.logout(bearer(req)!);
    return json({ ok: true });
  }
  if (is('POST', '/api/me/name')) return json({ name: await accounts.setDisplayName(me.id, body.name) });

  // ---------- retrato e duelos ----------
  if (is('PUT', '/api/snapshot')) return json(await duels.publish(me.id, body.code));
  if (is('GET', '/api/duel/opponent')) return json({ opponent: await duels.findOpponent(me.id, url.searchParams.get('not')) });
  if (method === 'GET' && path.startsWith('/api/duel/opponent/')) return json({ opponent: await duels.opponent(me.id, path.slice('/api/duel/opponent/'.length)) });
  if (is('POST', '/api/duel/start')) return json(await duels.start(me.id, body.opponentId));
  if (is('POST', '/api/duel/finish')) return json(await duels.finish(me.id, body));
  if (is('POST', '/api/duel/cancel')) return json({ ok: await duels.cancel(me.id, body.duelId) });
  if (is('GET', '/api/duel/ranking')) return json(await duels.ranking(me.id));
  if (is('GET', '/api/duel/defenses')) return json(await duels.defenses(me.id));
  if (is('POST', '/api/duel/defenses/seen')) {
    await duels.markSeen(me.id);
    return json({ ok: true });
  }
  if (is('GET', '/api/duel/history')) return json({ duels: await duels.history(me.id) });

  throw new ApiError(404, 'NOT_FOUND');
}
