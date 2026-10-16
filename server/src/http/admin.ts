// Painel da equipe (/api/admin/*): conta com papel de moderador/admin ou a chave de emergência X-Dev-Key (DEV_PASSWORD).
// Toda ação que muda algo passa por staffLog (services/staff.ts).
import { sql } from '../db';
import { ApiError } from '../errors';
import type { Account } from '../services/accounts';
import { duels } from '../services/duels';
import { news } from '../services/news';
import { notices } from '../services/notices';
import { panel } from '../services/panel';
import { staff } from '../services/staff';

type Json = Record<string, unknown>;

export interface StaffCtx {
  /** Quem está no painel (null = chave de emergência). */
  actor: Account | null;
  ip: string;
}

export async function routeAdmin(method: string, path: string, body: Json, json: (data: unknown, status?: number) => Response, ctx: StaffCtx, query: URLSearchParams = new URLSearchParams()): Promise<Response> {
  if (method === 'GET' && path === '/api/admin/whoami') return json({ actor: ctx.actor, emergency: !ctx.actor });
  if (method === 'GET' && path === '/api/admin/overview') {
    const [users] = await sql<Array<{ total: number; registered: number; online: number; today: number }>>`
      SELECT count(*)::int as total, count(registered_at)::int as registered,
        count(*) FILTER (WHERE last_seen_at > NOW() - interval '2 minutes')::int as online,
        count(*) FILTER (WHERE created_at > NOW() - interval '1 day')::int as today
      FROM users WHERE NOT is_test
    `;
    const [snaps] = await sql<Array<{ n: number }>>`SELECT count(*)::int as n FROM snapshots WHERE kind = 'ninja'`;
    const [d] = await sql<Array<{ total: number; today: number; open: number }>>`
      SELECT count(*)::int as total, count(*) FILTER (WHERE started_at > NOW() - interval '1 day')::int as today,
        count(*) FILTER (WHERE finished_at IS NULL)::int as open FROM duels
    `;
    const perDay = await sql<Array<{ day: string; duels: number }>>`
      SELECT to_char(started_at AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') as day, count(*)::int as duels
      FROM duels WHERE started_at > NOW() - interval '14 days' GROUP BY 1 ORDER BY 1
    `;
    const [flagged] = await sql<Array<{ n: number }>>`SELECT count(*)::int as n FROM duels WHERE finished_at > NOW() - interval '7 days' AND jsonb_array_length(COALESCE(summary->'flags', '[]'::jsonb)) > 0`;
    return json({ users, snapshots: snaps!.n, duels: { ...d!, flagged7d: flagged!.n }, perDay });
  }
  if (method === 'GET' && path === '/api/admin/suspicious') return json({ duels: await duels.suspicious() });
  if (method === 'GET' && path === '/api/admin/log') return json({ actions: await staff.log(100) });
  // quadros da visão geral (cada um pedido em separado pela página)
  if (method === 'GET' && path === '/api/admin/kpis') return json(await panel.kpis());
  if (method === 'GET' && path === '/api/admin/daily') return json(await panel.daily(Number(query.get('days'))));
  if (method === 'GET' && path === '/api/admin/audience') return json(await panel.audience());
  if (method === 'GET' && path === '/api/admin/health') return json(await panel.health());
  // jogadores
  if (method === 'GET' && path === '/api/admin/players') return json(await panel.players(query));
  const pl = /^\/api\/admin\/players\/([0-9a-f-]{36})(?:\/([a-z-]+))?$/i.exec(path);
  if (pl && method === 'GET' && !pl[2]) return json(await panel.player(pl[1]!));
  if (pl && method === 'POST' && pl[2]) return json(await panel.act(ctx.actor, pl[1]!, pl[2], body, ctx.ip));
  // novidades do site
  if (method === 'GET' && path === '/api/admin/news') return json({ news: await news.all() });
  if (method === 'POST' && path === '/api/admin/news') return json({ id: await news.create(ctx.actor, body, ctx.ip) });
  const nw = /^\/api\/admin\/news\/(\d+)$/.exec(path);
  if (nw && method === 'PUT') {
    await news.update(ctx.actor, Number(nw[1]), body, ctx.ip);
    return json({ ok: true });
  }
  if (nw && method === 'DELETE') {
    await news.remove(ctx.actor, Number(nw[1]), ctx.ip);
    return json({ ok: true });
  }
  // avisos
  if (method === 'GET' && path === '/api/admin/notices') return json({ notices: await notices.list() });
  if (method === 'POST' && path === '/api/admin/notices') return json({ id: await notices.create(ctx.actor, body, ctx.ip) });
  const nt = /^\/api\/admin\/notices\/(\d+)$/.exec(path);
  if (nt && method === 'PUT') {
    await notices.update(ctx.actor, Number(nt[1]), body, ctx.ip);
    return json({ ok: true });
  }
  if (nt && method === 'DELETE') {
    await notices.remove(ctx.actor, Number(nt[1]), ctx.ip);
    return json({ ok: true });
  }
  if (method === 'POST' && path === '/api/admin/role') return json({ account: await staff.setRole(ctx.actor, String(body.userId ?? ''), body.role, ctx.ip) });
  throw new ApiError(404, 'NOT_FOUND');
}
