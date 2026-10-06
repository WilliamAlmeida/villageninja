# Prévia do ninja montado em camadas e recolorido como no jogo: docs/arte/layers/preview.png
# Ordem: corpo-base → roupa → colete → cabelo → o que a roupa tem na cabeça (bandana).
import colorsys
from pathlib import Path

import numpy as np
from PIL import Image

ART = Path('src/art')
base = Image.open(ART / 'ninja-body.png').convert('RGBA')
METAL = (150, 158, 172)


def tint(im, color, mid, hue):
    """Troca a cor-chave (faixa de matiz) pela cor pedida, mantendo o sombreado; ciano vira metal."""
    a = np.array(im).astype(float)
    out = a.copy()
    for y in range(a.shape[0]):
        for x in range(a.shape[1]):
            r, g, b, al = a[y, x]
            if al < 10:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            h *= 360
            if s <= 0.35:
                continue
            to = color if hue[0] <= h <= hue[1] else METAL if 170 <= h <= 200 else None
            if to is None:
                continue
            k = v / mid
            for j in range(3):
                c = to[j]
                out[y, x, j] = c * k if k <= 1 else c + (255 - c) * min(1, k - 1)
    return Image.fromarray(out.astype(np.uint8), 'RGBA')


def layer(name, color, hair=False):
    p = ART / f'layer-{name}.png'
    if not p.exists():
        return None
    return tint(Image.open(p).convert('RGBA'), color, 0.8 if hair else 1, (85, 165) if hair else (280, 330))


def ninja(cloth, vest, hair):
    t = Image.new('RGBA', base.size, (0, 0, 0, 0))
    t.alpha_composite(base)
    parts = [layer('outfit-genin', cloth), vest and layer('vest-chunin', vest), hair and layer('hair-spiky', hair, True),
             layer('outfit-genin-top', cloth), vest and layer('vest-chunin-top', vest)]
    for p in parts:
        if p:
            t.alpha_composite(p)
    return t


combos = [ninja((40, 60, 140), None, None), ninja((40, 60, 140), None, (250, 200, 60)),
          ninja((40, 45, 70), (95, 105, 55), (250, 200, 60)), ninja((30, 30, 40), (70, 75, 80), (40, 30, 30)),
          ninja((90, 40, 30), (95, 105, 55), (200, 60, 40))]
pad = 10
W, H = base.width * len(combos) + pad * (len(combos) + 1), base.height + 2 * pad
out = Image.new('RGBA', (W, H), (58, 92, 48, 255))
for i, c in enumerate(combos):
    out.alpha_composite(c, (pad + i * (base.width + pad), pad))
out.resize((W * 3, H * 3), Image.NEAREST).save('docs/arte/layers/preview.png')
print('ok docs/arte/layers/preview.png')
