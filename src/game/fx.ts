import type { Game } from './game';
import type { Effect, EffectKind } from './types';

const MAX_EFFECTS = 350;

export function fx(g: Game, kind: EffectKind, x: number, y: number, opts: Partial<Effect> = {}) {
  if (g.state.effects.length >= MAX_EFFECTS) return;
  g.state.effects.push({ kind, x, y, t: 0, life: 0.6, color: '#ffffff', ...opts });
}

export function fxText(g: Game, x: number, y: number, text: string, color = '#ffffff', big = false) {
  fx(g, 'text', x, y, { text, color, big, life: big ? 1.5 : 0.9 });
}

/** Último momento especial por mapa: no máximo um a cada `MOMENT_GAP` s (numa luta longa não vira câmera lenta sem fim). */
const lastMoment = new WeakMap<object, number>();
const MOMENT_GAP = 8;
/** Técnica marcante (Kage, Sannin, chefe, jutsu proibido): câmera lenta curta com o nome no centro da tela. */
export function fxMoment(g: Game, x: number, y: number, text: string, color: string) {
  const now = g.state.time + g.state.day * 10000;
  const last = lastMoment.get(g.state);
  if (last != null && now - last < MOMENT_GAP && now >= last) return;
  lastMoment.set(g.state, now);
  fx(g, 'moment', x, y, { text, color, life: 1.3 });
}

/**
 * Número de dano: golpes seguidos no mesmo alvo (menos de 0,35 s) somam num número só, em vez de uma chuva de
 * números se sobrepondo na luta grande. `uid` = quem levou (o desenho usa fonte menor para dano).
 */
export function fxDamage(g: Game, x: number, y: number, uid: number, dmg: number, color: string, crit: boolean) {
  const e = g.state.effects.find((o) => o.kind === 'text' && o.uid === uid && o.t < 0.35);
  if (e) {
    const sum = (parseInt(e.text ?? '0', 10) || 0) + dmg;
    const hard = crit || !!e.text?.endsWith('!');
    e.text = hard ? `${sum}!` : `${sum}`;
    if (crit) e.color = color;
    e.t = Math.min(e.t, 0.08);
    return;
  }
  fx(g, 'text', x, y, { text: crit ? `${dmg}!` : `${dmg}`, color, life: 0.9, uid });
}
