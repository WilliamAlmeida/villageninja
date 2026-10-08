import { describe, expect, test } from 'bun:test';
import { SAVE_VERSION, SIM_DT } from '../src/config';
import { STRIKE_ANIM } from '../src/game/combat';
import { createNinja, createRogue } from '../src/game/entities';
import type { Game } from '../src/game/game';
import { createNewGame } from '../src/game/newGame';
import { migrate } from '../src/game/save';
import { SYSTEMS } from '../src/game/systems';
import { blink } from '../src/game/techniques';
import { CENTER_TX, CENTER_TY } from '../src/game/world';

const run = (g: Game, seconds: number, until?: () => boolean) => {
  for (let t = 0; t < seconds; t += SIM_DT) {
    g.step(SIM_DT);
    if (until?.()) return;
  }
};

describe('golpe comum com o dano no auge do avanço', () => {
  test('o dano entra depois do avanço começar, não no mesmo passo', () => {
    const g = createNewGame(SYSTEMS, 77);
    const x = (CENTER_TX + 8) * 32;
    const y = (CENTER_TY + 8) * 32;
    const n = createNinja(g, x, y, 'jounin', 0);
    n.ninja!.jutsu = [null, null];
    n.chakra = 0;
    const r = createRogue(g, x + 14, y, 1);
    r.hp = r.maxHp = 500;
    r.stun = 99; // parado e sem revidar
    if (r.ninja) r.ninja.stats.velocidade = 0; // sem esquiva
    r.kawaCd = 999; // nem Kawarimi
    run(g, 5, () => !!n.strike);
    expect(n.strike).toBeDefined();
    expect(r.hp).toBe(500); // marcado, ainda sem dano
    run(g, STRIKE_ANIM);
    expect(r.hp).toBeLessThan(500);
    expect(n.strike).toBeUndefined(); // o avanço acabou: a espada volta às costas
  });

  test('Shunshin marca a aterrissagem (esmaga e estica, só desenho)', () => {
    const g = createNewGame(SYSTEMS, 78);
    const n = createNinja(g, 600, 600, 'jounin', 0);
    blink(g, n, { x: 700, y: 600 }, 'leaf');
    expect(n.landT).toBeGreaterThan(0);
    run(g, 0.5);
    expect(n.landT).toBeUndefined();
  });

  test('migra saves da versão 25', () => {
    const g = createNewGame(SYSTEMS, 79);
    const old = JSON.parse(JSON.stringify(g.state));
    old.version = 25;
    const s = migrate(old)!;
    expect(s.version).toBe(SAVE_VERSION);
  });
});
