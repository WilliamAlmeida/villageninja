// Níveis da vila: território, requisitos e evolução (marco do sandbox).
import { TILE } from '../config';
import { BUILDINGS } from '../data/buildings';
import { RANK_ORDER, RANKS } from '../data/ninja';
import { levelDef, MAX_VILLAGE_LEVEL, type LevelReq } from '../data/villageLevels';
import { fx, fxText } from './fx';
import type { Game } from './game';
import type { GameState } from './types';
import { buildingCenter } from './world';

type Result = { ok: true } | { ok: false; error: string };

/** Centro do território (centro da Residência do Hokage), em tiles. */
export function territoryCenter(s: GameState) {
  const hk = s.buildings.find((b) => b.type === 'hokage');
  if (!hk) return null;
  const c = buildingCenter(hk);
  return { tx: c.x / TILE, ty: c.y / TILE };
}

export const territoryRadius = (s: GameState) => levelDef(s.level).territory;

/** Todo o retângulo (em tiles) cabe dentro do território? */
export function inTerritory(s: GameState, tx: number, ty: number, w: number, h: number): boolean {
  const c = territoryCenter(s);
  if (!c) return true;
  const r = territoryRadius(s);
  for (const [x, y] of [[tx, ty], [tx + w, ty], [tx, ty + h], [tx + w, ty + h]] as const)
    if (Math.hypot(x - c.tx, y - c.ty) > r) return false;
  return true;
}

export interface ReqCheck {
  label: string;
  have: number;
  need: number;
  ok: boolean;
}

/** Lista de requisitos com o progresso atual (para a UI e para validar). */
export function checkRequirements(g: Game, req: LevelReq): ReqCheck[] {
  const s = g.state;
  const out: ReqCheck[] = [];
  const add = (label: string, have: number, need: number) => out.push({ label, have, need, ok: have >= need });
  const ninjas = s.units.filter((u) => !u.dead && u.kind === 'ninja' && u.faction === 'village');
  if (req.population) add('População', g.population(), req.population);
  if (req.ninjas) add('Ninjas', ninjas.length, req.ninjas);
  if (req.ranked) {
    const min = RANK_ORDER.indexOf(req.ranked.rank);
    add(`${RANKS[req.ranked.rank].name} ou superior`, ninjas.filter((u) => RANK_ORDER.indexOf(u.ninja!.rank) >= min).length, req.ranked.count);
  }
  for (const [type, n] of Object.entries(req.buildings ?? {}) as [keyof typeof BUILDINGS, number][])
    add(BUILDINGS[type].name, s.buildings.filter((b) => b.type === type && b.built).length, n);
  if (req.raidsRepelled) add('Invasões repelidas', s.stats.raidsRepelled, req.raidsRepelled);
  if (req.missionsDone) add('Missões cumpridas', s.stats.missionsDone, req.missionsDone);
  if (req.clans) add('Clãs fundados', s.clans.length, req.clans);
  if (req.kage) add('Kage eleito', g.unit(s.kageId) && !g.unit(s.kageId)!.dead ? 1 : 0, 1);
  return out;
}

export function nextLevelStatus(g: Game) {
  if (g.state.level >= MAX_VILLAGE_LEVEL) return null;
  const def = levelDef(g.state.level + 1);
  const checks = checkRequirements(g, def.req);
  return { def, checks, ready: checks.every((c) => c.ok), afford: g.canAfford(def.cost) };
}

export function upgradeVillage(g: Game): Result {
  const st = nextLevelStatus(g);
  if (!st) return { ok: false, error: 'A vila já está no nível máximo.' };
  const missing = st.checks.find((c) => !c.ok);
  if (missing) return { ok: false, error: `Falta: ${missing.label} (${missing.have}/${missing.need}).` };
  if (!g.pay(st.def.cost)) return { ok: false, error: 'Recursos insuficientes.' };
  g.state.level = st.def.level;
  g.world.rebuild();
  const hk = g.hokage();
  if (hk) {
    const c = buildingCenter(hk);
    for (let i = 0; i < 3; i++) fx(g, 'ring', c.x, c.y, { r: 60 + i * 40, color: '#ffd34d', life: 0.8 + i * 0.3 });
    fxText(g, c.x, c.y - 50, `${st.def.icon} ${st.def.name}!`, '#ffd34d', true);
  }
  g.toast(`{party} Agora somos uma ${st.def.name}! ${st.def.perks.join(' · ')}`, 'good');
  return { ok: true };
}
