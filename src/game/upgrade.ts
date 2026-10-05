// Nível dos prédios: consultas usadas pelos sistemas e o comando de upgrade.
import { BUILDINGS } from '../data/buildings';
import { levelStep, MAX_BUILDING_LEVEL, UPGRADES } from '../data/upgrades';
import { levelDef } from '../data/villageLevels';
import { fx, fxText } from './fx';
import type { Game } from './game';
import type { Building, Cost } from './types';
import { buildingCenter, doorPos } from './world';

type Result = { ok: true } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });

export const levelOf = (b: Building) => b.level ?? 1;

/** Moradores que cabem (casas ganham +2 por nível). */
export const housingOf = (b: Building) => {
  const base = BUILDINGS[b.type].housing ?? 0;
  return base && b.type === 'house' ? base + (levelOf(b) - 1) * 2 : base;
};

/** Máximo de trabalhadores (lenhador e pedreira ganham +1 por nível). */
export const workersOf = (b: Building) => {
  const base = BUILDINGS[b.type].workers ?? 0;
  return base && (b.type === 'lumber' || b.type === 'quarry') ? base + levelOf(b) - 1 : base;
};

/** Comida por colheita da fazenda (2 → 3 → 4). */
export const farmYield = (b: Building | undefined) => (b ? 1 + levelOf(b) : 2);
/** Ryo por venda do mercado (3 → 5 → 7). */
export const marketYield = (b: Building | undefined) => (b ? 1 + levelOf(b) * 2 : 3);
/** Torre: dano +3 e alcance +15% por nível. */
export const towerDamage = (b: Building, base: number) => base + (b.type === 'tower' ? (levelOf(b) - 1) * 3 : 0);
export const towerRange = (b: Building, base: number) => base * (b.type === 'tower' ? levelStep(levelOf(b), 0.15) : 1);
/** Hospital: cura 1× → 1,5× → 2×. */
export const healMult = (b: Building) => (b.type === 'hospital' ? levelStep(levelOf(b), 0.5) : 1);
/** Campo de treino: o melhor da vila vale para todos (1× → 1,3× → 1,6×). */
export function trainMult(g: Game) {
  let best = 1;
  for (const b of g.state.buildings) if (b.type === 'training' && b.built) best = Math.max(best, levelStep(levelOf(b), 0.3));
  return best;
}

/** Tempo da obra de upgrade para o próximo nível. */
export const upgradeTime = (b: Building) => BUILDINGS[b.type].buildTime * (0.6 + levelOf(b) * 0.5);

/** Precisa de construtores: obra nova ou upgrade em andamento. */
export const needsBuilders = (b: Building) => !b.built || b.upgrade != null;

/** Pode subir de nível agora? Devolve o custo e o motivo quando não pode. */
export function upgradeStatus(g: Game, b: Building): { cost: Cost | null; reason: string | null } {
  const def = UPGRADES[b.type];
  if (!def) return { cost: null, reason: 'Este prédio não tem upgrade.' };
  const lvl = levelOf(b);
  if (lvl >= MAX_BUILDING_LEVEL) return { cost: null, reason: 'Nível máximo.' };
  const cost = def.costs[lvl - 1]!;
  if (!b.built) return { cost, reason: 'Termine a construção primeiro.' };
  if (b.upgrade != null) return { cost, reason: 'Upgrade em andamento.' };
  const minV = def.minVillage[lvl - 1]!;
  if (g.state.level < minV) return { cost, reason: `Requer ${levelDef(minV).name}.` };
  if (!g.canAfford(cost)) return { cost, reason: 'Recursos insuficientes.' };
  return { cost, reason: null };
}

/** Começa o upgrade: paga e abre a obra (os moradores vêm trabalhar; o prédio continua funcionando). */
export function startUpgrade(g: Game, id: number): Result {
  const b = g.building(id);
  if (!b) return fail('Prédio não encontrado.');
  const st = upgradeStatus(g, b);
  if (st.reason) return fail(st.reason);
  g.pay(st.cost!);
  b.upgrade = 0;
  g.state.timers.jobs = 0; // reavalia construtores já
  const p = doorPos(b);
  fx(g, 'smoke', p.x, p.y - 16, { r: 20, life: 0.6, color: '#d8c8a8' });
  return { ok: true };
}

/** Um construtor trabalhou `dt` segundos no upgrade. */
export function workUpgrade(g: Game, b: Building, dt: number) {
  if (b.upgrade == null) return;
  b.upgrade += dt;
  if (b.upgrade < upgradeTime(b)) return;
  b.level = levelOf(b) + 1;
  b.upgrade = null;
  const def = BUILDINGS[b.type];
  const c = buildingCenter(b);
  fxText(g, c.x, c.y - 40, `${def.name} nível ${b.level}!`, '#ffd34d', true);
  g.toast(`${def.icon} ${def.name} subiu para o nível ${b.level}: ${UPGRADES[b.type]!.perks[b.level - 1]}.`, 'good', doorPos(b));
}
