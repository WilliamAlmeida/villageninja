# Piloto do padrão novo da arte isométrica (docs/design-arte-iso.md, seção 6; plano aprovado em 2026-10-12):
# torre 2×2 (base + topo), casa nos 3 níveis, banco, gato, árvores, tocos, rochas e veios.
#
#   1. pede ao Codex folhas em grade com o GABARITO v2 (losango exato + volume da altura em H + silhueta do ninja,
#      scripts/iso_template.py) como 1ª referência e a casa atual como estilo  → docs/arte/piloto/_<folha>.png
#   2. recorta cada peça pela geometria do gabarito (a largura do losango, mais o que passar dele: beiral, galhos)
#   3. reduz para a grade do boneco: 1 px da imagem = 0,536 px da cena (o pixel do ninja), com no máximo 48 cores
#      (ou a paleta aprovada em docs/design/arte-iso/paleta.json) e contorno duro           → docs/arte/piloto/final/
#   4. torre: separa a BASE (pilares, escada, piso, parapeito do fundo) do TOPO (parapeito da frente, pilastras da frente
#      e telhado) pela geometria do gabarito → final/tower.png e final/tower-top.png (mesmo tamanho)
#   5. grava docs/arte/piloto/meta.json com a escala e o deslocamento de cada peça para o layout.json (o jogo desenha
#      pela largura do losango; o recorte pode ser mais largo que ele)
# Nada vai para src/art aqui: depois de aprovado, `--instalar` copia para src/art (com backup) e ajusta o layout.
#
# Uso: python scripts/pilot-art.py              (gera o que falta e refaz o processamento)
#      python scripts/pilot-art.py --so-processar (não chama o Codex; só refaz 2–5 a partir das folhas já geradas)
import json
import os
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from iso_template import H_SCENE, PROMPT_V2, STD, TOWER, draw_v2  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'docs' / 'arte' / 'piloto'
FINAL = OUT / 'final'
PIX = 30 / 56  # px da cena por px da imagem (o pixel do boneco)
STYLE = 'docs/arte/iso/house-2.png'

HOUSE = ('a cozy ninja village house: cream plaster walls with dark wooden frames, a stone base, a dark wooden sliding '
         'door with paper panels, small square windows, a dark blue ceramic tiled roof with curved Japanese eaves')
SHEETS = {
    'casas': {
        'cols': 4, 'rows': 1, 'fill': 0.8,
        'items': [
            ('tower', (2, 2, sum(TOWER.values())),
             f'a square wooden ninja WATCHTOWER: four thick wooden pillars with diagonal braces and a ladder up the front-left '
             f'side, a wooden PLATFORM at {TOWER["plataforma"]} ninja heights with a waist-high wooden railing all around, then '
             f'four tall pillars holding a dark blue tiled pagoda roof {TOWER["pe_direito"]} ninja heights above the platform; '
             f'the platform is OPEN between the railing and the roof (room for a person standing there), no person drawn'),
            ('house', (2, 2, STD['andar'] + STD['telhado']), f'LEVEL 1: a small one-story {HOUSE}'),
            ('house-2', (2, 2, STD['andar'] + STD['telhado']), f'LEVEL 2: the SAME house upgraded, still one story but wider, with a covered wooden porch and a flower box'),
            ('house-3', (2, 2, 2 * STD['andar'] + STD['telhado']), f'LEVEL 3: the SAME house upgraded to TWO floors, a wooden balcony on the second floor, bigger roof with ridge ornaments'),
        ],
    },
    'pequenos': {
        'cols': 4, 'rows': 2, 'fill': 0.45,
        'items': [
            ('bench', (1, 1, 0.5), 'a simple wooden park bench, no ground under it'),
            ('statue', (1, 1, 0.9), 'a small stone statue of a lucky beckoning cat with one paw raised on a square stone pedestal, no ground under it'),
            ('tree0', (1, 1, 2.8), 'a leafy deciduous tree with a round fluffy green canopy and a brown trunk'),
            ('tree1', (1, 1, 3.0), 'a tall dark green pine tree'),
            ('stump0', (1, 1, 0.4), 'the cut stump of the leafy tree (THE SAME trunk, cut low), a few roots'),
            ('stump1', (1, 1, 0.4), 'the cut stump of the pine tree, a few roots'),
            ('rock', (1, 1, 0.8), 'a big grey boulder'),
            ('rock-cracked', (1, 1, 0.8), 'THE SAME grey boulder, cracked in half with deep cracks'),
        ],
    },
    'pedras': {
        'cols': 4, 'rows': 1, 'fill': 0.45,
        'items': [
            ('rock-pebbles', (1, 1, 0.25), 'a few small grey pebbles and rock fragments left on the ground after a boulder broke'),
            ('ore', (1, 1, 0.9), 'a grey boulder with rusty iron ore veins and a few glowing blue crystals'),
            ('ore-empty', (1, 1, 0.8), 'THE SAME boulder with the iron veins mined out and no crystals'),
        ],
    },
}


def generate(sheet, cfg):
    path = OUT / f'_{sheet}.png'
    tpl = OUT / f'_{sheet}-gabarito.png'
    ds = draw_v2(tpl, [it[1] for it in cfg['items']], cfg['cols'], cfg['rows'], fill=cfg['fill'])
    if path.exists():
        return path, ds
    cells = ' '.join(
        f'Row {i // cfg["cols"] + 1}, column {i % cfg["cols"] + 1} (ground {it[1][0]}x{it[1][1]} tiles, total height {it[1][2]:.1f} ninjas): {it[2]}.'
        for i, it in enumerate(cfg['items'])
    )
    desc = (
        f'A SHEET of {len(cfg["items"])} separate isometric game assets for a cozy ninja village builder, in a strict grid of '
        f'{cfg["cols"]} columns and {cfg["rows"]} rows, ONE asset per cell, exactly where the template puts it'
        + (' (cells after the last item stay empty)' if len(cfg['items']) < cfg['cols'] * cfg['rows'] else '') + '. '
        'Detailed 16-bit pixel art with SMALL pixels and a clean dark outline, light from the top-left, same palette and '
        'finish as image 2 (the art style reference). Pure white background, no shadow outside the objects, no text, no '
        'grid lines. ' + PROMPT_V2 + cells
    )
    refs = ','.join([os.path.relpath(tpl, ROOT), STYLE])
    # --vaos: os vãos entre vigas, galhos e pernas do banco saem transparentes (não brancos)
    subprocess.run(['node', 'scripts/codex-image.mjs', str(path), desc, '--ref', refs, '--size', '1536x1024', '--vaos'], cwd=ROOT, check=True)
    return path, ds


def crop_box(cell_alpha, g, cell_x, cell_y):
    """Recorte na folha: na horizontal o losango mais o que passar dele; em cima o desenho; embaixo a ponta do losango."""
    ys, xs = np.nonzero(cell_alpha)
    ax0, ax1 = xs.min() + cell_x, xs.max() + 1 + cell_x
    ay0, ay1 = ys.min() + cell_y, ys.max() + 1 + cell_y
    x0, x1 = min(round(g['x0']), ax0), max(round(g['x1']), ax1)
    return x0, ay0, x1, max(round(g['by']), ay1)


def palette():
    p = ROOT / 'docs' / 'design' / 'arte-iso' / 'paleta.json'
    if not p.exists():
        return None
    cols = json.loads(p.read_text(encoding='utf8'))['colors']
    pal = Image.new('P', (1, 1))
    flat = [c for hexc in cols for c in (int(hexc[1:3], 16), int(hexc[3:5], 16), int(hexc[5:7], 16))]
    pal.putpalette(flat + flat[:3] * (256 - len(cols)))
    return pal


def to_grid(im, scene_w):
    """Reduz para a grade do boneco (largura = largura na cena / 0,536), cores limitadas e contorno duro."""
    w = max(1, round(scene_w / PIX))
    h = max(1, round(im.height * w / im.width))
    small = im.resize((w, h), Image.BOX)
    a = np.array(small)
    alpha = a[:, :, 3] > 110
    rgb = Image.fromarray(a[:, :, :3], 'RGB')
    pal = palette()
    q = rgb.quantize(palette=pal, dither=Image.Dither.NONE) if pal else rgb.quantize(48, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    out = np.array(q.convert('RGBA'))
    out[:, :, 3] = np.where(alpha, 255, 0)
    return Image.fromarray(out, 'RGBA')


def tower_split(full, g, box, k):
    """Máscara do TOPO da torre na imagem final (True = topo): telhado e beiral, as pilastras dos 3 cantos da frente e o
    parapeito da frente, pela geometria do gabarito (plataforma a TOWER['plataforma']·H, beiral +pe_direito·H)."""
    W, Hh = full.size
    sk = g['scene_k']
    unit = g['unit']
    hp = lambda hh: hh * H_SCENE / sk  # noqa: E731  altura em H → px da folha
    # cantos do losango na folha
    cx, by, w, h = g['cx'], g['by'], g['w'], g['h']
    P = lambda gx, gy: (cx + ((gx - gy) - (w - h)) * unit, by - ((w - gx) + (h - gy)) * unit / 2)  # noqa: E731
    front, right, left = P(w, h), P(w, 0), P(0, h)
    to_img = lambda x, y: ((x - box[0]) * k, (y - box[1]) * k)  # noqa: E731  folha → imagem final
    floor = hp(TOWER['plataforma'])
    eave = floor + hp(TOWER['pe_direito'])
    yy, xx = np.mgrid[0:Hh, 0:W]
    top = np.zeros((Hh, W), bool)
    # telhado: acima da linha do beiral (que segue o losango: mais baixa na frente), com uma folga para o beiral que desce
    for a, b in ((left, front), (front, right)):
        (x0, y0), (x1, y1) = to_img(a[0], a[1] - eave + hp(0.25)), to_img(b[0], b[1] - eave + hp(0.25))
        seg = (xx >= min(x0, x1)) & (xx <= max(x0, x1))
        yline = y0 + (xx - x0) * (y1 - y0) / (x1 - x0 or 1)
        top |= seg & (yy <= yline)
    top |= yy <= to_img(0, min(left[1], right[1]) - eave)[1]
    # pilastras dos 3 cantos da frente, do piso ao beiral
    pw = unit * 0.32 * k
    for c in (left, front, right):
        x, y_floor = to_img(c[0], c[1] - floor)
        _, y_eave = to_img(c[0], c[1] - eave)
        top |= (np.abs(xx - x) <= pw / 2) & (yy >= y_eave) & (yy <= y_floor + 2)
    # parapeito da frente: faixa de 0 a 0,5H acima do piso, nas duas faces da frente
    for a, b in ((left, front), (front, right)):
        (x0, y0), (x1, y1) = to_img(a[0], a[1] - floor), to_img(b[0], b[1] - floor)
        seg = (xx >= min(x0, x1)) & (xx <= max(x0, x1))
        yline = y0 + (xx - x0) * (y1 - y0) / (x1 - x0 or 1)
        top |= seg & (yy <= yline + 3) & (yy >= yline - hp(0.55) * k)
    return top


def main_object(mask):
    """Caixa (x0, y0, x1, y1) do objeto principal da casa: o maior pedaço opaco e o que estiver colado nele (até 6 px),
    sem fiapos de fundo nem pedaços de vizinhos. Componentes conexos numa grade reduzida (4 px)."""
    from collections import deque
    S = 4
    h, w = mask.shape
    g = mask[: h - h % S, : w - w % S].reshape(h // S, S, w // S, S).any(axis=(1, 3))
    lab = np.zeros(g.shape, int)
    sizes = [0]
    for sy, sx in zip(*np.nonzero(g)):
        if lab[sy, sx]:
            continue
        n = len(sizes)
        lab[sy, sx] = n
        q = deque([(sy, sx)])
        c = 0
        while q:
            y, x = q.popleft()
            c += 1
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
                yy, xx = y + dy, x + dx
                if 0 <= yy < g.shape[0] and 0 <= xx < g.shape[1] and g[yy, xx] and not lab[yy, xx]:
                    lab[yy, xx] = n
                    q.append((yy, xx))
        sizes.append(c)
    big = int(np.argmax(sizes))
    keep = lab == big
    ys, xs = np.nonzero(keep)
    bx0, by0, bx1, by1 = xs.min(), ys.min(), xs.max(), ys.max()
    for n in range(1, len(sizes)):  # pedaços pequenos colados (folhas soltas, pedrinhas)
        if n == big:
            continue
        ys2, xs2 = np.nonzero(lab == n)
        if xs2.min() <= bx1 + 2 and xs2.max() >= bx0 - 2 and ys2.min() <= by1 + 2 and ys2.max() >= by0 - 2:
            keep |= lab == n
    ys, xs = np.nonzero(keep)
    return xs.min() * S, ys.min() * S, (xs.max() + 1) * S, (ys.max() + 1) * S


def process(sheet, cfg, path, ds, meta):
    """Recorta o objeto principal de cada casa e fixa o tamanho pela regra do padrão:
    - prédio (terreno maior que 1×1): a BASE (a largura das últimas linhas do desenho) ocupa a largura do losango; a
      altura sai do desenho e é relatada em H;
    - 1×1 (decoração, árvore, rocha): a altura total vira a altura-alvo da tabela (H = 30 px)."""
    im = Image.open(path).convert('RGBA')
    if im.size != (1536, 1024):
        im = im.resize((1536, 1024), Image.LANCZOS)
    cw, ch = 1536 / cfg['cols'], 1024 / cfg['rows']
    a = np.array(im)[:, :, 3] > 40
    FINAL.mkdir(parents=True, exist_ok=True)
    for i, (name, (w, h, hh), _) in enumerate(cfg['items']):
        x, y = round((i % cfg['cols']) * cw), round((i // cfg['cols']) * ch)
        cell = a[y:round(y + ch), x:round(x + cw)]
        if not cell.any():
            print('vazio', name)
            continue
        ox0, oy0, ox1, oy1 = main_object(cell)
        crop = im.crop((x + ox0, y + oy0, x + ox1, y + oy1))
        crop.save(OUT / f'{name}.png')
        m = np.array(crop)[:, :, 3] > 40
        diam_w = (w + h) * 24
        if w * h == 1:
            target_h = hh * H_SCENE
            scene_w = crop.width * target_h / crop.height
            base_dx = 0.0
        else:
            # a base: a linha mais larga do terço de baixo (os cantos esquerdo e direito das paredes; embaixo de tudo só
            # aparece a ponta da frente, e em cima o beiral passa da base)
            lo = int(m.shape[0] * 0.67)
            best, span = None, 0
            for r in range(lo, m.shape[0]):
                c = np.nonzero(m[r])[0]
                if len(c) and c.max() - c.min() + 1 > span:
                    span, best = c.max() - c.min() + 1, (c.min(), c.max())
            scene_w = crop.width * diam_w / span
            base_dx = ((best[0] + best[1] + 1) / 2 - crop.width / 2) * scene_w / crop.width
        full = to_grid(crop, scene_w)
        h_scene = full.height * PIX
        meta[name] = {
            'tiles': [w, h], 'target_H': hh, 'height_H': round(h_scene / H_SCENE, 2), 'img': list(full.size),
            'scene_h': round(h_scene, 1),
            # layout.json (prédios e decorações): largura do losango × scale; o meio da BASE na ponta da frente; a base da
            # imagem na ponta (o +4 do jogo é cancelado); 1×1 apoiado no meio do losango (12 px acima da ponta)
            'scale': round(float(full.width * PIX / diam_w), 4),
            'dx': round(float(-base_dx), 2),
            'dy': -4.0 if w * h > 1 else -4.0 - 10.0,
        }
        if name == 'tower':
            full.save(OUT / 'tower-inteira.png')  # dividida em base e topo à parte (tower_split_manual)
        full.save(FINAL / f'{name}.png')
        print('ok', name, full.size, meta[name])


# Torre: o que vai no TOPO (por cima do vigia), em frações da imagem final (medido na torre gerada; ajustável aqui ou
# movendo pixels entre tower.png e tower-top.png no editor de sprites)
TOWER_TOP = [
    [(0, 0), (1, 0), (1, 0.25), (0.5, 0.34), (0, 0.25)],  # telhado até o beiral
    [(0.11, 0.24), (0.21, 0.24), (0.21, 0.42), (0.11, 0.42)],  # pilastra da esquerda
    [(0.79, 0.24), (0.89, 0.24), (0.89, 0.42), (0.79, 0.42)],  # pilastra da direita
    [(0.46, 0.33), (0.56, 0.33), (0.56, 0.5), (0.46, 0.5)],  # pilastra da frente
    [(0.02, 0.39), (0.5, 0.47), (0.98, 0.39), (0.98, 0.56), (0.5, 0.66), (0.02, 0.56)],  # parapeito da frente
]
# pés do vigia (frações da imagem): no piso, atrás do parapeito da frente; e dois pontos ao fundo para ele andar
TOWER_GUARD = [(0.34, 0.5), (0.66, 0.5), (0.4, 0.45)]  # nos lados da pilastra da frente (no meio, ela o tapa)


def tower_split_manual(meta):
    from PIL import ImageDraw
    full = Image.open(FINAL / 'tower.png').convert('RGBA') if not (OUT / 'tower-inteira.png').exists() else Image.open(OUT / 'tower-inteira.png').convert('RGBA')
    W, Hh = full.size
    mask = Image.new('L', full.size, 0)
    d = ImageDraw.Draw(mask)
    for poly in TOWER_TOP:
        d.polygon([(x * W, y * Hh) for x, y in poly], fill=255)
    m = np.array(mask) > 0
    arr = np.array(full)
    top, base = arr.copy(), arr.copy()
    top[~m, 3] = 0
    base[m, 3] = 0
    Image.fromarray(base, 'RGBA').save(FINAL / 'tower.png')
    Image.fromarray(top, 'RGBA').save(FINAL / 'tower-top.png')
    sw, sh = W * PIX, Hh * PIX
    # marcas do Editor de cenário: px da cena a partir do meio da base da imagem (a base é o meio da imagem + dx)
    marks = [[round((x - 0.5) * sw, 1), round(-(1 - y) * sh, 1)] for x, y in TOWER_GUARD]
    meta['tower']['marks'] = {'guard': marks[0], 'guard2': marks[1], 'guard3': marks[2]}
    print('torre dividida: base + topo; vigia', marks)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    only_process = '--so-processar' in sys.argv
    meta = {}
    for sheet, cfg in SHEETS.items():
        if only_process:
            path = OUT / f'_{sheet}.png'
            ds = draw_v2(OUT / f'_{sheet}-gabarito.png', [it[1] for it in cfg['items']], cfg['cols'], cfg['rows'], fill=cfg['fill'])
            if not path.exists():
                continue
        else:
            path, ds = generate(sheet, cfg)
        process(sheet, cfg, path, ds, meta)
    if 'tower' in meta:
        tower_split_manual(meta)
    (OUT / 'meta.json').write_text(json.dumps(meta, indent=1, ensure_ascii=False) + '\n', encoding='utf8')
    print('meta em', (OUT / 'meta.json').relative_to(ROOT).as_posix())


main()
