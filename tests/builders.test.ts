import { expect, test } from 'bun:test';
import { placeBuilding } from '../src/game/commands';
import { createNewGame } from '../src/game/newGame';
import { SYSTEMS } from '../src/game/systems';

test('obra avança mesmo quando todos os moradores já têm emprego', () => {
  const g = createNewGame(SYSTEMS);
  g.state.res.wood = 999;
  g.state.res.stone = 999;
  // todo morador empregado antes de existir qualquer obra
  for (const b of g.state.buildings) if (b.built) b.desired = 99;
  for (let i = 0; i < 300; i++) g.step(1 / 60);
  const villagers = () => g.state.units.filter((u) => u.kind === 'villager');
  expect(villagers().every((u) => u.jobId != null)).toBe(true);

  // duas casas no primeiro lugar livre perto do centro (o mapa é aleatório)
  const hk = g.hokage()!;
  let placed = 0;
  for (let r = 4; r < 14 && placed < 2; r++)
    for (let dx = -r; dx <= r && placed < 2; dx += 2)
      for (const dy of [-r, r]) if (placed < 2 && placeBuilding(g, 'house', hk.tx + dx, hk.ty + dy).ok) placed++;
  expect(placed).toBe(2);
  const sites = g.state.buildings.filter((b) => !b.built);
  for (let i = 0; i < 60 * 20; i++) {
    g.state.time = 30; // mantém de dia (à noite ninguém constrói)
    g.step(1 / 60);
  }
  // antes da correção as duas ficavam em 0% para sempre
  expect(sites.some((b) => b.built || b.progress > 0)).toBe(true);
  expect(villagers().some((u) => u.jobId == null)).toBe(true);
});
