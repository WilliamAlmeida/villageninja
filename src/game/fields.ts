// Campos cercados (substituem a Fazenda e a Horta de Ervas, save v49): o jogador pinta canteiros tile a tile, em
// formato livre (modo "Cercar campo" da construção, rascunho que só vale no "Pronto", como as ruas). Canteiros
// vizinhos formam um cercado, com uma cultura só (data/crops.ts). Cada canteiro passa por terra crua → arada →
// plantada (cresce por dias de jogo, conforme a estação e a água) → madura; os fazendeiros do cercado fazem o
// trabalho canteiro a canteiro (arar, semear, regar, colher). Teto total de canteiros por nível da vila.
import { DAY_LENGTH } from '../config';
import { CROP_LIST, CROPS, type CropId, FIELD } from '../data/crops';
import { SEASON_DAYS, SEASON_ORDER, WEATHERS } from '../data/seasons';
import { costLabel } from '../data/resources';
import { fx, fxText } from './fx';
import type { Game } from './game';
import { daysToNextSeason, isSnowing, localWeather, seasonOf } from './mood';
import type { Cost, Field, GameState, Plot, Unit } from './types';
import { inTerritory } from './village';
import { idx, inBounds, T, tileCenter } from './world';
import { levelDef } from '../data/villageLevels';

type Result = { ok: true } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });

const fieldsOf = (s: GameState) => (s.fields ??= []);
export const fieldById = (s: GameState, id: number | null | undefined) => (id == null ? undefined : fieldsOf(s).find((f) => f.id === id));
export const plotCount = (s: GameState) => fieldsOf(s).reduce((n, f) => n + f.plots.length, 0);

/** Teto total de canteiros (nível da vila; colônia tem o dela). */
export const plotCap = (s: GameState) => (s.colony ? FIELD.colonyPlots : FIELD.maxPlots[Math.max(0, Math.min(3, s.level))]!);

/** Campo e canteiro no tile (ou null). */
export function plotAt(g: Game, tx: number, ty: number): { field: Field; plot: Plot } | null {
  if (!inBounds(g.state, tx, ty)) return null;
  const field = fieldById(g.state, g.world.fieldTile[idx(g.state, tx, ty)]);
  const plot = field?.plots.find((p) => p.tx === tx && p.ty === ty);
  return field && plot ? { field, plot } : null;
}

/** Canteiro com água vizinha (rio, lago, mar): sempre úmido, e é onde o arroz cresce. */
export function isPaddy(s: GameState, tx: number, ty: number) {
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && inBounds(s, tx + dx, ty + dy) && s.tiles[idx(s, tx + dx, ty + dy)] === T.WATER) return true;
  return false;
}

/** Custo da cerca de `n` canteiros. */
export const fieldCost = (n: number): Cost => ({ wood: FIELD.cost.wood * n });

// ------------------------------------------------------------------ pintar (rascunho, como as ruas)
/** Rascunho do modo "Cercar campo": índice do tile → true (pôr canteiro) / false (tirar). Só vale no "Pronto". */
export type FieldDraft = Map<number, boolean>;

export const draftPlots = (d: FieldDraft) => {
  let n = 0;
  for (const v of d.values()) if (v) n++;
  return n;
};

/** Há canteiro no tile, contando o rascunho? */
export const plotWith = (g: Game, d: FieldDraft | null, tx: number, ty: number) =>
  (d && inBounds(g.state, tx, ty) ? d.get(idx(g.state, tx, ty)) : undefined) ?? !!plotAt(g, tx, ty);

/** Por que não dá para pôr um canteiro aqui (ou null). `pending` = canteiros já no rascunho e ainda não pagos. */
export function plotBlock(g: Game, tx: number, ty: number, pending = 0): string | null {
  const s = g.state;
  if (!inBounds(s, tx, ty) || tx < 1 || ty < 1 || tx >= s.mapW - 1 || ty >= s.mapH - 1) return 'Fora do mapa.';
  if (plotAt(g, tx, ty)) return 'Já é canteiro.';
  const t = s.tiles[idx(s, tx, ty)];
  if (t === T.WATER || t === T.ROCK) return 'Não dá para plantar na água ou na rocha.';
  if (g.world.buildingIdAt(tx, ty)) return 'Tem um prédio aqui.';
  if (s.nodes.some((n) => n.tx === tx && n.ty === ty && (n.type === 'rock' || n.type === 'ore') && n.amount > 0 && !n.cleared)) return 'Tem uma rocha aqui: limpe a área antes.';
  if (!s.colony && !inTerritory(s, tx, ty, 1, 1)) return 'Fora do território da vila.';
  if (plotCount(s) + pending + 1 > plotCap(s))
    return s.colony
      ? `Limite de ${plotCap(s)} canteiros na colônia.`
      : `Limite de ${plotCap(s)} canteiros no nível ${levelDef(s.level).name}${s.level < 3 ? ': suba a vila de nível' : ''}.`;
  if (!g.canAfford(fieldCost(pending + 1))) return 'Falta madeira para a cerca.';
  return null;
}

/** Pinta um tile no rascunho. Devolve o motivo se não deu (null = mudou ou já estava assim). */
export function draftField(g: Game, d: FieldDraft, tx: number, ty: number, on: boolean): string | null {
  const s = g.state;
  if (!inBounds(s, tx, ty)) return null;
  const i = idx(s, tx, ty);
  const has = !!plotAt(g, tx, ty);
  if (!on) {
    if (d.get(i)) d.delete(i);
    else if (has) d.set(i, false);
    return null;
  }
  if (d.get(i) === false) {
    d.delete(i);
    return null;
  }
  if (d.has(i) || has) return null;
  const why = plotBlock(g, tx, ty, draftPlots(d));
  if (!why) d.set(i, true);
  return why;
}

/** "Pronto": paga a cerca, põe e tira canteiros e refaz os cercados (vizinhos se juntam). Devolve quantos mudaram. */
export function commitFields(g: Game, d: FieldDraft): number {
  const s = g.state;
  let n = 0;
  const add: [number, number][] = [];
  const del = new Set<number>();
  for (const [i, on] of d) {
    const tx = i % s.mapW;
    const ty = Math.floor(i / s.mapW);
    if (on) add.push([tx, ty]);
    else del.add(i);
  }
  d.clear();
  // tirar primeiro (libera teto e lugar)
  if (del.size) {
    for (const f of fieldsOf(s)) f.plots = f.plots.filter((p) => !del.has(idx(s, p.tx, p.ty)));
    n += del.size;
  }
  const fresh: Plot[] = [];
  for (const [tx, ty] of add) {
    if (plotBlock(g, tx, ty, fresh.length)) continue;
    fresh.push({ tx, ty, st: 0, g: 0, fert: 1 });
  }
  if (fresh.length) {
    g.pay(fieldCost(fresh.length));
    clearUnder(g, fresh);
    n += fresh.length;
  }
  regroup(g, fresh);
  g.world.rebuild();
  return n;
}

/** Árvore no canteiro vira madeira (como ao construir); toco e rocha esgotada saem; a rua embaixo sai. */
function clearUnder(g: Game, plots: Plot[]) {
  const s = g.state;
  const at = new Set(plots.map((p) => idx(s, p.tx, p.ty)));
  let wood = 0;
  for (const n of [...s.nodes]) {
    if (!at.has(idx(s, n.tx, n.ty))) continue;
    if (n.type === 'tree') wood += n.amount > 0 ? 3 : 0;
    g.removeNode(n.id);
  }
  s.res.wood += wood;
  for (const i of at) if (s.roads) s.roads[i >> 5] = s.roads[i >> 5]! & ~(1 << (i & 31));
}

/**
 * Refaz os cercados pelos canteiros ligados (vizinhança de 4): cada grupo fica com o cercado de onde veio a maioria
 * dos canteiros (cultura, vagas e fazendeiros); um cercado partido ao meio vira dois com a mesma cultura; canteiro
 * novo solto vira um cercado novo de trigo (ou da cultura do vizinho).
 */
export function regroup(g: Game, fresh: Plot[] = []) {
  const s = g.state;
  const owner = new Map<number, Field>();
  const plotOf = new Map<number, Plot>();
  for (const f of fieldsOf(s))
    for (const p of f.plots) {
      owner.set(idx(s, p.tx, p.ty), f);
      plotOf.set(idx(s, p.tx, p.ty), p);
    }
  for (const p of fresh) plotOf.set(idx(s, p.tx, p.ty), p);
  const seen = new Set<number>();
  const used = new Set<number>();
  const next: Field[] = [];
  for (const start of plotOf.keys()) {
    if (seen.has(start)) continue;
    const group: Plot[] = [];
    const stack = [start];
    seen.add(start);
    while (stack.length) {
      const i = stack.pop()!;
      const p = plotOf.get(i)!;
      group.push(p);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const tx = p.tx + dx;
        const ty = p.ty + dy;
        if (!inBounds(s, tx, ty)) continue;
        const j = idx(s, tx, ty);
        if (seen.has(j) || !plotOf.has(j)) continue;
        seen.add(j);
        stack.push(j);
      }
    }
    // o cercado de onde veio a maioria (e ainda não usado por outro pedaço)
    const votes = new Map<Field, number>();
    for (const p of group) {
      const f = owner.get(idx(s, p.tx, p.ty));
      if (f) votes.set(f, (votes.get(f) ?? 0) + 1);
    }
    const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1]).map(([f]) => f);
    const keep = ranked.find((f) => !used.has(f.id));
    const like = ranked[0];
    const f: Field = keep ?? { id: g.newId(), crop: like?.crop ?? 'wheat', plots: [], desired: 0, workers: [] };
    used.add(f.id);
    f.plots = group.sort((a, b) => a.ty - b.ty || a.tx - b.tx);
    f.desired = keep ? Math.min(f.desired, maxWorkers(f)) : suggestedWorkers(f);
    next.push(f);
  }
  s.fields = next;
}

/** Vagas de fazendeiro de um cercado: uma a cada `plotsPerWorker` canteiros (no mínimo uma). */
export const maxWorkers = (f: Field) => Math.max(1, Math.ceil(f.plots.length / FIELD.plotsPerWorker));
const suggestedWorkers = (f: Field) => maxWorkers(f);

/** Cria um cercado pronto (jogo novo, migração, vitrine): sem custo nem teto. */
export function addField(g: Game, tiles: [number, number][], crop: CropId, init?: (p: Plot, i: number) => void): Field {
  const s = g.state;
  const plots: Plot[] = tiles
    .filter(([tx, ty]) => inBounds(s, tx, ty) && s.tiles[idx(s, tx, ty)] !== T.WATER && s.tiles[idx(s, tx, ty)] !== T.ROCK)
    .map(([tx, ty], i) => {
      const p: Plot = { tx, ty, st: 0, g: 0, fert: 1 };
      init?.(p, i);
      return p;
    });
  clearUnder(g, plots);
  const f: Field = { id: g.newId(), crop, plots, desired: 0, workers: [] };
  f.desired = maxWorkers(f);
  fieldsOf(s).push(f);
  g.world.rebuild();
  return f;
}

// ------------------------------------------------------------------ comandos do drawer
/** Por que esta cultura não pode ser a do cercado (ou null). */
export function cropBlock(g: Game, f: Field, crop: CropId): string | null {
  const c = CROPS[crop];
  if ((c.minLevel ?? 0) > g.state.level) return `Requer nível ${levelDef(c.minLevel!).name}.`;
  if (c.paddy && !f.plots.some((p) => isPaddy(g.state, p.tx, p.ty))) return `${c.name} só cresce em canteiro vizinho de água: leve o cercado até a beira do rio ou do lago.`;
  return null;
}

/** Troca a cultura do cercado: vale para o que for semeado daqui em diante (o que já cresce continua). */
export function setFieldCrop(g: Game, id: number, crop: CropId): Result {
  const f = fieldById(g.state, id);
  if (!f) return fail('Campo não encontrado.');
  const why = cropBlock(g, f, crop);
  if (why) return fail(why);
  f.crop = crop;
  return { ok: true };
}

export function setFieldWorkers(g: Game, id: number, delta: number): Result {
  const f = fieldById(g.state, id);
  if (!f) return fail('Campo não encontrado.');
  f.desired = Math.max(0, Math.min(maxWorkers(f), f.desired + delta));
  return { ok: true };
}

/** Desfaz o cercado (a madeira da cerca não volta). */
export function removeField(g: Game, id: number): Result {
  const s = g.state;
  const f = fieldById(s, id);
  if (!f) return fail('Campo não encontrado.');
  s.fields = fieldsOf(s).filter((x) => x !== f);
  for (const u of s.units) if (u.fieldId === id) u.fieldId = undefined;
  g.world.rebuild();
  if (g.selected?.kind === 'field' && g.selected.id === id) g.select(null);
  return { ok: true };
}

// ------------------------------------------------------------------ o trabalho no canteiro
export type PlotWork = 'harvest' | 'sow' | 'till' | 'water';

/** O que o canteiro pede agora (null = nada). */
export function plotNeed(g: Game, f: Field, p: Plot): PlotWork | null {
  if (p.st === 3) return 'harvest';
  if (p.st === 1) return sowCrop(g, f, p) ? 'sow' : null;
  if (p.st === 0) return 'till';
  if (p.st === 2 && !(p.wet && p.wet > 0)) return 'water';
  return null;
}

/** Dá para semear a cultura aqui agora? (arroz só na beira da água; nada que pare na estação nem que a geada mate) */
function sowable(g: Game, crop: CropId, p: Plot) {
  const c = CROPS[crop];
  if ((c.minLevel ?? 0) > g.state.level) return false;
  if (c.paddy && !isPaddy(g.state, p.tx, p.ty)) return false;
  const si = SEASON_ORDER.indexOf(seasonOf(g.state));
  if (!(c.season[si]! > 0)) return false;
  // a geada mata: só planta se der tempo de amadurecer antes do inverno
  return !c.frost || (si < 3 && c.days / c.season[si]! <= daysToNextSeason(g.state) + (2 - si) * SEASON_DAYS);
}

/**
 * O que semear no canteiro (rotação automática): a cultura do cercado; se ela acabou de sair dali (cansaria o solo) ou
 * não dá nesta estação, a outra do mesmo recurso que mais rende agora. Assim o solo descansa sozinho e o cercado não
 * fica parado no inverno. null = nada para semear.
 */
export function sowCrop(g: Game, f: Field, p: Plot): CropId | null {
  if (p.last !== f.crop && sowable(g, f.crop, p)) return f.crop;
  const si = SEASON_ORDER.indexOf(seasonOf(g.state));
  const res = CROPS[f.crop].res;
  let best: CropId | null = null;
  let bv = 0;
  for (const c of CROP_LIST) {
    if (c.id === p.last || c.res !== res || !sowable(g, c.id, p)) continue;
    const v = (c.yield / c.days) * c.season[si]!;
    if (v > bv) {
      best = c.id;
      bv = v;
    }
  }
  // sem outra do mesmo recurso (ervas), repete a do cercado
  return best ?? (sowable(g, f.crop, p) ? f.crop : null);
}

const PRIO: Record<PlotWork, number> = { harvest: 0, sow: 1, till: 2, water: 3 };

/** Próximo canteiro para o fazendeiro: o que mais importa (colher > semear > arar > regar), o mais perto, livre. */
export function nextPlot(g: Game, f: Field, u: Unit): Plot | null {
  const s = g.state;
  const taken = new Set<number>();
  for (const id of f.workers) {
    if (id === u.id) continue;
    const o = g.unit(id);
    if (o && o.taskId != null && (o.state === 'toPlot' || o.state === 'tending')) taken.add(o.taskId);
  }
  let best: Plot | null = null;
  let bp = 9;
  let bd = Infinity;
  for (const p of f.plots) {
    const need = plotNeed(g, f, p);
    if (!need || taken.has(idx(s, p.tx, p.ty))) continue;
    const pr = PRIO[need];
    const d = Math.hypot(tileCenter(p.tx) - u.x, tileCenter(p.ty) - u.y);
    if (pr < bp || (pr === bp && d < bd)) {
      best = p;
      bp = pr;
      bd = d;
    }
  }
  return best;
}

/** Segundos de trabalho do que o canteiro pede. */
export const workTime = (need: PlotWork) => FIELD.work[need];

/** O fazendeiro terminou o trabalho no canteiro: aplica o que ele pedia agora. */
export function workPlot(g: Game, f: Field, p: Plot, u: Unit) {
  const s = g.state;
  const need = plotNeed(g, f, p);
  const x = tileCenter(p.tx);
  const y = tileCenter(p.ty);
  if (need === 'harvest') {
    const c = CROPS[p.crop ?? f.crop];
    const amount = Math.max(1, Math.round(c.yield * WEATHERS[localWeather(s, x, y)].harvest * (0.5 + 0.5 * p.fert)));
    s.res[c.res] += amount;
    // solo: repetir a cultura cansa, trocar descansa
    p.fert = p.last === c.id ? Math.max(0, p.fert - FIELD.fertStep) : Math.min(1, p.fert + FIELD.fertStep);
    p.last = c.id;
    Object.assign(p, { st: 1, crop: undefined, g: 0, ripe: undefined });
    fxText(g, u.x, u.y - 20, `${c.res === 'food' ? '{food}' : '{herbs}'} +${amount}`, '#ffe08a');
    fx(g, 'chips', x, y, { color: c.fruit, life: 0.5 });
  } else if (need === 'sow') {
    Object.assign(p, { st: 2, crop: sowCrop(g, f, p)!, g: 0, ripe: undefined });
  } else if (need === 'till') {
    p.st = 1;
    fx(g, 'chips', x, y, { color: '#8a6a3a', life: 0.4 });
  } else if (need === 'water') {
    p.wet = FIELD.wetDays * DAY_LENGTH;
    fx(g, 'chips', x, y, { color: '#8fc8f0', life: 0.4 });
  }
}

// ------------------------------------------------------------------ crescer (sistema)
const acc = new WeakMap<GameState, number>();

/** Crescimento, umidade, murcha e geada. Roda a cada segundo de jogo. */
export function cropTick(g: Game, dt: number) {
  const s = g.state;
  if (!s.fields?.length) return;
  const a = (acc.get(s) ?? 0) + dt;
  if (a < 1) {
    acc.set(s, a);
    return;
  }
  acc.set(s, 0);
  const si = SEASON_ORDER.indexOf(seasonOf(s));
  const snow = si === 3 && isSnowing(s);
  for (const f of s.fields) {
    let withered = 0;
    let frozen = 0;
    for (const p of f.plots) {
      const x = tileCenter(p.tx);
      const y = tileCenter(p.ty);
      const w = localWeather(s, x, y);
      if (isPaddy(s, p.tx, p.ty) || w === 'rain' || w === 'storm') p.wet = FIELD.wetDays * DAY_LENGTH;
      else if (p.wet) p.wet = Math.max(0, p.wet - a);
      if (p.st === 2) {
        const c = CROPS[p.crop ?? f.crop];
        if (c.frost && snow) {
          Object.assign(p, { st: 1, crop: undefined, g: 0 });
          frozen++;
          continue;
        }
        const water = p.wet && p.wet > 0 ? 1 : FIELD.dryGrowth;
        const paddy = c.paddy && !isPaddy(s, p.tx, p.ty) ? 0 : 1;
        p.g += (a / (c.days * DAY_LENGTH)) * c.season[si]! * water * paddy;
        if (p.g >= 1) Object.assign(p, { st: 3, g: 1, ripe: 0 });
      } else if (p.st === 3) {
        p.ripe = (p.ripe ?? 0) + a;
        if (p.ripe > FIELD.witherDays * DAY_LENGTH) {
          Object.assign(p, { st: 1, crop: undefined, g: 0, ripe: undefined });
          withered++;
        }
      }
    }
    const at = f.plots[0] ? { x: tileCenter(f.plots[0].tx), y: tileCenter(f.plots[0].ty) } : undefined;
    if (withered) g.toast(`{alert} ${withered} canteiro(s) de ${CROPS[f.crop].name.toLowerCase()} murcharam no pé: faltou gente para colher.`, 'warn', at);
    if (frozen) g.toast(`{snow} A geada matou ${frozen} canteiro(s) de abóbora.`, 'warn', at);
  }
}

// ------------------------------------------------------------------ resumo para a interface e as colônias
export function fieldStats(g: Game, f: Field) {
  let raw = 0;
  let tilled = 0;
  let growing = 0;
  let ripe = 0;
  let dry = 0;
  let fert = 0;
  let soonest = Infinity;
  const si = SEASON_ORDER.indexOf(seasonOf(g.state));
  for (const p of f.plots) {
    fert += p.fert;
    if (p.st === 0) raw++;
    else if (p.st === 1) tilled++;
    else if (p.st === 3) ripe++;
    else {
      growing++;
      if (!(p.wet && p.wet > 0)) dry++;
      const c = CROPS[p.crop ?? f.crop];
      const rate = c.season[si]! * (p.wet && p.wet > 0 ? 1 : FIELD.dryGrowth);
      if (rate > 0) soonest = Math.min(soonest, ((1 - p.g) * c.days) / rate);
    }
  }
  return { raw, tilled, growing, ripe, dry, fert: f.plots.length ? fert / f.plots.length : 1, nextDays: soonest, paddy: f.plots.filter((p) => isPaddy(g.state, p.tx, p.ty)).length };
}

/** Rende por dia (fórmula fechada, para o resumo da colônia fora da tela): cada canteiro cuidado dá a cultura/dias. */
export function fieldDailyYield(g: Game, f: Field, farmers: number): Cost {
  const c = CROPS[f.crop];
  const si = SEASON_ORDER.indexOf(seasonOf(g.state));
  const tended = Math.min(f.plots.length, farmers * FIELD.plotsPerWorker);
  const n = c.paddy ? Math.min(tended, f.plots.filter((p) => isPaddy(g.state, p.tx, p.ty)).length) : tended;
  const v = Math.round(((n * c.yield) / c.days) * c.season[si]!);
  return v > 0 ? { [c.res]: v } : {};
}

/** Descrição curta de quanto custa a cerca de `n` canteiros (barra de pintar). */
export const fieldCostLabel = (n: number) => costLabel(fieldCost(n));
