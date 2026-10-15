// Retrato de ninja: o que um ninja é (atributos, jutsus, equipamento, clã) num texto curto que dá para copiar e colar.
// É a peça base do PvP (docs/gdd-escala-ilhas-pvp.md, seção 6): quem recebe o retrato luta contra ele como convidado.
// Tudo o que entra por aqui é desconfiado: ids são conferidos nos dados, números presos aos tetos da patente.
import { BLADES, type BladeId } from '../data/blades';
import { CONTRACTS } from '../data/contracts';
import type { ContractKind } from '../data/region';
import { ITEMS } from '../data/items';
import { JUTSUS } from '../data/jutsus';
import { KAGE_ARTS, type KageArtId } from '../data/kageArts';
import { KEKKEI, type KekkeiId } from '../data/kekkei';
import { NATURE_KEYS, type Nature } from '../data/natures';
import { RANK_ORDER, RANKS, STAT_KEYS, type Rank, type Stats } from '../data/ninja';
import { SPECS, type SpecKind } from '../data/specs';
import { clanOf } from './clans';
import { createNinja, refreshDerived } from './entities';
import type { Game } from './game';
import type { Look, Unit } from './types';

export const SNAPSHOT_VERSION = 1;
/** Prefixo do texto copiado ("VN1." + base64url do JSON). */
const PREFIX = `VN${SNAPSHOT_VERSION}.`;
/** Teto de nível aceito num retrato (acima disso é inventado). */
export const SNAPSHOT_MAX_LEVEL = 60;
const NAME_MAX = 28;

export interface NinjaSnapshot {
  v: number;
  name: string;
  /** Nome da vila de origem (só para mostrar). */
  from?: string;
  /** Clã (só nome e cor, para mostrar). */
  clan?: { name: string; color: string };
  look: Look;
  rank: Rank;
  nature: Nature;
  level: number;
  stats: Stats;
  jutsu: [string | null, string | null];
  kekkei: KekkeiId | null;
  equip: { weapon: string | null; armor: string | null; item: string | null };
  contract?: ContractKind;
  spec?: SpecKind;
  sannin?: ContractKind;
  bijuu?: number;
  anbu?: boolean;
  mask?: string;
  kageArt?: KageArtId;
}

/** O retrato de um ninja da vila. */
export function snapshotOf(g: Game, u: Unit): NinjaSnapshot {
  const n = u.ninja!;
  const clan = clanOf(g, u);
  const stats = {} as Stats;
  for (const k of STAT_KEYS) stats[k] = Math.round(n.stats[k] * 100) / 100; // duas casas: texto curto e igual ao que volta
  const out: NinjaSnapshot = {
    v: SNAPSHOT_VERSION,
    name: u.name,
    look: { skin: u.look.skin, hair: u.look.hair, cloth: u.look.cloth, spiky: u.look.spiky },
    rank: n.rank,
    nature: n.nature,
    level: n.level,
    stats,
    jutsu: [n.jutsu[0], n.jutsu[1]],
    kekkei: n.kekkei,
    equip: { weapon: n.equip.weapon, armor: n.equip.armor, item: n.equip.item },
  };
  if (g.state.kageHistory.length) out.from = `Vila de ${g.state.kageHistory.at(-1)!.name.split(' ').pop()}`;
  if (clan) out.clan = { name: clan.name, color: clan.color };
  if (n.contract) out.contract = n.contract;
  if (n.spec) out.spec = n.spec;
  if (n.sannin) out.sannin = n.sannin;
  if (n.bijuu) out.bijuu = n.bijuu;
  if (n.anbu) out.anbu = true;
  if (n.mask) out.mask = n.mask;
  if (n.kageArt) out.kageArt = n.kageArt;
  return out;
}

export function encodeSnapshot(s: NinjaSnapshot): string {
  const bytes = new TextEncoder().encode(JSON.stringify(s));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return PREFIX + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Lê um retrato colado; null se não for um retrato válido. Tudo é conferido e preso aos limites do jogo. */
export function decodeSnapshot(text: string): NinjaSnapshot | null {
  const t = text.trim();
  if (!t.startsWith(PREFIX)) return null;
  try {
    const b64 = t.slice(PREFIX.length).replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return sanitize(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}

const COLOR = /^#[0-9a-f]{6}$/i;
const color = (v: unknown, def: string) => (typeof v === 'string' && COLOR.test(v) ? v : def);
const str = (v: unknown, max: number) =>
  typeof v === 'string' ? v.replace(/[^\p{L}\p{N} '\-.]/gu, '').trim().slice(0, max) : '';
const num = (v: unknown, lo: number, hi: number, def: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def);
const oneOf = <T extends string>(v: unknown, list: readonly string[]): T | undefined => (typeof v === 'string' && list.includes(v) ? (v as T) : undefined);

/** Retrato lido do texto: ids conferidos nos dados, atributos no teto da patente, nome limpo. */
export function sanitize(raw: unknown): NinjaSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.v !== SNAPSHOT_VERSION) return null;
  const rank = oneOf<Rank>(r.rank, RANK_ORDER) ?? 'genin';
  const name = str(r.name, NAME_MAX) || 'Retrato';
  const cap = RANKS[rank].statCap;
  const rs = (r.stats ?? {}) as Record<string, unknown>;
  const stats = {} as Stats;
  for (const k of STAT_KEYS) stats[k] = Math.round(num(rs[k], 0.3, cap, 1) * 100) / 100;
  const rj = Array.isArray(r.jutsu) ? r.jutsu : [];
  const jutsu = [0, 1].map((i) => (typeof rj[i] === 'string' && JUTSUS[rj[i] as string] ? (rj[i] as string) : null)) as [string | null, string | null];
  const re = (r.equip ?? {}) as Record<string, unknown>;
  const gear = (v: unknown, slot: 'weapon' | 'armor' | 'item') => {
    if (typeof v !== 'string') return null;
    if (slot === 'weapon' && v in BLADES) return v as BladeId;
    return ITEMS[v]?.slot === slot ? v : null;
  };
  const rl = (r.look ?? {}) as Record<string, unknown>;
  const rc = r.clan as Record<string, unknown> | undefined;
  const out: NinjaSnapshot = {
    v: SNAPSHOT_VERSION,
    name,
    look: { skin: color(rl.skin, '#d9a97c'), hair: color(rl.hair, '#2b2622'), cloth: color(rl.cloth, '#6b5a2a'), spiky: rl.spiky === true },
    rank,
    nature: oneOf<Nature>(r.nature, NATURE_KEYS) ?? 'katon',
    level: Math.round(num(r.level, 1, SNAPSHOT_MAX_LEVEL, 1)),
    stats,
    jutsu,
    kekkei: oneOf<KekkeiId>(r.kekkei, Object.keys(KEKKEI)) ?? null,
    equip: { weapon: gear(re.weapon, 'weapon'), armor: gear(re.armor, 'armor'), item: gear(re.item, 'item') },
  };
  const from = str(r.from, NAME_MAX);
  if (from) out.from = from;
  if (rc && typeof rc === 'object') {
    const cn = str(rc.name, NAME_MAX);
    if (cn) out.clan = { name: cn, color: color(rc.color, '#c8a26a') };
  }
  const contract = oneOf<ContractKind>(r.contract, Object.keys(CONTRACTS));
  if (contract) out.contract = contract;
  const spec = oneOf<SpecKind>(r.spec, Object.keys(SPECS));
  if (spec) out.spec = spec;
  const sannin = oneOf<ContractKind>(r.sannin, Object.keys(CONTRACTS));
  if (sannin) out.sannin = sannin;
  const bijuu = Math.round(num(r.bijuu, 0, 9, 0));
  if (bijuu) out.bijuu = bijuu;
  if (r.anbu === true) out.anbu = true;
  const mask = str(r.mask, 16);
  if (out.anbu && mask) out.mask = mask;
  const art = oneOf<KageArtId>(r.kageArt, Object.keys(KAGE_ARTS));
  if (art) out.kageArt = art;
  return out;
}

/** Cria a unidade do retrato (convidado) no ponto dado: luta com as regras de sempre e vai embora no fim. */
export function unitFromSnapshot(g: Game, s: NinjaSnapshot, x: number, y: number): Unit {
  const u = createNinja(g, x, y, s.rank, 0);
  u.faction = 'guest';
  u.name = `${s.name} (convidado)`;
  u.look = { ...s.look };
  const n = u.ninja!;
  n.nature = s.nature;
  n.level = s.level;
  n.stats = { ...s.stats };
  n.jutsu = [s.jutsu[0], s.jutsu[1]];
  n.kekkei = s.kekkei;
  n.equip = { weapon: s.equip.weapon, armor: s.equip.armor, item: s.equip.item, itemReady: !!s.equip.item, itemCount: s.equip.item ? 1 : undefined };
  if (s.contract) n.contract = s.contract;
  if (s.spec) n.spec = s.spec;
  if (s.sannin) n.sannin = s.sannin;
  if (s.bijuu) n.bijuu = s.bijuu;
  if (s.anbu) n.anbu = true;
  if (s.mask) n.mask = s.mask;
  if (s.kageArt) n.kageArt = s.kageArt;
  refreshDerived(u);
  u.hp = u.maxHp;
  u.chakra = u.maxChakra;
  return u;
}
