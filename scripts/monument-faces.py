# Monte dos Kages com um rosto por Kage que já passou (state.kageHistory): o Codex desenha o paredão da montanha com os
# rostos grandes (referência de estilo = a casa) numa grade 3×2 com 1 a 6 rostos esculpidos; fatiado em docs/arte/iso/monument-f<n>.png e preparado pelo
# prepare-art.py (mesma largura do monte). O jogo escolhe pela quantidade de Kages (render/renderer.ts → artBox).
# Uso: python scripts/monument-faces.py
import os
import subprocess

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ISO = os.path.join(ROOT, 'docs', 'arte', 'iso')
COLS, ROWS = 3, 2


def run(on, gap=4):
    best, start, last = (0, 0), None, None
    for i, v in enumerate(list(on) + [False] * (gap + 1)):
        if v:
            if start is None or i - last > gap + 1:
                start = i
            last = i
            if last - start > best[1] - best[0]:
                best = (start, last + 1)
    return best


def main_box(cell):
    a = cell.getchannel('A').point(lambda v: 255 if v > 40 else 0)
    w, h = a.size
    px = a.load()
    x0, x1 = run([sum(1 for y in range(h) if px[x, y]) > 2 for x in range(w)])
    y0, y1 = run([sum(1 for x in range(x0, x1) if px[x, y]) > 2 for y in range(h)])
    return (x0, y0, x1, y1) if x1 > x0 and y1 > y0 else None


sheet = os.path.join(ISO, '_monument-faces.png')
nums = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX']
cells = ' '.join(f'Row {i // COLS + 1}, column {i % COLS + 1}: the monument with exactly {n} carved face{"s" if i else ""}.' for i, n in enumerate(nums))
desc = (
    'A SHEET of 6 versions of the SAME monument for an isometric ninja village builder game: the Kage Mountain, a wide steep rocky '
    'mountain cliff (wider than tall) with dark green pine trees and bushes on its rounded top, a few stone steps and two stone lanterns at its foot '
    'and a grassy base. The big flat cliff wall faces the viewer (front-left side in the 2:1 isometric view) and has huge stern human '
    'faces of past village leaders carved deep into the rock side by side in ONE row, like Mount Rushmore, each face large (about a quarter '
    'of the cliff height), with hair and headbands carved in stone. The sheet has a strict grid of 3 columns and 2 rows, every cell the same '
    'size, ONE mountain centered in each cell filling about 85% of it, with empty white space between them. The ONLY difference between the '
    'versions is the number of carved faces in the row (the rest of the wall is plain rock); everything else (shape, trees, colors) is identical. '
    'Flat 16-bit pixel art game asset, chibi cozy style, few flat colors, dark pixel outline, no gradients, same camera angle and pixel art '
    'style as the attached reference building. Pure white background, no text, no labels, no grid lines. ' + cells
)
subprocess.run(['node', 'scripts/codex-image.mjs', sheet, desc, '--ref', 'docs/arte/iso/house.png', '--size', '1536x1024'], cwd=ROOT, check=True)
im = Image.open(sheet).convert('RGBA')
cw, ch = im.width / COLS, im.height / ROWS
for i in range(6):
    x, y = (i % COLS) * cw, (i // COLS) * ch
    cell = im.crop((round(x), round(y), round(x + cw), round(y + ch)))
    box = main_box(cell)
    if box:
        cell.crop(box).save(os.path.join(ISO, f'monument-f{i + 1}.png'))
        print('ok', i + 1)
