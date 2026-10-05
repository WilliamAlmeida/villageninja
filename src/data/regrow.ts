// Quanto tempo (s de jogo) um recurso esgotado leva para voltar inteiro. 1 dia = 180 s.
import type { ResourceNode } from '../game/types';

export const REGROW: Partial<Record<ResourceNode['type'], number>> = {
  tree: 180 * 2,
  rock: 180 * 3,
  ore: 180 * 4,
};
