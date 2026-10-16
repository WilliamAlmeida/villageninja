import { pick } from '../../core/rng';
import { birthMult } from '../mood';
import { BUILDINGS, defOf } from '../../data/buildings';
import { childOf, clanOf } from '../clans';
import { createVillager } from '../entities';
import type { Game } from '../game';
import type { Unit } from '../types';
import { doorPos } from '../world';
import { housingOf, needsBuilders } from '../upgrade';
import { fieldById } from '../fields';

const BIRTH_INTERVAL = 30;

/** Nascimentos/migrantes, distribuição de casas e de empregos. */
export function populationSystem(g: Game, dt: number) {
  const t = g.state.timers;
  t.birth -= dt * birthMult(g.state);
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
  const houses = s.buildings.filter((b) => b.built && defOf(b).housing);
  if (!houses.length) return;
  // casas com um casal (2+ moradores) têm filhos; sem casal, chega um migrante
  const people = g.villagers();
  const couples = houses
    .map((h) => ({ h, res: people.filter((u) => u.homeId === h.id) }))
    .filter((x) => x.res.length >= 2);
  const home = couples.length ? pick(couples) : null;
  const h = home?.h ?? pick(houses);
  const p = doorPos(h);
  const u = createVillager(g, p.x, p.y);
  u.homeId = h.id;
  s.res.food -= 15;
  s.stats.born++;
  if (home) {
    const [a, b] = shuffle(home.res).slice(0, 2) as [Unit, Unit];
    const child = childOf(g, a, b);
    u.name = child.name;
    u.heritage = child.heritage;
    u.look = { ...u.look, ...child.look };
    const clan = clanOf(g, u);
    g.toast(`{baby} ${u.name} nasceu (filho(a) de ${a.name.split(' ').pop()} e ${b.name.split(' ').pop()})${clan ? ` · clã ${clan.name}` : ''}!`, 'good', u);
  } else g.toast(`{luggage} ${u.name} chegou à vila!`, 'good', u);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function assignHomes(g: Game) {
  const used = new Map<number, number>();
  const people = g.villagers();
  for (const u of people) {
    const h = g.building(u.homeId);
    if (!h || !h.built) u.homeId = null;
    else if ((used.get(h.id) ?? 0) >= housingOf(h)) u.homeId = null; // casa cheia: procura outra
    else used.set(h.id, (used.get(h.id) ?? 0) + 1);
  }
  for (const u of people) {
    if (u.homeId != null) continue;
    const h = g.state.buildings.find((b) => b.built && housingOf(b) > (used.get(b.id) ?? 0));
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
  // campos cercados (game/fields.ts): fazendeiro de campo que sumiu volta a ficar livre
  for (const f of s.fields ?? []) f.workers = f.workers.filter((id) => {
    const u = g.unit(id);
    return !!u && !u.dead && u.kind === 'villager' && u.fieldId === f.id;
  });
  for (const u of villagers) if (u.fieldId != null && (!fieldById(s, u.fieldId) || !fieldById(s, u.fieldId)!.workers.includes(u.id))) u.fieldId = undefined;

  const unemployed: Unit[] = villagers.filter((u) => u.jobId == null && u.fieldId == null);
  // se há obras, reserva até 2 construtores — tirando gente do emprego se todos estiverem trabalhando
  // (antes a obra ficava parada para sempre quando não sobrava ninguém desempregado)
  const pending = s.buildings.filter(needsBuilders).length;
  const builders = Math.min(2, pending, villagers.length);
  if (unemployed.length < builders) {
    const food = (u: Unit) => (u.fieldId != null || BUILDINGS[g.building(u.jobId)!.type].job === 'farmer' ? 1 : 0);
    const employed = villagers.filter((u) => u.jobId != null || u.fieldId != null).sort((a, b) => food(a) - food(b));
    for (const u of employed.slice(0, builders - unemployed.length)) {
      const job = g.building(u.jobId);
      if (job) job.workers = job.workers.filter((id) => id !== u.id);
      const fl = fieldById(s, u.fieldId);
      if (fl) fl.workers = fl.workers.filter((id) => id !== u.id);
      u.jobId = null;
      u.fieldId = undefined;
      if (!u.hidden) u.state = 'idle';
      u.carry = null;
      unemployed.push(u);
    }
  }
  let free = unemployed.length - builders;

  // campos cercados primeiro (comida): as vagas pedidas recebem fazendeiros como os prédios
  for (const f of s.fields ?? []) {
    while (f.workers.length > f.desired) {
      const u = g.unit(f.workers.pop());
      if (u) {
        u.fieldId = undefined;
        if (!u.hidden) u.state = 'idle';
      }
    }
    while (f.workers.length < f.desired && free > 0) {
      const u = unemployed.shift();
      if (!u) break;
      if (u.jobId != null) continue;
      u.fieldId = f.id;
      u.state = u.hidden ? u.state : 'idle';
      f.workers.push(u.id);
      free--;
    }
  }
  for (const b of s.buildings) {
    if (!b.built) continue;
    const def = defOf(b);
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
