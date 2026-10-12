# Paleta única do cenário a partir das artes marcadas como preferidas na página /paleta das ferramentas
# (docs/design/arte-iso/paleta-favoritos.json). Junta os pixels opacos de todas (cada arte pesa pela área, e as grandes
# não engolem as pequenas: no máximo 40 mil pixels por arte), tira N cores por median cut e grava:
#   docs/design/arte-iso/paleta.json  {"colors": ["#rrggbb", ...], "from": [...artes]}
#   docs/design/arte-iso/paleta.png   as cores em amostras, ordenadas por matiz e luz (para o autor aprovar)
# O scripts/pilot-art.py usa a paleta.json (se existir) ao reduzir as cores das peças novas.
# Uso: python scripts/palette-from-favorites.py [N=40]
import colorsys
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
DIR = ROOT / 'docs' / 'design' / 'arte-iso'
N = int(next((a for a in sys.argv[1:] if a.isdigit()), 40))

fav = json.loads((DIR / 'paleta-favoritos.json').read_text(encoding='utf8'))['picked']
if not fav:
    sys.exit('Nenhuma arte marcada em /paleta.')
rng = np.random.default_rng(1)
chunks = []
for f in fav:
    a = np.array(Image.open(ROOT / 'src' / 'art' / f).convert('RGBA')).reshape(-1, 4)
    a = a[a[:, 3] > 200][:, :3]
    if len(a) > 40000:
        a = a[rng.choice(len(a), 40000, replace=False)]
    chunks.append(a)
px = np.concatenate(chunks)
side = int(np.ceil(np.sqrt(len(px))))
canvas = np.zeros((side * side, 3), np.uint8)
canvas[: len(px)] = px
canvas[len(px):] = px[0]
q = Image.fromarray(canvas.reshape(side, side, 3), 'RGB').quantize(N, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
pal = np.array(q.getpalette()[: N * 3]).reshape(-1, 3)
counts = np.bincount(np.array(q).ravel(), minlength=N)[:N]
cols = [tuple(int(v) for v in c) for c, n in zip(pal, counts) if n > 0]


def key(c):
    h, l, s = colorsys.rgb_to_hls(*(v / 255 for v in c))
    return (0 if s < 0.15 else 1, round(h * 12) if s >= 0.15 else 0, l)


cols.sort(key=key)
hexes = ['#%02x%02x%02x' % c for c in cols]
(DIR / 'paleta.json').write_text(json.dumps({'colors': hexes, 'from': fav}, indent=1) + '\n', encoding='utf8')
S, per = 56, 10
rows = (len(cols) + per - 1) // per
img = Image.new('RGB', (per * S, rows * (S + 18)), (30, 30, 30))
d = ImageDraw.Draw(img)
for i, c in enumerate(cols):
    x, y = (i % per) * S, (i // per) * (S + 18)
    d.rectangle([x + 2, y + 2, x + S - 3, y + S - 3], fill=c)
    d.text((x + 4, y + S), hexes[i], fill=(220, 220, 220))
img.save(DIR / 'paleta.png')
print(len(cols), 'cores de', len(fav), 'artes → docs/design/arte-iso/paleta.png'.replace('→', 'em'))
