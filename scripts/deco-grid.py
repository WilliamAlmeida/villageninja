# Decorações da vila (categoria "Decoração" na construção, data/buildings.ts): cada uma é uma arte isométrica como os
# prédios, pedida ao Codex numa grade (uma geração para várias, gasta menos cota) com a casa como referência de estilo,
# fatiada em docs/arte/iso/<nome>.png; o prepare-art.py faz o resto (BUILDINGS, largura pelo tamanho em tiles).
#
# Uso: python scripts/deco-grid.py            (gera o que falta, em lotes de 8)
#      python scripts/deco-grid.py --only=a,b  (refaz só esses)
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from iso_template import PROMPT as TEMPLATE_PROMPT, draw as draw_template, footprint  # noqa: E402

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ISO = os.path.join(ROOT, 'docs', 'arte', 'iso')
ITEMS = [
    ('lantern', 'a single tall Japanese stone lantern (toro) on a square stone base with a little warm light inside'),
    ('shrine', 'a sacred round boulder wrapped with a thick twisted straw rope (shimenawa) with white zigzag paper strips, on a tiny patch of moss'),
    ('statue', 'a small stone statue of a lucky beckoning cat with one paw raised, on a square stone pedestal'),
    # fonte e lago ocupam 2×2 tiles: o desenho preenche o losango do chão (senão a peça fica enorme ou parece solta)
    ('fountain', 'a small square plaza of light grey paving stones shaped like a flat 2:1 isometric diamond tile, with a SMALL round stone fountain in its center (low stone basin with clear blue water, a short central spout, two lily pads); the fountain takes only the middle third of the plaza'),
    ('pagoda', 'a small three-tier Japanese pagoda with red wooden walls, dark green curved tiled roofs and a golden spire, on a stone platform'),
    ('cherry', 'a single small cherry blossom tree in full spring bloom, fluffy pink canopy, dark brown trunk, a few pink petals on the ground'),
    ('cherry-green', 'the SAME small cherry tree in summer: fluffy green leaf canopy instead of pink flowers, same trunk and shape'),
    ('cherry-bare', 'the SAME small cherry tree in winter: bare dark brown branches with no leaves, same trunk and shape'),
    ('bench', 'a simple wooden park bench with a little stone path under it'),
    ('flowers', 'a small square raised flower bed with a wooden border full of colorful flowers (red, yellow, purple)'),
    ('pond', 'a small koi pond dug into a flat 2:1 isometric diamond-shaped patch of grass: clear blue water with two orange koi fish, a rim of SMALL flat grey stones, a few reeds and one tiny wooden plank bridge; seen from the same isometric angle as the reference, flat on the ground'),
    ('banner', 'a tall wooden pole with a long vertical red cloth banner with a white spiral emblem, on a small stone base'),
    # alternativas para os locais do mapa (a ruína e a mina do jogo foram editadas à mão pelo autor; estas ficam à parte)
    ('ruin-alt', 'ancient ninja temple ruins: three broken grey stone pillars, a collapsed weathered red torii gate, a cracked stone floor with moss and vines, and a small stone altar with a sealed glowing scroll'),
    ('cave-alt', 'a mine entrance dug into a small rocky hill with grass on top: a dark tunnel with a sturdy wooden beam frame, rail tracks coming out with a wooden mine cart full of ore, a hanging lantern and a few rocks'),
    # Pedra Memorial (prédio único, não decoração)
    ('memorial', 'a ninja memorial stone: a tall dark grey polished stone slab with many tiny engraved name lines, on a two-step stone base, with a small incense burner smoking, white flowers and a few kunai left at its foot'),
]
COLS, ROWS = 4, 2
# terreno dos que não são prédios (locais do mapa): o resto sai de data/buildings.ts
FOOT = {'ruin-alt': (3, 3), 'cave-alt': (3, 3)}


def main_box(cell):
    """Caixa do desenho inteiro da casa: todos os pixels opacos menos os pontinhos soltos (fiapos de fundo). A versão
    antiga cortava pelo maior trecho contínuo de colunas e decepava a lagoa e a fonte nas bordas."""
    from PIL import ImageFilter
    a = cell.getchannel('A').point(lambda v: 255 if v > 40 else 0)
    a = a.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))  # some com fiapos de 1–2 px
    return a.getbbox()


only = next((set(a.split('=', 1)[1].split(',')) for a in sys.argv if a.startswith('--only=')), None)
todo = [(n, d) for n, d in ITEMS if (only and n in only) or (not only and not os.path.exists(os.path.join(ISO, f'{n}.png')))]
while todo:
    batch, todo = todo[:COLS * ROWS], todo[COLS * ROWS:]
    sheet = os.path.join(ISO, f'_deco-{batch[0][0]}.png')
    # gabarito de chão: o losango exato do terreno de cada peça na casa dela (scripts/iso_template.py)
    foots = [FOOT.get(n) or footprint(n.split('-')[0] if n.startswith('cherry') else n) for n, _ in batch]
    tpl = os.path.join(ISO, f'_deco-{batch[0][0]}-gabarito.png')
    ground = draw_template(tpl, foots, COLS, ROWS)
    cells = ' '.join(f'Row {i // COLS + 1}, column {i % COLS + 1}: {d}.' for i, (_, d) in enumerate(batch))
    desc = (
        f'A SHEET of {len(batch)} separate small decoration props for a cozy ninja village builder game, arranged in a strict grid of '
        f'{COLS} columns and {ROWS} rows, every cell the same size, ONE prop centered in each cell, each filling about 70% of its cell with '
        'clear empty white space between them' + (' (cells after the last item stay empty)' if len(batch) < COLS * ROWS else '') + '. '
        'Flat 16-bit pixel art game asset, chibi cozy style, few flat colors, dark pixel outline, no gradients, 2:1 isometric view from above, '
        'same camera angle, palette and art style as the attached reference building. Pure white background, no shadow outside the objects, '
        'no labels, no text, no grid lines. When an item says THE SAME, draw it as the same tree as the previous one. ' + TEMPLATE_PROMPT
        + 'Image 2 is the art style reference. ' + cells
    )
    refs = ','.join([os.path.relpath(tpl, ROOT), 'docs/arte/iso/house.png'])
    subprocess.run(['node', 'scripts/codex-image.mjs', sheet, desc, '--ref', refs, '--size', '1536x1024'], cwd=ROOT, check=True)
    im = Image.open(sheet).convert('RGBA')
    cw, ch = im.width / COLS, im.height / ROWS
    for i, (name, _) in enumerate(batch):
        x, y = (i % COLS) * cw, (i // COLS) * ch
        cell = im.crop((round(x), round(y), round(x + cw), round(y + ch)))
        box = main_box(cell)
        if box:
            # na horizontal, exatamente o losango (a largura vira o terreno no prepare-art); em cima, o desenho todo
            gr = ground[i]
            x0, x1 = round(gr['x0'] - x), round(gr['x1'] - x)
            bottom = max(box[3], round(gr['by'] - y))
            cell.crop((x0, box[1], x1, bottom)).save(os.path.join(ISO, f'{name}.png'))
            print('ok', name, f"(terreno {gr['w']}x{gr['h']})")
