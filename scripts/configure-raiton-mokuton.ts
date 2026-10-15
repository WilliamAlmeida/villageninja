// Configura apenas o novo lote, preservando os demais ajustes do laboratório.
import { FX, formatFx, type SpriteFx } from '../src/data/jutsuFx';
const sheet = (name: string, size: number, fps = 10, anchorY = .78): SpriteFx => ({
  sheet: name, cols: 4, rows: 2, frames: 8, fps, size, anchorX: .5, anchorY,
  dy: 0, opacity: 1, blend: 'normal', rotate: false, flip: false,
});
FX.jutsus.kirin = { ...FX.jutsus.kirin, impact: sheet('effect-kirin-v1', 180), burst: [] };
FX.jutsus.jukai = { ...FX.jutsus.jukai, sprite: sheet('effect-jukai-v1', 76, 12), burst: [] };
FX.jutsus.raikyuu = { ...FX.jutsus.raikyuu,
  sprite: { ...sheet('projectile-raikyuu-v1', 30, 16, .5), opacity: .87, rotate: true }, trail: [],
  burst: [{ shape: 'spark', colors: ['#ffffff', '#bdeeff', '#68caff'], n: 10, life: [.12, .24],
    size: [1, 2], speed: [20, 60], opacity: .85, glow: false }],
};
FX.jutsus.chidorinagashi = { ...FX.jutsus.chidorinagashi,
  impact: { ...sheet('effect-chidorinagashi-v1', 142), dy: FX.jutsus.chidorinagashi?.impact?.dy ?? 9, opacity: .95 }, burst: [],
};
await Bun.write('src/data/jutsu-fx.json', formatFx(FX));
