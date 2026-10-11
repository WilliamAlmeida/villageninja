// Modos de combate (manto de chakra): manto da fera do Jinchuuriki, Oito Portões, manto de Raiton e Susano'o. Um só por vez
// (`Unit.mode`); dano, velocidade, defesa e esquiva entram por estas funções em combat.ts e movement.ts.
import { bijuu, BIJUU_MODE, MODES, type ModeKind } from '../data/bijuu';
import { chance } from '../core/rng';
import { eyeTick } from './dojutsu';
import { fx, fxMoment, fxText } from './fx';
import type { Game } from './game';
import type { Unit } from './types';

export const modeDamage = (u: Unit | null | undefined) => {
  const m = u?.mode;
  if (!m) return 1;
  return MODES[m.kind].damage + (m.kind === 'bijuu' ? (m.tails ?? 1) * 0.05 : 0);
};
export const modeSpeed = (u: Unit) => (u.mode ? MODES[u.mode.kind].speed : 1);
/** Fração do dano que passa (o manto segura parte do golpe). */
export const modeGuard = (u: Unit) => (u.mode ? MODES[u.mode.kind].guard : 1);
export const modeDodge = (u: Unit) => (u.mode ? MODES[u.mode.kind].dodge : 0);

/** Entra no modo: o manto acende, o nome aparece e a câmera dá o momento especial. */
export function enterMode(g: Game, u: Unit, kind: ModeKind, tails?: number) {
  const d = MODES[kind];
  const wild = kind === 'bijuu' && chance((tails ?? 1) * BIJUU_MODE.wildPerTail);
  u.mode = { kind, t: d.time + (tails ?? 0), tails, wild, blast: BIJUU_MODE.blastEvery };
  const color = kind === 'bijuu' ? bijuu(tails ?? 1).color : d.color;
  fx(g, 'ring', u.x, u.y, { r: 34, color, life: 0.8 });
  fx(g, 'burst', u.x, u.y - 8, { r: 30, color, life: 0.6, vfx: kind === 'raiton' ? 'lightning' : 'heat' });
  const name = kind === 'bijuu' ? `${d.name} de ${bijuu(tails ?? 1).name}` : d.name;
  fxText(g, u.x, u.y - 34, wild ? `${name}: descontrolado!` : name, wild ? '#ff4d4d' : color, true);
  fxMoment(g, u.x, u.y, name, color);
}

/** A cada passo: o tempo corre, Oito Portões consomem a vida, o manto regenera e solta ondas de chakra; o Jinchuuriki
 *  veste o manto sozinho quando a luta aperta. */
export function modeTick(g: Game, u: Unit, dt: number) {
  eyeTick(g, u); // Sharingan/Byakugan acendem com a luta
  if (u.modeCd) u.modeCd = Math.max(0, u.modeCd - dt);
  const host = u.ninja?.bijuu;
  if (host && !u.mode && !u.modeCd && u.combatTimer > 0 && !u.hidden && u.stun <= 0 && (u.hp < u.maxHp * 0.65 || bossNear(g, u))) {
    enterMode(g, u, 'bijuu', host);
    u.modeCd = MODES.bijuu.cooldown;
  }
  const m = u.mode;
  if (!m) return;
  m.t -= dt;
  const d = MODES[m.kind];
  // dreno (Portões) ou regeneração (manto da fera); os Portões nunca matam sozinhos
  u.hp = Math.min(u.maxHp, Math.max(1, u.hp - u.maxHp * d.drain * dt));
  if (m.kind === 'bijuu' && (m.tails ?? 0) >= BIJUU_MODE.blastFrom && (m.blast = (m.blast ?? 0) - dt) <= 0) {
    m.blast = BIJUU_MODE.blastEvery;
    chakraWave(g, u, m.tails!, !!m.wild);
  }
  if (m.t <= 0) {
    u.mode = undefined;
    fx(g, 'smoke', u.x, u.y - 6, { r: 16, life: 0.6, color: '#d8d8d8' });
  }
}

/** Onda de chakra da fera em volta do Jinchuuriki; descontrolado, pega os aliados também. */
function chakraWave(g: Game, u: Unit, tails: number, wild: boolean) {
  const r = 30 + tails * 3;
  const power = 6 + tails * 3;
  const color = wild ? '#7a1a3a' : bijuu(tails).color;
  fx(g, 'wave', u.x, u.y, { r, color, life: 0.5 });
  for (const o of g.state.units) {
    if (o === u || o.dead || o.hidden || o.kind === 'villager' || Math.hypot(o.x - u.x, o.y - u.y) > r) continue;
    const foe = o.faction !== u.faction;
    if (!foe && !wild) continue;
    o.hp -= power;
    o.hitFlash = 0.15;
    o.combatTimer = 5;
    if (o.hp <= 0) o.hp = 1; // a onda fere, mas quem mata é a luta
  }
}

const bossNear = (g: Game, u: Unit) => g.state.units.some((o) => o.boss && !o.dead && o.faction !== u.faction && Math.hypot(o.x - u.x, o.y - u.y) < 180);
