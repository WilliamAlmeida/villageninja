// Ninken: cão ninja adotado no Canil. Acompanha o dono e luta com ele, fareja espiões invisíveis por perto e, fora da
// vila, às vezes acha ervas. A IA fica em `ally` (systems/hostiles.ts), junto com as invocações.
import { ANIMALS } from '../data/animals';
import { createAnimal } from './entities';
import { fx, fxText } from './fx';
import type { Game } from './game';
import type { Cost, Unit } from './types';

type Result = { ok: true } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });

export const DOG_COST: Cost = { food: 30, ryo: 40 };
/** Raio em que o faro do cão descobre espiões invisíveis; intervalo e chance de achar ervas fora da vila. */
export const DOG = { sniff: 170, herbEvery: 40, herbChance: 0.5, herbs: 3 };

const DOG_NAMES = ['Pakku', 'Kuromaru', 'Shiba', 'Kibo', 'Hana', 'Tora', 'Maru', 'Sora', 'Riku', 'Yuki'];

export const dogOf = (g: Game, u: Unit) => g.state.units.find((o) => !o.dead && o.animal === 'dog' && o.ownerId === u.id);

export function dogBlock(g: Game, u: Unit): string | null {
  if (!u.ninja || u.faction !== 'village' || u.kind !== 'ninja') return 'Inválido.';
  if (!g.findBuilt('kennel')) return 'Construa o Canil primeiro.';
  if (dogOf(g, u)) return 'Já tem um ninken.';
  if (u.away != null) return 'Está fora numa expedição.';
  return null;
}

export function adoptDog(g: Game, unitId: number): Result {
  const u = g.unit(unitId);
  if (!u) return fail('Ninja não encontrado.');
  const why = dogBlock(g, u);
  if (why) return fail(why);
  if (!g.pay(DOG_COST)) return fail('Recursos insuficientes.');
  const d = createAnimal(g, 'dog', u.x - 16, u.y + 8);
  d.faction = 'village';
  d.ownerId = u.id;
  d.life = 1e9;
  d.name = `${DOG_NAMES[(u.id * 7 + g.state.day) % DOG_NAMES.length]} (ninken)`;
  fx(g, 'smoke', d.x, d.y, { r: 14, life: 0.5, color: '#e8e0d0' });
  g.toast(`{paw} ${u.name} adotou ${d.name}!`, 'good', u);
  return { ok: true };
}

/** Faro do cão (chamado pela IA dos aliados): ervas fora da vila. */
export function dogSniff(g: Game, dog: Unit, owner: Unit, dt: number) {
  dog.abilityCd = (dog.abilityCd ?? DOG.herbEvery) - dt;
  if (dog.abilityCd > 0) return;
  dog.abilityCd = DOG.herbEvery;
  if (g.world.inVillage(owner.x, owner.y) || Math.random() > DOG.herbChance) return;
  g.state.res.herbs += DOG.herbs;
  fxText(g, dog.x, dog.y - 18, `+${DOG.herbs}{herbs}`, '#7fd36b');
}

export const dogName = (u: Unit) => u.name || ANIMALS.dog.name;
