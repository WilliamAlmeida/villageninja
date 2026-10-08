import { describe, expect, test } from 'bun:test';
import { SIM_DT } from '../src/config';
import { applyDamage, spawnProjectile } from '../src/game/combat';
import { createNinja, createRogue } from '../src/game/entities';
import { createNewGame } from '../src/game/newGame';
import { SYSTEMS } from '../src/game/systems';
import { projectileSystem } from '../src/game/systems/projectiles';
import { raiseWall, wallCovers, wallOf } from '../src/game/walls';
import { CENTER_TX, CENTER_TY } from '../src/game/world';

describe('Doryuuheki: muralha parada no chão', () => {
  const setup = () => {
    const g = createNewGame(SYSTEMS, 4401);
    const x = (CENTER_TX + 8) * 32;
    const y = (CENTER_TY + 8) * 32;
    const n = createNinja(g, x, y, 'jounin', 0);
    const r = createRogue(g, x + 120, y, 1);
    n.shield = 6;
    n.shieldVfx = 'earth';
    raiseWall(g, n, 6, '#a87b45');
    return { g, n, r };
  };

  test('brota entre o ninja e o inimigo e não anda com ele', () => {
    const { g, n } = setup();
    const w = wallOf(g, n)!;
    expect(w.x).toBeGreaterThan(n.x); // do lado do inimigo
    const wx = w.x;
    n.x -= 80;
    expect(wallOf(g, n)!.x).toBe(wx);
  });

  test('protege só quem ficou perto dela', () => {
    const { g, n, r } = setup();
    expect(wallCovers(g, n)).toBe(true);
    n.hp = n.maxHp = 1000;
    applyDamage(g, r, n, 100, null, {});
    const near = 1000 - n.hp;
    n.x -= 80;
    expect(wallCovers(g, n)).toBe(false);
    n.hp = 1000;
    applyDamage(g, r, n, 100, null, {});
    expect(1000 - n.hp).toBeGreaterThan(near * 1.5);
  });

  test('para o projétil inimigo que bate nela', () => {
    const { g, n, r } = setup();
    n.hp = n.maxHp = 1000;
    spawnProjectile(g, r, r.faction, r.x, n.y, n.x, n.y, { damage: 50, radius: 0, nature: null, color: '#fff', size: 4, speed: 300, kind: 'kunai', stun: 0, range: 300 });
    for (let t = 0; t < 1; t += SIM_DT) projectileSystem(g, SIM_DT);
    expect(n.hp).toBe(1000);
  });
});
