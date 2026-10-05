import { describe, expect, test } from 'bun:test';
import { createNinja } from '../src/game/entities';
import type { Game } from '../src/game/game';
import { createNewGame } from '../src/game/newGame';
import { trainTick } from '../src/game/progression';
import { hasSlot, marketSale, pickField, setFieldFocus, setMarketGood, trainees } from '../src/game/specialize';
import { SYSTEMS } from '../src/game/systems';
import type { BuildingType } from '../src/data/buildings';

const place = (g: Game, type: BuildingType, tx: number, ty: number, level = 1) =>
  g.addBuilding({ id: g.newId(), type, tx, ty, built: true, progress: 999, desired: 1, workers: [], cd: 0, level });

describe('prédios repetidos com papel próprio', () => {
  test('campo de treino tem vagas; cheio, o ninja vai ao próximo (o mais perto primeiro)', () => {
    const g = createNewGame(SYSTEMS, 501);
    const near = place(g, 'training', 10, 10);
    const far = place(g, 'training', 40, 30);
    const ninjas = Array.from({ length: 5 }, () => createNinja(g, 10 * 32, 12 * 32, 'genin', 0));
    for (const u of ninjas) {
      const f = pickField(g, u)!;
      u.trainId = f.id;
      u.state = 'toTrain';
    }
    expect(trainees(g, near)).toBe(3); // nível 1: 3 vagas
    expect(trainees(g, far)).toBe(2);
    expect(hasSlot(g, near)).toBe(false);
    // a última vaga do campo longe; depois disso ninguém acha vaga
    const last = createNinja(g, 10 * 32, 12 * 32, 'genin', 0);
    last.trainId = pickField(g, last)!.id;
    last.state = 'train';
    expect(pickField(g, createNinja(g, 0, 0, 'genin', 0))).toBeNull();
  });

  test('ninja prefere o campo do seu foco; sem foco próprio, treina o foco do campo com bônus', () => {
    const g = createNewGame(SYSTEMS, 502);
    place(g, 'training', 10, 10);
    const forca = place(g, 'training', 40, 30);
    expect(setFieldFocus(g, forca.id, 'forca').ok).toBe(true);
    const u = createNinja(g, 10 * 32, 12 * 32, 'genin', 0);
    u.ninja!.focus = 'forca';
    expect(pickField(g, u)).toBe(forca);
    // sem foco: o campo decide o atributo, com +50%
    const a = createNinja(g, 0, 0, 'genin', 0);
    const b = createNinja(g, 0, 0, 'genin', 0);
    a.ninja!.focus = null;
    b.ninja!.focus = 'forca';
    a.ninja!.stats.forca = b.ninja!.stats.forca = 1;
    a.ninja!.stats.inteligencia = b.ninja!.stats.inteligencia = 2;
    trainTick(g, a, null, forca);
    trainTick(g, b, null, undefined);
    expect(a.ninja!.stats.forca - 1).toBeCloseTo((b.ninja!.stats.forca - 1) * 1.5, 5);
  });

  test('mercado vende só o excedente da mercadoria escolhida', () => {
    const g = createNewGame(SYSTEMS, 503);
    const m = place(g, 'market', 10, 10);
    expect(marketSale(g, m)).toBe(0); // sem mercadoria escolhida
    expect(setMarketGood(g, m.id, 'wood').ok).toBe(true);
    g.state.res.wood = 300;
    const ryo = g.state.res.ryo;
    const got = marketSale(g, m);
    expect(got).toBeGreaterThan(0);
    expect(g.state.res.wood).toBe(294);
    expect(g.state.res.ryo).toBe(ryo + got);
    g.state.res.wood = 152; // perto da reserva (150): vende só o que passa
    marketSale(g, m);
    expect(g.state.res.wood).toBe(150);
    expect(marketSale(g, m)).toBe(0);
  });
});
