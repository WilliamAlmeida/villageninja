// Retratos pesados (Bingo Book: Ordem, Espadachins, Quinteto do Som; Kage) gerados aos poucos com o jogo ocioso,
// logo depois de carregar: a primeira abertura dessas abas travava ~0,4 s montando todos de uma vez.
import { ORG_MEMBERS } from '../data/org';
import { SOUND_MEMBERS } from '../data/sound';
import { SWORDSMEN } from '../data/swordsmen';
import type { MistBlade } from '../data/blades';
import type { Game } from '../game/game';
import { artPortrait, kagePortrait, swordsmanPortrait } from '../render/sprites';

type Idle = (cb: (d: { timeRemaining: () => number }) => void, o?: { timeout: number }) => number;

export function warmPortraits(home: () => Game) {
  const jobs: (() => unknown)[] = [
    ...Object.keys(ORG_MEMBERS).map((id) => () => artPortrait(`org-${id}`, true)),
    ...(Object.keys(SWORDSMEN) as MistBlade[]).map((id) => () => swordsmanPortrait(id)),
    ...Object.keys(SOUND_MEMBERS).map((id) => () => artPortrait(`sound-${id}`, true)),
    () => {
      const k = home().state.units.find((u) => !u.dead && u.ninja?.rank === 'kage');
      return k && kagePortrait(k);
    },
  ];
  const idle: Idle = (window as unknown as { requestIdleCallback?: Idle }).requestIdleCallback ?? ((cb) => window.setTimeout(() => cb({ timeRemaining: () => 8 }), 60));
  const step = (d: { timeRemaining: () => number }) => {
    // um ou mais por vez, só enquanto sobra tempo no quadro
    do jobs.shift()?.();
    while (jobs.length && d.timeRemaining() > 6);
    if (jobs.length) idle(step, { timeout: 2000 });
  };
  // espera o jogo assentar (primeiros quadros, imagens) antes de começar
  window.setTimeout(() => idle(step, { timeout: 2000 }), 1500);
}
