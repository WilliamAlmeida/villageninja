import { FOOD_PER_DAY, DAY_LENGTH } from '../../config';
import { BUILDINGS } from '../../data/buildings';
import { derive } from '../../data/ninja';
import type { Game } from '../game';
import { doorPos } from '../world';

/** Cooldowns, regeneração, fome e cura em prédios. */
export function statusSystem(g: Game, dt: number) {
  const s = g.state;

  // consumo de comida
  const pop = g.population();
  s.res.food = Math.max(0, s.res.food - (pop * FOOD_PER_DAY * dt) / DAY_LENGTH);
  const starving = s.res.food <= 0 && pop > 0;
  if (starving !== s.flags.starving) {
    s.flags.starving = starving;
    if (starving) g.toast('🍙 A vila está passando fome! Construa fazendas.', 'danger');
  }

  const healers = s.buildings.filter((b) => b.built && BUILDINGS[b.type].healRate).map((b) => ({ ...doorPos(b), rate: BUILDINGS[b.type].healRate! }));

  for (const u of s.units) {
    if (u.dead) continue;
    u.attackCd = Math.max(0, u.attackCd - dt);
    u.stun = Math.max(0, u.stun - dt);
    u.shield = Math.max(0, u.shield - dt);
    u.hitFlash = Math.max(0, u.hitFlash - dt);
    u.anim = Math.max(0, u.anim - dt);
    u.combatTimer = Math.max(0, u.combatTimer - dt);
    if (u.ninja) {
      u.ninja.cd[0] = Math.max(0, u.ninja.cd[0] - dt);
      u.ninja.cd[1] = Math.max(0, u.ninja.cd[1] - dt);
      u.chakra = Math.min(u.maxChakra, u.chakra + derive(u.ninja.stats).chakraRegen * dt);
    }
    if (u.faction === 'village' && u.kind !== 'clone') {
      if (starving) u.hp = Math.max(1, u.hp - 0.15 * dt);
      else if (u.combatTimer <= 0) {
        let regen = 0.5;
        if (u.state === 'rest' || u.state === 'cmdRest' || u.hidden)
          for (const h of healers) if (Math.hypot(h.x - u.x, h.y - u.y) < 48) regen = Math.max(regen, h.rate);
        u.hp = Math.min(u.maxHp, u.hp + regen * dt);
      }
    } else if (u.combatTimer <= 0) {
      u.hp = Math.min(u.maxHp, u.hp + 0.4 * dt);
    }
  }
}
