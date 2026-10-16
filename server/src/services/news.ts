// Novidades do site: escritas no painel (/staff), lidas em /novidades. Texto simples com poucas marcas (renderBody):
// parágrafo por linha em branco, "## " título, "- " lista, **negrito** e [texto](https://… ou /…). Tudo escapado antes.
import { sql } from '../db';
import { ApiError } from '../errors';
import type { Account } from './accounts';
import { staffLog } from './staff';

export interface NewsInput {
  slug?: unknown;
  titlePt?: unknown;
  summaryPt?: unknown;
  bodyPt?: unknown;
  titleEn?: unknown;
  summaryEn?: unknown;
  bodyEn?: unknown;
  published?: unknown;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function inline(s: string): string {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+|\/[^\s)]*)\)/g, (_m, t, u) => `<a href="${u}"${u.startsWith('/') ? '' : ' target="_blank" rel="noopener"'}>${t}</a>`);
}

/** Texto da novidade em HTML seguro. */
export function renderBody(text: string): string {
  return text
    .replace(/\r/g, '')
    .split(/\n{2,}/)
    .map((block) => {
      const b = block.trim();
      if (!b) return '';
      if (b.startsWith('## ')) return `<h2>${inline(b.slice(3))}</h2>`;
      const lines = b.split('\n');
      if (lines.every((l) => l.trim().startsWith('- '))) return `<ul>${lines.map((l) => `<li>${inline(l.trim().slice(2))}</li>`).join('')}</ul>`;
      return `<p>${lines.map(inline).join('<br>')}</p>`;
    })
    .join('\n');
}

export const slugify = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

function clean(b: NewsInput) {
  const titlePt = str(b.titlePt, 140);
  if (!titlePt) throw new ApiError(400, 'TITLE_REQUIRED');
  const slug = slugify(str(b.slug, 80) ?? titlePt);
  if (!slug) throw new ApiError(400, 'INVALID_SLUG');
  return {
    slug,
    title_pt: titlePt,
    summary_pt: str(b.summaryPt, 300) ?? '',
    body_pt: str(b.bodyPt, 20000) ?? '',
    title_en: str(b.titleEn, 140),
    summary_en: str(b.summaryEn, 300),
    body_en: str(b.bodyEn, 20000),
  };
}

const COLS = sql`
  id, slug, title_pt as "titlePt", summary_pt as "summaryPt", body_pt as "bodyPt", title_en as "titleEn",
  summary_en as "summaryEn", body_en as "bodyEn", published_at as "publishedAt", updated_at as "updatedAt"
`;

export interface NewsRow {
  id: number;
  slug: string;
  titlePt: string;
  summaryPt: string;
  bodyPt: string;
  titleEn: string | null;
  summaryEn: string | null;
  bodyEn: string | null;
  publishedAt: Date | null;
  updatedAt: Date;
}

export const news = {
  /** Publicadas, mais novas primeiro (site). */
  published(limit = 20): Promise<NewsRow[]> {
    return sql<NewsRow[]>`SELECT ${COLS} FROM news WHERE published_at IS NOT NULL AND published_at <= NOW() ORDER BY published_at DESC LIMIT ${limit}`;
  },

  async bySlug(slug: string): Promise<NewsRow | null> {
    const [row] = await sql<NewsRow[]>`SELECT ${COLS} FROM news WHERE slug = ${slug} AND published_at IS NOT NULL AND published_at <= NOW()`;
    return row ?? null;
  },

  /** Todas, com rascunhos (painel). */
  all(): Promise<NewsRow[]> {
    return sql<NewsRow[]>`SELECT ${COLS} FROM news ORDER BY COALESCE(published_at, created_at) DESC LIMIT 200`;
  },

  async create(actor: Account | null, b: NewsInput, ip: string): Promise<number> {
    const v = clean(b);
    try {
      // hora do banco (o relógio do Postgres no WSL pode estar um pouco atrás do servidor)
      const [row] = await sql`INSERT INTO news ${sql({ ...v, created_by: actor?.id ?? null })} RETURNING id`;
      if (b.published === true) await sql`UPDATE news SET published_at = NOW() WHERE id = ${row!.id}`;
      await staffLog(actor?.id ?? null, 'news-create', null, { id: row!.id, title: v.title_pt, published: b.published === true }, ip);
      return row!.id as number;
    } catch (e) {
      if ((e as { code?: string }).code === '23505') throw new ApiError(409, 'SLUG_TAKEN');
      throw e;
    }
  },

  async update(actor: Account | null, id: number, b: NewsInput, ip: string): Promise<void> {
    const v = clean(b);
    try {
      const r = await sql`
        UPDATE news SET ${sql(v)}, updated_at = NOW(),
          published_at = CASE WHEN ${b.published === true} THEN COALESCE(published_at, NOW()) ELSE NULL END
        WHERE id = ${id}
      `;
      if (!r.count) throw new ApiError(404, 'NOT_FOUND');
    } catch (e) {
      if ((e as { code?: string }).code === '23505') throw new ApiError(409, 'SLUG_TAKEN');
      throw e;
    }
    await staffLog(actor?.id ?? null, 'news-edit', null, { id, title: v.title_pt, published: b.published === true }, ip);
  },

  async remove(actor: Account | null, id: number, ip: string): Promise<void> {
    const r = await sql`DELETE FROM news WHERE id = ${id}`;
    if (!r.count) throw new ApiError(404, 'NOT_FOUND');
    await staffLog(actor?.id ?? null, 'news-delete', null, { id }, ip);
  },
};
