// Desgaste de arma e colete, conserto na Forja e consumo dos consumíveis na semana.
// A arma gasta a cada golpe que acerta e o colete com o dano que segura (só ninjas da vila, fora do duelo do Exame).
// Gasta (abaixo de WEAR.worn) dá metade do bônus; quebrada (0) não dá nada até consertar; lâmina lendária fica cega.
// Peça tirada antes do conserto vai para `state.worn` (não volta nova para o estoque); a Forja conserta as duas.
import { ITEMS, WEAR } from '../data/items';
import { levelOf } from './upgrade';
import { refreshDerived } from './entities';
import { fxText } from './fx';
import { duraOf, stageOf, type GearSlot, type WearStage } from './gearBonus';
import type { Game } from './game';
import type { Cost, GameState, Unit } from './types';

type Result = { ok: true } | { ok: false; error: string };
const SLOTS: GearSlot[] = ['weapon', 'armor'];

const STAGE_TEXT: Record<GearSlot, Partial<Record<WearStage, string>>> = {
  weapon: { worn: 'Arma gasta', broken: 'Arma quebrou!', blunt: 'Lâmina cega' },
  armor: { worn: 'Colete gasto', broken: 'Colete rasgou!' },
};

/** Gasta a peça: `amount` golpes (arma) ou pontos de dano (colete). */
export function wearOut(g: Game, u: Unit | null, slot: GearSlot, amount: number) {
  const e = u?.ninja?.equip;
  if (!u || !e || u.faction !== 'village' || u.arenaSide || u.kind === 'clone' || amount <= 0) return;
  const id = e[slot];
  const def = id ? ITEMS[id] : undefined;
  if (!def?.dura) return;
  const before = duraOf(u, slot);
  if (before <= 0) return;
  const after = Math.max(0, before - amount / def.dura);
  (e.dura ??= {})[slot] = after;
  const now = stageOf(id, after);
  if (now !== stageOf(id, before)) {
    refreshDerived(u); // colete gasto tira vida máxima (mantém a proporção)
    const text = STAGE_TEXT[slot][now];
    if (text) fxText(g, u.x, u.y - 34, text, '#ffb347');
  }
}

/** Gasta tudo o que o ninja usa de uma vez (expedição fora do mapa, na volta). */
export function wearAll(g: Game, u: Unit, share: number) {
  for (const slot of SLOTS) {
    const def = u.ninja?.equip[slot] ? ITEMS[u.ninja.equip[slot]!] : undefined;
    if (def?.dura) wearOut(g, u, slot, def.dura * share);
  }
}

/** Custo para consertar uma peça com essa durabilidade (parte do custo de fabricar, proporcional ao desgaste). */
export function repairCost(itemId: string, dura: number): Cost {
  const def = ITEMS[itemId];
  const k = WEAR.repair * (1 - Math.max(0, dura));
  if (!def || k <= 0) return {};
  // lâmina lendária de saque não tem receita: conserto em ferro e aço negro
  const base: Cost = Object.keys(def.cost).length ? def.cost : { iron: 30, darksteel: 2 };
  const out: Cost = {};
  for (const [r, v] of Object.entries(base) as [keyof Cost, number][]) if (v > 0) out[r] = Math.max(1, Math.ceil(v * k));
  return out;
}

const addCost = (a: Cost, b: Cost) => {
  for (const [r, v] of Object.entries(b) as [keyof Cost, number][]) a[r] = (a[r] ?? 0) + v;
  return a;
};

/** Peças do ninja que dá para consertar (com desgaste). */
export const wornSlots = (u: Unit) => SLOTS.filter((s) => u.ninja?.equip[s] && ITEMS[u.ninja.equip[s]!]?.dura && duraOf(u, s) < 1);
/** Alguma peça gasta, quebrada ou cega (filtro da lista de Ninjas). */
export const hasWornGear = (u: Unit) => SLOTS.some((s) => stageOf(u.ninja?.equip[s], duraOf(u, s)) !== 'ok');
export const unitRepairCost = (u: Unit) => wornSlots(u).reduce((c, s) => addCost(c, repairCost(u.ninja!.equip[s]!, duraOf(u, s))), {} as Cost);

export const forgeOf = (g: Game) => g.builtOf('forge')[0];
/** Ninja da vila que pode passar na Forja agora (dentro do território, fora de expedição). */
const atHome = (g: Game, u: Unit) => !u.dead && u.faction === 'village' && u.ninja && u.away == null && !u.origin && g.world.inVillage(u.x, u.y);

/** Por que não dá para consertar este ninja (null = dá). */
export function repairBlock(g: Game, u: Unit): string | null {
  if (!forgeOf(g)) return 'Precisa de uma Forja pronta.';
  if (!wornSlots(u).length) return 'Nada para consertar.';
  if (!atHome(g, u)) return 'Só dentro da vila (a Forja não vai até ele).';
  return null;
}

/** Conserta arma e colete do ninja (paga na hora). */
export function repairUnit(g: Game, u: Unit): Result {
  const why = repairBlock(g, u);
  if (why) return { ok: false, error: why };
  if (!g.pay(unitRepairCost(u))) return { ok: false, error: 'Recursos insuficientes.' };
  for (const s of wornSlots(u)) u.ninja!.equip.dura![s] = 1;
  refreshDerived(u);
  return { ok: true };
}

/** Peças guardadas gastas (fora de um ninja), por item. */
export const wornStock = (g: Game, id: string) => g.state.worn?.[id]?.length ?? 0;

/** Tudo o que a Forja pode consertar agora: ninjas na vila e peças gastas guardadas. */
export function pendingRepairs(g: Game) {
  const units = g.state.units.filter((u) => atHome(g, u) && wornSlots(u).length);
  const cost = units.reduce((c, u) => addCost(c, unitRepairCost(u)), {} as Cost);
  let pieces = units.reduce((n, u) => n + wornSlots(u).length, 0);
  for (const [id, list] of Object.entries(g.state.worn ?? {})) for (const d of list) addCost(cost, repairCost(id, d)), pieces++;
  return { units, pieces, cost };
}

/** Conserta o que der com os recursos da vila (`below`: só o que está abaixo dessa durabilidade). Retorna quantas peças. */
export function repairAll(g: Game, below = 1): number {
  if (!forgeOf(g)) return 0;
  let n = 0;
  const units = g.state.units.filter((u) => atHome(g, u) && wornSlots(u).some((s) => duraOf(u, s) < below));
  // os mais gastos primeiro (quebrados antes de gastos)
  units.sort((a, b) => Math.min(...wornSlots(a).map((s) => duraOf(a, s))) - Math.min(...wornSlots(b).map((s) => duraOf(b, s))));
  for (const u of units) {
    const slots = wornSlots(u).length;
    if (repairUnit(g, u).ok) n += slots;
  }
  for (const [id, list] of Object.entries(g.state.worn ?? {})) {
    list.sort((a, b) => b - a);
    while (list.length && list[list.length - 1]! < below && g.pay(repairCost(id, list[list.length - 1]!))) {
      list.pop();
      g.state.items[id] = (g.state.items[id] ?? 0) + 1;
      n++;
    }
    if (!list.length) delete g.state.worn![id];
  }
  return n;
}

/** Forja do nível 2 em diante conserta sozinha quem passa pela vila abaixo de WEAR.autoBelow (Auto-reparo, padrão sim). */
export function autoRepairTick(g: Game) {
  const f = forgeOf(g);
  if (!f || levelOf(f) < 2 || g.state.flags.autoRepair === false || g.state.sceneInfo) return;
  repairAll(g, WEAR.autoBelow);
}

export function setAutoRepair(g: Game, on: boolean) {
  g.state.flags.autoRepair = on;
  const n = on ? repairAll(g, WEAR.autoBelow) : 0;
  g.toast(on ? `{anvil} Auto-reparo ligado${n ? `: ${n} peça(s) consertada(s)` : ''}.` : '{anvil} Auto-reparo desligado.', 'info');
}

// ------------------------------------------------------------------ peças gastas guardadas
/** Guarda uma peça gasta tirada de um ninja. */
export function storeWorn(g: Game, id: string, dura: number) {
  ((g.state.worn ??= {})[id] ??= []).push(dura);
}
/** Tira do estoque de gastas a melhor peça desse item (a durabilidade dela), ou null. */
export function takeWorn(g: Game, id: string): number | null {
  const list = g.state.worn?.[id];
  if (!list?.length) return null;
  list.sort((a, b) => a - b);
  const d = list.pop()!;
  if (!list.length) delete g.state.worn![id];
  return d;
}

// ------------------------------------------------------------------ consumo da semana
/** Conta um consumível gasto hoje. */
export function noteUse(s: GameState, id: string, n = 1) {
  const u = (s.usage ??= { day: s.day, days: [{}] });
  if (s.day > u.day) {
    for (let i = 0; i < Math.min(7, s.day - u.day); i++) u.days.unshift({});
    u.days.length = Math.min(u.days.length, 7);
    u.day = s.day;
  }
  u.days[0]![id] = (u.days[0]![id] ?? 0) + n;
}

/** Quantos desse consumível foram gastos nos últimos 7 dias. */
export function weekUse(s: GameState, id: string) {
  const u = s.usage;
  if (!u) return 0;
  const off = Math.max(0, s.day - u.day);
  let n = 0;
  u.days.forEach((d, i) => {
    if (i + off < 7) n += d[id] ?? 0;
  });
  return n;
}
