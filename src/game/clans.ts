// Famílias, clãs e kekkei genkai.
import { chance, pick } from '../core/rng';
import { KEKKEI, KEKKEI_BIRTH_CHANCE, KEKKEI_LIST, type KekkeiDef, type KekkeiId } from '../data/kekkei';
import { randomGiven } from '../data/names';
import { STAT_KEYS, type StatKey } from '../data/ninja';
import { levelDef } from '../data/villageLevels';
import { fx, fxText } from './fx';
import type { Game } from './game';
import type { Clan, Heritage, Unit } from './types';

type Result = { ok: true } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });

export const CLAN_COLORS = ['#c0392b', '#2e86c1', '#27ae60', '#8e44ad', '#d68910', '#16a085', '#7f8c8d', '#e67e22'];
export const FOUND_COST = { ryo: 150 };
export const FOUND_MIN_LEVEL = 5;
export const AWAKEN_COST = { ryo: 300 };
export const MAX_CLANS = 4;

export const surname = (u: Unit) => u.name.split(' ')[0] ?? u.name;
export const clanOf = (g: Game, u: Unit | undefined | null) =>
  u?.heritage?.clanId != null ? g.state.clans.find((c) => c.id === u.heritage!.clanId) : undefined;

/** Pessoas da vila (moradores e ninjas) de um clã. */
export function clanMembers(g: Game, c: Clan): Unit[] {
  return g.state.units.filter((u) => !u.dead && u.faction === 'village' && (u.kind === 'villager' || u.kind === 'ninja') && u.heritage?.clanId === c.id);
}

const topStat = (u: Unit): StatKey => [...STAT_KEYS].sort((a, b) => u.ninja!.stats[b] - u.ninja!.stats[a])[0]!;

// ------------------------------------------------------------------ nascimentos
/** Herança do filho de um casal: sobrenome, clã, natureza, talento e kekkei genkai. */
export function childOf(g: Game, a: Unit, b: Unit): { name: string; heritage: Heritage; look: Partial<Unit['look']> } {
  // o sobrenome de clã tem prioridade
  const ca = clanOf(g, a);
  const cb = clanOf(g, b);
  const main = ca ? a : cb ? b : pick([a, b]);
  const clan = clanOf(g, main) ?? null;
  const ninjaParents = [a, b].filter((p) => p.ninja);
  const nature = ninjaParents.length && chance(0.6) ? pick(ninjaParents).ninja!.nature : clan && chance(0.5) ? clan.nature : null;
  const bias = clan && chance(0.6) ? clan.specialty : ninjaParents.length ? topStat(pick(ninjaParents)) : null;
  const kekkeiParent = [a, b].find((p) => p.ninja?.kekkei);
  const kekkei: KekkeiId | null =
    clan?.kekkei && chance(KEKKEI_BIRTH_CHANCE) ? clan.kekkei : kekkeiParent && chance(KEKKEI_BIRTH_CHANCE) ? kekkeiParent.ninja!.kekkei : null;
  return {
    name: `${surname(main)} ${randomGiven()}`,
    heritage: { clanId: clan?.id ?? null, nature, bias, kekkei, parents: [a.name, b.name] },
    look: { hair: pick([a.look.hair, b.look.hair]), skin: pick([a.look.skin, b.look.skin]) },
  };
}

// ------------------------------------------------------------------ clãs
export function canFoundClan(g: Game, u: Unit | undefined): Result {
  if (!u?.ninja || u.faction !== 'village' || u.kind !== 'ninja') return fail('Inválido.');
  if (g.state.level < 1) return fail(`Requer nível ${levelDef(1).name}.`);
  if (u.ninja.rank === 'genin') return fail('Precisa ser Chunin ou superior.');
  if (u.ninja.level < FOUND_MIN_LEVEL) return fail(`Precisa de nível ${FOUND_MIN_LEVEL}.`);
  if (clanOf(g, u)) return fail('Já pertence a um clã.');
  if (g.state.clans.some((c) => c.name === surname(u))) return fail(`O clã ${surname(u)} já existe.`);
  if (g.state.clans.length >= MAX_CLANS) return fail(`Máximo de ${MAX_CLANS} clãs.`);
  if (!g.canAfford(FOUND_COST)) return fail('Recursos insuficientes.');
  return { ok: true };
}

/** Funda um clã com o sobrenome do ninja: todos os parentes vivos entram. */
export function foundClan(g: Game, unitId: number): Result {
  const u = g.unit(unitId);
  const r = canFoundClan(g, u);
  if (!r.ok || !u) return r;
  g.pay(FOUND_COST);
  const used = new Set(g.state.clans.map((c) => c.color));
  const clan: Clan = {
    id: g.newId(),
    name: surname(u),
    color: CLAN_COLORS.find((c) => !used.has(c)) ?? CLAN_COLORS[0]!,
    founderId: u.id,
    founderName: u.name,
    specialty: topStat(u),
    nature: u.ninja!.nature,
    kekkei: null,
    day: g.state.day,
  };
  g.state.clans.push(clan);
  for (const m of g.state.units) {
    if (m.dead || m.faction !== 'village' || (m.kind !== 'villager' && m.kind !== 'ninja') || surname(m) !== clan.name) continue;
    m.heritage = { ...(m.heritage ?? { nature: null, bias: null, kekkei: null, parents: null }), clanId: clan.id };
  }
  fx(g, 'ring', u.x, u.y, { r: 30, color: clan.color, life: 0.8 });
  fxText(g, u.x, u.y - 32, `Clã ${clan.name}!`, clan.color, true);
  g.toast(`{castle} ${u.name} fundou o clã ${clan.name} (${clanMembers(g, clan).length} membro(s)).`, 'good', u);
  return { ok: true };
}

/** Kekkei genkai que o clã pode despertar agora (tem ninjas das duas naturezas). */
export function awakenOptions(g: Game, c: Clan): KekkeiDef[] {
  if (c.kekkei) return [];
  const natures = new Set(clanMembers(g, c).filter((u) => u.ninja).map((u) => u.ninja!.nature));
  return KEKKEI_LIST.filter((k) => natures.has(k.natures[0]) && natures.has(k.natures[1]));
}

export function awakenKekkei(g: Game, clanId: number, kekkei: KekkeiId): Result {
  const c = g.state.clans.find((x) => x.id === clanId);
  const def = KEKKEI[kekkei];
  if (!c || !def) return fail('Inválido.');
  if (g.state.level < 2) return fail(`Requer nível ${levelDef(2).name}.`);
  if (c.kekkei) return fail('Este clã já despertou uma kekkei genkai.');
  if (!awakenOptions(g, c).some((k) => k.id === kekkei))
    return fail(`O clã precisa de ninjas de ${def.natures.join(' e ')}.`);
  if (!g.pay(AWAKEN_COST)) return fail('Recursos insuficientes.');
  c.kekkei = kekkei;
  // os ninjas do clã com uma das naturezas despertam na hora
  const awakened: string[] = [];
  for (const u of clanMembers(g, c)) {
    if (!u.ninja || !def.natures.includes(u.ninja.nature)) continue;
    u.ninja.kekkei = kekkei;
    fx(g, 'burst', u.x, u.y, { r: 30, color: def.color, life: 0.7 });
    fxText(g, u.x, u.y - 30, `${def.kanji} ${def.name}!`, def.color, true);
    awakened.push(u.name.split(' ').pop()!);
  }
  g.toast(`${def.kanji} O clã ${c.name} despertou o ${def.name} (${def.pt})! ${awakened.join(', ')} já podem aprender ${def.name}.`, 'good');
  return { ok: true };
}
