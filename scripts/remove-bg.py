# Remove o fundo branco de uma arte (local, sem API): apaga o fundo LIGADO ÀS BORDAS da imagem.
#
# Fundo = quase branco E sem cor (o Codex entrega o fundo em ~254,254,254). A regra antiga (qualquer canal > 221)
# vazava para dentro do desenho onde uma parede creme ou um gramado claro encosta no fundo sem contorno escuro
# (Hospital: a parede da frente e a grama da base sumiam). Parede creme e grama clara têm um pouco de cor e ficam.
# Depois tira a franja clara do anti-alias na borda (1–2 px de pixels claros e sem cor encostados no fundo).
#   --vaos  também apaga bolsões brancos GRANDES fechados (vãos entre vigas, como na torre).
#           Não use em prédios com parede branca (ex.: hospital).
# Uso: python scripts/remove-bg.py <entrada.png> [saida.png] [--vaos]
import sys
from collections import deque

import numpy as np
from PIL import Image

args = [a for a in sys.argv[1:] if not a.startswith('--')]
holes = '--vaos' in sys.argv
src = args[0]
dst = args[1] if len(args) > 1 else src
im = Image.open(src).convert('RGBA')
a = np.array(im)
h, w = a.shape[:2]
rgb = a[..., :3].astype(int)
mn, mx = rgb.min(2), rgb.max(2)
clear = a[..., 3] < 20
# fundo: quase branco e sem saturação
bg_like = clear | ((mn >= 240) & (mx - mn <= 12))

# flood a partir das bordas só pelo que parece fundo
bg = np.zeros((h, w), bool)
q = deque()
for x in range(w):
    q.extend(((x, 0), (x, h - 1)))
for y in range(h):
    q.extend(((0, y), (w - 1, y)))
while q:
    x, y = q.popleft()
    if x < 0 or y < 0 or x >= w or y >= h or bg[y, x] or not bg_like[y, x]:
        continue
    bg[y, x] = True
    q.extend(((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)))

# franja: pixel claro e quase sem cor grudado no fundo (anti-alias do contorno contra o branco), 2 passadas
fringe_like = (mn >= 215) & (mx - mn <= 18)
for _ in range(2):
    near = np.zeros_like(bg)
    near[1:, :] |= bg[:-1, :]
    near[:-1, :] |= bg[1:, :]
    near[:, 1:] |= bg[:, :-1]
    near[:, :-1] |= bg[:, 1:]
    add = near & fringe_like & ~bg
    if not add.any():
        break
    bg |= add

a[bg] = (255, 255, 255, 0)

if holes:
    # bolsões de branco puro que sobraram; só os grandes (brilhos e detalhes brancos são pequenos)
    pure = (a[..., 3] > 0) & (mn > 245) & (mx - mn <= 12)
    seen = np.zeros((h, w), bool)
    min_size = (w * h) // 20000
    for y0, x0 in zip(*np.nonzero(pure)):
        if seen[y0, x0]:
            continue
        region, q = [], deque([(x0, y0)])
        seen[y0, x0] = True
        while q:
            x, y = q.popleft()
            region.append((y, x))
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if 0 <= nx < w and 0 <= ny < h and pure[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    q.append((nx, ny))
        if len(region) >= min_size:
            ys, xs = zip(*region)
            a[list(ys), list(xs)] = (255, 255, 255, 0)

Image.fromarray(a, 'RGBA').save(dst)
print(f'ok {dst}')
