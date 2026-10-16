// Avisos da equipe para os jogadores. O jogo pergunta ao abrir e a cada minuto (GET /api/notices) e marca entregue,
// lido e clicado; o painel mostra esses números. Aviso com `block_from` é manutenção: dali até o fim, duelo não começa.
import { cache } from '../cache';
import { sql } from '../db';
import { ApiError } from '../errors';
import type { Account } from './accounts';
import { staffLog } from './staff';

const KINDS = ['live', 'inbox'] as const;
const TONES = ['info', 'good', 'warn', 'danger'] as const;
const AUDIENCES = ['all', 'registered', 'guests'] as const;

export interface NoticeInput {
  kind?: unknown;
  tone?: unknown;
  titlePt?: unknown;
  textPt?: unknown;
  titleEn?: unknown;
  textEn?: unknown;
  actionUrl?: unknown;
  audience?: unknown;
  startsAt?: unknown;
  endsAt?: unknown;
  blockFrom?: unknown;
  active?: unknown;
}

const pick = <T extends readonly string[]>(list: T, v: unknown, def: T[number]): T[number] => ((list as readonly unknown[]).includes(v) ? (v as T[number]) : def);
const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
function date(v: unknown): Date | null {
  if (typeof v !== 'string' || !v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new ApiError(400, 'INVALID_DATE');
  return d;
}

function clean(b: NoticeInput) {
  const titlePt = str(b.titlePt, 120);
  if (!titlePt) throw new ApiError(400, 'TITLE_REQUIRED');
  const url = str(b.actionUrl, 300);
  if (url && !/^(https:\/\/|\/)/.test(url)) throw new ApiError(400, 'INVALID_URL');
  const startsAt = date(b.startsAt);
  const endsAt = date(b.endsAt);
  const blockFrom = date(b.blockFrom);
  if (endsAt && endsAt <= (startsAt ?? new Date())) throw new ApiError(400, 'INVALID_DATE');
  if (blockFrom && !endsAt) throw new ApiError(400, 'MAINTENANCE_NEEDS_END');
  return {
    kind: pick(KINDS, b.kind, 'inbox'),
    tone: pick(TONES, b.tone, 'info'),
    title_pt: titlePt,
    text_pt: str(b.textPt, 2000) ?? '',
    title_en: str(b.titleEn, 120),
    text_en: str(b.textEn, 2000),
    action_url: url,
    audience: pick(AUDIENCES, b.audience, 'all'),
    starts_at: startsAt,
    ends_at: endsAt,
    block_from: blockFrom,
    active: b.active !== false,
  };
}

const COLS = sql`
  n.id, n.kind, n.tone, n.title_pt as "titlePt", n.text_pt as "textPt", n.title_en as "titleEn", n.text_en as "textEn",
  n.action_url as "actionUrl", n.audience, n.starts_at as "startsAt", n.ends_at as "endsAt", n.block_from as "blockFrom", n.active
`;

export const notices = {
  /** Avisos valendo agora para a conta (e marca como entregues). */
  async forPlayer(me: Account) {
    const rows = await sql`
      SELECT ${COLS}, (v.read_at IS NOT NULL) as read FROM notices n
      LEFT JOIN notice_views v ON v.notice_id = n.id AND v.user_id = ${me.id}
      WHERE n.active AND n.starts_at <= NOW() AND (n.ends_at IS NULL OR n.ends_at > NOW())
        AND (n.audience = 'all' OR (n.audience = 'registered') = ${!me.isGuest})
      ORDER BY n.starts_at DESC LIMIT 10
    `;
    if (rows.length) {
      await sql`
        INSERT INTO notice_views (notice_id, user_id) SELECT unnest(${sql.array(rows.map((r) => r.id as number))}::int[]), ${me.id}
        ON CONFLICT DO NOTHING
      `;
    }
    return rows;
  },

  async mark(me: Account, id: number, what: 'read' | 'click') {
    if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, 'INVALID_ID');
    if (what === 'read') await sql`UPDATE notice_views SET read_at = COALESCE(read_at, NOW()) WHERE notice_id = ${id} AND user_id = ${me.id}`;
    else await sql`UPDATE notice_views SET read_at = COALESCE(read_at, NOW()), clicked_at = COALESCE(clicked_at, NOW()) WHERE notice_id = ${id} AND user_id = ${me.id}`;
  },

  /** Manutenção marcada para agora? (duelo novo não começa). 15 s no cache. */
  async maintenance(): Promise<{ until: string } | null> {
    return cache.remember('notices:maint', 15, async () => {
      const [row] = await sql<Array<{ until: Date }>>`
        SELECT ends_at as until FROM notices WHERE active AND block_from IS NOT NULL AND block_from <= NOW() AND ends_at > NOW()
        ORDER BY ends_at DESC LIMIT 1
      `;
      return row ? { until: new Date(row.until).toISOString() } : null;
    });
  },

  /** Lista do painel, com entregues/lidos/clicados. */
  async list() {
    return sql`
      SELECT ${COLS}, n.created_at as "createdAt", c.display_name as "createdBy",
        (SELECT count(*)::int FROM notice_views v WHERE v.notice_id = n.id) as delivered,
        (SELECT count(*)::int FROM notice_views v WHERE v.notice_id = n.id AND v.read_at IS NOT NULL) as "readCount",
        (SELECT count(*)::int FROM notice_views v WHERE v.notice_id = n.id AND v.clicked_at IS NOT NULL) as clicked
      FROM notices n LEFT JOIN users c ON c.id = n.created_by ORDER BY n.created_at DESC LIMIT 100
    `;
  },

  async create(actor: Account | null, b: NoticeInput, ip: string) {
    const v = clean(b);
    // sem início = agora pela hora do banco (o relógio do Postgres pode estar um pouco atrás)
    const { starts_at, ...rest } = v;
    const [row] = await sql`INSERT INTO notices ${sql({ ...rest, created_by: actor?.id ?? null })} RETURNING id`;
    if (starts_at) await sql`UPDATE notices SET starts_at = ${starts_at} WHERE id = ${row!.id}`;
    await staffLog(actor?.id ?? null, 'notice-create', null, { id: row!.id, title: v.title_pt, maintenance: !!v.block_from }, ip);
    await cache.del('notices:maint');
    return row!.id as number;
  },

  async update(actor: Account | null, id: number, b: NoticeInput, ip: string) {
    if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, 'INVALID_ID');
    const v = clean(b);
    const { starts_at, ...rest } = v;
    const r = await sql`UPDATE notices SET ${sql(rest)}, starts_at = COALESCE(${starts_at}, starts_at) WHERE id = ${id}`;
    if (!r.count) throw new ApiError(404, 'NOT_FOUND');
    await staffLog(actor?.id ?? null, 'notice-edit', null, { id, title: v.title_pt, active: v.active }, ip);
    await cache.del('notices:maint');
  },

  async remove(actor: Account | null, id: number, ip: string) {
    const r = await sql`DELETE FROM notices WHERE id = ${id}`;
    if (!r.count) throw new ApiError(404, 'NOT_FOUND');
    await staffLog(actor?.id ?? null, 'notice-delete', null, { id }, ip);
    await cache.del('notices:maint');
  },
};
