// Ações do jogador. A UI só altera o jogo por aqui (fácil de testar / reaproveitar).
import { BUILDINGS, type BuildingType } from '../data/buildings';
import { JUTSU_LIST, JUTSUS, type JutsuDef } from '../data/jutsus';
import { RANKS, STAT_INFO, type StatKey } from '../data/ninja';
import { convertToNinja, refreshDerived } from './entities';
import { fx, fxText } from './fx';
import type { Game } from './game';
import { nextRank } from './progression';
import type { Building, Cost, NinjaOrder, Unit } from './types';
import { doorPos } from './world';

export type Result = { ok: true } | { ok: false; error: string };
const ok: Result = { ok: true };
const fail = (error: string): Result => ({ ok: false, error });

export const costLabel = (c: Cost) =>
  [c.wood && `${c.wood}🪵`, c.stone && `${c.stone}🪨`, c.food && `${c.food}🍙`, c.ryo && `${c.ryo}💰`].filter(Boolean).join(' ') || 'grátis';

export function canBuild(g: Game, type: BuildingType): Result {
  const def = BUILDINGS[type];
  if (!def.buildable) return fail('Não pode ser construído.');
  if (def.unique && g.state.buildings.some((b) => b.type === type)) return fail('Só pode haver um.');
  if (!g.canAfford(def.cost)) return fail('Recursos insuficientes.');
  return ok;
}

export function placeBuilding(g: Game, type: BuildingType, tx: number, ty: number): Result {
  const def = BUILDINGS[type];
  const c = canBuild(g, type);
  if (!c.ok) return c;
  if (!g.world.canPlace(type, tx, ty)) return fail('Local inválido.');
  g.pay(def.cost);
  // árvores no terreno viram madeira
  let wood = 0;
  for (const n of [...g.state.nodes]) {
    if (n.type === 'tree' && n.tx >= tx && n.tx < tx + def.w && n.ty >= ty && n.ty <= ty + def.h) {
      wood += 3;
      g.removeNode(n.id);
    }
  }
  g.state.res.wood += wood;
  const b: Building = { id: g.newId(), type, tx, ty, built: false, progress: 0, desired: def.workers ?? 0, workers: [], cd: 0 };
  g.addBuilding(b);
  const p = doorPos(b);
  fx(g, 'smoke', p.x, p.y - 16, { r: 20, life: 0.6, color: '#d8c8a8' });
  return ok;
}

export function demolish(g: Game, id: number): Result {
  const b = g.building(id);
  if (!b) return fail('Prédio não encontrado.');
  if (b.type === 'hokage') return fail('A Residência do Hokage não pode ser demolida.');
  const def = BUILDINGS[b.type];
  g.give(def.cost, b.built ? 0.5 : 1);
  g.removeBuilding(id);
  return ok;
}

export function setDesiredWorkers(g: Game, id: number, delta: number): Result {
  const b = g.building(id);
  if (!b) return fail('Prédio não encontrado.');
  const max = BUILDINGS[b.type].workers ?? 0;
  b.desired = Math.max(0, Math.min(max, b.desired + delta));
  g.state.timers.jobs = 0;
  return ok;
}

export const RECRUIT_COST: Cost = { ryo: 60, food: 20 };

export function recruitNinja(g: Game): Result {
  if (!g.findBuilt('academy')) return fail('Construa a Academia Ninja primeiro.');
  const candidates = g.state.units.filter((u) => !u.dead && u.kind === 'villager');
  if (candidates.length <= 1) return fail('A vila precisa de mais moradores.');
  if (!g.canAfford(RECRUIT_COST)) return fail('Recursos insuficientes.');
  // prefere desempregados
  const u = candidates.find((c) => c.jobId == null) ?? candidates[0]!;
  g.pay(RECRUIT_COST);
  convertToNinja(g, u);
  const n = u.ninja!;
  const known = n.jutsu.filter(Boolean).length;
  fx(g, 'smoke', u.x, u.y, { r: 18, life: 0.6, color: '#e8e8e8' });
  fxText(g, u.x, u.y - 30, 'Novo ninja!', '#ffd34d', true);
  g.toast(known ? `🥷 ${u.name} virou ninja e já nasceu sabendo ${known} jutsu(s)!` : `🥷 ${u.name} virou ninja (ainda sem jutsu).`, 'good', u);
  return ok;
}

export interface JutsuOption {
  def: JutsuDef;
  ok: boolean;
  reason?: string;
  known: boolean;
}

/** Lista de jutsus com o motivo de poder/não poder aprender. */
export function jutsuOptions(u: Unit): JutsuOption[] {
  const n = u.ninja!;
  return JUTSU_LIST.filter((j) => j.nature === null || j.nature === n.nature).map((def) => {
    const known = n.jutsu.includes(def.id);
    if (known) return { def, ok: false, reason: 'Já conhece', known };
    if (def.rank > RANKS[n.rank].maxJutsuRank) return { def, ok: false, reason: `Requer rank maior`, known };
    for (const [k, v] of Object.entries(def.req) as [StatKey, number][])
      if (n.stats[k] < v) return { def, ok: false, reason: `${STAT_INFO[k].short} ${v}+`, known };
    return { def, ok: true, known };
  });
}

export function teachJutsu(g: Game, unitId: number, jutsuId: string, slot: 0 | 1): Result {
  const u = g.unit(unitId);
  const def = JUTSUS[jutsuId];
  if (!u?.ninja || !def) return fail('Inválido.');
  if (!g.findBuilt('academy')) return fail('Construa a Academia Ninja primeiro.');
  if (u.ninja.learning) return fail('Já está estudando um jutsu.');
  const opt = jutsuOptions(u).find((o) => o.def.id === jutsuId);
  if (!opt?.ok) return fail(opt?.reason ?? 'Não pode aprender.');
  if (!g.pay(def.cost)) return fail('Recursos insuficientes.');
  u.ninja.learning = { jutsuId, slot, progress: 0, total: def.learnTime };
  if (u.state !== 'fight') {
    u.state = 'idle';
    u.timer = 0;
  }
  g.toast(`📜 ${u.name} foi estudar ${def.name}.`, 'info', u);
  return ok;
}

export function promote(g: Game, unitId: number): Result {
  const u = g.unit(unitId);
  if (!u?.ninja) return fail('Inválido.');
  const next = nextRank(u);
  if (!next) return fail('Rank máximo.');
  const r = RANKS[next];
  if (u.ninja.level < r.minLevel) return fail(`Requer nível ${r.minLevel}.`);
  if (r.unique && g.state.units.some((o) => o.ninja?.rank === next && o.faction === 'village' && !o.dead))
    return fail(`Já existe um ${r.name}.`);
  if (!g.pay(r.promoteCost)) return fail('Recursos insuficientes.');
  u.ninja.rank = next;
  refreshDerived(u);
  fxText(g, u.x, u.y - 30, `${r.name}!`, '#ffd34d', true);
  fx(g, 'ring', u.x, u.y, { r: 28, color: '#ffd34d', life: 0.6 });
  g.toast(`🎖 ${u.name} foi promovido a ${r.name}!`, 'good', u);
  return ok;
}

export function setOrder(g: Game, unitId: number, order: NinjaOrder): Result {
  const u = g.unit(unitId);
  if (!u?.ninja) return fail('Inválido.');
  u.ninja.order = order;
  if (u.state !== 'fight' && u.state !== 'learn' && u.state !== 'toLearn') {
    u.state = 'idle';
    u.timer = 0;
    u.hidden = false;
  }
  return ok;
}

export function setFocus(g: Game, unitId: number, focus: StatKey | null): Result {
  const u = g.unit(unitId);
  if (!u?.ninja) return fail('Inválido.');
  u.ninja.focus = focus;
  return ok;
}
