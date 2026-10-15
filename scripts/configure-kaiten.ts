import { FX, formatFx } from '../src/data/jutsuFx';
FX.jutsus.kaiten = { ...FX.jutsus.kaiten,
  sprite: { sheet: 'effect-kaiten-v1', cols: 4, rows: 2, frames: 8, fps: 12, size: 96,
    anchorX: .5, anchorY: .78, dy: 0, opacity: .7, blend: 'normal', rotate: false, flip: false },
};
await Bun.write('src/data/jutsu-fx.json', formatFx(FX));
