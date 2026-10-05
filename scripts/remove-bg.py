# Remove o fundo branco de uma arte (local, sem API): apaga o branco/quase branco LIGADO ÀS BORDAS
# da imagem. Brancos dentro do desenho ficam, porque o contorno escuro do pixel art os separa do fundo.
#   --vaos  também apaga bolsões brancos GRANDES fechados (vãos entre vigas, como na torre).
#           Não use em prédios com parede branca (ex.: hospital).
# Uso: python scripts/remove-bg.py <entrada.png> [saida.png] [--vaos]
import sys
from collections import deque
from PIL import Image

args = [a for a in sys.argv[1:] if not a.startswith('--')]
holes = '--vaos' in sys.argv
src = args[0]
dst = args[1] if len(args) > 1 else src
im = Image.open(src).convert('RGBA')
w, h = im.size
px = im.load()


def is_bg(p, tol=34):
    r, g, b, a = p
    return a < 20 or (r > 255 - tol and g > 255 - tol and b > 255 - tol)


def flood(starts, test, limit=None):
    """Pinta de transparente a região ligada aos pontos iniciais que passa no teste; devolve os pixels."""
    seen_local, q, region = set(), deque(starts), []
    while q:
        x, y = q.popleft()
        if (x, y) in seen_local or not (0 <= x < w and 0 <= y < h) or not test(px[x, y]):
            continue
        seen_local.add((x, y))
        region.append((x, y))
        q.extend(((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)))
    return region


border = [(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)] + [(0, y) for y in range(h)] + [(w - 1, y) for y in range(h)]
for x, y in flood(border, is_bg):
    px[x, y] = (255, 255, 255, 0)

if holes:
    # bolsões de branco puro que sobraram; só os grandes (brilhos e detalhes brancos são pequenos)
    pure = lambda p: p[3] > 0 and p[0] > 245 and p[1] > 245 and p[2] > 245
    min_size = (w * h) // 20000
    done = set()
    for y in range(h):
        for x in range(w):
            if (x, y) in done or not pure(px[x, y]):
                continue
            region = flood([(x, y)], pure)
            done.update(region)
            if len(region) >= min_size:
                for rx, ry in region:
                    px[rx, ry] = (255, 255, 255, 0)
im.save(dst)
print(f'ok {dst}')
