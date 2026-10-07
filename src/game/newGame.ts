import { DAY_LENGTH, SAVE_VERSION } from '../config';
import { emptyRes } from '../data/resources';
import { BUILDINGS, type BuildingType } from '../data/buildings';
import { createNinja, createVillager, rollInnateCount } from './entities';
import { Game, type System } from './game';
import { createTeam, joinAsMember } from './teams';
import type { GameState } from './types';
import { emptyExplored, generateSites, revealStart } from './explore';
import { newRegion } from './region';
import { newOrg } from './org';
import { CENTER_TX, CENTER_TY, doorPos, generateMap } from './world';

/** Estado inicial com o terreno gerado e tudo vazio (base da vila nova e dos mapas de missão). */
export function baseState(seed: number): GameState {
  let nextId = 1;
  const { tiles, nodes } = generateMap(seed, () => nextId++);
  return {
    version: SAVE_VERSION,
    seed,
    level: 0,
    time: (DAY_LENGTH * 2) / 24, // 08:00
    day: 1,
    speed: 1,
    tiles,
    nodes,
    buildings: [],
    units: [],
    teams: [],
    missions: [],
    reputation: 0,
    missionDay: 0,
    exam: null,
    clans: [],
    kageId: null,
    kageHistory: [],
    ceremony: null,
    bossTimer: DAY_LENGTH * 6,
    pendingBoss: null,
    examNextDay: 0,
    lastExam: null,
    projectiles: [],
    effects: [],
    explored: emptyExplored(),
    sites: [],
    scrolls: [],
    expeditions: [],
    region: newRegion(),
    regionDay: 1,
    honor: 0,
    infamy: 0,
    weather: 'clear',
    happiness: 60,
    grief: 0,
    moodDay: 1,
    festivalDay: 0,
    festivalUntil: 0,
    pace: 'fast',
    snow: 0,
    clouds: [],
    org: newOrg(),
    blades: [],
    swordsmen: { nextDay: 0, taken: false, done: false },
    sound: { nextDay: 0, raid: null, captive: null, stopped: 0, lost: 0 },
    res: { ...emptyRes(), wood: 120, stone: 60, food: 80, ryo: 150 },
    items: {},
    nextId,
    timers: { animal: 35, raid: DAY_LENGTH * 2.6, birth: 30, jobs: 0, homes: 0 },
    flags: { starving: false, alert: false, raidActive: false, raidStole: false, shelterRookies: true, autoTeach: false, autoSensei: true },
    stats: { kills: 0, raidsRepelled: 0, born: 0, lost: 0, missionsDone: 0, bossesDefeated: 0 },
  };
}

export function createNewGame(systems: System[], seed = (Math.random() * 2 ** 31) | 0): Game {
  const state = baseState(seed);
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
  // névoa: só os arredores da vila começam explorados; locais especiais escondidos pelo mapa
  revealStart(state);
  state.sites = generateSites(state, () => g.newId());
  return g;
}
