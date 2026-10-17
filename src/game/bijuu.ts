// Bestas com cauda (data/bijuu.ts): qual fera a Fera Colossal é, o jarro das vencidas e a selagem num ninja (o
// Jinchuuriki). O Jinchuuriki que cai solta a fera: ela volta a vagar e pode aparecer de novo como ameaça.
import { costLabel } from '../data/resources';
import { bijuu, BIJUU, BIJUU_MAX_TAILS, bijuuScale, SEAL } from '../data/bijuu';
import { RANKS } from '../data/ninja';
import { fx, fxMoment, fxText } from './fx';
import type { Game } from './game';
import type { Unit } from './types';

type Result = { ok: true } | { ok: false; error: string };

/** Caudas das feras que a vila já tem (num Jinchuuriki vivo ou no jarro): essas não aparecem como ameaça. */
export function bijuuTaken(g: Game): Set<number> {
  const s = g.state;
  const out = new Set<number>(s.bijuu?.jar ?? []);
  for (const u of s.units) if (!u.dead && u.kind === 'ninja' && u.faction === 'village' && u.ninja?.bijuu) out.add(u.ninja.bijuu);
  return out;
}

/** Feras soltas (nem no jarro nem num Jinchuuriki) até o limite de caudas do nível da vila. */
export function bijuuFree(g: Game): number[] {
  const max = BIJUU_MAX_TAILS[Math.min(BIJUU_MAX_TAILS.length - 1, g.state.level)]!;
  const taken = bijuuTaken(g);
  return BIJUU.map((b) => b.tails).filter((n) => n <= max && !taken.has(n));
}

/** Qual fera desperta: uma das soltas até o limite de caudas do nível da vila, de preferência a de mais caudas. */
export function pickBijuu(g: Game): number {
  const max = BIJUU_MAX_TAILS[Math.min(BIJUU_MAX_TAILS.length - 1, g.state.level)]!;
  const free = bijuuFree(g);
  if (!free.length) return Math.max(1, Math.ceil(Math.random() * max)); // todas presas: uma "sombra" de qualquer uma
  // sorteio puxado para as maiores
  const w = free.map((n) => n * n);
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < free.length; i++) if ((r -= w[i]!) < 0) return free[i]!;
  return free[free.length - 1]!;
}

/** Transforma a Fera Colossal recém-criada na fera de `tails` caudas (nome, vida, dano, tamanho). */
export function makeBijuu(u: Unit, tails: number) {
  const d = bijuu(tails);
  const k = bijuuScale(tails);
  u.bijuu = tails;
  u.name = `${d.name} (${tails} ${tails > 1 ? 'caudas' : 'cauda'})`;
  u.maxHp = u.hp = Math.round(u.maxHp * k.hp); // o dano cresce em meleeStats (combat.ts)
}

/** Fera vencida: vai para o jarro (se ainda não tiver dono), esperando o Kage escolher o Jinchuuriki. */
export function bijuuDefeated(g: Game, u: Unit) {
  const n = u.bijuu;
  if (!n || bijuuTaken(g).has(n)) return;
  g.state.bijuu.jar.push(n);
  fx(g, 'ring', u.x, u.y, { r: 60, color: bijuu(n).color, life: 1.4 });
  g.toast(`{scroll} ${bijuu(n).name} foi selado(a) num jarro. Escolha um Jinchuuriki na aba Kage para guardar a fera.`, 'good', u);
}

/** Quem pode virar Jinchuuriki: ninja da vila de nível alto, sem outra fera. */
export const jinchuurikiCandidates = (g: Game) =>
  g.state.units
    .filter((u) => !u.dead && u.kind === 'ninja' && u.faction === 'village' && u.ninja && !u.ninja.bijuu && u.ninja.level >= SEAL.minLevel)
    .sort((a, b) => b.ninja!.level - a.ninja!.level);

export const jinchuuriki = (g: Game) => g.state.units.filter((u) => !u.dead && u.kind === 'ninja' && u.faction === 'village' && u.ninja?.bijuu);

export function sealBlock(g: Game, u: Unit | undefined, tails: number): string | null {
  if (!g.state.bijuu.jar.includes(tails)) return 'Essa fera não está no jarro.';
  if (!u?.ninja) return 'Escolha um ninja.';
  if (u.ninja.bijuu) return 'Já guarda uma fera.';
  if (u.ninja.level < SEAL.minLevel) return `Precisa de nível ${SEAL.minLevel}.`;
  if (!g.canAfford(SEAL.cost)) return `Custa ${costLabel(SEAL.cost)}.`;
  return null;
}

/** Sela a fera do jarro no ninja: ele vira Jinchuuriki e passa a vestir o manto de chakra em combate. */
export function sealBijuu(g: Game, unitId: number, tails: number): Result {
  const u = g.unit(unitId);
  const why = sealBlock(g, u, tails);
  if (why) return { ok: false, error: why };
  g.pay(SEAL.cost);
  const s = g.state;
  s.bijuu.jar.splice(s.bijuu.jar.indexOf(tails), 1);
  u!.ninja!.bijuu = tails;
  const d = bijuu(tails);
  fx(g, 'ring', u!.x, u!.y, { r: 50, color: d.color, life: 1.4 });
  fx(g, 'swirl', u!.x, u!.y - 8, { r: 26, color: d.color, life: 1.2 });
  fxText(g, u!.x, u!.y - 36, `Jinchuuriki de ${d.name}`, d.color, true);
  fxMoment(g, u!.x, u!.y, 'Selamento', d.color);
  g.toast(`{scroll} ${u!.name} (${RANKS[u!.ninja!.rank].name}) agora é o Jinchuuriki de ${d.name}: em combate veste o manto de chakra da fera.`, 'good', u);
  return { ok: true };
}

/** Jinchuuriki caído: a fera se solta (volta a vagar e pode voltar como ameaça). */
export function hostFell(g: Game, u: Unit) {
  const n = u.ninja?.bijuu;
  if (!n) return;
  u.ninja!.bijuu = undefined;
  fx(g, 'burst', u.x, u.y, { r: 40, color: bijuu(n).color, life: 0.8 });
  g.toast(`{beast} Com a queda de ${u.name}, ${bijuu(n).name} se libertou e fugiu.`, 'danger', u);
}
