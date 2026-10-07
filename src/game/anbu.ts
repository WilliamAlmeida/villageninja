// ANBU: a tropa do Kage. Ele nomeia Chunins e Jounins (com a Torre de Inteligência), que saem das equipes e trocam a
// bandana pela máscara: o animal mostra o melhor atributo (raposa = Ninjutsu, corvo = Genjutsu…) e o nomeado ganha +1
// nele. Em campo: invisíveis até atacar (o primeiro golpe é uma emboscada), patrulham a vila à noite, revelam espiões e
// aparecem com Shunshin ao lado do Kage quando ele luta. Missões secretas na Região: `startCovert` (game/region.ts).
import { anbuMask, MASK_LIST, MASK_NAMES, maskKey } from '../data/anbu';
import { STAT_INFO } from '../data/ninja';
import { costLabel } from '../data/resources';
import { rand } from '../core/rng';
import { refreshDerived } from './entities';
import { fx, fxText } from './fx';
import type { Game } from './game';
import { statCapOf } from './sannin';
import { blink, flickerStyle } from './techniques';
import type { Cost, Unit } from './types';

type Result = { ok: true } | { ok: false; error: string };

export const ANBU = {
  /** Vagas: base + 1 por nível da Torre de Inteligência acima do 1. */
  slots: 3,
  cost: { ryo: 500 } as Cost,
  /** Emboscada: dano do golpe que sai da invisibilidade; segundos visível depois de atacar ou apanhar. */
  ambush: 1.6,
  seen: 6,
  /** Guarda do Kage: distância máxima para acudir e recarga. */
  guardRange: 600,
  guardCd: 20,
  /** Só some (furtivo) com inimigo à vista: distância em px. */
  alert: 360,
};

/** Máscara de um animal: nome, atributo que representa e o rótulo dele. */
export function maskInfo(animal: string) {
  const key = maskKey(animal);
  return { animal, name: MASK_NAMES[animal] ?? animal, key, stat: STAT_INFO[key].label };
}
/** Máscara do ninja da ANBU (a escolhida ao nomear; saves antigos: a do melhor atributo). */
export const maskOf = (u: Unit) => maskInfo(u.ninja?.mask ?? anbuMask(u.ninja?.stats));
/** Primeira máscara que ninguém da ANBU usa (sugestão ao nomear). */
export const freeMask = (g: Game) => MASK_LIST.find((m) => !anbus(g).some((u) => maskOf(u).animal === m)) ?? MASK_LIST[0]!;

const village = (u: Unit) => !u.dead && u.faction === 'village' && u.kind === 'ninja' && !!u.ninja;
export const anbus = (g: Game) => g.state.units.filter((u) => village(u) && u.ninja!.anbu);
export const anbuSlots = (g: Game) => {
  const intel = g.findBuilt('intel');
  return intel ? ANBU.slots + Math.max(0, (intel.level ?? 1) - 1) : 0;
};

/** Quem pode entrar: Chunin ou Jounin (não Kage nem Sannin), do mais forte para o mais fraco. */
export const anbuCandidates = (g: Game) =>
  g.state.units
    .filter((u) => village(u) && !u.ninja!.anbu && !u.ninja!.sannin && (u.ninja!.rank === 'chunin' || u.ninja!.rank === 'jounin') && u.away == null && !u.origin)
    .sort((a, b) => b.ninja!.level - a.ninja!.level);

export function anbuBlock(g: Game, u?: Unit): string | null {
  if (!g.findBuilt('intel')) return 'Precisa da Torre de Inteligência.';
  if (g.state.kageId == null || g.unit(g.state.kageId)?.dead) return 'Só o Kage nomeia a ANBU: eleja um Kage.';
  if (anbus(g).length >= anbuSlots(g)) return `A ANBU está completa (${anbuSlots(g)} vagas).`;
  if (!u) return 'Escolha um Chunin ou Jounin.';
  if (u.ninja!.anbu) return 'Já é da ANBU.';
  if (u.ninja!.sannin || u.ninja!.rank === 'kage' || u.ninja!.rank === 'genin') return 'Só Chunins e Jounins entram na ANBU.';
  if (!g.canAfford(ANBU.cost)) return `Custa ${costLabel(ANBU.cost)}.`;
  return null;
}

/** Nomeia o ninja para a ANBU: sai das equipes, ganha a máscara e +1 no atributo dela. */
export function appointAnbu(g: Game, unitId: number, mask = freeMask(g)): Result {
  const u = g.unit(unitId);
  if (!u || !village(u)) return { ok: false, error: 'Ninja não encontrado.' };
  const why = anbuBlock(g, u);
  if (why) return { ok: false, error: why };
  g.pay(ANBU.cost);
  const n = u.ninja!;
  for (const t of g.state.teams) {
    t.memberIds = t.memberIds.filter((id) => id !== u.id);
    if (t.senseiId === u.id) t.senseiId = null;
  }
  const m = maskInfo(MASK_LIST.includes(mask) ? mask : freeMask(g));
  n.mask = m.animal;
  n.stats[m.key] = Math.min(statCapOf(n), n.stats[m.key] + 1);
  n.anbu = true;
  n.order = 'auto';
  refreshDerived(u);
  fx(g, 'smoke', u.x, u.y, { r: 18, life: 0.7, color: '#d8d4c8' });
  fxText(g, u.x, u.y - 34, `ANBU: ${m.name}`, '#d8d4c8', true);
  g.toast(`{shield} ${u.name} entrou para a ANBU com a máscara de ${m.name} (${m.stat} +1).`, 'good', u);
  return { ok: true };
}

/** Tira o ninja da ANBU (volta a ser ninja comum; o atributo ganho fica). */
export function dismissAnbu(g: Game, unitId: number): Result {
  const u = g.unit(unitId);
  if (!u?.ninja?.anbu) return { ok: false, error: 'Não é da ANBU.' };
  u.ninja.anbu = false;
  u.cloak = false;
  g.toast(`{shield} ${u.name} deixou a ANBU.`, 'info', u);
  return { ok: true };
}

/** Golpe que sai da invisibilidade (chamado no cálculo do dano): multiplicador e o ANBU fica visível. */
export function anbuAmbush(src: Unit | null): number {
  if (!src?.ninja?.anbu || !src.cloak) return 1;
  src.cloak = false;
  src.seenT = ANBU.seen;
  return ANBU.ambush;
}

/** Há inimigo à vista do ANBU? (invasor ou bicho atacando a vila por perto) */
function enemyNear(g: Game, u: Unit) {
  const r2 = ANBU.alert * ANBU.alert;
  return g.state.units.some((o) => !o.dead && o.away == null && (o.faction === 'enemy' || (o.faction === 'wild' && o.targetId != null && g.unit(o.targetId)?.faction === 'village')) && (o.x - u.x) ** 2 + (o.y - u.y) ** 2 < r2);
}

/** Passo do ANBU: com inimigo à vista fica invisível (até atacar ou apanhar); sem, anda visível. Acode o Kage que lutar. */
export function anbuTick(g: Game, u: Unit, dt: number) {
  const n = u.ninja!;
  if (!n.anbu || g.state.sceneInfo) {
    if (u.cloak && u.faction === 'village') u.cloak = false;
    return;
  }
  u.seenT = (u.seenT ?? 0) - dt;
  u.guardCd = (u.guardCd ?? 0) - dt;
  if (u.hitFlash > 0) u.seenT = Math.max(u.seenT, ANBU.seen); // apanhou: foi visto
  u.cloak = u.seenT <= 0 && !u.hidden && enemyNear(g, u);
  // guarda do Kage
  const k = g.state.kageId != null ? g.unit(g.state.kageId) : null;
  if (!k || k.dead || k.hidden || k.combatTimer <= 0 || u.combatTimer > 0 || u.hidden || u.stun > 0 || (u.guardCd ?? 0) > 0) return;
  const d = Math.hypot(k.x - u.x, k.y - u.y);
  if (d < 60 || d > ANBU.guardRange) return;
  u.guardCd = ANBU.guardCd;
  const a = rand(0, Math.PI * 2);
  blink(g, u, { x: k.x + Math.cos(a) * 28, y: k.y + Math.sin(a) * 28 }, flickerStyle(u));
  if (k.targetId != null) u.targetId = k.targetId;
  fxText(g, u.x, u.y - 30, 'ANBU!', '#d8d4c8', true);
}
