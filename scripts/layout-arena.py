# Layout inicial da arena (Editor de cenário): muro com portão e as peças pintadas a partir do desenho.
# Ponto de partida para o ajuste fino no editor (http://localhost:3011/cenario); rodar de novo SOBRESCREVE a arena.
#   python scripts/layout-arena.py
import json, math
from collections import deque
from PIL import Image

im = Image.open('src/art/arena.png').convert('RGBA'); W, H = im.size; px = im.load()
CX, CY, RX, RY = 0.5 * W, 0.615 * H, 0.395 * W, 0.197 * H

def sand(c): r, g, b, a = c; return a > 200 and abs(r - 229) < 30 and abs(g - 178) < 30 and abs(b - 116) < 30
def floorish(c):
    r, g, b, a = c
    return a > 200 and (sand(c) or (g > r and g > b and g > 100))
# chão = área de terra/grama ligada ao centro (inunda)
floor = bytearray(W * H)
q = deque([(int(CX), int(CY))])
while q:
    x, y = q.popleft()
    if not (0 <= x < W and 0 <= y < H) or floor[y * W + x] or not floorish(px[x, y]): continue
    if ((x - CX) / RX) ** 2 + ((y - CY) / RY) ** 2 > 1.08: continue  # não vaza pelo portão para fora
    floor[y * W + x] = 1
    q.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])

ARCH = (0.13 * W, 0.43 * W, 0.585 * H)  # telhado e portas do portão
mask = bytearray(W * H)
for y in range(H):
    for x in range(W):
        i = y * W + x
        if px[x, y][3] == 0 or floor[i]: continue
        if ARCH[0] <= x <= ARCH[1] and y >= ARCH[2]:
            mask[i] = 5; continue
        a = math.degrees(math.atan2((y - CY) / RY, (x - CX) / RX))
        mask[i] = 4 if 30 < a < 150 else 2 if abs(a) >= 150 else 3 if abs(a) <= 30 else 1

def rle(m):
    out = []; i = 0
    while i < len(m):
        v = m[i]; n = 1
        while i + n < len(m) and m[i + n] == v: n += 1
        out.append(f'{v}' if n == 1 else f'{v}*{n}'); i += n
    return ','.join(out)

p = 'src/data/layout.json'
L = json.load(open(p, encoding='utf8'))
L.setdefault('arts', {})['arena'] = {
    'ground': True,
    'pieces': [
        {'name': 'Muro de trás e arquibancada', 'ax': 0.5, 'ay': round((CY - RY) / H, 4)},
        {'name': 'Muro esquerdo', 'ax': round((CX - RX) / W, 4), 'ay': 0.615},
        {'name': 'Muro direito', 'ax': round((CX + RX) / W, 4), 'ay': 0.615},
        {'name': 'Muro da frente', 'ax': 0.5, 'ay': round((CY + RY) / H, 4)},
        {'name': 'Portão', 'ax': 0.25, 'ay': 0.77},
    ],
    'mask': rle(mask), 'maskW': W, 'maskH': H,
}
L.setdefault('types', {})['arena'] = {
    'tiles': ['######', '#....#', '#....#', '#....#', '#....#', '##gg##'],
}
open(p, 'w', encoding='utf8').write(json.dumps(L, ensure_ascii=False, indent=1) + '\n')
print('ok', len(L['arts']['arena']['mask']) // 1024, 'KB de máscara')
