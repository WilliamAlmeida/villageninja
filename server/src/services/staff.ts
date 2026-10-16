// Equipe do jogo: registro de tudo que moderador/admin faz no painel (staff_actions) e troca de papel.
import { sql } from '../db';
import { ApiError } from '../errors';
import { accounts, type Account, ROLES, type Role } from './accounts';

/** Grava uma ação da equipe. `staffId` nulo = feita com a chave de emergência (X-Dev-Key). */
export async function staffLog(staffId: string | null, action: string, targetId: string | null, detail: unknown = null, ip: string | null = null): Promise<void> {
  await sql`
    INSERT INTO staff_actions (staff_id, action, target_id, detail, ip)
    VALUES (${staffId}, ${action.slice(0, 32)}, ${targetId}, ${detail === null ? null : sql.json(detail as never)}, ${ip?.slice(0, 64) ?? null})
  `;
}

export const staff = {
  /** Últimas ações (do painel), com nomes de quem fez e em quem. */
  async log(limit = 100, targetId: string | null = null) {
    return sql`
      SELECT a.id, a.action, a.detail, a.created_at as "at",
        s.id as "staffId", s.display_name as "staffName", t.id as "targetId", t.display_name as "targetName"
      FROM staff_actions a
      LEFT JOIN users s ON s.id = a.staff_id
      LEFT JOIN users t ON t.id = a.target_id
      WHERE ${targetId ? sql`a.target_id = ${targetId}` : sql`TRUE`}
      ORDER BY a.created_at DESC LIMIT ${Math.min(500, Math.max(1, limit))}
    `;
  },

  /** Só admin troca papéis; ninguém tira o próprio admin (a conta do dono não fica sem acesso). */
  async setRole(actor: Account | null, targetId: string, raw: unknown, ip: string): Promise<Account> {
    if (actor && actor.role !== 'admin') throw new ApiError(403, 'FORBIDDEN');
    const role = String(raw) as Role;
    if (!ROLES.includes(role)) throw new ApiError(400, 'INVALID_ROLE');
    if (!/^[0-9a-f-]{36}$/i.test(targetId)) throw new ApiError(400, 'INVALID_ID');
    if (actor?.id === targetId && role !== 'admin') throw new ApiError(409, 'OWN_ROLE');
    const target = await accounts.get(targetId);
    if (!target) throw new ApiError(404, 'NOT_FOUND');
    await sql`UPDATE users SET role = ${role} WHERE id = ${targetId}`;
    await staffLog(actor?.id ?? null, 'role', targetId, { from: target.role, to: role }, ip);
    return (await accounts.get(targetId))!;
  },
};
