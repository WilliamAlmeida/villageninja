# Arte dos campos cercados (render/fields.ts): as plantas de cada cultura em 6 etapas, o chão do canteiro e a cerca, num
# atlas só, src/art/props/fields.png (casas de CELL×CELL px em 2×, SCENERY_SCALE).
#
# Cada folha do Codex leva como 1ª referência um gabarito de chão (scripts/iso_template.py): em cada casa o losango exato
# de um tile (1×1) e, nas peças de cerca, uma linha vermelha no lado do losango onde a cerca fica. O gabarito acerta o
# tamanho, mas não a posição: o recorte (`cells`) encaixa cada peça pelo próprio desenho.
#
# Casa do atlas (CELL = 112, em 2×): o losango do tile tem a ponta de cima em (56, 56), esquerda (8, 80), direita
# (104, 80) e a da frente em (56, 104); o que passa dele (folhas, postes) cabe na folga. render/fields.ts usa as mesmas
# medidas (FCELL, a metade na cena).
#   linhas 0..5: culturas na ordem de CROP_LIST (data/crops.ts); colunas = semente, broto, crescendo, quase, maduro,
#                passando do ponto (murchando)
#   linha 6: terra crua, arada, arada úmida, crua no inverno, cerca "\" (lado de baixo-esquerdo), cerca "/" (lado de
#            baixo-direito), portão "\" e poste de canto (na ponta da frente)
#
# Uso: python scripts/field-art.py            (gera as folhas que faltam, em paralelo, e monta o atlas)
#      python scripts/field-art.py --pack     (só remonta o atlas)
#      python scripts/field-art.py --refazer trigo,cerca   (gera de novo essas folhas)
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).parent))
from artpaths import art_file  # noqa: E402
import iso_template  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'docs' / 'arte' / 'fields'
CELL = 112
TOP, BOT, HALF = 56, 104, 48  # ponta de cima e da frente do losango na casa; meia largura
W, H = 1536, 1024

STYLE = ('Flat 16-bit pixel art for a top-down isometric village game, few flat colors, dark pixel outline, no gradients, '
         'no anti-aliasing, cheerful saturated colors like a classic farming game.')
TEMPLATE = ('Image 1 is a placement TEMPLATE with the same grid: in each cell a flat grey diamond shows the EXACT ground '
            'tile (true 2:1 isometric). Keep every drawing on its cell\'s diamond with the same size, position and angle. '
            'Do not draw the template itself (no grey diamond, no grid lines, no red marks). ')

STAGES = [
    'stage 1, just sown: only a few tiny dark seed dots and very small soil mounds in the spots where the plants will grow',
    'stage 2, sprouts: tiny bright green seedlings, just two or three small leaves each',
    'stage 3, growing: young plants at half size, leafy, still green, no fruit or grain yet',
    'stage 4, almost ripe: plants at full size, the fruit or grain is formed but still green/unripe',
    'stage 5, ripe: full size and ready to harvest, the fruit or grain in its full ripe color',
    'stage 6, overripe and wilting: the same ripe crop but drooping, leaves turning yellow-brown and dry',
]
# (arquivo, descrição da planta madura e de como fica no tile); a ordem é CROP_LIST
CROPS = [
    ('wheat', 'WHEAT: dense tufts of thin upright stalks in short rows; ripe = tall golden wheat ears'),
    ('turnip', 'TURNIP: four leafy turnip plants (one in each quarter of the diamond); ripe = round white-and-purple '
               'turnip roots showing above the soil under a crown of green leaves'),
    ('cabbage', 'CABBAGE: four cabbage plants (one in each quarter of the diamond); ripe = big round pale-green cabbage '
                'heads with wide outer leaves'),
    ('rice', 'RICE: tufts of thin rice plants in short rows standing in a little shallow water; ripe = drooping pale '
             'golden rice grain heads'),
    ('pumpkin', 'PUMPKIN: one sprawling pumpkin vine with big round leaves covering the diamond; ripe = two big orange '
                'pumpkins among the leaves'),
    ('herbs', 'MEDICINAL HERBS: four small bushy herb plants (one in each quarter of the diamond) with soft green leaves; '
              'ripe = covered in small lilac-purple flowers'),
]
GROUND = [
    ('soil-raw', 'a FLAT ground tile filling exactly the diamond (no height, no sides): bare untilled light brown earth '
                 'with a few short sparse grass tufts and pebbles'),
    ('soil-tilled', 'a FLAT ground tile filling exactly the diamond: freshly plowed brown soil with 4 neat parallel raised '
                    'furrows running parallel to the upper-right edge of the diamond'),
    ('soil-wet', 'the same FLAT plowed tile with the same 4 furrows, but the soil is dark wet brown with a few small shiny '
                 'water puddles in the grooves'),
    ('soil-winter', 'a FLAT ground tile filling exactly the diamond: bare untilled frozen earth partly covered by a thin '
                    'layer of white snow and frost'),
    ('fence-a', 'a short rustic wooden fence section standing upright EXACTLY along the red line (the red line is where '
                'it touches the ground): one round wooden post on each end of the red line and two horizontal wooden '
                'rails between them; the fence is about as tall as 40% of the red line\'s width'),
    ('fence-b', 'the SAME rustic wooden fence section (two end posts, two rails, same height and colors) standing upright '
                'EXACTLY along this red line, which goes the other way'),
    ('gate', 'a small wooden farm gate standing upright EXACTLY along the red line, same height as the fence: two slightly '
             'taller posts on the ends of the red line and a closed gate of wooden planks with a diagonal brace between '
             'them'),
    ('post', 'one single round wooden fence post (same as the fence posts) standing upright on the red dot'),
]
SHEETS = {name: (desc, 3, 2) for name, desc in CROPS}
SHEETS['ground'] = (None, 4, 2)


def template(name):
    """Gabarito da folha e os losangos dela (iso_template.diamonds)."""
    _, cols, rows = SHEETS[name]
    path = SRC / f'_gabarito-{name}.png'
    ds = iso_template.draw(path, [(1, 1)] * (cols * rows), cols, rows, W, H)
    if name == 'ground':
        im = Image.open(path).convert('RGB')
        d = ImageDraw.Draw(im)
        for i, g in enumerate(ds):
            cx, by, u = g['cx'], g['by'], g['unit']
            left, bottom, right = (cx - u, by - u / 2), (cx, by), (cx + u, by - u / 2)
            if GROUND[i][0] in ('fence-a', 'gate'):
                d.line([left, bottom], fill=(230, 30, 30), width=8)
            elif GROUND[i][0] == 'fence-b':
                d.line([bottom, right], fill=(230, 30, 30), width=8)
            elif GROUND[i][0] == 'post':
                d.ellipse([cx - 9, by - 9, cx + 9, by + 9], fill=(230, 30, 30))
        im.save(path)
    return path


def prompt(name):
    desc, cols, rows = SHEETS[name]
    if name == 'ground':
        cells = ' '.join(f'Row {i // cols + 1}, column {i % cols + 1}: {d}.' for i, (_, d) in enumerate(GROUND))
        return (f'A SHEET of {len(GROUND)} separate farm field pieces in a strict grid of {cols} columns and {rows} rows, '
                f'one piece per cell. {TEMPLATE}{cells} {STYLE}')
    cells = ' '.join(f'Row {i // cols + 1}, column {i % cols + 1}: {s}.' for i, s in enumerate(STAGES))
    return (f'A SHEET of 6 growth stages of the same crop, {desc}, in a strict grid of {cols} columns and {rows} rows, one '
            f'stage per cell. {TEMPLATE}In each cell draw ONLY the plants standing on that one tile, spread over the '
            'diamond and not going outside its left and right corners; do NOT draw any soil, ground or tile under them '
            f'(the ground is drawn separately). Same plants, same spots and same colors in every cell, only growing. {cells} '
            f'{STYLE}')


def generate(names):
    SRC.mkdir(parents=True, exist_ok=True)
    procs = []
    for name in names:
        ref = template(name).relative_to(ROOT).as_posix()
        out = (SRC / f'{name}.png').relative_to(ROOT).as_posix()
        procs.append((name, subprocess.Popen(['node', 'scripts/codex-image.mjs', out, prompt(name), '--ref', ref, '--size',
                                              f'{W}x{H}'], cwd=ROOT)))
    for name, p in procs:
        p.wait()
        print(name, 'ok' if p.returncode == 0 else 'FALHOU')


def _opaque(im):
    return im.getchannel('A').point(lambda v: 255 if v > 110 else 0)


def _foot(a, x):
    """Base do poste cujo centro está na coluna x (o ponto mais baixo do desenho ali)."""
    px, h = a.load(), a.size[1]
    return x, max(yy for yy in range(h) if px[x, yy])


def _place(src, sx0, sy0, k, dx0, dy0):
    """Leva `src` para a casa: o ponto (sx0, sy0) de src vai a (dx0, dy0) da casa, com escala k."""
    im = src.resize((max(1, round(src.width * k)), max(1, round(src.height * k))), Image.BOX)
    ox, oy = round(dx0 - sx0 * k), round(dy0 - sy0 * k)
    tmp = Image.new('RGBA', (CELL + 2 * im.width, CELL + 2 * im.height), (0, 0, 0, 0))
    tmp.alpha_composite(im, (ox + im.width, oy + im.height))
    return tmp.crop((im.width, im.height, im.width + CELL, im.height + CELL))


def _holes(cell):
    """Apaga o branco sem cor que sobrou dentro do desenho (vãos fechados que o remove-bg, que só tira o fundo ligado à
    borda, não alcança). O branco do desenho (neve, nabo) tem um pouco de cor e fica."""
    a = np.array(cell)
    rgb = a[..., :3].astype(int)
    a[(rgb.min(2) >= 236) & (rgb.max(2) - rgb.min(2) <= 14), 3] = 0
    return Image.fromarray(a)


# pontas do losango na casa do atlas
LEFT, BOTTOM, RIGHT = (8, 80), (56, BOT), (104, 80)


def cells(name):
    """Recorta as casas da folha `name` e encaixa cada desenho na casa do atlas pelo próprio contorno: o chão no losango
    inteiro, a cerca pelos pés dos postes nas pontas do lado do tile, a planta centrada com a base perto da ponta da
    frente (o Codex respeita o tamanho do gabarito, mas não a posição exata)."""
    _, cols, rows = SHEETS[name]
    im = Image.open(SRC / f'{name}.png').convert('RGBA')
    ds = iso_template.diamonds([(1, 1)] * (cols * rows), cols, rows, im.width, im.height)
    cw, ch = im.width / cols, im.height / rows
    out, fence_k = [], None
    if name == 'ground':
        # largura do poste: a do poste solto (a ripa encosta nos postes da cerca, então não dá para medir neles)
        pb = _opaque(im.crop((round(3 * cw), round(ch), round(4 * cw), round(2 * ch)))).getbbox()
        post_w = pb[2] - pb[0] if pb else 40
    for i, g in enumerate(ds):
        part = im.crop((round(i % cols * cw), round(i // cols * ch), round((i % cols + 1) * cw), round((i // cols + 1) * ch)))
        a = _opaque(part)
        box = a.getbbox()
        if not box:
            out.append(Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0)))
            continue
        x0, y0, x1, y1 = box
        k = HALF / g['unit']
        kind = GROUND[i][0] if name == 'ground' else 'plant'
        if kind.startswith('soil'):
            # 6% maior e recortado no losango exato: o contorno escuro que o Codex põe em volta fica de fora (senão cada
            # canteiro ganha uma borda e o cercado vira uma grade)
            sw, sh = round((RIGHT[0] - LEFT[0]) * 1.06), round((BOT - TOP) * 1.06)
            c = part.crop(box).resize((sw, sh), Image.BOX)
            cell = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
            cell.alpha_composite(c, (CELL // 2 - sw // 2, (TOP + BOT) // 2 - sh // 2))
            mask = Image.new('L', (CELL, CELL), 0)
            ImageDraw.Draw(mask).polygon([LEFT, (CELL // 2, TOP), RIGHT, BOTTOM], fill=255)
            cell.putalpha(Image.fromarray(np.minimum(np.array(cell.getchannel('A')), np.array(mask))))
        elif kind in ('fence-a', 'fence-b', 'gate'):
            (lx, ly), (rx, ry) = _foot(a, x0 + post_w // 2), _foot(a, x1 - 1 - post_w // 2)
            (tx0, ty0), (tx1, ty1) = (LEFT, BOTTOM) if kind != 'fence-b' else (BOTTOM, RIGHT)
            kk = (tx1 - tx0) / (rx - lx)
            fence_k = fence_k or kk
            # o meio dos dois pés no meio do lado (o erro de inclinação fica dividido entre as pontas)
            cell = _place(part, (lx + rx) / 2, (ly + ry) / 2, kk, (tx0 + tx1) / 2, (ty0 + ty1) / 2)
        elif kind == 'post':
            fx, fy = _foot(a, (x0 + x1) // 2)
            cell = _place(part, fx, fy, fence_k or k, *BOTTOM)
        else:
            kk = min(k, (CELL - 4) / (x1 - x0))
            cell = _place(part, (x0 + x1) / 2, y1, kk, CELL / 2, BOT - 6)
        if kind != 'soil-winter':
            cell = _holes(cell)
        cell.putalpha(cell.getchannel('A').point(lambda v: 255 if v > 110 else 0))  # contorno duro (pixel art)
        out.append(cell)
    return out


def pack():
    rows = [cells(n) if (SRC / f'{n}.png').exists() else [] for n, _ in CROPS]
    ground = cells('ground') if (SRC / 'ground.png').exists() else []
    atlas = Image.new('RGBA', (CELL * 8, CELL * 7), (0, 0, 0, 0))
    for r, row in enumerate(rows + [ground]):
        for c, im in enumerate(row):
            atlas.alpha_composite(im, (c * CELL, r * CELL))
    rgb = atlas.quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    out = art_file('fields')
    rgb.save(out, optimize=True)
    print(out.relative_to(ROOT).as_posix(), atlas.size, f'{out.stat().st_size / 1024:.1f} KB')


def main():
    redo = next((a.split(',') for a in sys.argv[sys.argv.index('--refazer') + 1:][:1]), []) if '--refazer' in sys.argv else []
    alias = {'trigo': 'wheat', 'nabo': 'turnip', 'repolho': 'cabbage', 'arroz': 'rice', 'abobora': 'pumpkin', 'ervas': 'herbs',
             'chao': 'ground', 'cerca': 'ground'}
    redo = [alias.get(n, n) for n in redo]
    if '--pack' not in sys.argv:
        todo = [n for n in SHEETS if n in redo or not (SRC / f'{n}.png').exists()]
        if todo:
            generate(todo)
    pack()


main()
