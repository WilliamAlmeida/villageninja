import { SAVE_KEY, SAVE_VERSION } from '../config';
import { Game, type System } from './game';
import type { GameState } from './types';
import { emptyExplored, generateSites, isExplored, revealStart } from './explore';
import { newRegion } from './region';
import { generateMap } from './world';
import { BUILDINGS, type BuildingType } from '../data/buildings';

/**
 * Migrações de save: cada entrada transforma a versão N na N+1.
 * Assim saves antigos continuam funcionando quando o estado ganha campos novos.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MIGRATIONS: Record<number, (s: any) => void> = {
  1: (s) => {
    s.teams = [];
    for (const u of s.units) u.command = null;
  },
  2: (s) => {
    s.level = 0;
  },
  3: (s) => {
    s.missions = [];
    s.reputation = 0;
    s.missionDay = 0;
    s.stats.missionsDone = 0;
  },
  4: (s) => {
    s.res.iron = 0;
    s.res.herbs = 0;
    s.res.paper = 0;
    s.items = {};
    for (const u of s.units) if (u.ninja) u.ninja.equip = { weapon: null, armor: null, item: null, itemReady: false };
    // parte das rochas longe do centro vira veio de minério de ferro
    let i = 0;
    for (const n of s.nodes) if (n.type === 'rock' && i++ % 4 === 0) n.type = 'ore';
  },
  5: (s) => {
    s.exam = null;
    s.examNextDay = 0;
    s.lastExam = null;
  },
  6: (s) => {
    s.clans = [];
    for (const u of s.units) if (u.ninja) u.ninja.kekkei = null;
  },
  7: (s) => {
    const kage = s.units.find((u: { ninja?: { rank: string }; faction: string }) => u.ninja?.rank === 'kage' && u.faction === 'village');
    s.kageId = kage ? kage.id : null;
    s.kageHistory = kage ? [{ name: kage.name, day: s.day }] : [];
    s.ceremony = null;
    s.bossTimer = 180 * 6;
    s.pendingBoss = null;
    s.stats.bossesDefeated = 0;
  },
  8: (s) => {
    for (const b of s.buildings) {
      b.level = 1;
      b.upgrade = null;
    }
  },
  9: (s) => {
    // névoa e locais especiais: revela os arredores da vila e o que os ninjas já andaram (território atual)
    s.explored = emptyExplored();
    s.sites = [];
    s.scrolls = [];
    revealStart(s);
    let next = s.nextId;
    s.sites = generateSites(s, () => next++);
    s.nextId = next;
    for (const site of s.sites) if (isExplored(s, site.tx, site.ty)) site.found = true;
  },
  10: (s) => {
    // minas: recursos raros e expedições
    s.res.crystal = 0;
    s.res.gold = 0;
    s.res.darksteel = 0;
    s.expeditions = [];
  },
  11: (s) => {
    // mapa da região, honra e infâmia
    s.region = newRegion();
    s.regionDay = s.day;
    s.honor = 0;
    s.infamy = 0;
  },
  12: (s) => {
    // estações, clima, felicidade e festivais
    s.weather = 'clear';
    s.happiness = 60;
    s.grief = 0;
    s.moodDay = s.day;
    s.festivalDay = 0;
    s.festivalUntil = 0;
  },
  13: (s) => {
    // recursos agora crescem de volta: o que já tinha sumido do mapa volta como toco / rocha rachada
    let next = s.nextId;
    const { nodes } = generateMap(s.seed, () => next++);
    const taken = new Set(s.nodes.map((n: { tx: number; ty: number }) => `${n.tx},${n.ty}`));
    const under = (tx: number, ty: number) =>
      s.buildings.some((b: { type: BuildingType; tx: number; ty: number }) => {
        const d = BUILDINGS[b.type];
        return tx >= b.tx - 1 && tx <= b.tx + d.w && ty >= b.ty - 1 && ty <= b.ty + d.h;
      });
    for (const n of nodes) {
      if (n.type === 'herb' || taken.has(`${n.tx},${n.ty}`) || under(n.tx, n.ty)) continue;
      s.nodes.push({ ...n, amount: 0, regrow: 30 + Math.random() * 300 });
    }
    s.nextId = next;
    s.flags.autoGear = false;
  },
  14: (s) => {
    // ritmo do combate (menu) e a arte do Kage atual
    s.pace = 'fast';
    const k = s.units.find((u: { id: number }) => u.id === s.kageId);
    if (k?.ninja && !k.ninja.kageArt) k.ninja.kageArt = 'hiraishin';
  },
  15: (s) => {
    s.snow = 0; // neve acumulada no chão
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function migrate(s: any): GameState | null {
  if (typeof s?.version !== 'number') return null;
  while (s.version < SAVE_VERSION) {
    const m = MIGRATIONS[s.version];
    if (!m) return null;
    m(s);
    s.version++;
  }
  return s.version === SAVE_VERSION ? (s as GameState) : null;
}

/** Salva o estado no localStorage (o jogo é local por enquanto). */
export function saveGame(g: Game): boolean {
  try {
    const data: GameState = { ...g.state, effects: [], projectiles: [] };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(systems: System[]): Game | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const state = migrate(JSON.parse(raw));
    return state ? new Game(state, systems) : null;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}
