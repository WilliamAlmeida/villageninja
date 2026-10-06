# Prévia do ninja montado em camadas e recolorido como no jogo (mesma ordem e cores de dollParts em sprites.ts):
# um de cada patente. Saída: docs/arte/layers/preview.png
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from importlib import import_module

L = import_module('prepare-layers')
ART = Path('src/art')
body = Image.open(ART / 'ninja-body.png').convert('RGBA')


def layer(name, color, color2=None):
    p = ART / f'layer-{name}.png'
    if not p.exists():
        return None
    kind = 'hair' if name.startswith('hair') else 'cloth'
    return Image.fromarray(L.tint(np.array(Image.open(p).convert('RGBA')), kind, color, color2), 'RGBA')


def ninja(*parts):
    t = body.copy()
    for p in parts:
        im = layer(*p)
        if im:
            t.alpha_composite(im)
    return t


C, H = '#2d4a9a', '#f2c94c'
combos = [
    ninja(('outfit-genin', C), ('hair-spiky', H), ('headband', C)),
    ninja(('outfit-genin', '#1f2a44'), ('vest-chunin', '#5f6b3a'), ('hair-spiky', '#2a2222'), ('headband', '#1f2a44')),
    ninja(('outfit-genin', '#1f1f2a'), ('vest-jounin', '#4e5a3a'), ('sword-zabuza', '#3a2a20'), ('hair-spiky', '#c0392b'), ('headband', '#1f1f2a')),
    ninja(('outfit-genin', '#3a3030'), ('coat-sannin', '#8c2a22', '#d4a03a'), ('hair-spiky', '#e8e8e8'), ('headband', '#3a3030')),
    ninja(('outfit-genin', '#2a2a3a'), ('cloak-kage', '#f0ece0', '#c8352a'), ('hat-kage', '#f0ece0', '#c8352a')),
]
pad = 8
W, Hh = body.width * len(combos) + pad * (len(combos) + 1), body.height + 2 * pad
out = Image.new('RGBA', (W, Hh), (58, 92, 48, 255))
for i, c in enumerate(combos):
    out.alpha_composite(c, (pad + i * (body.width + pad), pad))
out.resize((W * 2, Hh * 2), Image.NEAREST).save('docs/arte/layers/preview.png')
print('ok docs/arte/layers/preview.png')
