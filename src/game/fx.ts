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
