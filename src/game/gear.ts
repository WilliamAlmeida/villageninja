// Equipamento dos ninjas (arma, colete, consumível) e fabricação nas oficinas.
import { BUILDINGS, type BuildingType } from '../data/buildings';
import { ITEM_LIST, ITEMS, MAX_QUEUE, type ItemDef, type ItemSlot } from '../data/items';
import { levelDef } from '../data/villageLevels';
import { refreshDerived } from './entities';
import { fx, fxText } from './fx';
import type { Game } from './game';
import type { Unit } from './types';
export { gearBonus } from './gearBonus';

type Result = { ok: true } | { ok: false; error: string };
const ok: Result = { ok: true };
const fail = (error: string): Result => ({ ok: false, error });

export const stock = (g: Game, id: string) => g.state.items[id] ?? 0;
const take = (g: Game, id: string) => {
  if (stock(g, id) <= 0) return false;
  g.state.items[id] = stock(g, id) - 1;
  return true;
};
const put = (g: Game, id: string) => (g.state.items[id] = stock(g, id) + 1);

function ownNinja(g: Game, unitId: number) {
  const u = g.unit(unitId);
  return u && !u.dead && u.kind === 'ninja' && u.faction === 'village' && u.ninja ? u : null;
}

/** Equipa um item do estoque (o anterior volta para o estoque). */
export function equip(g: Game, unitId: number, itemId: string): Result {
  const u = ownNinja(g, unitId);
  const def = ITEMS[itemId];
  if (!u || !def) return fail('Inválido.');
  if (!take(g, itemId)) return fail('Sem esse item no estoque.');
  unequip(g, unitId, def.slot);
  const e = u.ninja!.equip;
  if (def.slot === 'item') {
    e.item = itemId;
    e.itemReady = true;
  } else e[def.slot] = itemId;
  refreshDerived(u);
  return ok;
}

export function unequip(g: Game, unitId: number, slot: ItemSlot): Result {
  const u = ownNinja(g, unitId);
  if (!u) return fail('Inválido.');
  const e = u.ninja!.equip;
  if (slot === 'item') {
    if (e.item && e.itemReady) put(g, e.item);
    e.item = null;
    e.itemReady = false;
  } else {
    if (e[slot]) put(g, e[slot]!);
    e[slot] = null;
  }
  refreshDerived(u);
  return ok;
}

const score = (d: ItemDef) => (d.bonus ? (d.bonus.melee ?? 0) + (d.bonus.kunai ?? 0) * 0.5 + (d.bonus.defense ?? 0) * 60 + (d.bonus.hp ?? 0) * 0.2 : 0);

/** Equipa a melhor arma e colete disponíveis (e um consumível, se houver). */
export function autoEquip(g: Game, unitIds: number[]): Result {
  let changed = 0;
  for (const id of unitIds) {
    const u = ownNinja(g, id);
    if (!u) continue;
    const e = u.ninja!.equip;
    for (const slot of ['weapon', 'armor'] as const) {
      const cur = e[slot] ? score(ITEMS[e[slot]!]!) : -1;
      const best = ITEM_LIST.filter((d) => d.slot === slot && stock(g, d.id) > 0).sort((a, b) => score(b) - score(a))[0];
      if (best && score(best) > cur && equip(g, id, best.id).ok) changed++;
    }
    if (!e.item) {
      const pref = ['soldierpill', 'bombtag', 'chakrapill'].find((i) => stock(g, i) > 0);
      if (pref && equip(g, id, pref).ok) changed++;
    }
  }
  return changed ? ok : fail('Nada melhor no estoque.');
}

/**
 * Distribui o estoque para todos os ninjas da vila: os mais fortes escolhem primeiro (ficam com as melhores peças).
 * Retorna quantas trocas fez.
 */
export function autoEquipAll(g: Game): number {
  const ninjas = g.state.units
    .filter((u) => !u.dead && u.kind === 'ninja' && u.faction === 'village' && u.ninja && u.away == null)
    .sort((a, b) => b.ninja!.level - a.ninja!.level || rankN(b) - rankN(a));
  let changed = 0;
  for (const u of ninjas) {
    const before = JSON.stringify(u.ninja!.equip);
    autoEquip(g, [u.id]);
    if (JSON.stringify(u.ninja!.equip) !== before) changed++;
  }
  return changed;
}
const rankN = (u: Unit) => ['genin', 'chunin', 'jounin', 'kage'].indexOf(u.ninja!.rank);

/** Liga/desliga a distribuição automática (e já distribui ao ligar). */
export function setAutoGear(g: Game, on: boolean) {
  g.state.flags.autoGear = on;
  const n = on ? autoEquipAll(g) : 0;
  g.toast(on ? `{gear} Equipamento automático ligado${n ? `: ${n} ninja(s) equipado(s)` : ''}.` : '{gear} Equipamento automático desligado.', 'info');
}

/** Ninja dentro da vila pega outro consumível do mesmo tipo no estoque. */
export function refillItem(g: Game, u: Unit) {
  const e = u.ninja?.equip;
  if (!e || !e.item || e.itemReady) return;
  if (take(g, e.item)) e.itemReady = true;
}

/** Consome o item carregado. A lógica de quando usar fica na IA de combate. */
export function consumeItem(g: Game, u: Unit): ItemDef | null {
  const e = u.ninja?.equip;
  if (!e?.item || !e.itemReady) return null;
  const def = ITEMS[e.item]!;
  e.itemReady = false;
  fxText(g, u.x, u.y - 30, `${def.icon} ${def.name}!`, '#ffe08a', true);
  return def;
}

// ------------------------------------------------------------------ oficinas
export const recipesOf = (type: BuildingType) => ITEM_LIST.filter((d) => d.building === type);
export const isWorkshop = (type: BuildingType) => ITEM_LIST.some((d) => d.building === type);

export function enqueueCraft(g: Game, buildingId: number, itemId: string): Result {
  const b = g.building(buildingId);
  const def = ITEMS[itemId];
  if (!b || !def || def.building !== b.type) return fail('Inválido.');
  if (!b.built) return fail('A oficina ainda está em construção.');
  if ((def.minLevel ?? 0) > g.state.level) return fail(`Requer nível ${levelDef(def.minLevel!).name}.`);
  const q = (b.queue ??= []);
  if (q.length + (b.craft ? 1 : 0) >= MAX_QUEUE) return fail(`Fila cheia (máx. ${MAX_QUEUE}).`);
  if (!g.pay(def.cost)) return fail('Recursos insuficientes.');
  q.push(itemId);
  return ok;
}

/** Cancela o último pedido (da fila; se vazia, o que está em produção) e devolve os recursos. */
export function cancelCraft(g: Game, buildingId: number): Result {
  const b = g.building(buildingId);
  if (!b) return fail('Inválido.');
  let id: string | undefined;
  if (b.queue?.length) id = b.queue.pop();
  else if (b.craft) {
    id = b.craft.itemId;
    b.craft = null;
  }
  if (!id) return fail('Fila vazia.');
  g.give(ITEMS[id]!.cost);
  return ok;
}

/** Avança a fabricação (chamado quando o artesão está trabalhando). */
export function advanceCraft(g: Game, buildingId: number, dt: number): boolean {
  const b = g.building(buildingId);
  if (!b) return false;
  if (!b.craft && b.queue?.length) b.craft = { itemId: b.queue.shift()!, progress: 0 };
  if (!b.craft) return false;
  const def = ITEMS[b.craft.itemId]!;
  b.craft.progress += dt;
  if (b.craft.progress >= def.craftTime) {
    put(g, def.id);
    b.craft = null;
    const d = BUILDINGS[b.type];
    const x = (b.tx + d.w / 2) * 32;
    const y = b.ty * 32;
    fx(g, 'ring', x, y + 20, { r: 20, color: '#ffd34d', life: 0.5 });
    fxText(g, x, y, `${def.icon} ${def.name}`, '#ffe08a', true);
  }
  return true;
}
