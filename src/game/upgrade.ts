// Nível dos prédios: consultas usadas pelos sistemas e o comando de upgrade.
import { MAX_QUEUE } from '../data/items';
import { defOf } from '../data/buildings';
import { levelStep, MAX_BUILDING_LEVEL, UPGRADES } from '../data/upgrades';
import { levelDef } from '../data/villageLevels';
import { fx, fxText } from './fx';
import type { Game } from './game';
import type { Building, Cost } from './types';
import { buildingCenter, doorPos, isShore } from './world';
import { inTerritory } from './village';
import { clearRoadsUnder } from './roads';

type Result = { ok: true } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });

export const levelOf = (b: Building) => b.level ?? 1;

/** Moradores que cabem (casas ganham +2 por nível). */
export const housingOf = (b: Building) => {
  const base = defOf(b).housing ?? 0;
  return base && b.type === 'house' ? base + (levelOf(b) - 1) * 2 : base;
};

/** Máximo de trabalhadores (lenhador e pedreira ganham +1 por nível). */
export const workersOf = (b: Building) => {
  const base = defOf(b).workers ?? 0;
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
/** Oficina (Forja, Farmácia, Selos): fabricação mais rápida por nível (1×, 1,4×, 2×) e fila maior (5, 7, 9). */
export const craftMult = (b: Building) => [1, 1.4, 2][Math.min(3, levelOf(b)) - 1]!;
export const queueMax = (b: Building) => MAX_QUEUE + (levelOf(b) - 1) * 2;
/** Campo de treino: o melhor da vila vale para todos (1× → 1,3× → 1,6×). */
export function trainMult(g: Game) {
  let best = 1;
  for (const b of g.state.buildings) if (b.type === 'training' && b.built) best = Math.max(best, levelStep(levelOf(b), 0.3));
  return best;
}

/** Academia: estudo de jutsu 1× → 1,3× → 1,6× (a melhor da vila vale). */
export function academyLearnMult(g: Game) {
  let best = 1;
  for (const b of g.state.buildings) if (b.type === 'academy' && b.built) best = Math.max(best, levelStep(levelOf(b), 0.3));
  return best;
}
/** Nível com que o recruta sai da Academia (1 → 2 → 3). */
export const academyRecruitLevel = (g: Game) => Math.max(1, ...g.builtOf('academy').map(levelOf));

/** Tempo da obra de upgrade para o próximo nível. */
export const upgradeTime = (b: Building) => defOf(b).buildTime * (0.6 + levelOf(b) * 0.5);

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
  const room = growRoom(g, b, lvl + 1);
  if (room) return { cost, reason: room };
  return { cost, reason: null };
}

/**
 * O nível `next` ocupa mais terreno (`BuildingDef.sizes`, ex. a casa nível 3 é 3×3)? Então o terreno novo (o mesmo canto,
 * crescendo para a direita e para baixo) tem que estar livre: devolve o motivo, ou null se cabe (ou não cresce).
 */
export function growRoom(g: Game, b: Building, next: number): string | null {
  const now = defOf(b);
  const grown = defOf({ type: b.type, level: next, flip: b.flip });
  if (grown.w === now.w && grown.h === now.h) return null;
  // direto na grade de ocupação (sem refazer a colisão): o terreno novo e 1 tile de folga só com este prédio ou vazio,
  // sem água/rocha nem recurso de pé, dentro do mapa e do território (as mesmas regras de `World.canPlace`)
  const s = g.state;
  const { tx, ty } = b;
  const shore = isShore({ type: b.type, level: next });
  let fits = tx >= 1 && ty >= 1 && tx + grown.w <= s.mapW - 1 && ty + grown.h <= s.mapH - 2 && inTerritory(s, tx, ty, grown.w, grown.h + 1);
  for (let y = ty - 1; fits && y <= ty + grown.h; y++)
    for (let x = tx - 1; fits && x <= tx + grown.w; x++) {
      const o = g.world.buildingIdAt(x, y);
      if (o && o !== b.id) fits = false;
    }
  if (fits)
    fits = !s.nodes.some((n) => (n.type === 'rock' || n.type === 'ore') && n.amount > 0 && n.tx >= tx && n.tx < tx + grown.w && n.ty >= ty && n.ty < ty + grown.h);
  if (!fits) return `No nível ${next} ocupa ${grown.w}×${grown.h} tiles (cresce para a direita e para baixo): abra espaço em volta ou mova o prédio.`;
  // o chão do terreno novo (água, rocha, porta): o Porto pela regra da margem; os outros, água só sob célula de água
  if (shore && !g.world.shoreFits(b.type, tx, ty, !!b.flip, next))
    return `No nível ${next} ele fica na beira da água (${grown.w}×${grown.h}, cresce para a direita e para baixo): a parte de água do terreno precisa cair em cima de água do mapa. Mova-o para a margem.`;
  const why = shore ? null : g.world.groundBlock(b.type, tx, ty, !!b.flip, next);
  return why ? `No nível ${next} ocupa ${grown.w}×${grown.h} tiles (cresce para a direita e para baixo). ${why} Mova o prédio.` : null;
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

/**
 * A Residência do Hokage não tem upgrade próprio: o nível dela (`Building.level`) acompanha o da vila (Aldeia = 1 …
 * Grande Vila Oculta = 4) e o terreno cresce junto (`sizes`: 3×3, 3×3, 4×4, 5×5, para a direita e para baixo). Sem
 * espaço livre, espera (avisa uma vez) e tenta de novo no próximo passo da automação. A arte segue este nível.
 */
export function syncHokage(g: Game) {
  const hk = g.hokage();
  if (!hk) return;
  while (levelOf(hk) < g.state.level + 1) {
    const next = levelOf(hk) + 1;
    const room = growRoom(g, hk, next);
    if (room) {
      if (!hk.waitRoom) g.toast(`{alert} A Residência quer crescer com a vila, mas falta espaço. ${room}`, 'warn', doorPos(hk));
      hk.waitRoom = true;
      return;
    }
    delete hk.waitRoom;
    growTo(g, hk, next);
  }
}

/** Sobe o prédio para o nível `next`; com terreno maior, tira árvore/rocha e rua de baixo e refaz a colisão. */
function growTo(g: Game, b: Building, next: number) {
  const grew = defOf({ type: b.type, level: next, flip: b.flip }).w !== defOf(b).w;
  b.level = next;
  if (!grew) return;
  const d = defOf(b);
  for (const n of [...g.state.nodes]) if (n.tx >= b.tx && n.tx < b.tx + d.w && n.ty >= b.ty && n.ty < b.ty + d.h) g.removeNode(n.id);
  clearRoadsUnder(g.state, b.tx, b.ty, d.w, d.h, !!d.walkable);
  g.world.rebuild();
}

/** Um construtor trabalhou `dt` segundos no upgrade. */
export function workUpgrade(g: Game, b: Building, dt: number) {
  if (b.upgrade == null) return;
  b.upgrade += dt;
  if (b.upgrade < upgradeTime(b)) return;
  // nível com terreno maior: espera o espaço (alguém pode ter construído colado durante a obra)
  const room = growRoom(g, b, levelOf(b) + 1);
  if (room) {
    b.upgrade = upgradeTime(b);
    if (!b.waitRoom) g.toast(`{alert} ${defOf(b).name}: a obra terminou, mas falta espaço. ${room}`, 'warn', doorPos(b));
    b.waitRoom = true;
    return;
  }
  delete b.waitRoom;
  b.upgrade = null;
  growTo(g, b, levelOf(b) + 1); // o terreno novo: árvore/rocha embaixo sai, a rua embaixo sai, a colisão se refaz
  const def = defOf(b);
  const c = buildingCenter(b);
  fxText(g, c.x, c.y - 40, `${def.name} nível ${b.level}!`, '#ffd34d', true);
  g.toast(`${def.icon} ${def.name} subiu para o nível ${b.level}: ${UPGRADES[b.type]!.perks[levelOf(b) - 1]}.`, 'good', doorPos(b));
}
