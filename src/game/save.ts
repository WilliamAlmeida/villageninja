import { SAVE_KEY, SAVE_VERSION } from '../config';
import { Game, type System } from './game';
import type { GameState } from './types';

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
