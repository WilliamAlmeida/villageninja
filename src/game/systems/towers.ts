import type { BuildingType } from '../../data/buildings';
import { spawnProjectile } from '../combat';
import type { Game } from '../game';
import type { Unit } from '../types';
import { buildingCenter } from '../world';

/** Prédios que atiram kunais em inimigos (a Residência do Hokage tem guardas). */
export const DEFENSES: Partial<Record<BuildingType, { range: number; cd: number; damage: number; height: number }>> = {
  tower: { range: 190, cd: 1.4, damage: 7, height: 28 },
  hokage: { range: 170, cd: 1.8, damage: 6, height: 24 },
};

export function towerSystem(g: Game, dt: number) {
  for (const b of g.state.buildings) {
    const def = DEFENSES[b.type];
    if (!def || !b.built) continue;
    b.cd -= dt;
    if (b.cd > 0) continue;
    const c = buildingCenter(b);
    let best: Unit | null = null;
    let bd = def.range;
    for (const u of g.state.units) {
      if (u.dead || u.hidden || u.faction === 'village') continue;
      const d = Math.hypot(u.x - c.x, u.y - c.y);
      if (d < bd) {
        bd = d;
        best = u;
      }
    }
    if (!best) continue;
    b.cd = def.cd;
    spawnProjectile(g, null, 'village', c.x, c.y - def.height, best.x, best.y - 6, {
      damage: def.damage, radius: 0, nature: null, color: '#cfd6dd', size: 4, speed: 380, kind: 'kunai', stun: 0, range: def.range + 40,
    });
  }
}
