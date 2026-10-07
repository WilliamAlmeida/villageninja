// Automação para vilas grandes (gerenciar 50 ninjas à mão cansa) e destinos para o ryo do fim de jogo:
// oficinas que fabricam sozinhas (com upgrade), Academia que ensina sozinha, senseis automáticos,
// ninjas mercenários e materiais raros comprados no mercado.
import { ITEMS } from '../data/items';
import { JUTSU_LIST, type JutsuDef } from '../data/jutsus';
import { RANKS, type Rank } from '../data/ninja';
import { costLabel } from '../data/resources';
import { createNinja, randomStats, refreshDerived } from './entities';
import { fx, fxText } from './fx';
import type { Game } from './game';
import { enqueueCraft, recipesOf, stock } from './gear';
import { jutsuOptions, teachJutsu } from './commands';
import { joinAsSensei, teamFit, teamOf } from './teams';
import type { Building, Cost, Unit } from './types';
import { levelOf } from './upgrade';
import { doorPos } from './world';

type Result = { ok: true } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });

// ------------------------------------------------------------------ oficinas: fabricar sozinho
/** A partir do nível 2 a oficina mantém o estoque sozinha (velocidade e fila por nível: craftMult/queueMax). */
export const AUTO_CRAFT_LEVEL = 2;
export const canAutoCraft = (b: Building) => b.built && levelOf(b) >= AUTO_CRAFT_LEVEL;

/** Quantos deste item já estão garantidos: no estoque, na fila e em produção (desta e das outras oficinas). */
function pipeline(g: Game, itemId: string) {
  let n = stock(g, itemId);
  for (const b of g.state.buildings) {
    n += (b.queue ?? []).filter((q) => q === itemId).length;
    if (b.craft?.itemId === itemId) n++;
  }
  return n;
}

/** Define quantos do item a oficina deve manter no estoque (0 = não fabrica sozinha). */
export function setKeep(g: Game, buildingId: number, itemId: string, n: number): Result {
  const b = g.building(buildingId);
  const def = ITEMS[itemId];
  if (!b || !def || def.building !== b.type) return fail('Inválido.');
  if (def.blade) return fail('Lâmina lendária: forja-se uma vez só, à mão.');
  if (!canAutoCraft(b)) return fail(`Faça o upgrade da oficina para o nível ${AUTO_CRAFT_LEVEL} para fabricar sozinha.`);
  b.keep ??= {};
  if (n > 0) b.keep[itemId] = Math.min(30, Math.round(n));
  else delete b.keep[itemId];
  return { ok: true };
}

/** Oficinas com upgrade repõem o estoque sozinhas (pagando os recursos), até a fila encher. */
export function autoCraftTick(g: Game) {
  for (const b of g.state.buildings) {
    if (!b.keep || !canAutoCraft(b)) continue;
    for (const r of recipesOf(b.type)) {
      const want = r.blade ? 0 : (b.keep[r.id] ?? 0);
      let have = pipeline(g, r.id);
      while (have < want && g.canAfford(r.cost) && enqueueCraft(g, b.id, r.id).ok) have++;
    }
  }
}

// ------------------------------------------------------------------ Academia: ensinar sozinha
/** Nota de um jutsu para este ninja: rank, atributo que o potencializa e variedade com o que ele já sabe. */
function jutsuScore(u: Unit, def: JutsuDef) {
  const s = u.ninja!.stats;
  const stat = def.type === 'taijutsu' ? s.taijutsu + s.forca * 0.5 : def.type === 'genjutsu' ? s.genjutsu : def.type === 'iryo' ? s.inteligencia : s.ninjutsu;
  const known = u.ninja!.jutsu.filter(Boolean).map((id) => JUTSU_LIST.find((j) => j.id === id)?.effect);
  const variety = known.includes(def.effect) ? 0 : 4;
  const medic = def.effect === 'heal' && u.ninja!.spec === 'medic' ? 8 : 0;
  return def.rank * 10 + stat * 2 + variety + medic;
}

/** Melhor jutsu que o ninja pode aprender agora (sem proibidos: têm risco de sequela). */
export function bestJutsuFor(g: Game, u: Unit): JutsuDef | null {
  const opts = jutsuOptions(u, g.state.scrolls).filter((o) => o.ok && !o.def.forbidden && g.canAfford(o.def.cost));
  if (!opts.length) return null;
  return opts.sort((a, b) => jutsuScore(u, b.def) - jutsuScore(u, a.def))[0]!.def;
}

/** Quantos ninjas estudam ao mesmo tempo no ensino automático (não esvazia a defesa). */
export const maxLearners = (g: Game) => 2 + 2 * Math.max(0, ...g.builtOf('academy').map(levelOf));

/** Ensina o melhor jutsu a quem tem espaço livre. `limit` = no máximo quantos começam agora. Retorna quantos começaram. */
export function teachAll(g: Game, limit = Infinity): number {
  if (!g.findBuilt('academy')) return 0;
  const ninjas = g.state.units
    .filter((u) => !u.dead && u.kind === 'ninja' && u.faction === 'village' && u.away == null && u.ninja && !u.ninja.learning)
    .filter((u) => u.ninja!.jutsu.includes(null))
    .sort((a, b) => b.ninja!.level - a.ninja!.level);
  let n = 0;
  for (const u of ninjas) {
    if (n >= limit) break;
    const def = bestJutsuFor(g, u);
    if (!def) continue;
    const slot = u.ninja!.jutsu[0] === null ? 0 : 1;
    if (teachJutsu(g, u.id, def.id, slot).ok) n++;
  }
  return n;
}

export function autoTeachTick(g: Game) {
  const learning = g.state.units.filter((u) => !u.dead && u.ninja?.learning && u.faction === 'village').length;
  const room = maxLearners(g) - learning;
  if (room > 0) teachAll(g, room);
}

// ------------------------------------------------------------------ senseis automáticos
/** Equipes sem sensei recebem um: um Chunin+ da própria equipe ou o Jounin/Chunin livre mais forte. Retorna quantos. */
export function autoSenseiTick(g: Game): number {
  let n = 0;
  for (const t of g.state.teams) {
    if (t.senseiId != null) continue;
    const inside = t.memberIds.map((id) => g.unit(id)).find((u) => u && !u.dead && u.ninja && u.ninja.rank !== 'genin' && !teamFit(g, t, u));
    const free = g.state.units
      .filter((u) => !u.dead && u.kind === 'ninja' && u.faction === 'village' && u.ninja && (u.ninja.rank === 'jounin' || u.ninja.rank === 'chunin') && !teamOf(g, u) && !teamFit(g, t, u))
      .sort((a, b) => Number(b.ninja!.rank === 'jounin') - Number(a.ninja!.rank === 'jounin') || b.ninja!.level - a.ninja!.level)[0];
    const pick = inside ?? free;
    if (!pick || !joinAsSensei(g, t.id, pick.id).ok) continue;
    n++;
    g.toast(`{crown} ${pick.name} agora é o sensei de ${t.name}.`, 'good', pick);
  }
  return n;
}

// ------------------------------------------------------------------ destinos para o ryo
/** Ninjas mercenários contratados na Mesa de Missões. */
export const MERCS: Record<'chunin' | 'jounin', { cost: Cost; level: number; stats: number; minVillage: number }> = {
  chunin: { cost: { ryo: 900, food: 60 }, level: 8, stats: 1.6, minVillage: 1 },
  jounin: { cost: { ryo: 2500, food: 120 }, level: 14, stats: 3, minVillage: 2 },
};

export function hireBlock(g: Game, rank: 'chunin' | 'jounin'): string | null {
  const m = MERCS[rank];
  if (!g.findBuilt('missions')) return 'Construa a Mesa de Missões.';
  if (g.state.level < m.minVillage) return `A vila precisa ser maior para atrair um ${RANKS[rank].name}.`;
  if (g.population() >= g.popCap()) return 'Sem vaga nas casas: construa casas para o mercenário morar.';
  if (!g.canAfford(m.cost)) return `Custa ${costLabel(m.cost)}.`;
  return null;
}

export function hireMercenary(g: Game, rank: 'chunin' | 'jounin'): Result {
  const why = hireBlock(g, rank);
  if (why) return fail(why);
  const m = MERCS[rank];
  g.pay(m.cost);
  const b = g.findBuilt('missions')!;
  const p = doorPos(b);
  const u = createNinja(g, p.x, p.y + 8, rank as Rank, 1);
  u.ninja!.stats = randomStats(rank as Rank, m.stats);
  u.ninja!.level = m.level;
  refreshDerived(u);
  u.hp = u.maxHp;
  u.chakra = u.maxChakra;
  fx(g, 'smoke', u.x, u.y, { r: 18, life: 0.6, color: '#e8e8e8' });
  fxText(g, u.x, u.y - 30, 'Contratado!', '#ffd34d', true);
  g.toast(`{ninja} ${u.name}, ${RANKS[rank].name} nível ${m.level}, aceitou servir a vila.`, 'good', u);
  return { ok: true };
}

/** Materiais raros vendidos no mercado (antes só vinham das minas). Preço por unidade. */
export const RARE_PRICE: Partial<Record<'crystal' | 'darksteel', number>> = { crystal: 140, darksteel: 200 };

export function buyRare(g: Game, res: 'crystal' | 'darksteel', n: number): Result {
  const price = RARE_PRICE[res];
  if (!price) return fail('Inválido.');
  if (!g.findBuilt('market')) return fail('Construa um Mercado.');
  if (g.state.level < 2) return fail('Os mercadores só trazem isso para uma Vila Oculta.');
  const cost = { ryo: price * n };
  if (!g.pay(cost)) return fail(`Custa ${costLabel(cost)}.`);
  g.state.res[res] += n;
  return { ok: true };
}

