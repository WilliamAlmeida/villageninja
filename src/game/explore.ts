// Exploração: névoa (tiles explorados num bitset), locais especiais escondidos e o que acontece ao investigá-los.
import { DAY_LENGTH, MAP_H, MAP_W, TILE } from '../config';
import { chance, mulberry32, pick } from '../core/rng';
import { JUTSU_LIST } from '../data/jutsus';
import { MINE_USES, SIGHT, SITE_MIN_DIST, SITE_RESPAWN_DAYS, SITES, type SiteKind } from '../data/sites';
import { costLabel } from '../data/resources';
import { createRogue } from './entities';
import { fx, fxText } from './fx';
import type { Game } from './game';
import type { Cost, GameState, Site, Unit } from './types';
import { CENTER_TX, CENTER_TY, idx, inBounds, T, tileCenter, toTile } from './world';

const WORDS = Math.ceil((MAP_W * MAP_H) / 32);

export const emptyExplored = () => new Array<number>(WORDS).fill(0);

export function isExplored(s: GameState, tx: number, ty: number) {
  if (!inBounds(tx, ty)) return false;
  const i = idx(tx, ty);
  return ((s.explored[i >> 5]! >>> (i & 31)) & 1) === 1;
}
export const isExploredPx = (s: GameState, x: number, y: number) => isExplored(s, toTile(x), toTile(y));

/** Revela um círculo de tiles. Retorna quantos eram novos (0 = nada mudou). */
export function revealCircle(s: GameState, cx: number, cy: number, r: number): number {
  let added = 0;
  const r2 = r * r;
  for (let y = Math.max(0, cy - r); y <= Math.min(MAP_H - 1, cy + r); y++)
    for (let x = Math.max(0, cx - r); x <= Math.min(MAP_W - 1, cx + r); x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > r2) continue;
      const i = idx(x, y);
      const bit = 1 << (i & 31);
      const w = s.explored[i >> 5]!;
      if (w & bit) continue;
      s.explored[i >> 5] = w | bit;
      added++;
    }
  return added;
}

/** Contador que muda sempre que algo é revelado (o render refaz a textura da névoa só então). */
export let fogVersion = 0;
export const bumpFog = () => fogVersion++;

/** Quantos % do mapa já foram explorados. */
export function exploredPercent(s: GameState) {
  let n = 0;
  for (const w of s.explored) for (let v = w >>> 0; v; v &= v - 1) n++;
  return Math.round((n / (MAP_W * MAP_H)) * 100);
}

/** Espalha os locais especiais longe da vila, em terra firme e sem se amontoar (determinístico pela seed). */
export function generateSites(s: GameState, nextId: () => number, kinds: SiteKind[] = ['ruin', 'chest', 'cave']): Site[] {
  const rng = mulberry32(s.seed ^ 0x517e5);
  const out: Site[] = [];
  for (const kind of kinds)
    for (let k = 0; k < SITES[kind].count; k++) {
      const p = siteSpot(s, rng, out);
      if (p) out.push({ id: nextId(), kind, ...p, found: false, done: false });
    }
  return out;
}

/** Lugar para um local especial: longe da vila, em terra firme, sem prédio e sem se amontoar com os outros. */
function siteSpot(s: GameState, rng: () => number, extra: Site[] = [], wantFog = false) {
  const taken = (tx: number, ty: number) =>
    // o próprio local que vai mudar também conta: o lugar novo fica longe do antigo
    [...s.sites, ...extra].some((o) => Math.abs(o.tx - tx) < 6 && Math.abs(o.ty - ty) < 6) ||
    s.nodes.some((n) => n.tx === tx && n.ty === ty) ||
    s.buildings.some((b) => tx >= b.tx - 1 && tx <= b.tx + BUILD_PAD + 2 && ty >= b.ty - 1 && ty <= b.ty + BUILD_PAD + 2);
  for (let tries = 0; tries < 800; tries++) {
    const tx = 2 + Math.floor(rng() * (MAP_W - 4));
    const ty = 2 + Math.floor(rng() * (MAP_H - 5));
    if (Math.hypot(tx - CENTER_TX, (ty - CENTER_TY) * 1.2) < SITE_MIN_DIST) continue;
    if (wantFog && tries < 400 && isExplored(s, tx, ty)) continue; // de preferência ainda na névoa (dá o que explorar)
    // o local e os vizinhos precisam ser terra (dá para chegar e investigar)
    let land = true;
    for (let y = ty - 1; y <= ty + 1 && land; y++) for (let x = tx - 1; x <= tx + 1 && land; x++) land = s.tiles[idx(x, y)] !== T.WATER;
    if (!land || taken(tx, ty)) continue;
    return { tx, ty };
  }
  return null;
}
const BUILD_PAD = 3;

/** Expedições que a entrada de mina ainda aguenta. */
export const mineUses = (site: Site) => site.uses ?? MINE_USES;

/** Uma expedição terminou nesta mina: gasta um uso; o último desaba a entrada (outra aparece noutro lugar). */
export function spendMine(g: Game, siteId: number | undefined) {
  const site = g.state.sites.find((x) => x.id === siteId && x.kind === 'cave');
  if (!site || site.done) return;
  site.uses = mineUses(site) - 1;
  if (site.uses > 0) return;
  site.done = true;
  const p = { x: tileCenter(site.tx), y: tileCenter(site.ty) };
  fx(g, 'burst', p.x, p.y, { r: 30, color: '#9a8c7a', life: 0.8 });
  g.toast(`{pickaxe} A mina se esgotou e os túneis desabaram. Outra entrada deve aparecer pelo mapa em uns ${SITE_RESPAWN_DAYS.cave} dias.`, 'info', p);
}

/** Locais feitos/esgotados contam o tempo e reaparecem noutro lugar (fora dos mapas de missão). */
export function siteTick(g: Game, dt: number) {
  const s = g.state;
  if (s.sceneInfo) return;
  for (const site of s.sites) {
    if (!site.done) continue;
    site.respawn = (site.respawn ?? SITE_RESPAWN_DAYS[site.kind] * DAY_LENGTH) - dt;
    if (site.respawn > 0) continue;
    const p = siteSpot(s, Math.random, [], true);
    if (!p) {
      site.respawn = 60; // sem lugar agora: tenta de novo daqui a pouco
      continue;
    }
    site.tx = p.tx;
    site.ty = p.ty;
    site.found = false;
    site.done = false;
    site.uses = undefined;
    site.respawn = undefined;
    if (isExplored(s, site.tx, site.ty)) discover(g, site);
  }
}

/** Começo do jogo (ou save antigo): revela os arredores da vila. */
export function revealStart(s: GameState) {
  revealCircle(s, CENTER_TX, CENTER_TY, SIGHT.start);
  for (const b of s.buildings) revealCircle(s, b.tx + 1, b.ty + 1, 6);
}

/** Local que acabou de sair da névoa: marca como achado e avisa (ruínas ganham guardiões). */
export function discover(g: Game, site: Site) {
  site.found = true;
  const def = SITES[site.kind];
  const p = { x: tileCenter(site.tx), y: tileCenter(site.ty) };
  fx(g, 'ring', p.x, p.y, { r: 26, color: '#ffd34d', life: 1 });
  g.toast(`{eye} Descoberto: ${def.name}! Toque no local para ver.`, 'good', p);
  if (site.kind === 'ruin') spawnGuardians(g, site);
}

function spawnGuardians(g: Game, site: Site) {
  const lvl = g.state.level;
  for (let i = 0; i < 2; i++) {
    const u = createRogue(g, tileCenter(site.tx) + (i ? 26 : -26), tileCenter(site.ty) + 20, g.state.day, {
      rank: lvl >= 2 ? 'jounin' : 'chunin', stats: 0.5 + lvl * 0.5, jutsu: 1, name: 'Guardião das ruínas',
    });
    u.guard = site.id;
    u.homeX = u.x;
    u.homeY = u.y;
    u.look = { ...u.look, cloth: '#3b3550' };
  }
}

export const guardiansOf = (g: Game, site: Site) => g.state.units.filter((u) => !u.dead && u.guard === site.id);

/** Pergaminhos proibidos que ainda faltam achar. */
export const missingScrolls = (s: GameState) => JUTSU_LIST.filter((j) => j.forbidden && !s.scrolls.includes(j.id));

/** O ninja terminou de investigar: aplica o resultado do local. Retorna o texto do que aconteceu. */
export function resolveSite(g: Game, site: Site, u: Unit): string {
  const s = g.state;
  const p = { x: tileCenter(site.tx), y: tileCenter(site.ty) };
  site.done = true;
  let text: string;
  if (site.kind === 'ruin') {
    const left = missingScrolls(s);
    if (left.length) {
      const j = pick(left);
      s.scrolls.push(j.id);
      text = `{scroll} ${u.name} encontrou um pergaminho proibido: ${j.name}! Já pode ser ensinado na Academia (com riscos).`;
    } else {
      const loot: Cost = { ryo: 120 + s.day * 6, paper: 10 };
      g.give(loot);
      text = `{scroll} ${u.name} achou relíquias nas ruínas: ${costLabel(loot)}.`;
    }
  } else {
    // baú: recursos que crescem com a distância da vila; às vezes uma armadilha
    const far = Math.hypot(site.tx - CENTER_TX, site.ty - CENTER_TY) / 10;
    const loot: Cost = pick([
      { wood: Math.round(60 * far), stone: Math.round(40 * far) },
      { ryo: Math.round(70 * far) },
      { iron: Math.round(10 * far), herbs: Math.round(10 * far) },
    ]);
    g.give(loot);
    fx(g, 'treasure', p.x, p.y - 6, { r: 26, color: '#ffd34d', life: 1.1 });
    text = `{luggage} ${u.name} abriu o baú: ${costLabel(loot)}.`;
    if (chance(0.25)) {
      const dmg = Math.round(u.maxHp * 0.3);
      u.hp = Math.max(1, u.hp - dmg);
      fx(g, 'burst', p.x, p.y, { r: 22, color: '#ff8a3d', life: 0.5 });
      text += ' Era uma armadilha: ele se feriu.';
    }
  }
  fxText(g, p.x, p.y - 26, site.kind === 'chest' ? 'Aberto!' : 'Investigado!', '#ffd34d', true);
  g.toast(text, 'good', p);
  return text;
}

/**
 * Batedor: o tile ainda na névoa mais perto do ninja que dá para alcançar (andável e vizinho de explorado),
 * procurando em anéis crescentes. null = mapa todo explorado.
 */
export function scoutTarget(g: Game, u: Unit): { x: number; y: number } | null {
  const s = g.state;
  const cx = toTile(u.x);
  const cy = toTile(u.y);
  const maxR = Math.max(MAP_W, MAP_H);
  for (let r = 3; r < maxR; r += 2) {
    const opts: [number, number][] = [];
    for (let y = cy - r; y <= cy + r; y++)
      for (let x = cx - r; x <= cx + r; x++) {
        if (Math.abs(x - cx) !== r && Math.abs(y - cy) !== r) continue; // só a borda do anel
        if (!inBounds(x, y) || isExplored(s, x, y) || !g.world.walkable(x, y)) continue;
        if (isExplored(s, x + 1, y) || isExplored(s, x - 1, y) || isExplored(s, x, y + 1) || isExplored(s, x, y - 1)) opts.push([x, y]);
      }
    if (opts.length) {
      const [x, y] = opts[(u.id * 7 + r) % opts.length]!; // batedores diferentes vão para lados diferentes
      return { x: tileCenter(x), y: tileCenter(y) };
    }
  }
  return null;
}

/** Ponto em px no centro do local. */
export const sitePos = (site: Site) => ({ x: site.tx * TILE + TILE / 2, y: site.ty * TILE + TILE / 2 });
