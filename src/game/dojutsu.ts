// Dōjutsu (técnicas oculares, kekkei genkai de clã; data/kekkei.ts). Os olhos acendem em combate.
// - Sharingan: lê os golpes (esquiva), COPIA o jutsu que um inimigo usa por perto (devolve uma vez, `Unit.mirror`, e
//   guarda em `NinjaInfo.seen` para aprender depois sem pergaminho nem natureza; só rank baixo, até C, e uma cópia por ninja), Kanashibari, Amaterasu (chamas negras
//   que queimam até apagar, `Unit.burn`) e Susano'o (modo, game/modes.ts).
// - Byakugan: vê o que está invisível por perto (espiões, ANBU inimiga) e o Punho Gentil: cada golpe corpo a corpo
//   fecha pontos de chakra do alvo; os golpes Hyuga (Kūshō, 64 Palmas, Kaiten, Sōshiken) exigem o Byakugan.
import { KEKKEI, type KekkeiId } from '../data/kekkei';
import type { JutsuDef } from '../data/jutsus';
import { fx, fxText } from './fx';
import type { Game } from './game';
import type { Unit } from './types';

export const DOJUTSU = {
  /** Sharingan: chance extra de esquivar do corpo a corpo. */
  sharinganDodge: 0.12,
  /** Distância em que o Sharingan copia o jutsu de quem o usa. */
  copyRange: 220,
  /** Segundos que a cópia fica pronta para ser devolvida. */
  mirrorTime: 12,
  /** Rank mais alto que o Sharingan copia (2 = C; só os de rank baixo: E, D e C). */
  copyMaxRank: 2,
  /** Cada ninja guarda UMA cópia: a nova toma o lugar da anterior. */
  seenMax: 1,
  /** Byakugan: alcance em que revela quem está invisível. */
  sightRange: 170,
  /** Punho Gentil: chakra que cada golpe corpo a corpo tira do alvo. */
  juken: 6,
};

export type EyeId = Extract<KekkeiId, 'sharingan' | 'byakugan'>;

/** O dōjutsu do ninja (ou nada). */
export const eyeOf = (u: Unit | null | undefined): EyeId | null => {
  const k = u?.ninja?.kekkei;
  return k && KEKKEI[k].eye ? (k as EyeId) : null;
};

export const eyeDodge = (u: Unit) => (eyeOf(u) === 'sharingan' ? DOJUTSU.sharinganDodge : 0);

/** O Sharingan copia só jutsu de rank baixo (até C); técnica de clã, proibida, modo, clone e cura não. */
export const copyable = (def: JutsuDef) =>
  def.rank <= DOJUTSU.copyMaxRank && !def.kekkei && !def.forbidden && def.effect !== 'mode' && def.effect !== 'clone' && def.effect !== 'heal';

/** Acende/apaga os olhos com a luta: o nome aparece uma vez ao acender. */
export function eyeTick(g: Game, u: Unit) {
  const eye = eyeOf(u);
  if (!eye) return;
  const on = u.combatTimer > 0 && !u.hidden;
  if (on === !!u.eyeOn) return;
  u.eyeOn = on || undefined;
  if (!on) return;
  const d = KEKKEI[eye];
  fxText(g, u.x, u.y - 30, `${d.kanji} ${d.name}!`, d.color, true);
  fx(g, 'ring', u.x, u.y - 22, { r: 10, color: d.color, life: 0.4 });
}

/** Alguém soltou um jutsu: quem tem Sharingan e viu por perto (do outro lado) copia. */
export function sawJutsu(g: Game, caster: Unit, def: JutsuDef) {
  if (!copyable(def)) return;
  for (const o of g.state.units) {
    if (o === caster || o.dead || o.hidden || eyeOf(o) !== 'sharingan' || (o.faction === caster.faction && !caster.arenaSide)) continue;
    if (Math.hypot(o.x - caster.x, o.y - caster.y) > DOJUTSU.copyRange) continue;
    const n = o.ninja!;
    o.mirror = { id: def.id, t: DOJUTSU.mirrorTime };
    if (!n.jutsu.includes(def.id)) {
      n.seen = [def.id, ...(n.seen ?? []).filter((id) => id !== def.id)].slice(0, DOJUTSU.seenMax);
      fxText(g, o.x, o.y - 26, 'Copiado!', KEKKEI.sharingan.color);
    }
  }
}

/** Punho Gentil (Byakugan): o golpe corpo a corpo fecha pontos de chakra do alvo. */
export function gentleFist(g: Game, src: Unit | null, t: Unit) {
  if (eyeOf(src) !== 'byakugan' || !t.maxChakra) return;
  t.chakra = Math.max(0, t.chakra - DOJUTSU.juken);
  fx(g, 'hit', t.x, t.y - 10, { r: 6, color: KEKKEI.byakugan.color, life: 0.2, vfx: 'wind' });
}

/** Byakugan da vila por perto: o invisível aparece. */
export const byakuganNear = (g: Game, x: number, y: number) =>
  g.state.units.some((o) => !o.dead && !o.hidden && o.faction === 'village' && eyeOf(o) === 'byakugan' && Math.hypot(o.x - x, o.y - y) < DOJUTSU.sightRange);

/** Amaterasu: acende as chamas negras no alvo (não apagam; reacender só renova). */
export function ignite(g: Game, src: Unit, t: Unit, total: number, seconds: number) {
  t.burn = { t: seconds, dps: total / seconds, src: src.id };
  t.combatTimer = 5;
  fx(g, 'burst', t.x, t.y - 8, { r: 22, color: '#1a0a1e', life: 0.6, vfx: 'dark' });
}
