# Variantes da fazenda (docs/gdd-escala-ilhas-pvp.md, seção 4): `farm-b`, `farm-b-2`, `farm-b-3`, um campo DIFERENTE
# (arrozal) no mesmo losango 3×3. A fazenda é um decalque no chão do pipeline antigo (docs/arte/iso → prepare-art.py, largura
# 2 × 0,75 × 32 × 6 tiles = 576 px em 2×), não do padrão novo dos prédios, então o preparo é feito aqui, igual ao do
# prepare-art.py para `farm`: recorte da margem, redução com BOX, contorno duro e 256 cores.
#   1. gera docs/arte/iso/farm-b*.png pelo Codex com a fazenda de hoje do mesmo nível (docs/arte/iso/farm*.png) como
#      referência de losango, estilo e paleta, e a variante do nível anterior como "o mesmo campo crescido"
#   2. grava src/art/buildings/farm-b*.png (scripts/artpaths.py)
# Uso: python scripts/field-variants.py              (gera o que falta e prepara)
#      python scripts/field-variants.py --so-preparar (não chama o Codex)
import subprocess
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from artpaths import art_file  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
ISO = ROOT / 'docs' / 'arte' / 'iso'
TILES = 6  # w + h do terreno 3×3 (prepare-art.py: BUILDINGS['farm'])
SCENERY_SCALE = 2

STYLE = ('Same art style as the reference image: flat 16-bit pixel art, few flat colors, dark pixel outline, no gradients. The '
         'plot is the exact SAME flat 2:1 isometric diamond-shaped ground plot as the reference (same diamond shape, size and '
         'position, fills the image width, same thin wooden fence border), seen from above. Nothing outside the diamond '
         'except things that stand on it. Pure white background, no text.')
ITEMS = [
    ('farm-b', 'farm',
     'A DIFFERENT farm plot of the same village, NOT a copy of the reference: flooded RICE PADDIES: squares of shallow '
     'pale-blue water with bright green rice seedlings in neat rows, narrow brown earth dikes between the squares, a small '
     'wooden water gate in one corner.'),
    ('farm-b-2', 'farm-2',
     'THE SAME rice paddy plot as image 2, upgraded to level 2 (image 1 shows the level-2 wheat farm of the game only for '
     'size, style and richness): fuller taller green rice, a small thatched tool shed in a corner, a scarecrow, a wooden '
     'footbridge over the dike.'),
    ('farm-b-3', 'farm-3',
     'THE SAME rice paddy plot as image 2, upgraded to level 3 (image 1 shows the level-3 wheat farm of the game only for '
     'size, style and richness): golden ripe rice ready for harvest, bundles of cut rice drying on a wooden rack, a small '
     'thatched storage hut, a stone irrigation channel with water, a scarecrow.'),
]


def crisp(im):
    im.putalpha(im.getchannel('A').point(lambda a: 255 if a > 110 else 0))
    return im


def prepare(name):
    im = Image.open(ISO / f'{name}.png').convert('RGBA')
    box = im.getchannel('A').point(lambda a: 255 if a > 40 else 0).getbbox()
    im = im.crop(box)
    w = round(48 * TILES * SCENERY_SCALE)
    im = crisp(im.resize((w, round(im.height * w / im.width)), Image.BOX))
    im = im.quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    out = art_file(name)
    im.save(out, optimize=True)
    print(out.relative_to(ROOT).as_posix(), im.size, f'{out.stat().st_size / 1024:.1f} KB')


def main():
    prev = None
    for name, cur, desc in ITEMS:
        src = ISO / f'{name}.png'
        if not src.exists() and '--so-preparar' not in sys.argv:
            refs = [ISO / f'{cur}.png'] + ([prev] if prev else [])
            rel = ','.join(r.relative_to(ROOT).as_posix() for r in refs)
            subprocess.run(['node', 'scripts/codex-image.mjs', str(src), f'{desc} {STYLE}', '--ref', rel, '--size', '1536x1024'], cwd=ROOT, check=True)
        if src.exists():
            prepare(name)
        prev = src


main()
