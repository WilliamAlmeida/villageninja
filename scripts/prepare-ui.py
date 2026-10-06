# Prepara os assets de interface gerados pelo Codex (docs/arte/ui/*) para o jogo:
#   icons/  → atlas src/art/ui/icons.png, casas de 64 px (ícones; `rich()`/`ico()` usam no lugar do SVG)
#   seals/ + busts/ → atlas src/art/ui/cards.png, casas de 128 px (selos de rank, retratos de busto)
#   art/    → arquivos soltos em src/art/ui/art, até 256 px no lado maior (cenas, kunai, animais)
# Atlas = uma requisição só (pelo túnel, dezenas de PNGs soltos demoravam a aparecer). Paleta de 256 cores com
# transparência: pixel art não perde nada e o arquivo cai a ~1/4. Escreve src/ui/pxicons.ts com os mapas.
# Uso: python scripts/prepare-ui.py
import glob
import os
import shutil

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'docs', 'arte', 'ui')
DST = os.path.join(ROOT, 'src', 'art', 'ui')
ATLASES = {'icons': (['icons'], 64), 'cards': (['seals', 'busts'], 128)}
ART_MAX = 256
COLS = 10


def defringe(im, passes=3):
    """Apaga o halo claro que a remoção do fundo branco deixa no contorno: pixel claro e sem cor encostado no
    transparente vira transparente (algumas passadas, de fora para dentro)."""
    a = np.array(im)
    for _ in range(passes):
        alpha = a[..., 3]
        rgb = a[..., :3].astype(int)
        light = (rgb.min(axis=2) > 185) & ((rgb.max(axis=2) - rgb.min(axis=2)) < 40)
        clear = alpha < 40
        edge = np.zeros_like(clear)
        edge[1:, :] |= clear[:-1, :]
        edge[:-1, :] |= clear[1:, :]
        edge[:, 1:] |= clear[:, :-1]
        edge[:, :-1] |= clear[:, 1:]
        kill = light & edge & ~clear
        if not kill.any():
            break
        a[kill, 3] = 0
    # semitransparentes claros no contorno (antisserrilhado contra o branco) também saem
    rgb = a[..., :3].astype(int)
    a[(a[..., 3] < 200) & (rgb.min(axis=2) > 170), 3] = 0
    return Image.fromarray(a, 'RGBA')


def load(path):
    im = defringe(Image.open(path).convert('RGBA'))
    box = im.getbbox()
    return im.crop(box) if box else None


def fit(im, size, square):
    w, h = im.size
    if square:
        side = max(w, h)
        sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
        sq.paste(im, ((side - w) // 2, (side - h) // 2))
        im, w, h = sq, side, side
    k = size / max(w, h)
    return im.resize((max(1, round(w * k)), max(1, round(h * k))), Image.BOX)


def save_small(im, path):
    im.quantize(256, method=Image.FASTOCTREE).save(path, optimize=True)


# limpa a saída antiga (arquivos soltos de versões anteriores)
for old in ('icons', 'seals'):
    shutil.rmtree(os.path.join(DST, old), ignore_errors=True)
shutil.rmtree(os.path.join(DST, 'art'), ignore_errors=True)
os.makedirs(os.path.join(DST, 'art'), exist_ok=True)

maps = {}
for atlas, (groups, cell) in ATLASES.items():
    items = []
    for g in groups:
        for f in sorted(glob.glob(os.path.join(SRC, g, '*.png'))):
            im = load(f)
            if im is None:
                print('vazio:', f)
                continue
            items.append((os.path.splitext(os.path.basename(f))[0], fit(im, cell, True)))
    rows = max(1, (len(items) + COLS - 1) // COLS)
    sheet = Image.new('RGBA', (COLS * cell, rows * cell), (0, 0, 0, 0))
    pos = {}
    for i, (name, im) in enumerate(items):
        x, y = (i % COLS) * cell, (i // COLS) * cell
        sheet.paste(im, (x + (cell - im.width) // 2, y + (cell - im.height) // 2), im)
        pos[name] = (i % COLS, i // COLS)
    save_small(sheet, os.path.join(DST, f'{atlas}.png'))
    maps[atlas] = (pos, rows)
    print(f'{atlas}: {len(items)} em {COLS}x{rows} ({cell}px)')

art = []
for f in sorted(glob.glob(os.path.join(SRC, 'art', '*.png'))):
    im = load(f)
    if im is None:
        continue
    name = os.path.splitext(os.path.basename(f))[0]
    save_small(fit(im, ART_MAX, False), os.path.join(DST, 'art', f'{name}.png'))
    art.append(name)
print('art:', len(art))

lines = ['// Gerado por scripts/prepare-ui.py: assets de interface em pixel art (atlas de ícones e de cartões, ilustrações).', '']
for atlas in maps:
    lines.append(f"import {atlas}Atlas from '../art/ui/{atlas}.png';")
for n in art:
    lines.append(f"import ar_{n.replace('-', '_')} from '../art/ui/art/{n}.png';")
lines.append('')
lines.append('/** Um atlas: imagem, colunas × linhas e a casa (coluna, linha) de cada item. */')
lines.append('export interface Atlas { url: string; cols: number; rows: number; pos: Record<string, [number, number]> }')
for atlas, (pos, rows) in maps.items():
    body = ', '.join(f"'{n}': [{c}, {r}]" for n, (c, r) in pos.items())
    lines.append(f'export const {atlas.upper()}: Atlas = {{ url: {atlas}Atlas, cols: {COLS}, rows: {rows}, pos: {{ {body} }} }};')
body = ', '.join(f"'{n}': ar_{n.replace('-', '_')}" for n in art)
lines.append(f'export const ART: Record<string, string> = {{ {body} }};')
with open(os.path.join(ROOT, 'src', 'ui', 'pxicons.ts'), 'w', encoding='utf8', newline='\n') as fh:
    fh.write('\n'.join(lines) + '\n')
print('ok src/ui/pxicons.ts')
