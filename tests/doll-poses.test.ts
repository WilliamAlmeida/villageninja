import { describe, expect, test } from 'bun:test';
import { existsSync } from 'fs';
import poses from '../src/data/doll-poses.json';
import { DOLL_GRID } from '../src/render/doll';

// poses do ninja em camadas (golpe e selos): deslocamento da cabeça por quadro e as peças com arte própria
describe('poses do ninja em camadas', () => {
  const cells = DOLL_GRID.cols * DOLL_GRID.rows;
  for (const pose of ['strike', 'cast', 'kick', 'air', 'hurt', 'sit', 'carry'] as const) {
    test(`${pose}: um deslocamento por quadro, pequeno`, () => {
      const offs = (poses.offsets as Record<string, number[][]>)[pose]!;
      expect(offs).toHaveLength(cells);
      for (const [dx, dy] of offs) {
        expect(Math.abs(dx!)).toBeLessThanOrEqual(40); // caído no chão: a cabeça fica bem de lado
        expect(Math.abs(dy!)).toBeLessThanOrEqual(40);
      }
    });
    test(`${pose}: corpo e peças da pose existem`, () => {
      expect(existsSync(`src/art/ninja-body-${pose}.png`)).toBe(true);
      for (const p of poses.pieces) expect(existsSync(`src/art/layer-${p}-${pose}.png`)).toBe(true);
    });
  }
});
