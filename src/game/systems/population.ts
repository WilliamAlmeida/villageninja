import { pick } from '../../core/rng';
import { BUILDINGS } from '../../data/buildings';
import { createVillager } from '../entities';
import type { Game } from '../game';
import type { Unit } from '../types';
import { doorPos } from '../world';

const BIRTH_INTERVAL = 30;

/** Nascimentos/migrantes, distribuição de casas e de empregos. */
export function populationSystem(g: Game, dt: number) {
  const t = g.state.timers;
  t.birth -= dt;
  t.homes -= dt;
  t.jobs -= dt;
  if (t.birth <= 0) {
    t.birth = BIRTH_INTERVAL;
    births(g);
  }
  if (t.homes <= 0) {
    t.homes = 2;
    assignHomes(g);
  }
  if (t.jobs <= 0) {
    t.jobs = 1;
    assignJobs(g);
  }
}

function births(g: Game) {
  const s = g.state;
  if (g.population() >= g.popCap() || s.res.food < 40 || s.flags.starving) return;
  const houses = s.buildings.filter((b) => b.built && BUILDINGS[b.type].housing);
  if (!houses.length) return;
  const h = pick(houses);
  const p = doorPos(h);
  const u = createVillager(g, p.x, p.y);
  u.homeId = h.id;
  s.res.food -= 15;
  s.stats.born++;
  g.toast(`👶 ${u.name} chegou à vila!`, 'good', u);
}

function assignHomes(g: Game) {
  const used = new Map<number, number>();
  const people = g.villagers();
  for (const u of people) {
    const h = g.building(u.homeId);
    if (!h || !h.built) u.homeId = null;
    else used.set(h.id, (used.get(h.id) ?? 0) + 1);
  }
  for (const u of people) {
    if (u.homeId != null) continue;
    const h = g.state.buildings.find((b) => b.built && (BUILDINGS[b.type].housing ?? 0) > (used.get(b.id) ?? 0));
    if (!h) break;
    u.homeId = h.id;
    used.set(h.id, (used.get(h.id) ?? 0) + 1);
  }
}

function assignJobs(g: Game) {
  const s = g.state;
  const villagers = s.units.filter((u) => !u.dead && u.kind === 'villager');
  // remove trabalhadores inválidos
  for (const b of s.buildings) {
    b.workers = b.workers.filter((id) => {
      const u = g.unit(id);
      return !!u && !u.dead && u.kind === 'villager' && u.jobId === b.id;
    });
  }
  for (const u of villagers) if (u.jobId != null && !g.building(u.jobId)?.built) u.jobId = null;

  const unemployed: Unit[] = villagers.filter((u) => u.jobId == null);
  // se há obras, reserva até 2 construtores
  const pending = s.buildings.filter((b) => !b.built).length;
  let free = unemployed.length - Math.min(2, pending);

  for (const b of s.buildings) {
    if (!b.built) continue;
    const def = BUILDINGS[b.type];
    if (!def.workers) continue;
    while (b.workers.length > b.desired) {
      const u = g.unit(b.workers.pop());
      if (u) {
        u.jobId = null;
        u.state = 'idle';
      }
    }
    while (b.workers.length < b.desired && free > 0) {
      const u = unemployed.shift();
      if (!u) break;
      u.jobId = b.id;
      u.state = u.hidden ? u.state : 'idle';
      b.workers.push(u.id);
      free--;
    }
  }
}
