import { TILE } from '../config';
import { FX } from '../data/jutsuFx';
import { fx } from './fx';
import type { Game } from './game';
import { T } from './world';

/** Impacto visual compartilhado. O dano continua sendo resolvido por dashTick. */
export function rasenganHitFx(g: Game, id: string | undefined, x: number, y: number): boolean {
  if (id !== 'rasengan' && id !== 'odama') return false;
  const config = FX.jutsus[id], scale = id === 'odama' ? 2 : 1;
  const impact = config?.impact;
  fx(g, 'burst', x, y, { r: 24 * scale, color: '#7fc8ff', vfx: 'wind', fx: id,
    life: impact ? impact.frames / Math.max(1, impact.fps) : 0.5 });
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  if (tx < 0 || ty < 0 || tx >= g.state.mapW || ty >= g.state.mapH || g.state.tiles[ty * g.state.mapW + tx] === T.WATER) return true;
  const old = g.state.effects.filter(e => e.kind === 'crater');
  if (old.length >= 24) g.state.effects.splice(g.state.effects.indexOf(old[0]!), 1);
  fx(g, 'crater', x, y, { r: 24 * scale, color: '#59402c', fx: id, life: config?.crater?.life ?? 12 });
  return true;
}
