# Remove o fundo branco de uma arte (local, sem API): apaga o branco/quase branco LIGADO ÀS BORDAS
# da imagem. Brancos dentro do desenho ficam, porque o contorno escuro do pixel art os separa do fundo.
# Uso: python scripts/remove-bg.py <entrada.png> [saida.png]    (sem saída, sobrescreve a entrada)
import sys
from collections import deque
from PIL import Image

src = sys.argv[1]
dst = sys.argv[2] if len(sys.argv) > 2 else src
im = Image.open(src).convert('RGBA')
w, h = im.size
px = im.load()


def is_bg(p, tol=34):
    r, g, b, a = p
    return a < 20 or (r > 255 - tol and g > 255 - tol and b > 255 - tol)


seen = bytearray(w * h)
q = deque()
for x in range(w):
    q.extend(((x, 0), (x, h - 1)))
for y in range(h):
    q.extend(((0, y), (w - 1, y)))
while q:
    x, y = q.popleft()
    i = y * w + x
    if seen[i] or not is_bg(px[x, y]):
        continue
    seen[i] = 1
    px[x, y] = (255, 255, 255, 0)
    if x > 0: q.append((x - 1, y))
    if x < w - 1: q.append((x + 1, y))
    if y > 0: q.append((x, y - 1))
    if y < h - 1: q.append((x, y + 1))
im.save(dst)
print(f'ok {dst}')
