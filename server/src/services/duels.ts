// Retratos e duelos assíncronos (molde do Duelo do battlecard-server): o jogador publica o retrato do campeão; outro
// jogador busca um adversário de força parecida, luta no próprio aparelho contra a cópia do retrato e manda o
// resultado. ELO próprio: K 32 para quem ataca, K 16 para quem defende (o defensor não estava lá).
import { decodeSnapshot, type NinjaSnapshot } from '../../../src/game/snapshot';
import { STAT_KEYS } from '../../../src/data/ninja';
import { sql } from '../db';
import { ApiError } from '../errors';

export const DUEL = {
  START_RATING: 1000,
  MIN_RATING: 100,
  K_ATTACK: 32,
  K_DEFENSE: 16,
  /** Faixa de força do adversário em volta da minha (±). */
  POWER_SPREAD: 0.3,
  /** Retrato visto há mais de isso não entra no sorteio. */
  ACTIVE_DAYS: 30,
  REPORT_LIMIT: 30,
  /** Tamanho máximo do texto do retrato. */
  CODE_MAX: 8 * 1024,
} as const;

/** Força do retrato: soma dos atributos × (nível + 5), para o nível 1 não valer quase nada. */
export const powerOf = (s: NinjaSnapshot) => Math.round(STAT_KEYS.reduce((a, k) => a + s.stats[k], 0) * (s.level + 5));

/** Variação de ELO de quem tem `mine` contra `other` com o resultado dado. */
export function ratingDelta(mine: number, other: number, won: boolean, k: number): number {
  const expected = 1 / (1 + 10 ** ((other - mine) / 400));
  return Math.round(k * ((won ? 1 : 0) - expected));
}

export interface DuelStats {
  rating: number;
  wins: number;
  losses: number;
  defWins: number;
  defLosses: number;
}

export interface Opponent {
  opponentId: string;
  name: string;
  rating: number;
  wins: number;
  losses: number;
  power: number;
  /** Texto VN1 do retrato (o jogo decodifica e luta contra ele). */
  code: string;
  ninja: { name: string; rank: string; level: number; from?: string };
}

export interface Defense {
  id: string;
  at: string;
  attacker: { id: string; name: string };
  attackerNinja: { name: string; rank: string; level: number } | null;
  /** O retrato segurou. */
  held: boolean;
  /** Quem atacou largou o duelo. */
  left: boolean;
  defDelta: number | null;
  summary: Record<string, unknown> | null;
  unseen: boolean;
  revenged: boolean;
}

export interface Summary {
  turns?: number;
  myHp?: number;
  foeHp?: number;
  by?: string;
  seconds?: number;
}

const ninjaOf = (s: NinjaSnapshot) => ({ name: s.name, rank: s.rank, level: s.level, from: s.from });

async function ensureStats(db: typeof sql, userId: string) {
  await db`INSERT INTO duel_stats (user_id, rating) VALUES (${userId}, ${DUEL.START_RATING}) ON CONFLICT (user_id) DO NOTHING`;
}

export const duels = {
  /** Publica (ou troca) o retrato do campeão. O texto é decodificado aqui com a mesma regra do jogo. */
  async publish(userId: string, code: unknown): Promise<{ power: number; updatedAt: string; ninja: Opponent['ninja'] }> {
    if (typeof code !== 'string' || code.length > DUEL.CODE_MAX) throw new ApiError(400, 'INVALID_SNAPSHOT');
    const snap = decodeSnapshot(code);
    if (!snap) throw new ApiError(400, 'INVALID_SNAPSHOT');
    const power = powerOf(snap);
    const [row] = await sql<Array<{ updatedAt: Date }>>`
      INSERT INTO snapshots (user_id, kind, data, code, power, updated_at) VALUES (${userId}, 'ninja', ${sql.json(snap as never)}, ${code.trim()}, ${power}, NOW())
      ON CONFLICT (user_id, kind) DO UPDATE SET data = EXCLUDED.data, code = EXCLUDED.code, power = EXCLUDED.power, updated_at = NOW()
      RETURNING updated_at as "updatedAt"
    `;
    await ensureStats(sql, userId);
    return { power, updatedAt: new Date(row!.updatedAt).toISOString(), ninja: ninjaOf(snap) };
  },

  async mine(userId: string): Promise<{ power: number; updatedAt: string; ninja: Opponent['ninja'] } | null> {
    const [row] = await sql<Array<{ data: NinjaSnapshot; power: number; updatedAt: Date }>>`
      SELECT data, power, updated_at as "updatedAt" FROM snapshots WHERE user_id = ${userId} AND kind = 'ninja'
    `;
    return row ? { power: row.power, updatedAt: new Date(row.updatedAt).toISOString(), ninja: ninjaOf(row.data) } : null;
  },

  async stats(userId: string): Promise<DuelStats> {
    await ensureStats(sql, userId);
    const [row] = await sql<DuelStats[]>`
      SELECT rating, wins, losses, def_wins as "defWins", def_losses as "defLosses" FROM duel_stats WHERE user_id = ${userId}
    `;
    return row!;
  },

  /**
   * Sorteia um adversário: outro jogador, visto nos últimos 30 dias, com retrato de força parecida com o MEU retrato
   * (sem retrato publicado, com qualquer força), preferindo pontuação próxima e com um pouco de acaso.
   */
  async findOpponent(userId: string, exclude?: string | null): Promise<Opponent | null> {
    const me = await this.stats(userId);
    const mine = await this.mine(userId);
    const lo = mine ? Math.round(mine.power * (1 - DUEL.POWER_SPREAD)) : 0;
    const hi = mine ? Math.round(mine.power * (1 + DUEL.POWER_SPREAD)) : 1e9;
    const pick = async (anyPower: boolean) => {
      const rows = await sql<Array<{ id: string; name: string; data: NinjaSnapshot; code: string; power: number; rating: number | null; wins: number | null; losses: number | null }>>`
        SELECT u.id, u.display_name as name, s.data, s.code, s.power, ds.rating, ds.wins, ds.losses
        FROM snapshots s JOIN users u ON u.id = s.user_id LEFT JOIN duel_stats ds ON ds.user_id = u.id
        WHERE s.kind = 'ninja' AND u.id <> ${userId} AND u.id <> ${exclude ?? userId} AND NOT u.is_test AND u.banned_at IS NULL
          AND u.last_seen_at > NOW() - make_interval(days => ${DUEL.ACTIVE_DAYS})
          AND (${anyPower} OR (s.power BETWEEN ${lo} AND ${hi}))
        ORDER BY abs(COALESCE(ds.rating, ${DUEL.START_RATING}) - ${me.rating}) + random() * 200
        LIMIT 1
      `;
      return rows[0];
    };
    const row = (await pick(false)) ?? (await pick(true));
    if (!row) return null;
    return {
      opponentId: row.id, name: row.name, rating: row.rating ?? DUEL.START_RATING, wins: row.wins ?? 0, losses: row.losses ?? 0,
      power: row.power, code: row.code, ninja: ninjaOf(row.data),
    };
  },

  /** Retrato atual de um jogador (revanche a partir do relatório). */
  async opponent(userId: string, opponentId: string): Promise<Opponent> {
    if (opponentId === userId) throw new ApiError(400, 'DUEL_SELF');
    const [row] = await sql<Array<{ id: string; name: string; data: NinjaSnapshot; code: string; power: number; rating: number | null; wins: number | null; losses: number | null }>>`
      SELECT u.id, u.display_name as name, s.data, s.code, s.power, ds.rating, ds.wins, ds.losses
      FROM snapshots s JOIN users u ON u.id = s.user_id LEFT JOIN duel_stats ds ON ds.user_id = u.id
      WHERE s.kind = 'ninja' AND u.id = ${opponentId} AND u.banned_at IS NULL
    `;
    if (!row) throw new ApiError(404, 'DUEL_OPPONENT_UNAVAILABLE');
    return {
      opponentId: row.id, name: row.name, rating: row.rating ?? DUEL.START_RATING, wins: row.wins ?? 0, losses: row.losses ?? 0,
      power: row.power, code: row.code, ninja: ninjaOf(row.data),
    };
  },

  /** Abre o duelo: guarda a cópia do retrato do defensor (o duelo não muda se ele publicar outro) e o meu. */
  async start(userId: string, opponentId: unknown): Promise<{ duelId: string; code: string }> {
    if (typeof opponentId !== 'string' || !/^[0-9a-f-]{36}$/.test(opponentId)) throw new ApiError(400, 'INVALID_OPPONENT');
    await this.settleAbandoned(userId);
    const foe = await this.opponent(userId, opponentId);
    const mine = await this.mine(userId);
    const [snapRow] = await sql<Array<{ data: NinjaSnapshot }>>`SELECT data FROM snapshots WHERE user_id = ${opponentId} AND kind = 'ninja'`;
    const [myRow] = mine ? await sql<Array<{ data: NinjaSnapshot }>>`SELECT data FROM snapshots WHERE user_id = ${userId} AND kind = 'ninja'` : [undefined];
    const [row] = await sql<Array<{ id: string }>>`
      INSERT INTO duels (attacker_id, defender_id, snapshot, attacker_snapshot)
      VALUES (${userId}, ${opponentId}, ${sql.json(snapRow!.data as never)}, ${myRow ? sql.json(myRow.data as never) : null})
      RETURNING id
    `;
    await ensureStats(sql, userId);
    await ensureStats(sql, opponentId);
    return { duelId: row!.id, code: foe.code };
  },

  /** Resultado do duelo (confiado ao cliente por enquanto; o replay com semente é o próximo passo). */
  async finish(userId: string, input: { duelId?: unknown; won?: unknown; summary?: unknown; reason?: unknown }): Promise<{ rating: number; delta: number; defDelta: number }> {
    const duelId = typeof input.duelId === 'string' ? input.duelId : '';
    if (!/^[0-9a-f-]{36}$/.test(duelId)) throw new ApiError(400, 'INVALID_DUEL');
    const won = input.won === true;
    const reason = typeof input.reason === 'string' && /^[a-z]{1,12}$/.test(input.reason) ? input.reason : won ? 'win' : 'loss';
    const summary = input.summary && typeof input.summary === 'object' ? (input.summary as Summary) : null;
    return sql.begin(async (tx) => {
      const [duel] = await tx<Array<{ defenderId: string; finished: Date | null }>>`
        SELECT defender_id as "defenderId", finished_at as finished FROM duels WHERE id = ${duelId} AND attacker_id = ${userId} FOR UPDATE
      `;
      if (!duel) throw new ApiError(404, 'DUEL_NOT_FOUND');
      if (duel.finished) throw new ApiError(409, 'DUEL_ALREADY_FINISHED');
      const r = await this.applyResult(tx as unknown as typeof sql, userId, duel.defenderId, won);
      await tx`
        UPDATE duels SET won = ${won}, end_reason = ${reason}, finished_at = NOW(),
          summary = ${sql.json({ ...(summary ?? {}), defDelta: r.defDelta, delta: r.delta } as never)}
        WHERE id = ${duelId}
      `;
      return r;
    });
  },

  async applyResult(tx: typeof sql, userId: string, opponentId: string, won: boolean) {
    await ensureStats(tx, userId);
    await ensureStats(tx, opponentId);
    const [a] = await tx<Array<{ rating: number }>>`SELECT rating FROM duel_stats WHERE user_id = ${userId} FOR UPDATE`;
    const [d] = await tx<Array<{ rating: number }>>`SELECT rating FROM duel_stats WHERE user_id = ${opponentId} FOR UPDATE`;
    const delta = ratingDelta(a!.rating, d!.rating, won, DUEL.K_ATTACK);
    const defDelta = -ratingDelta(a!.rating, d!.rating, won, DUEL.K_DEFENSE);
    const next = Math.max(DUEL.MIN_RATING, a!.rating + delta);
    const defNext = Math.max(DUEL.MIN_RATING, d!.rating + defDelta);
    await tx`UPDATE duel_stats SET rating = ${next}, wins = wins + ${won ? 1 : 0}, losses = losses + ${won ? 0 : 1}, updated_at = NOW() WHERE user_id = ${userId}`;
    await tx`UPDATE duel_stats SET rating = ${defNext}, def_wins = def_wins + ${won ? 0 : 1}, def_losses = def_losses + ${won ? 1 : 0}, updated_at = NOW() WHERE user_id = ${opponentId}`;
    return { rating: next, delta: next - a!.rating, defDelta: defNext - d!.rating };
  },

  /** O duelo não chegou a começar no jogo (arena ocupada etc.): apaga sem contar, se ainda está aberto. */
  async cancel(userId: string, duelId: unknown): Promise<boolean> {
    if (typeof duelId !== 'string' || !/^[0-9a-f-]{36}$/.test(duelId)) throw new ApiError(400, 'INVALID_DUEL');
    const rows = await sql`DELETE FROM duels WHERE id = ${duelId} AND attacker_id = ${userId} AND finished_at IS NULL AND started_at > NOW() - interval '5 minutes' RETURNING id`;
    return rows.length > 0;
  },

  /** Duelos abertos e largados (fechou o jogo no meio) contam como derrota antes do próximo. */
  async settleAbandoned(userId: string): Promise<number> {
    const open = await sql<Array<{ id: string; defenderId: string }>>`
      SELECT id, defender_id as "defenderId" FROM duels WHERE attacker_id = ${userId} AND finished_at IS NULL
    `;
    for (const d of open) {
      await sql.begin(async (tx) => {
        const [row] = await tx`UPDATE duels SET finished_at = NOW(), won = false, end_reason = 'abandon' WHERE id = ${d.id} AND finished_at IS NULL RETURNING id`;
        if (row) await this.applyResult(tx as unknown as typeof sql, userId, d.defenderId, false);
      });
    }
    return open.length;
  },

  async ranking(userId: string): Promise<{ top: Array<{ userId: string; name: string; rating: number; wins: number; losses: number; ninja: Opponent['ninja'] | null }>; me: DuelStats & { position: number | null } }> {
    const top = await sql<Array<{ userId: string; name: string; rating: number; wins: number; losses: number; data: NinjaSnapshot | null }>>`
      SELECT ds.user_id as "userId", u.display_name as name, ds.rating, ds.wins, ds.losses, s.data
      FROM duel_stats ds JOIN users u ON u.id = ds.user_id LEFT JOIN snapshots s ON s.user_id = u.id AND s.kind = 'ninja'
      WHERE ds.wins + ds.losses + ds.def_wins + ds.def_losses > 0 AND NOT u.is_test AND u.banned_at IS NULL
      ORDER BY ds.rating DESC, ds.wins DESC LIMIT 50
    `;
    const me = await this.stats(userId);
    const played = me.wins + me.losses + me.defWins + me.defLosses > 0;
    const [pos] = await sql<Array<{ n: number }>>`
      SELECT count(*)::int + 1 as n FROM duel_stats ds JOIN users u ON u.id = ds.user_id
      WHERE ds.wins + ds.losses + ds.def_wins + ds.def_losses > 0 AND NOT u.is_test AND u.banned_at IS NULL AND ds.rating > ${me.rating}
    `;
    return { top: top.map((r) => ({ ...r, data: undefined, ninja: r.data ? ninjaOf(r.data) : null })), me: { ...me, position: played ? pos!.n : null } };
  },

  /** Quem enfrentou o meu retrato e como foi; `unseen` = depois da última vez que olhei o relatório. */
  async defenses(userId: string): Promise<{ defenses: Defense[]; unseen: number; rating: number }> {
    const me = await this.stats(userId);
    const [seen] = await sql<Array<{ at: Date | null }>>`SELECT report_seen_at as at FROM duel_stats WHERE user_id = ${userId}`;
    const rows = await sql<Array<{ id: string; at: Date; attackerId: string; name: string; attackerSnapshot: NinjaSnapshot | null; won: boolean; endReason: string | null; summary: Record<string, unknown> | null; revenged: boolean }>>`
      SELECT d.id, d.finished_at as at, a.id as "attackerId", a.display_name as name, d.attacker_snapshot as "attackerSnapshot",
        d.won, d.end_reason as "endReason", d.summary,
        EXISTS (SELECT 1 FROM duels r WHERE r.attacker_id = ${userId} AND r.defender_id = a.id AND r.started_at > d.started_at) as revenged
      FROM duels d JOIN users a ON a.id = d.attacker_id
      WHERE d.defender_id = ${userId} AND d.finished_at IS NOT NULL AND NOT a.is_test
      ORDER BY d.finished_at DESC LIMIT ${DUEL.REPORT_LIMIT}
    `;
    const seenAt = seen?.at ? new Date(seen.at).getTime() : 0;
    const defenses: Defense[] = rows.map((r) => ({
      id: r.id,
      at: new Date(r.at).toISOString(),
      attacker: { id: r.attackerId, name: r.name },
      attackerNinja: r.attackerSnapshot ? { name: r.attackerSnapshot.name, rank: r.attackerSnapshot.rank, level: r.attackerSnapshot.level } : null,
      held: !r.won,
      left: r.endReason === 'abandon' || r.endReason === 'retreat',
      defDelta: typeof r.summary?.defDelta === 'number' ? (r.summary.defDelta as number) : null,
      summary: r.summary,
      unseen: new Date(r.at).getTime() > seenAt,
      revenged: r.revenged,
    }));
    return { defenses, unseen: defenses.filter((d) => d.unseen).length, rating: me.rating };
  },

  async markSeen(userId: string): Promise<void> {
    await ensureStats(sql, userId);
    await sql`UPDATE duel_stats SET report_seen_at = NOW() WHERE user_id = ${userId}`;
  },

  /** Últimos duelos que eu ataquei (histórico curto). */
  async history(userId: string): Promise<Array<{ id: string; at: string; defender: string; ninja: Opponent['ninja']; won: boolean | null; delta: number | null }>> {
    const rows = await sql<Array<{ id: string; at: Date; defender: string; data: NinjaSnapshot; won: boolean | null; summary: Record<string, unknown> | null }>>`
      SELECT d.id, COALESCE(d.finished_at, d.started_at) as at, u.display_name as defender, d.snapshot as data, d.won, d.summary
      FROM duels d JOIN users u ON u.id = d.defender_id WHERE d.attacker_id = ${userId} ORDER BY d.started_at DESC LIMIT 10
    `;
    return rows.map((r) => ({ id: r.id, at: new Date(r.at).toISOString(), defender: r.defender, ninja: ninjaOf(r.data), won: r.won, delta: typeof r.summary?.delta === 'number' ? (r.summary.delta as number) : null }));
  },
};
