import { expect, spyOn, test } from 'bun:test';
import { FX } from '../src/data/jutsuFx';
import { Particles } from '../src/render/particles';
import type { Projectile } from '../src/game/types';

test('rastros das sprites ficam na camada de trás, translúcidos e sem mistura aditiva', () => {
  const random = spyOn(Math, 'random').mockReturnValue(0.5);
  try {
    // jutsus com sprite cujo rastro (data/jutsu-fx.json) é o resíduo discreto, ligado; o painel "Ajuste" pode desligar
    const kinds = (['housenka', 'goukakyuu', 'mizurappa', 'suiryuudan'] as const).filter((k) => FX.jutsus[k]?.trail?.some((e) => e.under && !e.off));
    expect(kinds.length).toBeGreaterThan(0);
    for (const kind of kinds) {
      const particles = new Particles();
      const strokes: { x: number; opacity: number; blend: string }[] = [];
      let x = 0;
      const context = {
        globalAlpha: 1, globalCompositeOperation: 'source-over', fillStyle: '', strokeStyle: '',
        beginPath() {},
        arc(px: number) { x = px; },
        fill() { strokes.push({ x, opacity: this.globalAlpha, blend: this.globalCompositeOperation }); },
        fillRect(px: number) { x = px; this.fill(); },
      };
      const ctx = context as unknown as CanvasRenderingContext2D;
      const p = { kind, vx: 200, vy: 0, size: 9 } as Projectile;
      particles.trail(p, 100, 60, 0.05);
      particles.draw(ctx); // efeitos de impacto não redesenham as brasas/gotas do rastro
      expect(strokes).toHaveLength(0);
      particles.draw(ctx, 'trail');
      expect(strokes).toHaveLength(1);
      expect(strokes[0]!.x).toBeLessThan(90);
      expect(strokes[0]!.opacity).toBeLessThanOrEqual(0.32);
      expect(strokes[0]!.blend).toBe('source-over');
      particles.update(1);
      strokes.length = 0;
      particles.draw(ctx, 'trail');
      expect(strokes).toHaveLength(0);
    }
  } finally {
    random.mockRestore();
  }
});
