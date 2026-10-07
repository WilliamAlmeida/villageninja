// Técnicas básicas de todo ninja: Shunshin (corpo cintilante) e Kawarimi (substituição), e os selos de mão do
// ritmo tático. Tudo automático: a IA decide quando usar.
import { chance, pick, rand } from '../core/rng';
import type { JutsuDef } from '../data/jutsus';
import { KAGE_ARTS } from '../data/kageArts';
import type { Stats } from '../data/ninja';
import { fx, fxText } from './fx';
import type { Game } from './game';
import type { FlickerStyle, Unit } from './types';
import { keepInRing } from './arena';
import { doorPos } from './world';

const TAU = Math.PI * 2;

/** Ninja de verdade (não clone, marionete, bicho ou morador): sabe Shunshin e Kawarimi. */
export const isShinobi = (u: Unit) => !!u.ninja && (u.kind === 'ninja' || u.kind === 'rogue') && u.role !== 'puppet';

export function stopMoving(u: Unit) {
  u.path.length = 0;
  u.hasGoal = false;
  u.moving = false;
}

/** Ponto andável perto de (x, y), ou null. */
export function landing(g: Game, x: number, y: number): { x: number; y: number } | null {
  if (g.world.walkablePx(x, y)) return { x, y };
  for (let r = 8; r <= 32; r += 8)
    for (let i = 0; i < 8; i++) {
      const px = x + Math.cos((i / 8) * TAU) * r;
      const py = y + Math.sin((i / 8) * TAU) * r;
      if (g.world.walkablePx(px, py)) return { x: px, y: py };
    }
  return null;
}

// ------------------------------------------------------------------ Shunshin no Jutsu
export const SHUNSHIN = {
  /** Distância máxima de um salto (px). */
  maxDist: 260,
  /** Só vale a pena acima disto além da distância de luta. */
  minGain: 70,
};
export const flickerCost = (d: number) => Math.round(6 + d / 30);
export const flickerCooldown = (s: Stats) => Math.max(3, 8 - s.velocidade * 0.4);

/** Visual por vila e natureza: folhas (nossa vila), névoa (renegados), água (Suiton), areia (Doton), fumaça (convidados). */
export function flickerStyle(u: Unit): FlickerStyle {
  const nat = u.ninja?.nature;
  if (nat === 'suiton') return 'water';
  if (nat === 'doton') return 'sand';
  return u.faction === 'village' ? 'leaf' : u.faction === 'enemy' ? 'mist' : 'smoke';
}
export const FLICKER_COLOR: Record<FlickerStyle, string> = {
  leaf: '#d8f27a', mist: '#c9d3dc', water: '#4da6ff', sand: '#d9b77a', smoke: '#e8e8e8', flash: '#ffd34d',
};

export const canFlicker = (u: Unit, d: number) =>
  isShinobi(u) && !u.cloak && u.stun <= 0 && !u.cast && !u.dash && (u.flickerCd ?? 0) <= 0 && u.chakra >= flickerCost(d);

/** Some num redemoinho (deixa um vulto) e reaparece em (x, y). Paga chakra e entra em recarga. */
export function shunshin(g: Game, u: Unit, x: number, y: number): boolean {
  const d = Math.hypot(x - u.x, y - u.y);
  if (!canFlicker(u, d)) return false;
  const q = keepInRing(g, u, { x, y }); // no duelo do Exame só pousa dentro da arena
  const p = landing(g, q.x, q.y);
  if (!p) return false;
  u.chakra -= flickerCost(d);
  u.flickerCd = flickerCooldown(u.ninja!.stats);
  blink(g, u, p, flickerStyle(u));
  return true;
}

/** O deslocamento em si (usado também pelo Hiraishin, com o clarão amarelo). */
export function blink(g: Game, u: Unit, p: { x: number; y: number }, style: FlickerStyle) {
  const color = FLICKER_COLOR[style];
  if (style !== 'flash') fx(g, 'afterimage', u.x, u.y, { uid: u.id, facing: u.facing, life: 0.35 });
  fx(g, 'flicker', u.x, u.y, { variant: style, r: 18, life: 0.6, color });
  u.facing = Math.atan2(p.y - u.y, p.x - u.x);
  u.x = p.x;
  u.y = p.y;
  stopMoving(u);
  fx(g, 'flicker', u.x, u.y, { variant: style, r: 14, life: 0.45, color });
}

/**
 * Shunshin em combate: longe do alvo, aparece a uma distância boa de luta; quem luta de longe e foi encurralado
 * (ferido, colado no inimigo) salta para trás.
 */
export function flickerInCombat(g: Game, u: Unit, t: Unit, d: number, desired: number): boolean {
  if (d > desired + SHUNSHIN.minGain && d < SHUNSHIN.maxDist + desired) {
    const a = Math.atan2(u.y - t.y, u.x - t.x);
    const stop = Math.max(18, desired * 0.8);
    return shunshin(g, u, t.x + Math.cos(a) * stop, t.y + Math.sin(a) * stop);
  }
  if (desired > 60 && d < 28 && u.hp < u.maxHp * 0.7) {
    const a = Math.atan2(u.y - t.y, u.x - t.x) + rand(-0.6, 0.6);
    return shunshin(g, u, t.x + Math.cos(a) * desired * 0.8, t.y + Math.sin(a) * desired * 0.8);
  }
  return false;
}

/** Ferido: some do meio da luta na direção do hospital (ou da Residência). */
export function escapeFlicker(g: Game, u: Unit): boolean {
  const b = g.findBuilt('hospital') ?? g.hokage();
  if (!b) return false;
  const p = doorPos(b);
  const d = Math.hypot(p.x - u.x, p.y - u.y);
  if (d < 50) return false;
  const step = Math.min(SHUNSHIN.maxDist, d - 10);
  const a = Math.atan2(p.y - u.y, p.x - u.x);
  return shunshin(g, u, u.x + Math.cos(a) * step, u.y + Math.sin(a) * step);
}

// ------------------------------------------------------------------ Kawarimi no Jutsu
export const KAWARIMI = { chakra: 10, cooldown: 14, /** fração da vida máxima que conta como "golpe forte" */ heavy: 0.15 };
export const kawarimiChance = (s: Stats) => Math.min(0.5, 0.1 + (s.velocidade + s.inteligencia) * 0.02);

/**
 * Golpe forte (ou fatal) prestes a acertar: chance de trocar de lugar com um tronco. Reaparece atrás de quem
 * atacou de perto, ou ao lado. Retorna true se escapou (o dano não acontece).
 */
export function tryKawarimi(g: Game, t: Unit, src: Unit | null, dmg: number): boolean {
  if (!isShinobi(t) || t.stun > 0 || t.cast || t.dash || t.state === 'ko' || (t.kawaCd ?? 0) > 0 || t.chakra < KAWARIMI.chakra) return false;
  if (dmg < t.maxHp * KAWARIMI.heavy && dmg < t.hp) return false;
  if (!chance(kawarimiChance(t.ninja!.stats))) return false;
  let p: { x: number; y: number } | null = null;
  if (src && Math.hypot(src.x - t.x, src.y - t.y) < 60) {
    const a = Math.atan2(src.y - t.y, src.x - t.x);
    p = landing(g, src.x + Math.cos(a) * 20, src.y + Math.sin(a) * 20);
  }
  if (!p) {
    const a = rand(0, TAU);
    p = landing(g, t.x + Math.cos(a) * 42, t.y + Math.sin(a) * 42);
  }
  if (!p) return false;
  p = keepInRing(g, t, p);
  fx(g, 'log', t.x, t.y, { life: 1.6, color: '#8a5a2e' });
  fx(g, 'smoke', t.x, t.y - 4, { r: 18, life: 0.6, color: '#e8e8e8' });
  fxText(g, t.x, t.y - 26, 'Kawarimi!', '#e8d6b0');
  t.x = p.x;
  t.y = p.y;
  stopMoving(t);
  fx(g, 'smoke', t.x, t.y - 4, { r: 12, life: 0.45, color: '#e8e8e8' });
  t.chakra -= KAWARIMI.chakra;
  t.kawaCd = KAWARIMI.cooldown;
  if (src) t.facing = Math.atan2(src.y - t.y, src.x - t.x);
  return true;
}

// ------------------------------------------------------------------ selos de mão (ritmo tático)
const SEALS = ['Ne', 'Ushi', 'Tora', 'U', 'Tatsu', 'Mi', 'Uma', 'Hitsuji', 'Saru', 'Tori', 'Inu', 'I'];

/** Segundos de selos antes do jutsu sair (0 = sai na hora: taijutsu e cura não usam selos). Mais Selos, mais rápido. */
export function sealTime(def: JutsuDef, s: Stats) {
  if (def.type === 'taijutsu' || def.effect === 'heal') return 0;
  return (0.25 + def.rank * 0.1) * Math.max(0.5, 1.1 - s.selos * 0.06);
}

/** Nomes dos selos mostrados enquanto o ninja os faz (o Kage Bunshin usa o selo em cruz). */
export function sealNames(def: JutsuDef) {
  if (def.effect === 'clone') return 'Jūji no in';
  const n = Math.min(4, def.rank + 1);
  return Array.from({ length: n }, () => pick(SEALS)).join(' · ');
}

/** Golpe que quebra os selos: fração da vida máxima num golpe só. */
export const SEAL_BREAK = 0.1;

/** Golpe que quebra a concentração dos selos: o jutsu falha (o chakra já foi gasto). `quiet`: só larga, sem aviso. */
export function interruptCast(g: Game, u: Unit, quiet = false) {
  if (!u.cast) return;
  u.cast = undefined;
  u.anim = 0;
  if (!quiet) fxText(g, u.x, u.y - 30, 'Selos interrompidos!', '#9aa4b0');
}

/** Kage com Hiraishin ferido: volta na hora para a Residência, onde a fórmula está gravada. */
export function hiraishinHome(g: Game, u: Unit): boolean {
  if (u.ninja?.kageArt !== 'hiraishin' || (u.artCd ?? 0) > 0) return false;
  const h = g.hokage();
  if (!h) return false;
  const door = doorPos(h);
  if (Math.hypot(door.x - u.x, door.y - u.y) < 60) return false;
  const p = landing(g, door.x, door.y + 10);
  if (!p) return false;
  fxText(g, u.x, u.y - 30, 'Hiraishin!', FLICKER_COLOR.flash, true);
  blink(g, u, p, 'flash');
  u.artCd = KAGE_ARTS.hiraishin.cooldown;
  return true;
}
