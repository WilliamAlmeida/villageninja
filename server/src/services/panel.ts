// Dados do painel da equipe (/staff). Cada quadro tem a sua consulta pequena e guardada no cache, para a página abrir
// na hora e os quadros chegarem sozinhos. Os números por dia ficam prontos em daily_stats (job a cada 5 min).
import { cache } from '../cache';
import { sql } from '../db';
import { ApiError } from '../errors';
import { type Account, accounts, isStaff, validateDisplayName } from './accounts';
import { DUEL } from './duels';
import { staffLog } from './staff';

const TZ = 'America/Sao_Paulo';
const UUID_RE = /^[0-9a-f-]{36}$/i;
const today = sql`(NOW() AT TIME ZONE ${TZ})::date`;

/** Refaz as linhas de daily_stats dos últimos `days` dias (o job usa 2: hoje e ontem). */
export async function refreshDaily(days = 2): Promise<void> {
  await sql`
    INSERT INTO daily_stats (day, new_users, new_registered, active, returning_d1, duels, duels_flagged, snapshots, updated_at)
    SELECT d.day,
      (SELECT count(*) FROM users u WHERE NOT u.is_test AND (u.created_at AT TIME ZONE ${TZ})::date = d.day),
      (SELECT count(*) FROM users u WHERE NOT u.is_test AND (u.registered_at AT TIME ZONE ${TZ})::date = d.day),
      (SELECT count(*) FROM user_days x JOIN users u ON u.id = x.user_id WHERE NOT u.is_test AND x.day = d.day),
      (SELECT count(*) FROM users u JOIN user_days x ON x.user_id = u.id AND x.day = d.day + 1
        WHERE NOT u.is_test AND (u.created_at AT TIME ZONE ${TZ})::date = d.day),
      (SELECT count(*) FROM duels w WHERE (w.started_at AT TIME ZONE ${TZ})::date = d.day),
      (SELECT count(*) FROM duels w WHERE (w.finished_at AT TIME ZONE ${TZ})::date = d.day
        AND jsonb_array_length(COALESCE(w.summary->'flags', '[]'::jsonb)) > 0),
      (SELECT count(*) FROM snapshots s WHERE (s.updated_at AT TIME ZONE ${TZ})::date = d.day),
      NOW()
    FROM (SELECT generate_series(${today} - ${days - 1}::int, ${today}, interval '1 day')::date as day) d
    ON CONFLICT (day) DO UPDATE SET new_users = EXCLUDED.new_users, new_registered = EXCLUDED.new_registered,
      active = EXCLUDED.active, returning_d1 = EXCLUDED.returning_d1, duels = EXCLUDED.duels,
      duels_flagged = EXCLUDED.duels_flagged, snapshots = EXCLUDED.snapshots, updated_at = NOW()
  `;
}

/** Job do servidor: hoje e ontem a cada 5 min; na subida, os últimos 90 dias (preenche o histórico). */
export function startDailyJob(): () => void {
  void refreshDaily(90).catch((e) => console.error('[daily_stats]', e));
  const t = setInterval(() => void refreshDaily(2).catch((e) => console.error('[daily_stats]', e)), 5 * 60_000);
  return () => clearInterval(t);
}

const startedAt = Date.now();

export interface PlayerRow {
  id: string;
  name: string;
  username: string | null;
  email: string | null;
  role: string;
  isGuest: boolean;
  isTest: boolean;
  banned: boolean;
  country: string | null;
  createdAt: Date;
  lastSeenAt: Date;
  rating: number | null;
  logins: string[];
}

const FILTERS = ['all', 'registered', 'guests', 'banned', 'staff', 'test', 'active'] as const;
const SORTS = { seen: sql`u.last_seen_at DESC`, created: sql`u.created_at DESC`, rating: sql`ds.rating DESC NULLS LAST` } as const;

export const panel = {
  /** Quadro "agora": on-line, hoje, contas, duelos abertos. 30 s no cache. */
  kpis() {
    return cache.remember('panel:kpis', 30, async () => {
      const [u] = await sql<Array<Record<string, number>>>`
        SELECT count(*)::int as total, count(registered_at)::int as registered,
          count(*) FILTER (WHERE last_seen_at > NOW() - interval '2 minutes')::int as online,
          count(*) FILTER (WHERE last_seen_at > NOW() - interval '1 day')::int as "active24h",
          count(*) FILTER (WHERE last_seen_at > NOW() - interval '7 days')::int as "active7d",
          count(*) FILTER (WHERE created_at > NOW() - interval '1 day')::int as "new24h",
          count(*) FILTER (WHERE banned_at IS NOT NULL)::int as banned
        FROM users WHERE NOT is_test
      `;
      const [d] = await sql<Array<Record<string, number>>>`
        SELECT count(*) FILTER (WHERE started_at > NOW() - interval '1 day')::int as "duels24h",
          count(*) FILTER (WHERE finished_at IS NULL)::int as "openDuels",
          count(*) FILTER (WHERE finished_at > NOW() - interval '7 days' AND jsonb_array_length(COALESCE(summary->'flags', '[]'::jsonb)) > 0)::int as "flagged7d"
        FROM duels
      `;
      const [s] = await sql<Array<{ n: number }>>`SELECT count(*)::int as n FROM snapshots WHERE kind = 'ninja'`;
      return { ...u, ...d, snapshots: s!.n };
    });
  },

  /** Série por dia (daily_stats), já pronta: só lê. */
  daily(days: number) {
    const n = Math.min(90, Math.max(7, Math.round(days) || 30));
    return cache.remember(`panel:daily:${n}`, 60, async () => {
      const rows = await sql`
        SELECT to_char(day, 'YYYY-MM-DD') as day, new_users as "newUsers", new_registered as "newRegistered", active,
          returning_d1 as "returningD1", duels, duels_flagged as "duelsFlagged", snapshots
        FROM daily_stats WHERE day > ${today} - ${n}::int ORDER BY day
      `;
      return { days: n, rows };
    });
  },

  /** Países (Cloudflare) e jeitos de entrar das contas. 5 min no cache. */
  audience() {
    return cache.remember('panel:audience', 300, async () => {
      const countries = await sql`
        SELECT COALESCE(country, '??') as country, count(*)::int as n FROM users WHERE NOT is_test
        GROUP BY 1 ORDER BY n DESC LIMIT 12
      `;
      const logins = await sql`
        SELECT provider, count(*)::int as n FROM user_identities i JOIN users u ON u.id = i.user_id WHERE NOT u.is_test GROUP BY 1
        UNION ALL SELECT 'password', count(*)::int FROM users WHERE password_hash IS NOT NULL AND NOT is_test
        UNION ALL SELECT 'guest', count(*)::int FROM users WHERE registered_at IS NULL AND NOT is_test
      `;
      const sources = await sql`
        SELECT COALESCE(CASE WHEN ref IS NOT NULL THEN '?ref=' || ref END, ref_host, 'direto') as source, count(*)::int as n
        FROM users WHERE NOT is_test GROUP BY 1 ORDER BY n DESC LIMIT 10
      `;
      return { countries, logins, sources };
    });
  },

  /** Saúde do servidor (sem cache: é barato e quem olha quer o agora). */
  async health() {
    const t0 = performance.now();
    await sql`SELECT 1`;
    const dbMs = Math.round((performance.now() - t0) * 10) / 10;
    const [last] = await sql<Array<{ at: Date | null }>>`SELECT max(updated_at) as at FROM daily_stats`;
    return {
      cache: await cache.backend(),
      dbMs,
      uptimeSec: Math.round((Date.now() - startedAt) / 1000),
      memoryMb: Math.round(process.memoryUsage().rss / 1048576),
      dailyUpdatedAt: last?.at ?? null,
      bun: Bun.version,
    };
  },

  async players(q: URLSearchParams) {
    const search = (q.get('q') ?? '').trim().slice(0, 60);
    const filter = (FILTERS as readonly string[]).includes(q.get('filter') ?? '') ? q.get('filter')! : 'all';
    const sort = SORTS[(q.get('sort') ?? 'seen') as keyof typeof SORTS] ?? SORTS.seen;
    const page = Math.max(0, Math.min(500, Number(q.get('page')) || 0));
    const like = `%${search.replace(/[%_\\]/g, '\\$&')}%`;
    const where = sql`
      ${search ? (UUID_RE.test(search) ? sql`u.id = ${search}` : sql`(u.display_name ILIKE ${like} OR u.username ILIKE ${like} OR u.email ILIKE ${like})`) : sql`TRUE`}
      AND ${
        filter === 'registered' ? sql`u.registered_at IS NOT NULL`
        : filter === 'guests' ? sql`u.registered_at IS NULL`
        : filter === 'banned' ? sql`u.banned_at IS NOT NULL`
        : filter === 'staff' ? sql`u.role <> 'player'`
        : filter === 'test' ? sql`u.is_test`
        : filter === 'active' ? sql`u.last_seen_at > NOW() - interval '7 days'`
        : sql`TRUE`
      }
    `;
    const rows = await sql<PlayerRow[]>`
      SELECT u.id, u.display_name as name, u.username, u.email, u.role, (u.registered_at IS NULL) as "isGuest",
        u.is_test as "isTest", (u.banned_at IS NOT NULL) as banned, u.country, u.created_at as "createdAt",
        u.last_seen_at as "lastSeenAt", ds.rating, u.ref, u.ref_host as "refHost",
        ARRAY(SELECT provider FROM user_identities i WHERE i.user_id = u.id ORDER BY provider) as logins
      FROM users u LEFT JOIN duel_stats ds ON ds.user_id = u.id
      WHERE ${where} ORDER BY ${sort}, u.id LIMIT 31 OFFSET ${page * 30}
    `;
    const [count] = await sql<Array<{ n: number }>>`SELECT count(*)::int as n FROM users u WHERE ${where}`;
    return { players: rows.slice(0, 30), more: rows.length > 30, page, total: count!.n };
  },

  async player(id: string) {
    if (!UUID_RE.test(id)) throw new ApiError(400, 'INVALID_ID');
    const [row] = await sql`
      SELECT u.id, u.display_name as name, u.username, u.email, u.role, (u.registered_at IS NULL) as "isGuest",
        u.is_test as "isTest", u.banned_at as "bannedAt", u.ban_reason as "banReason", u.admin_note as note, u.country,
        u.avatar_url as "avatarUrl", u.ref, u.ref_host as "refHost", u.created_at as "createdAt", u.registered_at as "registeredAt", u.last_seen_at as "lastSeenAt",
        (u.password_hash IS NOT NULL) as "hasPassword",
        (SELECT count(*)::int FROM sessions s WHERE s.user_id = u.id) as sessions,
        (SELECT count(*)::int FROM user_days x WHERE x.user_id = u.id) as "daysPlayed"
      FROM users u WHERE u.id = ${id}
    `;
    if (!row) throw new ApiError(404, 'NOT_FOUND');
    const identities = await sql`
      SELECT provider, name, email, created_at as "createdAt", last_login_at as "lastLoginAt" FROM user_identities WHERE user_id = ${id} ORDER BY provider
    `;
    const [stats] = await sql`SELECT rating, wins, losses, def_wins as "defWins", def_losses as "defLosses" FROM duel_stats WHERE user_id = ${id}`;
    const [snap] = await sql`SELECT data->>'name' as ninja, data->>'rank' as rank, (data->>'level')::int as level, power, updated_at as "updatedAt" FROM snapshots WHERE user_id = ${id} AND kind = 'ninja'`;
    const duels = await sql`
      SELECT d.id, d.started_at as at, (d.attacker_id = ${id}) as attacking, o.id as "otherId", o.display_name as other,
        d.won, d.summary->'flags' as flags, (d.summary->>'delta')::int as delta
      FROM duels d JOIN users o ON o.id = CASE WHEN d.attacker_id = ${id} THEN d.defender_id ELSE d.attacker_id END
      WHERE d.attacker_id = ${id} OR d.defender_id = ${id} ORDER BY d.started_at DESC LIMIT 20
    `;
    const log = await sql`
      SELECT a.action, a.detail, a.created_at as at, s.display_name as "staffName"
      FROM staff_actions a LEFT JOIN users s ON s.id = a.staff_id WHERE a.target_id = ${id} ORDER BY a.created_at DESC LIMIT 30
    `;
    return { player: row, identities, stats: stats ?? null, snapshot: snap ?? null, duels, log };
  },

  /**
   * Ações sobre um jogador; toda ação vai para staff_actions. Moderador não mexe em conta da equipe; apagar e trocar
   * papel são só do admin (papel fica em services/staff.ts).
   */
  async act(actor: Account | null, id: string, action: string, body: Record<string, unknown>, ip: string) {
    if (!UUID_RE.test(id)) throw new ApiError(400, 'INVALID_ID');
    const target = await accounts.get(id);
    if (!target) throw new ApiError(404, 'NOT_FOUND');
    const isAdmin = !actor || actor.role === 'admin';
    if (isStaff(target) && !isAdmin) throw new ApiError(403, 'FORBIDDEN');
    if (actor?.id === id && ['ban', 'delete', 'kick'].includes(action)) throw new ApiError(409, 'NOT_ON_SELF');
    const log = (detail: unknown = null) => staffLog(actor?.id ?? null, action, id, detail, ip);
    switch (action) {
      case 'rename': {
        const name = validateDisplayName(body.name);
        await sql`UPDATE users SET display_name = ${name} WHERE id = ${id}`;
        await log({ from: target.displayName, to: name });
        break;
      }
      case 'note': {
        const note = typeof body.note === 'string' ? body.note.slice(0, 1000) : '';
        await sql`UPDATE users SET admin_note = ${note || null} WHERE id = ${id}`;
        await log({ note });
        break;
      }
      case 'ban': {
        const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 300) : '';
        if (!reason) throw new ApiError(400, 'REASON_REQUIRED');
        await sql.begin(async (tx) => {
          await tx`UPDATE users SET banned_at = NOW(), ban_reason = ${reason} WHERE id = ${id}`;
          await tx`DELETE FROM sessions WHERE user_id = ${id}`;
        });
        await log({ reason });
        break;
      }
      case 'unban':
        await sql`UPDATE users SET banned_at = NULL, ban_reason = NULL WHERE id = ${id}`;
        await log();
        break;
      case 'kick': {
        const r = await sql`DELETE FROM sessions WHERE user_id = ${id}`;
        await log({ sessions: r.count });
        break;
      }
      case 'reset-rating': {
        const [cur] = await sql<Array<{ rating: number }>>`SELECT rating FROM duel_stats WHERE user_id = ${id}`;
        await sql`UPDATE duel_stats SET rating = ${DUEL.START_RATING}, updated_at = NOW() WHERE user_id = ${id}`;
        await log({ from: cur?.rating ?? null, to: DUEL.START_RATING });
        break;
      }
      case 'test': {
        const on = body.on === true;
        await sql`UPDATE users SET is_test = ${on} WHERE id = ${id}`;
        await log({ on });
        break;
      }
      case 'delete': {
        if (!isAdmin) throw new ApiError(403, 'FORBIDDEN');
        if (body.confirm !== target.displayName) throw new ApiError(400, 'CONFIRM_NAME');
        await log({ name: target.displayName, email: target.email });
        await sql`DELETE FROM users WHERE id = ${id}`;
        break;
      }
      default:
        throw new ApiError(400, 'INVALID_ACTION');
    }
    await cache.del('panel:kpis', 'panel:audience', 'site:top50');
    return action === 'delete' ? { deleted: true } : this.player(id);
  },
};
