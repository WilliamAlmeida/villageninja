// Os Espadachins da Névoa (data/swordsmen.ts): invasões de tempos em tempos com dois espadachins (dos que ainda têm a
// espada) e uma escolta de renegados. O primeiro espadachim derrubado na invasão cai de vez e a espada dele fica com a
// vila; os outros, derrubados, somem na névoa e voltam numa próxima. Tomadas as sete, continuam vindo atrás delas (o
// primeiro derrubado cai e dá ryo). Só começam depois da primeira invasão do Quinteto do Som (ordem da história).
import { rand, randi } from '../core/rng';
import { bladeItem, BLADES, MIST_BLADES, type MistBlade } from '../data/blades';
import { STAT_KEYS } from '../data/ninja';
import { costLabel } from '../data/resources';
import { SWORDSMEN, SWORDSMEN_ORG } from '../data/swordsmen';
import { grantBlade } from './blades';
import { createRogue, refreshDerived } from './entities';
import { fx, fxText } from './fx';
import type { Game } from './game';
import { setDestination } from './movement';
import { edgePoint } from './systems/spawner';
import type { GameState, Unit } from './types';

/** Espadachins que ainda têm a espada (os que podem invadir). */
export const swordsmenLeft = (g: Game) => MIST_BLADES.filter((b) => !g.state.blades.includes(b));
export const swordsmenOnMap = (g: Game) => g.state.units.filter((u) => !u.dead && u.swordsman);

/** Cria o espadachim: renegado forte, com a lâmina dele (efeito e bônus de arma) e a roupa da Névoa. */
export function createSwordsman(g: Game, id: MistBlade, x: number, y: number): Unit {
  const d = SWORDSMEN[id];
  const o = SWORDSMEN_ORG;
  const u = createRogue(g, x, y, g.state.day, { rank: 'jounin', stats: o.stats, hpMult: o.hpMult, jutsu: 2, name: `${d.name}, ${d.title}` });
  u.swordsman = id;
  u.boss = true;
  const n = u.ninja!;
  n.nature = d.nature;
  n.level = 25;
  n.equip.weapon = bladeItem(id);
  u.look = { ...u.look, cloth: o.cloth, hair: d.hair };
  for (const k of STAT_KEYS) n.stats[k] = Math.min(10, o.stats * 2.4 + rand(0, 1.5));
  refreshDerived(u);
  const elite = g.state.units.filter((v) => !v.dead && v.faction === 'village' && v.ninja && (v.ninja.rank === 'jounin' || v.ninja.rank === 'kage')).length;
  u.maxHp = Math.round(u.maxHp * o.hpMult * Math.min(2.5, 1 + elite * 0.1));
  u.hp = u.maxHp;
  u.chakra = u.maxChakra;
  return u;
}

/** Já começaram? Só depois da primeira invasão do Quinteto do Som (a ordem da história: Som, Névoa, Eclipse). */
export const swordsmenAwake = (s: GameState) =>
  s.sound.stopped + s.sound.lost > 0 || (s.swordsmen.raids ?? 0) > 0 || s.blades.some((b) => (MIST_BLADES as readonly string[]).includes(b));

/** Na vila: agenda e manda a próxima invasão (Vila Oculta em diante, uma organização por vez no mapa). */
export function swordsmenTick(g: Game) {
  const s = g.state;
  const st = s.swordsmen;
  if (s.level < SWORDSMEN_ORG.minVillage || s.sceneInfo || !swordsmenAwake(s)) return;
  if (!st.nextDay) st.nextDay = s.day + 3;
  if (s.day < st.nextDay || swordsmenOnMap(g).length || s.units.some((u) => !u.dead && (u.org || u.sound))) return;
  // com as sete espadas na vila, vêm quaisquer dois (atrás das espadas)
  const left = swordsmenLeft(g).length ? swordsmenLeft(g) : [...MIST_BLADES];
  st.raids = (st.raids ?? 0) + 1;
  st.nextDay = s.day + randi(SWORDSMEN_ORG.every[0], SWORDSMEN_ORG.every[1]);
  st.taken = false;
  const p = edgePoint(g);
  const who = left.map((id) => ({ id, k: rand(0, 1) })).sort((a, b) => a.k - b.k).slice(0, SWORDSMEN_ORG.perRaid).map((x) => x.id);
  who.forEach((id, i) => {
    const u = createSwordsman(g, id, p.x + i * 24, p.y);
    fx(g, 'smoke', u.x, u.y, { r: 26, life: 1, color: '#c8d4e0' });
  });
  for (let i = 0; i < SWORDSMEN_ORG.escort; i++) createRogue(g, p.x + rand(-20, 20), p.y + rand(10, 30), s.day, { rank: 'chunin', stats: 1.6 });
  s.flags.raidActive = true;
  const names = who.map((id) => `${SWORDSMEN[id].name} (${BLADES[id].name})`).join(' e ');
  g.toast(`{swords} Os ${SWORDSMEN_ORG.name} atacam: ${names}! Derrube um para tomar a espada dele.`, 'danger', p);
}

/** Alvo do espadachim fora do alcance de visão: o ninja da vila (à vista, fora de casa) mais perto. */
export function swordsmanPrey(g: Game, u: Unit): Unit | null {
  let best: Unit | null = null;
  let bd = Infinity;
  for (const o of g.state.units) {
    if (o.dead || o.hidden || o.cloak || o.faction !== 'village' || o.kind !== 'ninja') continue;
    const d = Math.hypot(o.x - u.x, o.y - u.y);
    if (d < bd) [best, bd] = [o, d];
  }
  return best;
}

/**
 * Espadachim zerou a vida. O primeiro da invasão cai de vez e a espada fica com a vila (retorna false: segue a morte
 * normal); os outros somem na névoa feridos e voltam depois (retorna true: não morre).
 */
export function swordsmanFall(g: Game, u: Unit): boolean {
  const s = g.state;
  const id = u.swordsman!;
  const d = SWORDSMEN[id];
  // as sete já são da vila: o primeiro derrubado cai de vez (ryo no lugar da espada), os outros somem na névoa
  if (!s.swordsmen.taken && s.blades.includes(id)) {
    s.swordsmen.taken = true;
    g.give(SWORDSMEN_ORG.bladeReward);
    g.toast(`{crown} ${d.name} caiu tentando retomar a ${BLADES[id].name}! +${costLabel(SWORDSMEN_ORG.bladeReward)}.`, 'good', u);
    return false;
  }
  if (!s.swordsmen.taken && !s.blades.includes(id)) {
    s.swordsmen.taken = true;
    g.give(SWORDSMEN_ORG.bladeReward);
    grantBlade(g, id, `${d.name} caiu e deixou a espada`, u);
    fxText(g, u.x, u.y - 40, BLADES[id].name, BLADES[id].color, true);
    if (!swordsmenLeft(g).length) {
      s.swordsmen.done = true;
      g.toast(`{crown} As sete espadas são da vila! Os ${SWORDSMEN_ORG.name} vão continuar vindo atrás delas.`, 'good');
    }
    return false;
  }
  // já tomaram uma espada nesta invasão: este some na névoa
  u.hp = Math.max(1, Math.round(u.maxHp * 0.3));
  u.cloak = true;
  u.state = 'escape';
  u.targetId = null;
  u.stun = 0;
  const p = edgePoint(g);
  setDestination(g, u, p.x, p.y);
  fx(g, 'smoke', u.x, u.y, { r: 24, life: 1, color: '#c8d4e0' });
  fxText(g, u.x, u.y - 34, 'Kirigakure!', '#c8d4e0', true);
  g.give(SWORDSMEN_ORG.fleeReward);
  g.toast(`{run} ${d.name} sumiu na névoa com a ${BLADES[id].name} (+${costLabel(SWORDSMEN_ORG.fleeReward)}). Só uma espada por invasão: ele volta.`, 'warn', u);
  return true;
}
