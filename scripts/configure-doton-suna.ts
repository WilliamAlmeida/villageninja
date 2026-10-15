// Atualiza só o lote Doton/areia, preservando os demais ajustes do laboratório.
import { FX, formatFx, type SpriteFx } from '../src/data/jutsuFx';
const sheet = (name: string, size: number, fps = 12): SpriteFx => ({
  sheet: name, cols: 4, rows: 2, frames: 8, fps, size, anchorX: .5, anchorY: .78,
  dy: 0, opacity: 1, blend: 'normal', rotate: false, flip: false,
});
FX.jutsus.doryuuheki = { ...FX.jutsus.doryuuheki, sprite: sheet('effect-doryuuheki-v1', 64),
  profile: { ...sheet('effect-doryuuheki-profile-v1', 58), flip: true },
  oblique: { ...sheet('effect-doryuuheki-oblique-v1', 58), flip: true } };
FX.jutsus.doryuudan = { ...FX.jutsus.doryuudan,
  sprite: { ...sheet('projectile-doryuudan-v1', 22, 16), anchorY: .5, rotate: true },
  origin: { ...sheet('effect-doryuudan-origin-v1', 68), dy: -8, flip: true, life: .65, mouthX: .76, mouthY: .52 },
  trail: [],
};
FX.jutsus.sunanotate = { ...FX.jutsus.sunanotate, sprite: { ...sheet('effect-sunanotate-v1', 64), opacity: .9, flip: true }, trail: [], burst: [] };
FX.jutsus.sabakukyu = { ...FX.jutsus.sabakukyu, sprite: sheet('effect-sabakukyu-v1', 56), trail: [], burst: [] };
await Bun.write('src/data/jutsu-fx.json', formatFx(FX));
