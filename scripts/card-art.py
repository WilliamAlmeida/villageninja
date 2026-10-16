# Imagens dos cards de pintar terreno no menu Construir (ui/build.ts): Campo cercado, Rua calçada, Limpar área, Aterrar
# e Cavar. Os cards de prédio usam a arte do prédio (`.bg`); estes não tinham nada. Uma folha do Codex (grade 3×2, gabarito
# de chão 2×2 em cada casa, a arte da casa e o atlas dos campos como referência de estilo), fatiada, sem fundo, reduzida
# e gravada em src/art/ui/cards/card-<nome>.png (scripts/artpaths.py). Originais em docs/arte/cards/.
#
# Uso: python scripts/card-art.py            (gera a folha se faltar e prepara)
#      python scripts/card-art.py --refazer  (gera de novo)
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from artpaths import art_file  # noqa: E402
import iso_template  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'docs' / 'arte' / 'cards'
COLS, ROWS = 3, 2
WIDTH = 192  # largura final (o card mostra a ~6,6rem; 2× para telas densas)
CARDS = [
    ('field', 'a small fenced crop field: four plots of tilled brown soil with rows of golden wheat and green cabbages, '
              'a rustic wooden fence with round posts around it and a small wooden gate in front'),
    ('road', 'a short stretch of paved village road: grey flat cobblestone tiles in a neat pattern on the grass, with a '
             'low stone curb along the edges'),
    ('clear', 'clearing land: a tree stump with an axe stuck in it, a few cut logs, wood chips and a small pile of broken '
              'grey rocks on a patch of grass'),
    ('fill', 'filling in a pond: half of the tile is blue pond water, the other half a fresh mound of brown earth and '
             'stones pushed into the water, a wooden shovel and a basket of dirt on the bank'),
    ('dig', 'digging a pond: a freshly dug square hole in the grass with blue water starting to fill the bottom, a mound '
            'of dug-out brown earth beside it and a wooden shovel stuck in the mound'),
]


def main():
    sheet = SRC / 'cards.png'
    if '--refazer' in sys.argv or not sheet.exists():
        SRC.mkdir(parents=True, exist_ok=True)
        tpl = SRC / '_gabarito.png'
        iso_template.draw(tpl, [(2, 2)] * (COLS * ROWS), COLS, ROWS)
        cells = ' '.join(f'Row {i // COLS + 1}, column {i % COLS + 1}: {d}.' for i, (_, d) in enumerate(CARDS))
        desc = (f'A SHEET of {len(CARDS)} separate small isometric scenes for the build menu of a pixel art village game, in '
                f'a strict grid of {COLS} columns and {ROWS} rows (the last cell stays EMPTY), one scene per cell. '
                + iso_template.PROMPT + cells + ' Same flat 16-bit pixel art style, palette and dark outline as images 2 and '
                '3 (art of the game). Nothing outside the diamond except things standing on it.')
        refs = ','.join(p.relative_to(ROOT).as_posix() for p in [tpl, art_file('house'), art_file('crop-wheat')])
        subprocess.run(['node', 'scripts/codex-image.mjs', str(sheet), desc, '--ref', refs, '--size', '1536x1024'], cwd=ROOT, check=True)
    im = Image.open(sheet).convert('RGBA')
    cw, ch = im.width / COLS, im.height / ROWS
    for i, (name, _) in enumerate(CARDS):
        cell = im.crop((round(i % COLS * cw), round(i // COLS * ch), round((i % COLS + 1) * cw), round((i // COLS + 1) * ch)))
        box = cell.getchannel('A').point(lambda a: 255 if a > 40 else 0).getbbox()
        if not box:
            print('VAZIO', name)
            continue
        c = cell.crop(box)
        if name == 'field':
            # vãos brancos fechados entre as ripas da cerca (o remove-bg só tira o fundo ligado à borda)
            a = np.array(c)
            rgb = a[..., :3].astype(int)
            a[(rgb.min(2) >= 236) & (rgb.max(2) - rgb.min(2) <= 14), 3] = 0
            c = Image.fromarray(a)
        c = c.resize((WIDTH, max(1, round(c.height * WIDTH / c.width))), Image.BOX)
        c.putalpha(c.getchannel('A').point(lambda a: 255 if a > 110 else 0))
        c = c.quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
        out = art_file(f'card-{name}')
        c.save(out, optimize=True)
        print(out.relative_to(ROOT).as_posix(), c.size)


main()
