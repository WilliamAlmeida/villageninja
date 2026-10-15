// Painel do dono (/api/admin/*, header X-Dev-Key = DEV_PASSWORD): só números gerais por enquanto.
import { sql } from '../db';
import { ApiError } from '../errors';

type Json = Record<string, unknown>;

export async function routeAdmin(method: string, path: string, _body: Json, json: (data: unknown, status?: number) => Response): Promise<Response> {
  if (method === 'GET' && path === '/api/admin/overview') {
    const [users] = await sql<Array<{ total: number; registered: number; online: number; today: number }>>`
      SELECT count(*)::int as total, count(password_hash)::int as registered,
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
    return json({ users, snapshots: snaps!.n, duels: d, perDay });
  }
  throw new ApiError(404, 'NOT_FOUND');
}
