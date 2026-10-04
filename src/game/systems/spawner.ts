import { DAY_LENGTH, MAP_H, MAP_W } from '../../config';
import { pick, rand, randi, weightedPick } from '../../core/rng';
import { ANIMAL_LIST } from '../../data/animals';
import { levelDef } from '../../data/villageLevels';
import type { Rank } from '../../data/ninja';
import { createAnimal, createRogue } from '../entities';
import type { Game } from '../game';
import { findPath, nearestWalkable } from '../pathfinding';
import { CENTER_TX, CENTER_TY, doorTile, tileCenter } from '../world';

/** Surgimento de animais e invasões de renegados + alerta da vila. */
export function spawnerSystem(g: Game, dt: number) {
  const s = g.state;
  s.timers.animal -= dt;
  s.timers.raid -= dt;

  if (s.timers.animal <= 0) {
    s.timers.animal = rand(40, 75);
    spawnAnimals(g);
  }
  if (s.timers.raid <= 0) {
    s.timers.raid = DAY_LENGTH * rand(2, 3.2);
    if (s.day >= 3) spawnRaid(g);
  }

  // alerta: algum inimigo dentro da vila?
  let alert = false;
  let rogues = 0;
  for (const u of s.units) {
    if (u.dead || u.faction === 'village') continue;
    if (u.kind === 'rogue' && u.missionId == null) rogues++;
    if (!alert && g.world.inVillage(u.x, u.y)) alert = true;
  }
  if (alert !== s.flags.alert) {
    s.flags.alert = alert;
    if (alert) g.toast('⚠ Inimigos dentro da vila!', 'danger');
  }
  if (s.flags.raidActive && rogues === 0) {
    s.flags.raidActive = false;
    if (s.flags.raidStole) g.toast('Os renegados fugiram…', 'warn');
    else {
      s.stats.raidsRepelled++;
      g.toast('🎉 Invasão repelida! A vila está segura.', 'good');
    }
  }
}

/** Ponto de spawn perto da borda (preferindo florestas longe da vila). */
function edgeSpawn(g: Game) {
  const far = g.state.nodes.filter((n) => n.type === 'tree' && Math.hypot(n.tx - CENTER_TX, n.ty - CENTER_TY) > 20);
  if (far.length && Math.random() < 0.7) {
    const n = pick(far);
    const w = nearestWalkable(g.world, n.tx, n.ty + 1);
    if (w && findPath(g.world, w[0], w[1], CENTER_TX, CENTER_TY + 3)) return { x: tileCenter(w[0]), y: tileCenter(w[1]) };
  }
  return edgePoint(g);
}

/** Ponto na borda do mapa que tenha caminho até a vila (evita ilhas cercadas de água). */
function edgePoint(g: Game) {
  const hk = g.hokage();
  const goal = hk ? doorTile(hk) : { tx: CENTER_TX, ty: CENTER_TY };
  let fallback: { x: number; y: number } | null = null;
  for (let i = 0; i < 30; i++) {
    const side = randi(0, 3);
    const tx = side === 0 ? 1 : side === 1 ? MAP_W - 2 : randi(1, MAP_W - 2);
    const ty = side === 2 ? 1 : side === 3 ? MAP_H - 2 : randi(1, MAP_H - 2);
    if (!g.world.walkable(tx, ty)) continue;
    const p = { x: tileCenter(tx), y: tileCenter(ty) };
    if (findPath(g.world, tx, ty, goal.tx, goal.ty)) return p;
    fallback ??= p;
  }
  return fallback ?? { x: tileCenter(1), y: tileCenter(1) };
}

function spawnAnimals(g: Game) {
  const s = g.state;
  const wild = s.units.filter((u) => !u.dead && u.kind === 'animal' && u.missionId == null).length;
  const threat = levelDef(s.level).threat;
  if (wild >= 4 + Math.floor(s.day / 2) + threat * 2) return;
  const def = weightedPick(
    ANIMAL_LIST.filter((a) => a.minDay <= s.day + threat * 2),
    // vilas maiores atraem feras maiores
    (a) => a.weight + (a.type === 'bear' || a.type === 'snake' ? threat : 0),
  );
  if (!def) return;
  const p = edgeSpawn(g);
  const count = randi(def.pack[0], def.pack[1]);
  for (let i = 0; i < count; i++) createAnimal(g, def.type, p.x + rand(-14, 14), p.y + rand(-14, 14));
  if (def.type === 'snake' || def.type === 'bear') g.toast(`🐾 Um(a) ${def.name} foi avistado(a) na floresta!`, 'warn', p);
}

/**
 * Força das invasões. Cresce devagar com os dias e mais rápido com a fama
 * (nível) da vila — assim quem evolui enfrenta ameaças maiores, e uma vila
 * pequena não é esmagada só porque o tempo passou.
 */
export function raidStrength(day: number, threat: number) {
  const rank: Rank = day >= 18 || threat >= 3 ? 'jounin' : day >= 9 || threat >= 2 ? 'chunin' : 'genin';
  return {
    rank,
    count: Math.min(5 + threat, 1 + Math.floor(day / 5) + threat),
    stats: Math.min(3, day * 0.07 + threat * 0.5),
  };
}

function spawnRaid(g: Game) {
  const s = g.state;
  const p = edgePoint(g);
  const r = raidStrength(s.day, levelDef(s.level).threat);
  for (let i = 0; i < r.count; i++) createRogue(g, p.x + rand(-16, 16), p.y + rand(-16, 16), s.day, { rank: r.rank, stats: r.stats });
  const n = r.count;
  s.flags.raidActive = true;
  s.flags.raidStole = false;
  g.toast(`⚔ ${n} ninja(s) renegado(s) estão invadindo a vila!`, 'danger', p);
}
