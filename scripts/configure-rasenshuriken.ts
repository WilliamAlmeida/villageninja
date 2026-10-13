// Configura o lote de arte; mantém os demais ajustes do laboratório.
import { FX, formatFx, type SpriteFx } from '../src/data/jutsuFx';
const sheet = (name: string, size: number, fps: number, anchorY: number, opacity = 1): SpriteFx => ({
  sheet: name, cols: 4, rows: 2, frames: 8, fps, size,
  anchorX: 0.5, anchorY, dy: 0, opacity, blend: 'normal', rotate: false, flip: false,
});
FX.jutsus.rasenshuriken = {
  sprite: sheet('projectile-rasenshuriken-v1', 56, 24, 0.5),
  impact: { ...sheet('effect-rasenshuriken-impact-v1', 208, 10, 0.78, 0.75), dy: 8 },
  crater: { ...FX.jutsus.odama!.crater!, size: 164, life: 20 },
  trail: [], burst: [],
};
await Bun.write('src/data/jutsu-fx.json', formatFx(FX));
