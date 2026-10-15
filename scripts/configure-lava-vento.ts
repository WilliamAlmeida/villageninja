// Atualiza apenas Lava/Vento e preserva os ajustes dos outros jutsus.
import { FX, formatFx, type SpriteFx } from '../src/data/jutsuFx';
const sheet = (name: string, size: number, fps: number, anchorX = .5, anchorY = .78): SpriteFx => ({
  sheet: name, cols: 4, rows: 2, frames: 8, fps, size, anchorX, anchorY,
  dy: 0, opacity: 1, blend: 'normal', rotate: false, flip: false,
});
FX.jutsus.yokai = { ...FX.jutsus.yokai,
  sprite: { ...sheet('projectile-yokai-v1', 48, 16, .75, .5), rotate: true, flip: true },
  impact: { ...sheet('effect-yokai-impact-v1', 144, 10), dy: 12, layer: 'ground' }, trail: [], burst: [],
};
FX.jutsus.daitoppa = { ...FX.jutsus.daitoppa,
  gust: { ...sheet('effect-daitoppa-v1', 140, 16, .15, .5), rotate: true, flip: true, opacity: .8, forward: 18 },
  burst: [],
};
FX.jutsus.shinkuuha = { ...FX.jutsus.shinkuuha,
  sprite: { ...sheet('projectile-shinkuuha-v1', 42, 20, .75, .5), rotate: true, flip: true, opacity: .9 },
  trail: [],
};
FX.jutsus.sekizo = { ...FX.jutsus.sekizo,
  cannon: { width: 28, opacity: .62, forward: 14, dy: -4 }, burst: [], trail: [],
};
delete FX.jutsus.sekizo.impact;
FX.jutsus.doryuudan!.origin!.forward = -12;
FX.jutsus.chidorinagashi!.impact!.dy = -9;
await Bun.write('src/data/jutsu-fx.json', formatFx(FX));
