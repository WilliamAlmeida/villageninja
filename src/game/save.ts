import { SAVE_KEY, SAVE_VERSION } from '../config';
import { Game, type System } from './game';
import type { GameState } from './types';

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
    const state = JSON.parse(raw) as GameState;
    if (state.version !== SAVE_VERSION) return null;
    return new Game(state, systems);
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
