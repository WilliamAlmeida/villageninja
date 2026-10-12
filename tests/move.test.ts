import { expect, test } from 'bun:test';
import { canMove, moveBuilding, placeBuilding } from '../src/game/commands';
import { createNewGame } from '../src/game/newGame';
import { territoryRadius } from '../src/game/village';
import { doorPos } from '../src/game/world';

/** Primeiro lugar livre para o tipo, perto da Residência do Hokage. */
function freeSpot(g: ReturnType<typeof createNewGame>, fits: (tx: number, ty: number) => boolean) {
  const hk = g.hokage()!;
  for (let r = 3; r < 14; r++)
    for (let dx = -r; dx <= r; dx++) for (const dy of [-r, r]) if (fits(hk.tx + dx, hk.ty + dy)) return { tx: hk.tx + dx, ty: hk.ty + dy };
  throw new Error('sem lugar livre');
}

test('mover prédio: muda de lugar, de graça, e leva quem está dentro', () => {
  const g = createNewGame([]);
  const house = g.state.buildings.find((b) => b.type === 'house')!;
  const resBefore = { ...g.state.res };
  const u = g.villagers()[0]!;
  const d0 = doorPos(house);
  Object.assign(u, { x: d0.x, y: d0.y, hidden: true, state: 'sleep' });

  const to = freeSpot(g, (tx, ty) => canMove(g, house.id, tx, ty).ok);
  expect(moveBuilding(g, house.id, to.tx, to.ty).ok).toBe(true);
  expect([house.tx, house.ty]).toEqual([to.tx, to.ty]);
  expect(g.world.buildingIdAt(to.tx, to.ty)).toBe(house.id);
  const d1 = doorPos(house);
  expect([u.x, u.y]).toEqual([d1.x, d1.y]);
  expect(g.state.res.stone).toBe(resBefore.stone);
  expect(g.state.res.ryo).toBe(resBefore.ryo);
});

test('mover prédio: recusa lugar ocupado e fora do território', () => {
  const g = createNewGame([]);
  const [a, b] = g.state.buildings.filter((x) => x.type === 'house');
  expect(canMove(g, a!.id, b!.tx, b!.ty).ok).toBe(false);
  expect(canMove(g, a!.id, 1, 1).ok).toBe(false);
  // nada mudou depois das tentativas
  expect(g.world.buildingIdAt(a!.tx, a!.ty)).toBe(a!.id);
  expect(g.world.buildingIdAt(b!.tx, b!.ty)).toBe(b!.id);
});

test('mover a Residência do Hokage não pode deixar prédios fora do território', () => {
  const g = createNewGame([]);
  g.state.res.wood = 999;
  g.state.res.stone = 999;
  const hk = g.hokage()!;
  // prédio na borda do território: arrastar o centro para longe o deixaria de fora
  const r = territoryRadius(g.state);
  let edge: { tx: number; ty: number } | null = null;
  for (let dx = r - 5; dx <= r - 2 && !edge; dx++)
    for (const sx of [1, -1])
      for (let dy = -2; dy <= 2 && !edge; dy++) if (g.world.canPlace('house', hk.tx + sx * dx, hk.ty + dy)) edge = { tx: hk.tx + sx * dx, ty: hk.ty + dy };
  expect(edge).not.toBeNull();
  edge = edge!;
  expect(placeBuilding(g, 'house', edge.tx, edge.ty).ok).toBe(true);
  const far = { tx: hk.tx + (hk.tx > edge.tx ? 9 : -9), ty: hk.ty };
  expect(canMove(g, hk.id, far.tx, far.ty).ok).toBe(false);
});
