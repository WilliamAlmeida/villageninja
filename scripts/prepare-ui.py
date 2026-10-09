# Prepara os assets de interface gerados pelo Codex (docs/arte/ui/*) para o jogo:
#   icons/  → atlas src/art/ui/icons.png, casas de 64 px (ícones; `rich()`/`ico()` usam no lugar do SVG)
#   seals/ → atlas src/art/ui/cards.png, casas de 128 px (selos de rank; os bustos da Ordem saíram: o Bingo Book usa os sprites)
#   art/    → arquivos soltos em src/art/ui/art, até 256 px no lado maior (cenas, kunai, animais)
# Atlas = uma requisição só (pelo túnel, dezenas de PNGs soltos demoravam a aparecer). Paleta de 256 cores com
# transparência: pixel art não perde nada e o arquivo cai a ~1/4. Escreve src/ui/pxicons.ts com os mapas.
# Editados à mão no editor de sprites (src/art/art-edits.json: "ui/icons.png", "ui/art/<nome>.png"): o atlas é
# remontado guardando as casas que já existiam (só ícone novo é gerado da fonte) e a ilustração editada não é refeita.
# Uso: python scripts/prepare-ui.py [--force] [--refresh=nome1,nome2]
#   --force    refaz tudo da fonte (perde as edições à mão)
#   --refresh  refaz só esses ícones/ilustrações da fonte, mantendo o resto do que foi editado
import glob
import json
import os
import re
import shutil
import sys
from collections import deque

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'docs', 'arte', 'ui')
DST = os.path.join(ROOT, 'src', 'art', 'ui')
ATLASES = {'icons': (['icons'], 64), 'cards': (['seals'], 128)}
ART_MAX = 256
COLS = 10
EDITS = os.path.join(ROOT, 'src', 'art', 'art-edits.json')
EDITED = set() if '--force' in sys.argv or not os.path.exists(EDITS) else set(json.load(open(EDITS, encoding='utf8')))
REFRESH = {n for a in sys.argv if a.startswith('--refresh=') for n in a.split('=', 1)[1].split(',') if n}
PXICONS = os.path.join(ROOT, 'src', 'ui', 'pxicons.ts')


def old_positions(atlas):
    """Casa (coluna, linha) de cada item no atlas atual, lida do pxicons.ts gerado da última vez."""
    if not os.path.exists(PXICONS):
        return {}
    for line in open(PXICONS, encoding='utf8'):
        if line.startswith(f'export const {atlas.upper()}:'):
            return {n: (int(c), int(r)) for n, c, r in re.findall(r"'([^']+)': \[(\d+), (\d+)\]", line)}
    return {}


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


# vãos fechados que ficaram com o branco do fundo (o remove-bg não alcança): miolo do cadeado, centro da engrenagem,
# entre os fios da silhueta do líder e as pernas de aranha. 'maior' = só o maior branco (os outros são brilho);
# 'todos' = qualquer branco (desenho sem branco nenhum).
HOLES = {'lock': 'maior', 'gear': 'maior', 'todo': 'maior'}
WORK = 512  # a limpeza roda nesta resolução (a saída é bem menor)


def components(mask):
    """Regiões conectadas (4 vizinhos) de uma máscara booleana."""
    h, w = mask.shape
    seen = np.zeros_like(mask, bool)
    out = []
    for y0, x0 in zip(*np.nonzero(mask)):
        if seen[y0, x0]:
            continue
        q = deque([(y0, x0)])
        seen[y0, x0] = True
        pts = []
        while q:
            y, x = q.popleft()
            pts.append((y, x))
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    q.append((ny, nx))
        ys, xs = zip(*pts)
        out.append((np.array(ys), np.array(xs)))
    return out


def clear_holes(im, mode):
    """O maior branco puro dentro do desenho vira transparente (só nos ícones de HOLES)."""
    a = np.array(im)
    rgb = a[..., :3].astype(int)
    floor = 200 if mode == 'todos' else 236  # sem branco no desenho dá para pegar também o cinza claro do contorno
    white = (a[..., 3] > 200) & (rgb.min(axis=2) >= floor) & ((rgb.max(axis=2) - rgb.min(axis=2)) < 16)
    # só o maior: o vão; os brilhos (também brancos) ficam
    if mode == 'todos':
        a[white, 3] = 0
        return Image.fromarray(a, 'RGBA')
    comps = [c for c in components(white) if len(c[0]) > white.size * 0.004]
    if comps:
        ys, xs = max(comps, key=lambda c: len(c[0]))
        a[ys, xs, 3] = 0
    return Image.fromarray(a, 'RGBA')


def despeck(im, min_px=14):
    """Pontinhos soltos (ilhas opacas minúsculas no meio do transparente) somem."""
    a = np.array(im)
    for ys, xs in components(a[..., 3] > 40):
        if len(ys) < min_px:
            a[ys, xs, 3] = 0
    return Image.fromarray(a, 'RGBA')


def load(path):
    im = Image.open(path).convert('RGBA')
    box = im.getbbox()
    if not box:
        return None
    im = im.crop(box)
    im.thumbnail((WORK, WORK), Image.BOX)
    mode = HOLES.get(os.path.splitext(os.path.basename(path))[0])
    if mode:
        im = clear_holes(im, mode)
    im = despeck(defringe(im))
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
os.makedirs(os.path.join(DST, 'art'), exist_ok=True)

maps = {}
for atlas, (groups, cell) in ATLASES.items():
    out = os.path.join(DST, f'{atlas}.png')
    # atlas editado à mão: as casas que já existiam vêm do atlas atual (com a edição), não da fonte
    edited = f'ui/{atlas}.png' in EDITED and os.path.exists(out)
    before = Image.open(out).convert('RGBA') if edited else None
    old = old_positions(atlas) if edited else {}
    items = []
    kept = 0
    for g in groups:
        for f in sorted(glob.glob(os.path.join(SRC, g, '*.png'))):
            name = os.path.splitext(os.path.basename(f))[0]
            if name in old and name not in REFRESH:
                c, r = old[name]
                items.append((name, before.crop((c * cell, r * cell, (c + 1) * cell, (r + 1) * cell)), True))
                kept += 1
                continue
            im = load(f)
            if im is None:
                print('vazio:', f)
                continue
            items.append((name, defringe(fit(im, cell, True), 1), False))
    rows = max(1, (len(items) + COLS - 1) // COLS)
    sheet = Image.new('RGBA', (COLS * cell, rows * cell), (0, 0, 0, 0))
    pos = {}
    for i, (name, im, whole) in enumerate(items):
        x, y = (i % COLS) * cell, (i // COLS) * cell
        if whole:
            sheet.paste(im, (x, y))  # a casa inteira, como foi editada
        else:
            sheet.paste(im, (x + (cell - im.width) // 2, y + (cell - im.height) // 2), im)
        pos[name] = (i % COLS, i // COLS)
    save_small(sheet, out)
    maps[atlas] = (pos, rows)
    print(f'{atlas}: {len(items)} em {COLS}x{rows} ({cell}px)' + (f' · {kept} casas mantidas (editado à mão; --force ou --refresh=nome refaz)' if edited else ''))

art = []
for f in sorted(glob.glob(os.path.join(SRC, 'art', '*.png'))):
    name = os.path.splitext(os.path.basename(f))[0]
    out = os.path.join(DST, 'art', f'{name}.png')
    if f'ui/art/{name}.png' in EDITED and name not in REFRESH and os.path.exists(out):
        print(f'ui/art/{name}.png editada à mão: mantida (--force ou --refresh={name} refaz)')
        art.append(name)
        continue
    im = load(f)
    if im is None:
        continue
    save_small(defringe(fit(im, ART_MAX, False), 1), out)
    art.append(name)
# ilustração que saiu da fonte sai do jogo também
for f in glob.glob(os.path.join(DST, 'art', '*.png')):
    if os.path.splitext(os.path.basename(f))[0] not in art:
        os.remove(f)
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
