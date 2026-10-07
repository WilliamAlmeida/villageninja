import { MAP_H, MAP_W, SAVE_KEY, SAVE_VERSION } from '../config';
import { Game, type System } from './game';
import type { GameState } from './types';
import { JUTSUS } from '../data/jutsus';
import { needsScroll } from './library';
import { emptyExplored, generateSites, isExplored, revealStart } from './explore';
import { newRegion } from './region';
import { generateMap, idx, T } from './world';
import { newOrg } from './org';
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
  16: (s) => {
    s.flags.shelterRookies = true; // novatos se abrigam de inimigos fortes demais
  },
  17: (s) => {
    s.clouds = []; // nuvens de chuva no mapa (surgem no próximo tick se for dia de chuva)
  },
  18: (s) => {
    s.flags.autoTeach = false; // Academia ensina sozinha (o jogador liga)
    s.flags.autoSensei = true; // equipes sem sensei recebem um
  },
  19: (s) => {
    s.org = newOrg(); // a Ordem do Eclipse
    s.region.covil = { rel: 0, status: 'neutral' };
  },
  20: (s) => {
    // lâminas lendárias e os Espadachins da Névoa (a ANBU é um campo opcional do ninja)
    s.blades = [];
    s.swordsmen = { nextDay: 0, taken: false, done: false };
    if (s.scene) {
      s.scene.blades = [];
      s.scene.swordsmen = { nextDay: 0, taken: false, done: false };
    }
  },
  21: (s) => {
    // o Quinteto do Som e o Esconderijo do Som na Região
    s.sound = { nextDay: 0, raid: null, captive: null, stopped: 0, lost: 0 };
    if (s.scene) s.scene.sound = { nextDay: 0, raid: null, captive: null, stopped: 0, lost: 0 };
    s.region.som = { rel: 0, status: 'neutral' };
  },
  22: (s) => {
    // Biblioteca: jutsus rank C+ pedem pergaminho aberto. Os que a vila já usa (sabidos ou em estudo) ficam abertos.
    const open = new Set<string>();
    for (const st of [s, s.scene].filter(Boolean))
      for (const u of st.units ?? [])
        if (u.faction === 'village' && u.ninja) {
          for (const id of u.ninja.jutsu ?? []) if (id) open.add(id);
          if (u.ninja.learning) open.add(u.ninja.learning.jutsuId);
        }
    s.jutsuOpen = [...open].filter((id) => JUTSUS[id] && needsScroll(JUTSUS[id]));
    if (s.scene) s.scene.jutsuOpen = [...s.jutsuOpen];
  },
  23: (s) => {
    // a arena cresceu (4×4 → 6×6, redonda): se encostar noutro prédio, procura um lugar livre ao lado
    const W = BUILDINGS.arena.w;
    for (const a of s.buildings ?? []) {
      if (a.type !== 'arena') continue;
      const free = (tx: number, ty: number) => {
        if (tx < 1 || ty < 1 || tx + W > MAP_W - 1 || ty + W > MAP_H - 1) return false;
        for (let y = ty; y < ty + W; y++) for (let x = tx; x < tx + W; x++) if (s.tiles[idx(x, y)] === T.WATER) return false;
        return !s.buildings.some((o: { id: number; type: BuildingType; tx: number; ty: number }) => {
          if (o === a) return false;
          const d = BUILDINGS[o.type];
          return tx < o.tx + d.w + 1 && tx + W + 1 > o.tx && ty < o.ty + d.h + 1 && ty + W + 1 > o.ty;
        });
      };
      if (free(a.tx, a.ty)) continue;
      search: for (let r = 1; r <= 8; r++)
        for (let dy = -r; dy <= r; dy++)
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !free(a.tx + dx, a.ty + dy)) continue;
            a.tx += dx;
            a.ty += dy;
            break search;
          }
    }
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
    const sc = g.state.scene;
    const data: GameState = { ...g.state, effects: [], projectiles: [], scene: sc ? { ...sc, effects: [], projectiles: [] } : sc };
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
