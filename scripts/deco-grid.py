# Decorações da vila (categoria "Decoração" na construção, data/buildings.ts): cada uma é uma arte isométrica como os
# prédios, pedida ao Codex numa grade (uma geração para várias, gasta menos cota) com a casa como referência de estilo,
# fatiada em docs/arte/iso/<nome>.png; o prepare-art.py faz o resto (BUILDINGS, largura pelo tamanho em tiles).
#
# Uso: python scripts/deco-grid.py            (gera o que falta, em lotes de 8)
#      python scripts/deco-grid.py --only=a,b  (refaz só esses)
import os
import subprocess
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ISO = os.path.join(ROOT, 'docs', 'arte', 'iso')
ITEMS = [
    ('lantern', 'a single tall Japanese stone lantern (toro) on a square stone base with a little warm light inside'),
    ('shrine', 'a sacred round boulder wrapped with a thick twisted straw rope (shimenawa) with white zigzag paper strips, on a tiny patch of moss'),
    ('statue', 'a small stone statue of a lucky beckoning cat with one paw raised, on a square stone pedestal'),
    ('fountain', 'a round stone fountain with clear blue water, a small central spout and a few lily pads, stone rim'),
    ('pagoda', 'a small three-tier Japanese pagoda with red wooden walls, dark green curved tiled roofs and a golden spire, on a stone platform'),
    ('cherry', 'a single small cherry blossom tree in full spring bloom, fluffy pink canopy, dark brown trunk, a few pink petals on the ground'),
    ('cherry-green', 'the SAME small cherry tree in summer: fluffy green leaf canopy instead of pink flowers, same trunk and shape'),
    ('cherry-bare', 'the SAME small cherry tree in winter: bare dark brown branches with no leaves, same trunk and shape'),
    ('bench', 'a simple wooden park bench with a little stone path under it'),
    ('flowers', 'a small square raised flower bed with a wooden border full of colorful flowers (red, yellow, purple)'),
    ('pond', 'a small irregular koi pond with clear blue water, two orange koi fish, round stones around the edge and a tiny wooden bridge'),
    ('banner', 'a tall wooden pole with a long vertical red cloth banner with a white spiral emblem, on a small stone base'),
    # Pedra Memorial (prédio único, não decoração)
    ('memorial', 'a ninja memorial stone: a tall dark grey polished stone slab with many tiny engraved name lines, on a two-step stone base, with a small incense burner smoking, white flowers and a few kunai left at its foot'),
]
COLS, ROWS = 4, 2


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


only = next((set(a.split('=', 1)[1].split(',')) for a in sys.argv if a.startswith('--only=')), None)
todo = [(n, d) for n, d in ITEMS if (only and n in only) or (not only and not os.path.exists(os.path.join(ISO, f'{n}.png')))]
while todo:
    batch, todo = todo[:COLS * ROWS], todo[COLS * ROWS:]
    sheet = os.path.join(ISO, f'_deco-{batch[0][0]}.png')
    cells = ' '.join(f'Row {i // COLS + 1}, column {i % COLS + 1}: {d}.' for i, (_, d) in enumerate(batch))
    desc = (
        f'A SHEET of {len(batch)} separate small decoration props for a cozy ninja village builder game, arranged in a strict grid of '
        f'{COLS} columns and {ROWS} rows, every cell the same size, ONE prop centered in each cell, each filling about 70% of its cell with '
        'clear empty white space between them' + (' (cells after the last item stay empty)' if len(batch) < COLS * ROWS else '') + '. '
        'Flat 16-bit pixel art game asset, chibi cozy style, few flat colors, dark pixel outline, no gradients, 2:1 isometric view from above, '
        'same camera angle, palette and art style as the attached reference building. Pure white background, no shadow outside the objects, '
        'no ground tiles, no labels, no text, no grid lines. When an item says THE SAME, draw it as the same tree as the previous one. ' + cells
    )
    subprocess.run(['node', 'scripts/codex-image.mjs', sheet, desc, '--ref', 'docs/arte/iso/house.png', '--size', '1536x1024'], cwd=ROOT, check=True)
    im = Image.open(sheet).convert('RGBA')
    cw, ch = im.width / COLS, im.height / ROWS
    for i, (name, _) in enumerate(batch):
        x, y = (i % COLS) * cw, (i // COLS) * ch
        cell = im.crop((round(x), round(y), round(x + cw), round(y + ch)))
        box = main_box(cell)
        if box:
            cell.crop(box).save(os.path.join(ISO, f'{name}.png'))
            print('ok', name)
