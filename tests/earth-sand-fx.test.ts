import { describe, expect, test } from 'bun:test';
import { castJutsu } from '../src/game/combat';
import { createNinja, createRogue } from '../src/game/entities';
import { createNewGame } from '../src/game/newGame';
import { SYSTEMS } from '../src/game/systems';
import { effectSystem } from '../src/game/systems/effects';
import { CENTER_TX, CENTER_TY } from '../src/game/world';
import { sandCoffinFrame, wallFrame, wallUsesProfile, wallView } from '../src/render/earthSandMotion';

describe('fases dos efeitos de terra e areia', () => {
  test('diagonais usam folha com volume, incluindo a direção do print de regressão', () => {
    for (const [dx, dy] of [[24, 12], [24, -12], [-24, 12], [-24, -12], [16, 15]]) {
      expect(wallView(dx!, dy!)).toBe('oblique');
      expect(wallView(-dx!, -dy!)).toBe('oblique');
    }
    expect(wallView(34, 0)).toBe('front');
    expect(wallView(0, 17)).toBe('profile');
  });
  test('perfil apenas nas bases quase verticais', () => {
    expect(wallUsesProfile(0, 24)).toBe(true);
    expect(wallUsesProfile(8, -20)).toBe(true);
    expect(wallUsesProfile(-8, 20)).toBe(true);
    expect(wallUsesProfile(32, 0)).toBe(false);
    expect(wallUsesProfile(24, 12)).toBe(false);
    expect(wallUsesProfile(-24, -12)).toBe(false);
  });
  test('muralha permanece inteira até o fim e a anterior encurtada desmorona', () => {
    expect(wallFrame(0, 6)).toBe(0);
    expect(wallFrame(.2, 5.8)).toBe(2);
    for (const age of [.25, 1, 3, 5.5]) expect([3, 4]).toContain(wallFrame(age, 6 - age));
    expect(wallFrame(2, .3)).toBeGreaterThanOrEqual(5);
    expect(wallFrame(5.99, .01)).toBe(7);
  });
  test('casulo mantém o alvo coberto durante a prisão e só desmancha no fim', () => {
    expect(sandCoffinFrame(2.4, 2.4)).toBe(0);
    expect(sandCoffinFrame(2.05, 2.4)).toBe(2);
    for (const remaining of [1.9, 1.5, 1, .7]) expect(sandCoffinFrame(remaining, 2.4)).toBe(3);
    expect(sandCoffinFrame(.6, 2.4)).toBe(4);
    expect(sandCoffinFrame(.4, 2.4)).toBe(5);
    expect(sandCoffinFrame(.2, 2.4)).toBe(6);
    expect(sandCoffinFrame(.1, 2.4)).toBe(7);
  });
  test('Doryuudan cria uma fonte fixa e só um projétil; a fonte expira sem seguir o ninja', () => {
    const g = createNewGame(SYSTEMS, 9301);
    g.state.pace = 'fast';
    const x = (CENTER_TX + 6) * 32, y = (CENTER_TY + 6) * 32;
    const n = createNinja(g, x, y, 'jounin', 0), target = createRogue(g, x + 90, y, 1);
    n.ninja!.jutsu = ['doryuudan', null];
    n.chakra = n.maxChakra = 400;
    castJutsu(g, n, 0, target);
    const origins = g.state.effects.filter(e => e.kind === 'jutsuOrigin');
    expect(origins.length).toBe(1);
    expect(g.state.projectiles.length).toBe(1);
    expect(origins[0]!.fx).toBe('doryuudan');
    expect(origins[0]!.x).toBe(g.state.projectiles[0]!.x);
    expect(origins[0]!.y).toBe(g.state.projectiles[0]!.y);
    n.x += 80;
    effectSystem(g, .3);
    expect(origins[0]!.x).toBe(x);
    effectSystem(g, .4);
    expect(g.state.effects.some(e => e.kind === 'jutsuOrigin')).toBe(false);
  });
});
