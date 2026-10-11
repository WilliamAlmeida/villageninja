import { describe, expect, test } from 'bun:test';
import { SIM_DT } from '../src/config';
import { JUTSU_LIST, JUTSUS } from '../src/data/jutsus';
import { MOVE_SEQS, moveAt, movesTime } from '../src/data/moves';
import { applyDamage, castJutsu } from '../src/game/combat';
import { createNinja, createRogue } from '../src/game/entities';
import type { Game } from '../src/game/game';
import { createNewGame } from '../src/game/newGame';
import { SYSTEMS } from '../src/game/systems';
import { CENTER_TX, CENTER_TY } from '../src/game/world';

const run = (g: Game, seconds: number) => {
  for (let t = 0; t < seconds; t += SIM_DT) g.step(SIM_DT);
};

/** Ninja forte de frente para alvos parados (sem esquiva, sem Kawarimi). */
function arena(seed: number, foes: [number, number][]) {
  const g = createNewGame(SYSTEMS, seed);
  g.state.nodes = []; // campo limpo: investida não para em árvore ou rocha
  g.world.rebuild();
  // uma faixa livre de 140 px para a investida (sem água, rocha ou prédio no caminho)
  let x = 0;
  let y = 0;
  search: for (let ty = CENTER_TY - 14; ty < CENTER_TY + 14; ty++)
    for (let tx = CENTER_TX - 20; tx < CENTER_TX + 20; tx++) {
      const px = tx * 32 + 16;
      const py = ty * 32 + 16;
      if ([-20, 0, 20].every((oy) => Array.from({ length: 8 }, (_, i) => i * 20).every((ox) => g.world.walkablePx(px + ox, py + oy)))) {
        x = px;
        y = py;
        break search;
      }
    }
  const n = createNinja(g, x, y, 'jounin', 0);
  const stats = n.ninja!.stats;
  for (const k of Object.keys(stats) as (keyof typeof stats)[]) stats[k] = 8;
  g.state.pace = 'fast';
  const rs = foes.map(([dx, dy]) => {
    const r = createRogue(g, x + dx, y + dy, 1);
    r.hp = r.maxHp = 2000;
    r.stun = 99;
    if (r.ninja) r.ninja.stats.velocidade = 0;
    r.kawaCd = 999;
    return r;
  });
  return { g, n, rs };
}

describe('coreografias (data/moves.ts)', () => {
  test('todo passo usa uma folha de pose e um quadro de 0 a 3, com duração e altura válidas', () => {
    const seqs = [...Object.values(MOVE_SEQS), ...JUTSU_LIST.flatMap((j) => (j.moves ? [j.moves] : []))];
    expect(seqs.length).toBeGreaterThan(20);
    for (const seq of seqs)
      for (const [pose, frame, d, h = 0] of seq) {
        expect(['strike', 'kick', 'cast', 'air', 'hurt']).toContain(pose);
        expect(frame).toBeGreaterThanOrEqual(0);
        expect(frame).toBeLessThanOrEqual(3);
        expect(d).toBeGreaterThan(0);
        expect(h).toBeGreaterThanOrEqual(0);
      }
  });

  test('a altura sobe e desce suave e termina no chão', () => {
    const seq = JUTSUS.shishi!.moves!;
    const total = movesTime(seq);
    const peak = Math.max(...Array.from({ length: 40 }, (_, i) => moveAt(seq, (i / 40) * total).h));
    expect(peak).toBeGreaterThan(10);
    expect(moveAt(seq, total).h).toBe(0);
  });
});

describe('jutsus novos', () => {
  test('Ōkashō (investida com área): pega todos em volta do alvo ao chegar', () => {
    const { g, n, rs } = arena(91, [[70, 0], [96, 10], [96, -10]]);
    n.ninja!.jutsu = ['okasho', null];
    castJutsu(g, n, 0, rs[0]!);
    for (let t = 0; t < 2 && n.dash; t += SIM_DT) g.step(SIM_DT); // até chegar
    expect(n.moveJutsu).toBe('okasho'); // a coreografia da chegada
    for (const r of rs) expect(r.hp).toBeLessThan(2000);
  });

  test('Rasengan crava e lança o alvo ao alto (reação no desenho)', () => {
    const { g, n, rs } = arena(92, [[60, 0]]);
    const r = rs[0]!;
    r.ninja = r.ninja ?? createNinja(g, r.x, r.y, 'genin', 0).ninja;
    n.ninja!.jutsu = ['rasengan', null];
    castJutsu(g, n, 0, r);
    run(g, 1.2);
    expect(r.hp).toBeLessThan(2000);
  });

  test('golpe forte derruba (reação hurt-down), leve só faz recuar', () => {
    const { g, n } = arena(93, []);
    const t = createNinja(g, n.x + 20, n.y, 'genin', 0);
    t.maxHp = t.hp = 100;
    t.kawaCd = 999;
    t.ninja!.stats.velocidade = 0;
    applyDamage(g, n, t, 8, null, {});
    expect(t.moveJutsu).toBe('hurt-light');
    applyDamage(g, n, t, 40, null, { knock: 30 });
    expect(t.moveJutsu).toBe('hurt-down');
    expect(t.anim).toBeCloseTo(movesTime(MOVE_SEQS['hurt-down']!), 5);
  });

  test('Rasenshuriken e Hirudora disparam o projétil grande', () => {
    for (const id of ['rasenshuriken', 'hirudora']) {
      const { g, n, rs } = arena(94, [[120, 0]]);
      n.ninja!.jutsu = [id, null];
      castJutsu(g, n, 0, rs[0]!);
      expect(g.state.projectiles.some((p) => p.size >= 13)).toBe(true);
    }
  });
});
