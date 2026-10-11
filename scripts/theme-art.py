# Mapas jogáveis temáticos (game/scene.ts → `SceneInfo.theme`): a Vila dos Pescadores (palafitas, cais, barcos) e a
# Cidade dos Mercadores (deserto, tendas, muralha). Duas gerações do Codex:
#  1. prédios no tema (casa, mercado, torre), referência = a casa da vila → docs/arte/iso/<tipo>-<tema>.png, preparados
#     pelo prepare-art.py com a largura do prédio comum (o jogo troca a arte no mapa do tema: Renderer.artBox);
#  2. enfeites (barcos, redes, palmeiras, poço…) → docs/arte/theme/<nome>.png e o atlas src/art/theme-props.png
#     (casas de CELL px, desenho encostado embaixo; ordem = PROPS = THEME_PROPS em render/themeProps.ts).
# Uso: python scripts/theme-art.py           (gera o que falta e monta o atlas)
#      python scripts/theme-art.py --pack    (só remonta o atlas)
import os
import subprocess
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ISO = os.path.join(ROOT, 'docs', 'arte', 'iso')
SRC = os.path.join(ROOT, 'docs', 'arte', 'theme')
CELL = 128
BUILDINGS = [
    ('house-fishing', 'a small fishing village house on wooden stilts with a weathered blue-grey tiled roof, a little ladder, a fishing net hanging on the wall and a wooden deck'),
    ('market-fishing', 'a fish market warehouse on a wooden deck: open front with baskets of fish, crates and barrels, a blue-grey tiled roof and a hanging lantern'),
    ('tower-fishing', 'a tall wooden lookout tower on stilts with a small blue-grey roof, a lantern and a bell, rope railings'),
    ('house-desert', 'a small desert house of sand-colored adobe with a rounded dome roof, a wooden door, a striped cloth awning and clay pots by the wall'),
    ('market-desert', 'a desert bazaar: three market stalls with colorful striped cloth awnings (red, yellow, blue), rugs, spice sacks and pottery, on a sandy patch'),
    ('tower-desert', 'a tall square adobe watchtower of sand-colored brick with a crenellated top, a red banner and a small arched window'),
]
PROPS = [
    ('boat', 'a small wooden fishing boat with a furled white sail, floating on a little patch of blue water'),
    ('boat-small', 'a tiny wooden rowing boat with two oars, floating on a little patch of blue water'),
    ('nets', 'a wooden rack with fishing nets hung to dry and two floats'),
    ('fish-rack', 'a low wooden frame with rows of fish hung to dry in the sun'),
    ('barrels', 'three wooden barrels, a coil of rope and a crate of fish'),
    ('lantern-pole', 'a wooden pole with a paper lantern hanging from it, on a small stone base'),
    ('palm', 'a tall desert palm tree with green fronds and a few coconuts'),
    ('palm-small', 'a small young desert palm tree'),
    ('well', 'a round stone desert well with a wooden frame, a rope and a bucket'),
    ('tent', 'a small desert cloth tent with red and white stripes'),
    ('cactus', 'a tall green desert cactus with two arms and a small rock'),
    ('pots', 'a group of clay pots and amphoras with two burlap spice sacks'),
]
COLS = 4


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


def grid(items, out, kind, rows):
    todo = [(n, d) for n, d in items if not os.path.exists(os.path.join(out, f'{n}.png'))]
    if not todo:
        return
    os.makedirs(out, exist_ok=True)
    sheet = os.path.join(out, f'_{kind}-{todo[0][0]}.png')
    cells = ' '.join(f'Row {i // COLS + 1}, column {i % COLS + 1}: {d}.' for i, (_, d) in enumerate(todo))
    desc = (
        f'A SHEET of {len(todo)} separate {kind} for a cozy ninja village builder game, arranged in a strict grid of {COLS} columns and '
        f'{rows} rows, every cell the same size, ONE item centered in each cell, each filling about 75% of its cell with clear empty white space '
        'between them' + (' (cells after the last item stay empty)' if len(todo) < COLS * rows else '') + '. '
        'Flat 16-bit pixel art game asset, chibi cozy style, few flat colors, dark pixel outline, no gradients, 2:1 isometric view from above, '
        'same camera angle, palette and art style as the attached reference building. Pure white background, no shadow outside the objects, '
        'no ground tiles, no labels, no text, no grid lines. ' + cells
    )
    subprocess.run(['node', 'scripts/codex-image.mjs', sheet, desc, '--ref', 'docs/arte/iso/house.png', '--size', '1536x1024'], cwd=ROOT, check=True)
    im = Image.open(sheet).convert('RGBA')
    cw, ch = im.width / COLS, im.height / rows
    for i, (name, _) in enumerate(todo):
        x, y = (i % COLS) * cw, (i // COLS) * ch
        cell = im.crop((round(x), round(y), round(x + cw), round(y + ch)))
        box = main_box(cell)
        if box:
            cell.crop(box).save(os.path.join(out, f'{name}.png'))
            print('ok', name)


if '--pack' not in sys.argv:
    grid(BUILDINGS, ISO, 'buildings', 2)
    grid(PROPS, SRC, 'props', 3)

atlas = Image.new('RGBA', (CELL * len(PROPS), CELL), (0, 0, 0, 0))
for i, (name, _) in enumerate(PROPS):
    p = os.path.join(SRC, f'{name}.png')
    if not os.path.exists(p):
        continue
    im = Image.open(p).convert('RGBA')
    k = min(CELL / im.width, CELL / im.height)
    im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    atlas.alpha_composite(im, (i * CELL + (CELL - im.width) // 2, CELL - im.height))
atlas.save(os.path.join(ROOT, 'src', 'art', 'theme-props.png'), optimize=True)
print('atlas', atlas.size)
