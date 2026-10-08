import { describe, expect, test } from 'bun:test';
import { DAY_LENGTH, SIM_DT, TILE } from '../src/config';
import { SITE_RESPAWN_DAYS } from '../src/data/sites';
import { createNinja, createRogue } from '../src/game/entities';
import { CHEST_LINGER, doneFor } from '../src/game/explore';
import type { Game } from '../src/game/game';
import { createNewGame } from '../src/game/newGame';
import { SYSTEMS } from '../src/game/systems';
import { DEFEND_CAP } from '../src/game/systems/ninjas';
import type { ResourceNode, Site } from '../src/game/types';
import { CENTER_TX, CENTER_TY, nodeArt } from '../src/game/world';

const run = (g: Game, seconds: number) => {
  for (let t = 0; t < seconds; t += SIM_DT) g.step(SIM_DT);
};

describe('defesa proporcional', () => {
  test('um invasor dentro da vila não puxa todos os ninjas: os de longe param no limite', () => {
    const g = createNewGame(SYSTEMS, 3301);
    g.state.level = 3; // território grande
    const cx = CENTER_TX * TILE;
    const cy = CENTER_TY * TILE;
    const ninjas = Array.from({ length: 14 }, (_, i) => createNinja(g, cx - 160 + (i % 7) * 12, cy + 40 + Math.floor(i / 7) * 12, 'chunin', 0));
    const r = createRogue(g, cx + 260, cy + 40, 1);
    r.stun = 99; // parado: ninguém chega perto dele por conta própria
    r.hp = r.maxHp = 5000;
    expect(g.world.inVillage(r.x, r.y)).toBe(true);
    run(g, 1);
    const on = ninjas.filter((u) => u.targetId === r.id && u.state === 'fight').length;
    expect(on).toBeGreaterThan(0);
    expect(on).toBeLessThanOrEqual(DEFEND_CAP);
  });
});

describe('locais e recursos', () => {
  test('baú aberto fica alguns segundos e depois some (doneFor passa de CHEST_LINGER)', () => {
    const full = SITE_RESPAWN_DAYS.chest * DAY_LENGTH;
    const site = { kind: 'chest', done: true } as Site;
    expect(doneFor(site)).toBe(0);
    site.respawn = full - (CHEST_LINGER + 1);
    expect(doneFor(site)).toBeGreaterThan(CHEST_LINGER);
  });

  test('estágios: toco de cada árvore, rocha some deixando pedrinhas, veio sem cristais', () => {
    const n = (type: ResourceNode['type'], amount: number, variant = 0) => ({ id: 1, type, tx: 0, ty: 0, amount, max: 40, variant }) as ResourceNode;
    expect(nodeArt(n('tree', 2, 0))).toBe('stump0');
    expect(nodeArt(n('tree', 2, 3))).toBe('stump1');
    expect(nodeArt(n('rock', 40))).toBe('rock');
    expect(nodeArt(n('rock', 10))).toBe('rock-cracked');
    expect(nodeArt(n('rock', 0))).toBe('rock-pebbles');
    expect(nodeArt(n('ore', 40))).toBe('ore');
    expect(nodeArt(n('ore', 0))).toBe('ore-empty');
  });
});
