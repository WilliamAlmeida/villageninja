import { describe, expect, test } from 'bun:test';
import { SAVE_VERSION } from '../src/config';
import { BUILDINGS, defOf } from '../src/data/buildings';
import type { Game } from '../src/game/game';
import { createNewGame } from '../src/game/newGame';
import { migrate } from '../src/game/save';
import { SYSTEMS } from '../src/game/systems';
import type { Building } from '../src/game/types';
import { growRoom, startUpgrade, syncHokage, upgradeTime, workUpgrade } from '../src/game/upgrade';
import { CENTER_TX, CENTER_TY, doorTile, hasWater, idx, isShore, T } from '../src/game/world';
import { layout, type TypeLayout, typeLayout } from '../src/data/layout';
import { placeBuilding } from '../src/game/commands';

/** Casa nível 2 pronta num lugar com espaço de sobra em volta (para crescer para 3×3). */
const setup = (seed: number) => {
  const g = createNewGame(SYSTEMS, seed);
  g.state.level = 3;
  Object.assign(g.state.res, { wood: 9999, stone: 9999, ryo: 9999 });
  let spot: { tx: number; ty: number } | null = null;
  for (let r = 5; r < 20 && !spot; r++)
    for (let a = 0; a < 24 && !spot; a++) {
      const tx = CENTER_TX + Math.round(Math.cos(a) * r);
      const ty = CENTER_TY + Math.round(Math.sin(a) * r);
      if (g.world.canPlace('house', tx, ty, false, 3)) spot = { tx, ty };
    }
  const b = g.addBuilding({ id: g.newId(), type: 'house', ...spot!, built: true, progress: 99, desired: 0, workers: [], cd: 0, level: 2 }) as Building;
  g.world.rebuild();
  return { g, b };
};
const finish = (g: Game, b: Building) => workUpgrade(g, b, upgradeTime(b) + 1);

describe('prédio que cresce no upgrade (casa nível 3 = 3×3)', () => {
  test('com espaço: a obra começa e, pronta, a casa ocupa 3×3', () => {
    const { g, b } = setup(1201);
    expect(defOf(b).w).toBe(2);
    expect(startUpgrade(g, b.id).ok).toBe(true);
    finish(g, b);
    expect(b.level).toBe(3);
    expect([defOf(b).w, defOf(b).h]).toEqual([3, 3]);
    expect(g.world.buildingIdAt(b.tx + 2, b.ty + 2)).toBe(b.id);
  });

  test('sem espaço: o upgrade diz por quê; se fecharem o espaço durante a obra, ela espera', () => {
    const { g, b } = setup(1202);
    // um prédio colado à direita
    g.addBuilding({ id: g.newId(), type: 'lantern', tx: b.tx + 3, ty: b.ty, built: true, progress: 99, desired: 0, workers: [], cd: 0 });
    g.world.rebuild();
    expect(growRoom(g, b, 3)).toContain('3×3');
    expect(startUpgrade(g, b.id).ok).toBe(false);
    // libera, começa, fecha de novo e termina a obra: fica esperando no nível 2
    g.state.buildings = g.state.buildings.filter((o) => o.type !== 'lantern');
    g.world.rebuild();
    expect(startUpgrade(g, b.id).ok).toBe(true);
    g.addBuilding({ id: g.newId(), type: 'lantern', tx: b.tx + 3, ty: b.ty, built: true, progress: 99, desired: 0, workers: [], cd: 0 });
    g.world.rebuild();
    finish(g, b);
    expect(b.level).toBe(2);
    expect(b.waitRoom).toBe(true);
  });

  test('save v33 → v34: a casa que já era nível 3 cresce no lugar (ou muda se encostar)', () => {
    const { g, b } = setup(1203);
    b.level = 3;
    const s = JSON.parse(JSON.stringify(g.state));
    s.version = 33;
    const m = migrate(s)!;
    expect(m.version).toBe(SAVE_VERSION);
    const h = m.buildings.find((o) => o.id === b.id)!;
    for (const o of m.buildings) {
      if (o === h) continue;
      const d = defOf(o);
      const overlap = h.tx < o.tx + d.w && h.tx + 3 > o.tx && h.ty < o.ty + d.h && h.ty + 3 > o.ty;
      expect(overlap).toBe(false);
    }
  });
});

describe('Residência do Hokage cresce com a vila (3×3, 3×3, 4×4, 5×5)', () => {
  test('vila sobe de nível: a Residência acompanha e ocupa o terreno do nível', () => {
    const g = createNewGame(SYSTEMS, 1301);
    const hk = g.hokage()!;
    expect([defOf(hk).w, defOf(hk).h]).toEqual([3, 3]);
    g.state.level = 2;
    syncHokage(g);
    expect(hk.level).toBe(3);
    expect([defOf(hk).w, defOf(hk).h]).toEqual([4, 4]);
    g.state.level = 3;
    syncHokage(g);
    expect(hk.level).toBe(4);
    expect(g.world.buildingIdAt(hk.tx + 4, hk.ty + 4)).toBe(hk.id);
  });

  test('sem espaço, espera; liberado, cresce', () => {
    const g = createNewGame(SYSTEMS, 1302);
    const hk = g.hokage()!;
    const block = g.addBuilding({ id: g.newId(), type: 'lantern', tx: hk.tx + 4, ty: hk.ty, built: true, progress: 99, desired: 0, workers: [], cd: 0 });
    g.world.rebuild();
    g.state.level = 2;
    syncHokage(g);
    expect(hk.level ?? 1).toBe(2); // o 3×3 do nível 2 cabe; o 4×4 encosta na lanterna
    expect(hk.waitRoom).toBe(true);
    g.state.buildings = g.state.buildings.filter((b) => b !== block);
    g.world.rebuild();
    syncHokage(g);
    expect(hk.level).toBe(3);
    expect(hk.waitRoom).toBeUndefined();
  });

  test('save v36 → v37: a Residência ganha o nível da vila e cresce sem encostar em ninguém', () => {
    const g = createNewGame(SYSTEMS, 1303);
    g.state.level = 3;
    const s = JSON.parse(JSON.stringify(g.state));
    s.version = 36;
    const m = migrate(s)!;
    const hk = m.buildings.find((b) => b.type === 'hokage')!;
    expect(hk.level).toBe(4);
    for (const o of m.buildings) {
      if (o === hk) continue;
      const d = defOf(o);
      expect(hk.tx < o.tx + d.w && hk.tx + 5 > o.tx && hk.ty < o.ty + d.h && hk.ty + 5 > o.ty).toBe(false);
    }
  });
});

test('save v37 → v38: nível 3 de mercado/academia/hospital… cresce sem sobrepor; sem lugar, volta ao 2 esperando espaço', () => {
  const { g, b } = setup(1401);
  b.type = 'market';
  b.level = 3;
  const s = JSON.parse(JSON.stringify(g.state));
  s.version = 37;
  const m = migrate(s)!;
  const mk = m.buildings.find((o) => o.id === b.id)!;
  if (mk.waitRoom) expect(mk.level).toBe(2);
  else expect([defOf(mk).w, defOf(mk).h]).toEqual([3, 3]);
  for (const o of m.buildings) {
    if (o === mk) continue;
    const d = defOf(o);
    const e = defOf(mk);
    expect(mk.tx < o.tx + d.w && mk.tx + e.w > o.tx && mk.ty < o.ty + d.h && mk.ty + e.h > o.ty).toBe(false);
  }
});

describe('girar (espelhar) qualquer prédio', () => {
  test('terreno retangular troca largura e altura; a colisão segue o lado escolhido', () => {
    const { g } = setup(1501);
    g.state.level = 3;
    Object.assign(g.state.res, { wood: 9999, stone: 9999, ryo: 9999 });
    expect([defOf({ type: 'hospital' }).w, defOf({ type: 'hospital' }).h]).toEqual([3, 2]);
    expect([defOf({ type: 'hospital', flip: true }).w, defOf({ type: 'hospital', flip: true }).h]).toEqual([2, 3]);
    let spot: { tx: number; ty: number } | null = null;
    for (let r = 6; r < 30 && !spot; r++)
      for (let a = 0; a < 32 && !spot; a++) {
        const tx = CENTER_TX + Math.round(Math.cos(a) * r);
        const ty = CENTER_TY + Math.round(Math.sin(a) * r);
        if (g.world.canPlace('hospital', tx, ty, true) && g.world.canPlace('hospital', tx, ty, false)) spot = { tx, ty };
      }
    expect(placeBuilding(g, 'hospital', spot!.tx, spot!.ty, true).ok).toBe(true);
    const h = g.state.buildings.find((b) => b.type === 'hospital')!;
    expect(h.flip).toBe(true);
    expect(g.world.buildingIdAt(h.tx + 1, h.ty + 2)).toBe(h.id); // 2 de largura, 3 de altura
    expect(g.world.buildingIdAt(h.tx + 2, h.ty)).not.toBe(h.id);
  });

  test('sem porta marcada, a porta espelhada fica na face da frente-direita', () => {
    const b = { type: 'market', tx: 10, ty: 10 } as Building;
    expect(doorTile(b)).toEqual({ tx: 11, ty: 12 });
    expect(doorTile({ ...b, flip: true } as Building)).toEqual({ tx: 12, ty: 11 });
  });
});

describe('célula de água no terreno: o tile pode ficar na água, sem obrigação (só o Porto é de margem)', () => {
  test('lenhador nível 3 não é prédio de margem e sobe de nível em terra firme', () => {
    const { g, b } = setup(1601);
    b.type = 'lumber';
    b.level = 2;
    g.world.rebuild();
    expect(isShore({ type: 'lumber', level: 3 })).toBe(false);
    expect(isShore({ type: 'port' })).toBe(true);
    expect(hasWater({ type: 'lumber', level: 3 })).toBe(!!typeLayout('lumber-3')?.tiles?.some((r) => r.includes('~')));
    expect(growRoom(g, b, 3)).toBeNull();
  });

  test('água do mapa só sob um tile com célula de água; a porta em terra firme', () => {
    const { g } = setup(1602);
    const s = g.state;
    // terreno de teste: 2×2 com a linha de baixo em água (a roda d'água), porta na face de cima... sem porta marcada a
    // porta fica abaixo (ty + h), então a água do mapa vai na linha de cima do terreno
    layout().types['market-9'] = { tiles: ['..~~', '..~~', '....', '....'] } as TypeLayout;
    BUILDINGS.market.sizes = { ...(BUILDINGS.market.sizes ?? {}), 9: [2, 2] };
    try {
      const tx = CENTER_TX - 12;
      const ty = CENTER_TY + 10;
      for (let x = tx - 2; x <= tx + 4; x++) for (let y = ty - 2; y <= ty + 4; y++) s.tiles[idx(s, x, y)] = T.GRASS;
      s.nodes = s.nodes.filter((n) => n.tx < tx - 2 || n.tx > tx + 4 || n.ty < ty - 2 || n.ty > ty + 4);
      g.world.rebuild();
      expect(g.world.canPlace('market', tx, ty, false, 9)).toBe(true);
      // água sob o tile da direita de cima (célula de água): pode
      s.tiles[idx(s, tx + 1, ty)] = T.WATER;
      expect(g.world.canPlace('market', tx, ty, false, 9)).toBe(true);
      expect(g.world.groundBlock('market', tx, ty, false, 9)).toBeNull();
      // água sob um tile sem célula de água: não
      s.tiles[idx(s, tx, ty + 1)] = T.WATER;
      expect(g.world.canPlace('market', tx, ty, false, 9)).toBe(false);
      expect(g.world.groundBlock('market', tx, ty, false, 9)).toContain('parte de água');
      s.tiles[idx(s, tx, ty + 1)] = T.GRASS;
      // porta (abaixo do prédio) na água: não
      s.tiles[idx(s, tx + 1, ty + 2)] = T.WATER;
      expect(g.world.groundBlock('market', tx, ty, false, 9)).toContain('porta');
      // prédio comum: água sob qualquer tile bloqueia
      expect(g.world.groundBlock('market', tx, ty + 2, false, 1)).toContain('água');
    } finally {
      delete layout().types['market-9'];
      delete BUILDINGS.market.sizes![9];
    }
  });
});
