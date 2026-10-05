// Prédios repetíveis com papel próprio: Campos de Treino têm vagas e um foco; cada Mercado vende um excedente.
import { STAT_KEYS, type StatKey } from '../data/ninja';
import { MARKET_GOODS, TRAIN_SLOTS, type MarketGood } from '../data/specialize';
import type { Game } from './game';
import type { Building, Unit } from './types';
import { levelOf } from './upgrade';
import { doorPos } from './world';

type Result = { ok: true } | { ok: false; error: string };

// ------------------------------------------------------------------ Campo de Treino: vagas e foco
export const trainSlots = (b: Building) => TRAIN_SLOTS[Math.min(TRAIN_SLOTS.length, levelOf(b)) - 1]!;

/** Ninjas indo treinar ou treinando neste campo agora. */
export const trainees = (g: Game, b: Building) =>
  g.state.units.filter((u) => !u.dead && u.trainId === b.id && (u.state === 'toTrain' || u.state === 'train')).length;

export const hasSlot = (g: Game, b: Building) => b.built && trainees(g, b) < trainSlots(b);

/** Campo com vaga para este ninja: primeiro os do foco dele, depois o mais perto. Null = todos cheios. */
export function pickField(g: Game, u: Unit): Building | null {
  const free = g.builtOf('training').filter((b) => hasSlot(g, b));
  if (!free.length) return null;
  const focus = u.ninja?.focus;
  const d = (b: Building) => {
    const p = doorPos(b);
    return Math.hypot(p.x - u.x, p.y - u.y);
  };
  return free.sort((a, b) => Number(b.focus === focus && !!focus) - Number(a.focus === focus && !!focus) || d(a) - d(b))[0]!;
}

export function setFieldFocus(g: Game, id: number, focus: StatKey | null): Result {
  const b = g.building(id);
  if (!b || b.type !== 'training') return { ok: false, error: 'Não é um Campo de Treino.' };
  if (focus && !STAT_KEYS.includes(focus)) return { ok: false, error: 'Atributo inválido.' };
  b.focus = focus;
  return { ok: true };
}

// ------------------------------------------------------------------ Mercado: o que vende
export function setMarketGood(g: Game, id: number, good: MarketGood | null): Result {
  const b = g.building(id);
  if (!b || b.type !== 'market') return { ok: false, error: 'Não é um Mercado.' };
  if (good && !MARKET_GOODS[good]) return { ok: false, error: 'Mercadoria inválida.' };
  b.sells = good;
  return { ok: true };
}

/** Quanto este mercado vende por vez (unidades) e quanto rende. */
export function marketLot(b: Building) {
  if (!b.sells) return null;
  const def = MARKET_GOODS[b.sells];
  const lot = def.lot * levelOf(b);
  return { lot, ryo: Math.round(lot * def.price), keep: def.keep };
}

/** Uma venda do comerciante: só o que passa da reserva. Retorna o ryo ganho (0 se não havia excedente). */
export function marketSale(g: Game, b: Building): number {
  const m = marketLot(b);
  if (!m || !b.sells) return 0;
  const extra = Math.floor(g.state.res[b.sells] - m.keep);
  if (extra <= 0) return 0;
  const n = Math.min(m.lot, extra);
  g.state.res[b.sells] -= n;
  const ryo = Math.round(n * MARKET_GOODS[b.sells].price);
  g.state.res.ryo += ryo;
  return ryo;
}
