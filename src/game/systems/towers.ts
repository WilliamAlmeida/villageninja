import type { BuildingType } from '../../data/buildings';
import { spawnProjectile } from '../combat';
import { canHit } from '../factions';
import type { Game } from '../game';
import type { Unit } from '../types';
import { buildingCenter } from '../world';
import { towerDamage, towerRange } from '../upgrade';

/** Prédios que atiram kunais em inimigos (a Residência do Hokage tem guardas). */
export const DEFENSES: Partial<Record<BuildingType, { range: number; cd: number; damage: number; height: number }>> = {
  tower: { range: 190, cd: 1.4, damage: 7, height: 28 },
  hokage: { range: 170, cd: 1.8, damage: 6, height: 24 },
};

/** Segundos que o guarda fica visível na torre depois de cada arremesso. */
export const GUARD_SHOW = 3;

export function towerSystem(g: Game, dt: number) {
  const side = g.state.towersFaction ?? 'village';
  for (const b of g.state.buildings) {
    const def = DEFENSES[b.type];
    if (!def || !b.built) continue;
    b.cd -= dt;
    if (b.shot) b.shot = Math.max(0, b.shot - dt);
    if (b.cd > 0) continue;
    const c = buildingCenter(b);
    const range = towerRange(b, def.range);
    let best: Unit | null = null;
    let bd = range;
    for (const u of g.state.units) {
      if (u.dead || u.hidden || !canHit(side, undefined, u)) continue;
      const d = Math.hypot(u.x - c.x, u.y - c.y);
      if (d < bd) {
        bd = d;
        best = u;
      }
    }
    if (!best) continue;
    b.cd = def.cd;
    spawnProjectile(g, null, side, c.x, c.y - def.height, best.x, best.y - 6, {
      damage: towerDamage(b, def.damage), radius: 0, nature: null, color: '#cfd6dd', size: 4, speed: 380, kind: 'kunai', stun: 0, range: range + 40,
    });
    // o guarda aparece no alto da torre arremessando e fica uns segundos de vigia (render: GUARD_SHOW)
    b.shot = GUARD_SHOW;
    b.aim = Math.atan2(best.y - c.y, best.x - c.x);
  }
}
