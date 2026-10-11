# Enfeites dos andares da mina (só visual): uma geração do Codex numa grade 4×3 com 12 objetos de caverna em pixel art,
# fatiada e sem fundo em docs/arte/cave/<nome>.png e montada no atlas src/art/cave-props.png (casas de CELL px, desenho
# encostado embaixo e centrado; a ordem é PROPS, a mesma de CAVE_PROPS em render/cave.ts).
#
# Uso: python scripts/cave-props.py          (gera o que falta e monta o atlas)
#      python scripts/cave-props.py --pack   (só remonta o atlas)
import os
import subprocess
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'docs', 'arte', 'cave')
CELL = 96
PROPS = [
    ('stalagmites', 'a tall cluster of brown cave stalagmites of different heights rising from a small pile of rubble'),
    ('stalagmites-small', 'two small brown stalagmites with a few pebbles'),
    ('crystal-blue', 'a cluster of glowing bright blue crystals growing out of grey rocks'),
    ('crystal-orange', 'a cluster of glowing orange amber crystals growing out of grey rocks'),
    ('mushroom-purple', 'a group of glowing purple cave mushrooms with light spots on the caps, on a little patch of moss'),
    ('mushroom-blue', 'a group of small glowing cyan blue cave mushrooms on a little patch of moss'),
    ('pool', 'a small dark blue underground water puddle with a rim of grey stones, flat on the ground, seen from above'),
    ('bones', 'a skull and scattered old bones lying flat on the ground with a few pebbles'),
    ('cart', 'a wooden mine cart full of grey ore on a short piece of rail track'),
    ('support', 'a wooden mine support frame (two posts and a crossbeam with rope bindings) with a glowing oil lantern hanging from it'),
    ('torch', 'a wooden torch post on a stone base with a bright burning flame'),
    ('crates', 'two wooden crates, a small barrel and a pickaxe leaning on them, with a small lit lantern on top'),
]
COLS, ROWS = 4, 3



def _run(on, gap=4):
    best, start, last = (0, 0), None, None
    for i, v in enumerate(list(on) + [False] * (gap + 1)):
        if v:
            if start is None or i - last > gap + 1:
                start = i
            last = i
            if last - start > best[1] - best[0]:
                best = (start, last + 1)
    return best


def _main_box(cell):
    """Maior trecho seguido com conteúdo (tira lascas do vizinho que caíram na casa)."""
    a = cell.getchannel('A').point(lambda v: 255 if v > 40 else 0)
    w, h = a.size
    px = a.load()
    x0, x1 = _run([sum(1 for y in range(h) if px[x, y]) > 2 for x in range(w)])
    y0, y1 = _run([sum(1 for x in range(x0, x1) if px[x, y]) > 2 for y in range(h)])
    return (x0, y0, x1, y1) if x1 > x0 and y1 > y0 else None


missing = [(n, d) for n, d in PROPS if not os.path.exists(os.path.join(SRC, f'{n}.png'))]
if '--pack' not in sys.argv and missing:
    os.makedirs(SRC, exist_ok=True)
    sheet = os.path.join(SRC, '_grade.png')
    cells = ' '.join(f'Row {i // COLS + 1}, column {i % COLS + 1}: {d}.' for i, (_, d) in enumerate(PROPS))
    desc = (
        f'A SHEET of {len(PROPS)} separate isometric cave props for a top-down pixel art game, arranged in a strict grid of '
        f'{COLS} columns and {ROWS} rows, every cell the same size, ONE prop centered in each cell, each filling about 70% of '
        'its cell with clear empty white space between them. Seen from above at a 3/4 isometric angle, the same angle and '
        '16-bit pixel art style as the attached cave props reference (dark outlines, flat shading, glowing parts bright). '
        'No ground tile under them, no labels, no text, no grid lines. ' + cells
    )
    ref = os.path.join('docs', 'arte', 'mockups', 'Imagem do ChatGPT 11 de out. de 2026, 12_33_50.png')
    subprocess.run(['node', 'scripts/codex-image.mjs', sheet, desc, '--ref', ref, '--size', '1536x1024'], cwd=ROOT, check=True)
    im = Image.open(sheet).convert('RGBA')
    cw, ch = im.width / COLS, im.height / ROWS
    for i, (name, _) in enumerate(PROPS):
        x, y = (i % COLS) * cw, (i // COLS) * ch
        cell = im.crop((round(x), round(y), round(x + cw), round(y + ch)))
        box = _main_box(cell)
        if box:
            cell.crop(box).save(os.path.join(SRC, f'{name}.png'))
            print('ok', name)

atlas = Image.new('RGBA', (CELL * len(PROPS), CELL), (0, 0, 0, 0))
for i, (name, _) in enumerate(PROPS):
    p = os.path.join(SRC, f'{name}.png')
    if not os.path.exists(p):
        continue
    im = Image.open(p).convert('RGBA')
    k = min(CELL / im.width, CELL / im.height)
    im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.BOX)
    atlas.alpha_composite(im, (i * CELL + (CELL - im.width) // 2, CELL - im.height))
atlas.save(os.path.join(ROOT, 'src', 'art', 'cave-props.png'), optimize=True)
print('atlas', atlas.size)
