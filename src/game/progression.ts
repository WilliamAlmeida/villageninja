// Evolução dos ninjas: XP, níveis, treino de atributos e promoção.
import { trainMult } from './upgrade';
import { pick } from '../core/rng';
import { RANKS, STAT_INFO, STAT_KEYS, xpToNext, type StatKey } from '../data/ninja';
import { refreshDerived } from './entities';
import { fxText } from './fx';
import type { Game } from './game';
import type { Unit } from './types';

/** Aumenta um atributo respeitando o teto do rank. Retorna o ganho real. */
export function addStat(u: Unit, key: StatKey, amount: number): number {
  const n = u.ninja!;
  const cap = RANKS[n.rank].statCap;
  const before = n.stats[key];
  n.stats[key] = Math.min(cap, before + amount);
  return n.stats[key] - before;
}

export function gainXp(g: Game, u: Unit, amount: number) {
  const n = u.ninja;
  if (!n || u.faction !== 'village' || u.kind !== 'ninja') return;
  n.xp += amount;
  while (n.xp >= xpToNext(n.level)) {
    n.xp -= xpToNext(n.level);
    n.level++;
    for (let i = 0; i < 2; i++) addStat(u, pick(STAT_KEYS), 0.3);
    refreshDerived(u);
    u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.3);
    fxText(g, u.x, u.y - 30, `Nível ${n.level}!`, '#ffd34d', true);
    g.toast(`{up} ${u.name} alcançou o nível ${n.level}`, 'good');
    const next = nextRank(u);
    if (next && n.level === RANKS[next].minLevel)
      g.toast(next === 'kage' ? `{crown} ${u.name} pode ser eleito Kage (Residência do Hokage).` : `{medal} ${u.name} pode ser promovido a ${RANKS[next].name}!`, 'good');
  }
}

/** Uma sessão de treino no Campo de Treino. Com o sensei por perto rende 50% a mais. */
export function trainTick(g: Game, u: Unit, sensei: Unit | null = null) {
  const n = u.ninja!;
  const cap = RANKS[n.rank].statCap;
  const open = STAT_KEYS.filter((k) => n.stats[k] < cap);
  // sem foco definido, o sensei puxa o treino para os pontos fortes dele
  const senseiPick = sensei?.ninja && !n.focus && Math.random() < 0.5 ? topStats(sensei).find((k) => open.includes(k)) : undefined;
  const key = n.focus && n.stats[n.focus] < cap ? n.focus : (senseiPick ?? (open.length ? pick(open) : null));
  // sensei +50%; campo de treino com upgrade +30% por nível
  const mult = (sensei ? 1.5 : 1) * trainMult(g);
  if (key) {
    const gain = addStat(u, key, 0.12 * mult * (0.8 + n.stats.inteligencia * 0.05));
    if (gain > 0) fxText(g, u.x, u.y - 22, `+${STAT_INFO[key].short}`, STAT_INFO[key].color);
    refreshDerived(u);
  }
  // Monte dos Kages inspira: +30% de XP no treino
  const monument = g.state.buildings.some((b) => b.type === 'monument' && b.built);
  gainXp(g, u, Math.round(5 * mult * (monument ? 1.3 : 1)));
  if (sensei) gainXp(g, sensei, 1);
}

function topStats(u: Unit): StatKey[] {
  const s = u.ninja!.stats;
  return [...STAT_KEYS].sort((a, b) => s[b] - s[a]).slice(0, 2);
}

export function nextRank(u: Unit) {
  const order = ['genin', 'chunin', 'jounin', 'kage'] as const;
  const i = order.indexOf(u.ninja!.rank);
  return i >= 0 && i < order.length - 1 ? order[i + 1]! : null;
}
