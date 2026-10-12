# Lugares do mapa da Região no estilo Ikariam: cada vilarejo, a vila do jogador, o posto avançado e os covis ganham
# uma miniatura desenhada (construções sobre um pedacinho de chão) que fica em cima do mapa src/art/region/region.jpg.
# Uma geração só do Codex numa grade 4×2 (referência de estilo = o próprio mapa), fatiada e sem fundo em
# docs/arte/region/<nome>.png; depois monta o atlas src/art/region/region-places.png (casas de CELL px, desenho encostado
# embaixo e centrado; a ordem é PLACES, a mesma de render em ui/panel.ts → REGION_ART).
#
# Uso: python scripts/region-places.py          (gera o que falta, em lotes de 8, e monta o atlas)
#      python scripts/region-places.py --pack   (só remonta o atlas)
import os
import subprocess
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'scripts'))
from artpaths import art_file  # noqa: E402  (pastas de src/art)
SRC = os.path.join(ROOT, 'docs', 'arte', 'region')
CELL = 160
PLACES = [
    ('home', 'a hidden ninja village: a tall red-roof Japanese pagoda tower in the middle surrounded by small wooden houses with orange tiled roofs, a wooden palisade wall with a gate, a few green trees, on a small patch of grass and dirt'),
    ('arroz', 'a peaceful farming hamlet: three thatched-roof wooden houses beside flooded bright green terraced rice paddies and a small wooden water wheel, on a small patch of grass'),
    ('pesca', 'a fishing village: wooden stilt houses on a pier over blue water, two small fishing boats with white sails and drying nets, on a small sandy shore patch'),
    ('montanha', 'a mountain mining village: grey stone houses with dark slate roofs against grey rocky cliffs, a mine entrance with wooden beams and a mine cart full of ore'),
    ('mercadores', 'a rich walled merchant town: a tall pagoda with red and gold roofs, market stalls with colored awnings and warehouses, a stone wall around it'),
    ('outpost', 'a small wooden ninja outpost camp: a tall wooden watchtower, two canvas tents, a campfire and a red flag on a pole, on a small patch of grass'),
    ('covil', 'an ominous hidden cave entrance carved into black rocks, red banners with a black eclipse circle, two torches, on a small patch of dark rock'),
    ('som', 'a secret underground lair: stone stairs going down into the ground between dark twisted forest trees and roots, purple paper lanterns, on a small patch of dark grass'),
    # a vila do jogador por nível (home = Vila Oculta, nível 2)
    ('home-0', 'a tiny poor ninja hamlet: four small wooden huts with thatched roofs around a campfire, a low wooden fence, a few trees, on a small patch of grass and dirt'),
    ('home-1', 'a small ninja village: wooden houses with orange tiled roofs, a small wooden watchtower, a wooden palisade with a simple gate, trees, on a small patch of grass and dirt'),
    ('home-3', 'a great hidden ninja city: a huge red round Kage tower with a green leaf emblem in the center, several red pagodas, many houses with orange tiled roofs, a tall stone and wood wall with a big red gate, on a patch of grass'),
    # vilarejos hostis (saqueados): as mesmas vilas queimadas, com fumaça
    ('arroz-x', 'the SAME rice farming hamlet after being raided: burnt thatched houses with broken roofs, small fires and dark smoke, trampled rice paddies, a broken water wheel'),
    ('pesca-x', 'the SAME fishing village after being raided: burnt stilt houses, a broken pier, a sunken boat, small fires and dark smoke over blue water'),
    ('montanha-x', 'the SAME mountain mining village after being raided: burnt stone houses with collapsed roofs, small fires and dark smoke, an overturned mine cart'),
    ('mercadores-x', 'the SAME walled merchant town after being raided: broken wall with a breach, burnt market stalls, a pagoda with damaged roof, fires and dark smoke'),
    # equipes em viagem (vistas de lado, indo para a DIREITA; o jogo espelha na volta): carroça vazia na ida, cheia na
    # volta com espólio, sem carroça quando perderam; pelo mar, o barco
    ('trip-cart', 'seen from the side, three tiny chibi ninjas with dark blue clothes and headbands walking to the RIGHT, the front one pulling an EMPTY small wooden two-wheeled handcart behind them'),
    ('trip-loot', 'seen from the side, the same three tiny chibi ninjas walking to the RIGHT pulling the same small wooden handcart now FULL of crates, rice sacks and gold coins'),
    ('trip-none', 'seen from the side, the same three tiny chibi ninjas walking to the RIGHT with NO cart, tired, bandaged and limping, one leaning on another'),
    ('boat-cart', 'seen from the side, a small wooden sailing boat with a white sail sailing to the RIGHT with three tiny chibi ninjas on board and an EMPTY deck, small waves under it'),
    ('boat-loot', 'seen from the side, the same small wooden sailing boat sailing to the RIGHT with the three tiny ninjas and the deck FULL of crates, sacks and gold, small waves under it'),
    ('boat-none', 'seen from the side, a small broken wooden raft drifting to the RIGHT with the three tiny ninjas tired and bandaged on it, torn sail, small waves under it'),
]
COLS, ROWS = 4, 2


def run(on, gap=4):
    """Maior trecho seguido com conteúdo (buracos de até `gap` px contam junto): tira lascas do vizinho na beira."""
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

missing = [(n, d) for n, d in PLACES if not os.path.exists(os.path.join(SRC, f'{n}.png'))]
while '--pack' not in sys.argv and missing:
    batch, missing = missing[:COLS * ROWS], missing[COLS * ROWS:]
    os.makedirs(SRC, exist_ok=True)
    sheet = os.path.join(SRC, f'_grade-{batch[0][0]}.png')
    cells = ' '.join(f'Row {i // COLS + 1}, column {i % COLS + 1}: {d}.' for i, (_, d) in enumerate(batch))
    refs = [os.path.relpath(art_file('region', '.jpg'), ROOT)] + ([os.path.relpath(os.path.join(SRC, '_grade.png'), ROOT)] if os.path.exists(os.path.join(SRC, '_grade.png')) else [])
    desc = (
        f'A SHEET of {len(batch)} separate miniature map pieces (settlements or small travelling parties) for a strategy game world map, like the town icons '
        f'on the Ikariam island map, arranged in a strict grid of {COLS} columns and {ROWS} rows, every cell the same size, '
        'ONE piece centered in each cell, each filling about 75% of its cell with clear empty white space between them'
        + (' (cells after the last item stay empty)' if len(batch) < COLS * ROWS else '') + '. '
        'Settlements are seen from above at a 3/4 isometric angle; travelling parties as described. 16-bit pixel art matching the attached region map exactly (same palette, '
        'same pixel size, dark outlines, flat shading)'
        + ('; the second attached image shows the settlements already made: keep exactly that style and scale, and when an item says THE SAME, redraw that settlement from it' if len(refs) > 1 else '')
        + '. Each settlement sits on its own small irregular patch of ground that fades to nothing at the edges; travelling parties have no ground patch. '
        'No labels, no text, no grid lines. ' + cells
    )
    subprocess.run(['node', 'scripts/codex-image.mjs', sheet, desc, '--ref', ','.join(refs), '--size', '1536x1024'], cwd=ROOT, check=True)
    im = Image.open(sheet).convert('RGBA')
    cw, ch = im.width / COLS, im.height / ROWS
    for i, (name, _) in enumerate(batch):
        x, y = (i % COLS) * cw, (i // COLS) * ch
        cell = im.crop((round(x), round(y), round(x + cw), round(y + ch)))
        box = main_box(cell)
        if box:
            cell.crop(box).save(os.path.join(SRC, f'{name}.png'))
            print('ok', name)

# atlas: uma linha com as casas na ordem de PLACES
atlas = Image.new('RGBA', (CELL * len(PLACES), CELL), (0, 0, 0, 0))
for i, (name, _) in enumerate(PLACES):
    p = os.path.join(SRC, f'{name}.png')
    if not os.path.exists(p):
        continue
    im = Image.open(p).convert('RGBA')
    k = min(CELL / im.width, CELL / im.height)
    im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    atlas.alpha_composite(im, (i * CELL + (CELL - im.width) // 2, CELL - im.height))
atlas.save(art_file('region-places'), optimize=True)
print('atlas', atlas.size)
