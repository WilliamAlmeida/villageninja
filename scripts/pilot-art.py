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
from iso_art import base_span, drop_specks, main_object, to_grid  # noqa: E402,F401

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'docs' / 'arte' / 'piloto'
FINAL = OUT / 'final'
from iso_art import PIX  # noqa: E402
STYLE = 'docs/arte/iso/house-2.png'

HOUSE = ('a cozy ninja village house: cream plaster walls with dark wooden frames, a stone base, a dark wooden sliding '
         'door with paper panels, small square windows, a dark blue ceramic tiled roof with curved Japanese eaves')
SHEETS = {
    # a torre saiu da 1ª folha (_torre.png); a base e o topo saem dela por edição (tower_layers)
    'torre': {
        'cols': 4, 'rows': 1, 'fill': 0.8,
        'items': [
            ('tower', (2, 2, sum(TOWER.values())),
             f'a square wooden ninja WATCHTOWER: four thick wooden pillars with diagonal braces and a ladder up the front-left '
             f'side, a wooden PLATFORM at {TOWER["plataforma"]} ninja heights with a waist-high wooden railing all around, then '
             f'four tall pillars holding a dark blue tiled pagoda roof {TOWER["pe_direito"]} ninja heights above the platform; '
             f'the platform is OPEN between the railing and the roof (room for a person standing there), no person drawn'),
        ],
    },
    # casas: cada nível bem diferente do anterior; o nível 3 ocupa 3×3 (cresce para os lados, não só para cima)
    'casas': {
        'cols': 3, 'rows': 1, 'fill': 0.85,
        'items': [
            ('house', (2, 2, STD['andar'] + STD['telhado']), f'LEVEL 1: a small simple one-story {HOUSE}'),
            ('house-2', (2, 2, STD['andar'] + STD['telhado']),
             'LEVEL 2: the same family house grown: one story but L-shaped with an attached side room, a covered wooden porch '
             'with posts in front of the door, two stone lanterns, more windows, a flower box'),
            ('house-3', (3, 3, 2 * STD['andar'] + STD['telhado']),
             'LEVEL 3 on a BIGGER plot: a grand two-story family house (balcony on the second floor) with a one-story side wing '
             'and a small walled garden with a bonsai and stepping stones; clearly wider and richer than level 2, same style'),
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


# tamanho por peça quando a altura-alvo não é a regra (pedido do autor, 2026-10-12): o banco com a largura do de hoje
# (é um banco de praça, não uma cadeira), o gato com a altura do de hoje; os tocos novos não entram (os de hoje casam
# melhor com as árvores novas)
SIZE = {'bench': ('w', 40.8), 'statue': ('h', 43.6)}
SKIP = {'stump0', 'stump1'}


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


_SHEET_SCALE: dict = {}


def sheet_scale(cfg, ds, im, a, cw, ch):
    """px da cena por px da folha para os prédios (terreno maior que 1×1) desta folha: mediana de largura do losango (cena)
    / base medida (folha)."""
    key = id(cfg)
    if key in _SHEET_SCALE:
        return _SHEET_SCALE[key]
    ratios = []
    for i, (name, (w, h, _), _) in enumerate(cfg['items']):
        if w * h == 1 or name in SKIP:
            continue
        x, y = round((i % cfg['cols']) * cw), round((i // cfg['cols']) * ch)
        wx0, wy0 = max(0, x - round(cw * 0.3)), max(0, y - round(ch * 0.15))
        wx1, wy1 = min(1536, round(x + cw * 1.3)), min(1024, round(y + ch * 1.15))
        ox0, oy0, ox1, oy1 = main_object(a[wy0:wy1, wx0:wx1], (x - wx0, y - wy0, round(x + cw) - wx0, round(y + ch) - wy0))
        span, _ = base_span(a[wy0 + oy0:wy0 + oy1, wx0 + ox0:wx0 + ox1])
        ratios.append((w + h) * 24 / span)
    _SHEET_SCALE[key] = float(np.median(ratios)) if ratios else 1.0
    print('escala da folha (prédios):', round(_SHEET_SCALE[key], 4), 'px da cena por px')
    return _SHEET_SCALE[key]


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
        if name in SKIP:
            continue
        x, y = round((i % cfg['cols']) * cw), round((i // cfg['cols']) * ch)
        if not a[y:round(y + ch), x:round(x + cw)].any():
            print('vazio', name)
            continue
        # janela com folga além da casa (o que passa da borda dela não é cortado)
        wx0, wy0 = max(0, x - round(cw * 0.3)), max(0, y - round(ch * 0.15))
        wx1, wy1 = min(1536, round(x + cw * 1.3)), min(1024, round(y + ch * 1.15))
        ox0, oy0, ox1, oy1 = main_object(a[wy0:wy1, wx0:wx1], (x - wx0, y - wy0, round(x + cw) - wx0, round(y + ch) - wy0))
        crop = im.crop((wx0 + ox0, wy0 + oy0, wx0 + ox1, wy0 + oy1))
        crop.save(OUT / f'{name}.png')
        m = np.array(crop)[:, :, 3] > 40
        diam_w = (w + h) * 24
        if name in SIZE:
            kind, v = SIZE[name]
            scene_w = v if kind == 'w' else crop.width * v / crop.height
            base_dx = 0.0
        elif w * h == 1:
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
            # px da cena por px da folha: a MESMA para todos os prédios da folha (o Codex desenha todos na mesma escala; medir
            # cada um separadamente fazia a casa 1 sair maior que a 2): a mediana de "largura do losango / base medida"
            per = sheet_scale(cfg, ds, im, a, cw, ch)
            scene_w = crop.width * per
            base_dx = ((best[0] + best[1] + 1) / 2 - crop.width / 2) * per
        full = to_grid(crop, scene_w)
        if w * h > 1:
            full = drop_specks(full)
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


TOWER_EDITS = {
    'base': ('Edit image 1: redraw EXACTLY the same watchtower, same size, same position on the canvas, same pixel art, '
             'but REMOVE the roof, REMOVE the railing on the two FRONT sides of the platform (the sides nearest the viewer) '
             'and REMOVE the three front pillars ABOVE the platform floor. KEEP the stone base, the lower pillars with their '
             'braces, the ladder, the WHOLE wooden platform floor (now fully visible, with its front edge), the railing on '
             'the two BACK sides and the back pillar. Pure white background, nothing else.'),
    'top': ('Edit image 1: keep ONLY these parts of the SAME watchtower, at exactly the same size and position on the '
            'canvas: the roof, the three front pillars from the platform floor up to the roof, and the railing on the two '
            'FRONT sides of the platform (nearest the viewer). ERASE to pure white everything else: the stone base, the '
            'lower pillars and braces, the ladder, the platform floor, the back railing and the back pillar.'),
}


def align(ref, im, search=60):
    """Escala e deslocamento que levam `im` a coincidir com `ref` (RGBA do mesmo tamanho): o que mais acerta a cor onde
    as duas são opacas. Busca grossa em 1/8 do tamanho (escala 0,8–1,2 em passos de 2,5%) e fina no tamanho cheio.
    Devolve (k, dx, dy): `im` reduzida/ampliada por k em volta do canto e deslocada por (dx, dy)."""
    def arr(img, f):
        a = np.array(img.resize((max(1, round(img.width * f)), max(1, round(img.height * f))), Image.NEAREST)).astype(int)
        return a

    def score(R, I, dx, dy):
        h, w = R.shape[:2]
        ih, iw = I.shape[:2]
        ox0, oy0 = max(0, dx), max(0, dy)
        ox1, oy1 = min(w, dx + iw), min(h, dy + ih)
        if ox1 - ox0 < 10 or oy1 - oy0 < 10:
            return -1e9
        r = R[oy0:oy1, ox0:ox1]
        i = I[oy0 - dy:oy1 - dy, ox0 - dx:ox1 - dx]
        both = (r[:, :, 3] > 40) & (i[:, :, 3] > 40)
        n = both.sum()
        if n < 50:
            return -1e9
        diff = np.abs(r[:, :, :3] - i[:, :, :3]).sum(axis=2)[both].mean()
        return n / (1 + diff)

    q = 0.125
    Rq = arr(ref, q)
    best = (-1e9, 1.0, 0, 0)
    for k in np.arange(0.8, 1.2001, 0.025):
        Iq = arr(im, q * k)
        sr = round(search * q)
        for dx in range(-sr - round(im.width * q * (k - 1) / 2), sr + 1, 1):
            for dy in range(-sr - round(im.height * q * (k - 1)), sr + 1, 1):
                sc = score(Rq, Iq, dx, dy)
                if sc > best[0]:
                    best = (sc, float(k), dx, dy)
    _, k, dx, dy = best
    R = np.array(ref).astype(int)
    I = arr(im, k)
    fine = max(((dx * 8 + ddx, dy * 8 + ddy) for ddx in range(-8, 9, 2) for ddy in range(-8, 9, 2)), key=lambda d: score(R, I, *d))
    fine = max(((fine[0] + ddx, fine[1] + ddy) for ddx in (-1, 0, 1) for ddy in (-1, 0, 1)), key=lambda d: score(R, I, *d))
    return k, fine[0], fine[1]


def tower_layers(meta):
    """Base e topo da torre como DUAS imagens geradas (não um recorte da inteira: entre as tábuas do parapeito aparecia o
    piso, que ia junto para o topo e cobria as pernas do vigia). Parte da torre inteira já gerada (docs/arte/piloto/
    tower.png, no tamanho da folha), pede as duas edições ao Codex no mesmo quadro, alinha cada uma à inteira e reduz
    as duas exatamente como a inteira (mesmo tamanho final)."""
    full = Image.open(OUT / 'tower.png').convert('RGBA')
    S = 1024
    canvas = Image.new('RGBA', (S, S), (255, 255, 255, 255))
    off = ((S - full.width) // 2, S - full.height - 40)
    canvas.alpha_composite(full, off)
    ref = OUT / '_tower-ref.png'
    canvas.convert('RGB').save(ref)
    ref_rgba = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ref_rgba.alpha_composite(full, off)
    layers = {}
    for part, prompt in TOWER_EDITS.items():
        raw = OUT / f'_tower-{part}.png'
        if not raw.exists():
            subprocess.run(['node', 'scripts/codex-image.mjs', str(raw), prompt, '--ref', os.path.relpath(ref, ROOT), '--size', f'{S}x{S}', '--vaos'], cwd=ROOT, check=True)
        im = Image.open(raw).convert('RGBA')
        if im.size != (S, S):
            im = im.resize((S, S), Image.LANCZOS)
        k, dx, dy = align(ref_rgba, im)
        im = im.resize((round(S * k), round(S * k)), Image.NEAREST)
        moved = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        moved.paste(im, (dx, dy), im)
        layers[part] = moved.crop((off[0], off[1], off[0] + full.width, off[1] + full.height))
        print(f'torre {part}: escala {k:.3f}, deslocamento {dx},{dy}')
    scene_w = meta['tower']['img'][0] * PIX
    for part, name in (('base', 'tower'), ('top', 'tower-top')):
        out = np.array(to_grid(layers[part], scene_w))
        # resto do fundo branco do Codex (fiapos entre as pilastras): quase branco e sem cor vira transparente
        rgb = out[:, :, :3].astype(int)
        whiteish = (rgb.min(axis=2) > 215) & (rgb.max(axis=2) - rgb.min(axis=2) < 28)
        out[whiteish, 3] = 0
        Image.fromarray(out, 'RGBA').save(FINAL / f'{name}.png')
    sw, sh = meta['tower']['img'][0] * PIX, meta['tower']['img'][1] * PIX
    marks = [[round((x - 0.5) * sw, 1), round(-(1 - y) * sh, 1)] for x, y in TOWER_GUARD]
    meta['tower']['marks'] = {'guard': marks[0], 'guard2': marks[1], 'guard3': marks[2]}


def install():
    """Copia o piloto para src/art (backup das antigas e do trecho do layout em docs/arte/_backup/<data>/piloto/), ajusta
    o layout.json (escala/posição pela meta; vigia da torre) e tira as trocadas da lista de editadas à mão. As alturas
    dos objetos (árvore, rocha) e o registro do topo da torre ficam no código (render/sprites.ts, render/art.ts)."""
    import datetime
    import shutil
    sys.path.insert(0, str(Path(__file__).parent))
    from artpaths import art_file, ART, EDITS
    meta = json.loads((OUT / 'meta.json').read_text(encoding='utf8'))
    names = [n for n in meta if n not in SKIP] + ['tower-top']
    bk = ROOT / 'docs' / 'arte' / '_backup' / datetime.date.today().isoformat() / 'piloto'
    bk.mkdir(parents=True, exist_ok=True)
    layout_p = ROOT / 'src' / 'data' / 'layout.json'
    L = json.loads(layout_p.read_text(encoding='utf8'))
    old_layout = {n: L['arts'].get(n) for n in names}
    (bk / 'layout-antigo.json').write_text(json.dumps(old_layout, indent=1, ensure_ascii=False) + '\n', encoding='utf8')
    art_src = (ROOT / 'src' / 'render' / 'art.ts').read_text(encoding='utf8')
    edits = json.loads(EDITS.read_text(encoding='utf8'))
    for n in names:
        dst = art_file(n)
        if dst.exists():
            shutil.copy2(dst, bk / f'{n}.png')
        shutil.copy2(FINAL / f'{n}.png', dst)
        rel = dst.relative_to(ART).as_posix()
        if rel in edits:
            edits.remove(rel)
        m = meta.get(n)
        if not m:
            continue
        a = {}
        if m['tiles'] != [1, 1] or n in ('bench', 'statue'):
            # prédio/decoração: largura do losango × ART_SCALE × scale → a escala da meta já é a final
            import re
            mm = re.search(rf"'{re.escape(n)}':\s*([\d.]+)|\b{re.escape(n)}:\s*([\d.]+)", art_src[art_src.index('export const ART_SCALE'):art_src.index('export const artUrl')])
            art_scale = float(next(g for g in mm.groups() if g)) if mm else 1.0
            a = {'scale': round(m['scale'] / art_scale, 4), 'dx': m['dx'], 'dy': m['dy']}
        if 'marks' in m:
            a['marks'] = m['marks']
        if a:
            L['arts'][n] = a
        else:
            L['arts'].pop(n, None)
    layout_p.write_text(json.dumps(L, indent=1, ensure_ascii=False) + '\n', encoding='utf8')
    EDITS.write_text(json.dumps(sorted(edits), indent=2, ensure_ascii=False) + '\n', encoding='utf8')
    (bk / 'LEIAME.md').write_text(
        '# Artes trocadas pelo piloto do padrão novo (docs/design-arte-iso.md)\n\n'
        'Como estavam em src/art antes da instalação (inclusive as editadas à mão: banco, casa nível 3, torre) e o trecho do '
        'layout.json delas (layout-antigo.json). Pode apagar quando quiser.\n', encoding='utf8')
    print('instalado:', ', '.join(names), '| backup em', bk.relative_to(ROOT).as_posix())


def main():
    if '--instalar' in sys.argv:
        install()
        return
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
        tower_layers(meta)
    (OUT / 'meta.json').write_text(json.dumps(meta, indent=1, ensure_ascii=False) + '\n', encoding='utf8')
    print('meta em', (OUT / 'meta.json').relative_to(ROOT).as_posix())


main()
