import { describe, expect, test } from 'bun:test';
import { SIM_DT } from '../src/config';
import { refreshDerived } from '../src/game/entities';
import type { Game } from '../src/game/game';
import { createNewGame } from '../src/game/newGame';
import { regionOf, startRegion } from '../src/game/region';
import { migrate } from '../src/game/save';
import { retreatScene, sceneFoes, sceneGame, sceneTeam } from '../src/game/scene';
import { SYSTEMS } from '../src/game/systems';
import { teamUnits } from '../src/game/teams';

const run = (g: Game, seconds: number, until?: () => boolean) => {
  for (let t = 0; t < seconds; t += SIM_DT) {
    g.step(SIM_DT);
    if (until?.()) return;
  }
};
function setup(seed: number, stats = 8) {
  const g = createNewGame(SYSTEMS, seed);
  Object.assign(g.state.res, { wood: 999, stone: 999, food: 999, ryo: 9999 });
  const team = g.state.teams[0]!;
  for (const u of teamUnits(g, team)) {
    const n = u.ninja!;
    n.rank = 'jounin';
    n.level = 15;
    for (const k of Object.keys(n.stats) as (keyof typeof n.stats)[]) n.stats[k] = stats;
    refreshDerived(u);
    u.hp = u.maxHp;
  }
  return { g, team };
}

describe('mapa de missão jogável (invasão de vilarejo)', () => {
  test('saquear abre o mapa: vila inimiga com armazém, torres e guardas; a equipe é copiada para lá', () => {
    const { g, team } = setup(901);
    expect(startRegion(g, team.id, 'arroz', 'raid').ok).toBe(true);
    run(g, 20, () => !!g.state.scene);
    const sg = sceneGame(g)!;
    expect(sg).not.toBeNull();
    const info = sg.state.sceneInfo!;
    expect(sg.state.buildings.some((b) => b.id === info.warehouseId && b.type === 'market')).toBe(true);
    expect(sg.state.buildings.some((b) => b.type === 'tower')).toBe(true);
    expect(sceneFoes(sg).length).toBeGreaterThanOrEqual(3);
    expect(sceneTeam(sg).length).toBe(teamUnits(g, team).length);
    // os originais ficam fora do mapa da vila
    expect(teamUnits(g, team).every((u) => u.away != null && u.hidden)).toBe(true);
  });

  test('a luta no mapa decide o saque; XP e vida voltam para os ninjas da vila', () => {
    const { g, team } = setup(902);
    const xp0 = teamUnits(g, team).map((u) => u.ninja!.level * 1000 + u.ninja!.xp);
    startRegion(g, team.id, 'arroz', 'raid');
    const e = g.state.expeditions.at(-1)!;
    run(g, 400, () => e.status === 'done' || e.status === 'lost');
    expect(e.status).toBe('done');
    expect(g.state.scene ?? null).toBeNull();
    expect(regionOf(g.state, 'arroz').status).toBe('hostile');
    const xp1 = teamUnits(g, team).map((u) => u.ninja!.level * 1000 + u.ninja!.xp);
    expect(xp1.some((v, i) => v > xp0[i]!)).toBe(true);
  });

  test('recuar encerra a invasão sem o saque; o mapa sobrevive ao salvar e carregar', () => {
    const { g, team } = setup(903);
    startRegion(g, team.id, 'arroz', 'raid');
    run(g, 20, () => !!g.state.scene);
    const saved = JSON.parse(JSON.stringify(g.state));
    const back = migrate(saved)!;
    expect(back.scene?.sceneInfo?.kind).toBe('village');
    retreatScene(g);
    const e = g.state.expeditions.at(-1)!;
    run(g, 60, () => e.status === 'done');
    expect(e.status).toBe('done');
    expect(regionOf(g.state, 'arroz').status).not.toBe('hostile');
  });
});
