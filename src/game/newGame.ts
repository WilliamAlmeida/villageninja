import { DAY_LENGTH, SAVE_VERSION } from '../config';
import { BUILDINGS, type BuildingType } from '../data/buildings';
import { createNinja, createVillager, rollInnateCount } from './entities';
import { Game, type System } from './game';
import { createTeam, joinAsMember } from './teams';
import type { GameState } from './types';
import { CENTER_TX, CENTER_TY, doorPos, generateMap } from './world';

export function createNewGame(systems: System[], seed = (Math.random() * 2 ** 31) | 0): Game {
  let nextId = 1;
  const { tiles, nodes } = generateMap(seed, () => nextId++);
  const state: GameState = {
    version: SAVE_VERSION,
    seed,
    time: (DAY_LENGTH * 2) / 24, // 08:00
    day: 1,
    speed: 1,
    tiles,
    nodes,
    buildings: [],
    units: [],
    teams: [],
    projectiles: [],
    effects: [],
    res: { wood: 120, stone: 60, food: 80, ryo: 150 },
    nextId,
    timers: { animal: 35, raid: DAY_LENGTH * 2.6, birth: 30, jobs: 0, homes: 0 },
    flags: { starving: false, alert: false, raidActive: false, raidStole: false },
    stats: { kills: 0, raidsRepelled: 0, born: 0, lost: 0 },
  };
  const g = new Game(state, systems);

  const place = (type: BuildingType, tx: number, ty: number) => {
    const def = BUILDINGS[type];
    // limpa recursos no terreno inicial
    for (const n of [...state.nodes]) if (n.tx >= tx - 1 && n.tx <= tx + def.w && n.ty >= ty - 1 && n.ty <= ty + def.h) g.removeNode(n.id);
    return g.addBuilding({ id: g.newId(), type, tx, ty, built: true, progress: def.buildTime, desired: def.workers ?? 0, workers: [], cd: 0 });
  };
  const hk = place('hokage', CENTER_TX - 1, CENTER_TY - 2);
  place('house', CENTER_TX - 5, CENTER_TY - 2);
  place('house', CENTER_TX + 3, CENTER_TY - 2);
  place('farm', CENTER_TX - 1, CENTER_TY + 3);

  const d = doorPos(hk);
  for (let i = 0; i < 6; i++) createVillager(g, d.x + (i - 3) * 14, d.y + 12 + (i % 2) * 10);
  // dois ninjas iniciais: um talentoso e um sem jutsu (precisa estudar)
  const a = createNinja(g, d.x - 20, d.y + 34, 'genin', Math.max(1, rollInnateCount()));
  const b = createNinja(g, d.x + 20, d.y + 34, 'genin', 0);
  // primeira equipe já formada (ainda sem sensei)
  const team = createTeam(g, 'Time 1');
  joinAsMember(g, team.id, a.id);
  joinAsMember(g, team.id, b.id);
  return g;
}
