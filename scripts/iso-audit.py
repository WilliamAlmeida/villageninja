# Auditoria da arte isométrica (prédios, decorações, Monte, Memorial) contra a projeção do jogo.
# Para cada arte, desenha-a como o jogo desenha (render/renderer.ts → artBox: largura = losango do terreno × ART_SCALE ×
# escala do Editor de cenário; meio da base na ponta da frente do losango, 4 px abaixo dela, mais o dx/dy do editor) e
# mede, em px da cena (zoom 1):
#   - a inclinação das bordas de baixo da silhueta (esquerda e direita; o chão do jogo é 2:1 = 0,5 = 26,6°);
#   - onde caem os cantos (esquerdo, direito, frente) em relação aos cantos do losango verdadeiro do terreno;
#   - o tamanho do "pixel" do desenho em px da cena (distância média entre trocas de cor), para comparar com os bonecos;
#   - quanto da arte passa para fora do losango (largura).
# Grava docs/design/arte-iso/medidas.json e folhas anotadas (losango do terreno em ciano, chão batido do jogo em amarelo,
# bordas medidas em vermelho, base da imagem em magenta).
# Uso: python scripts/iso-audit.py
import json
import math
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).parent))
from artpaths import art_file  # noqa: E402
from iso_template import footprint  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'docs' / 'design' / 'arte-iso'
TILE, K = 32, 0.75
Z = 3  # zoom das folhas anotadas

ART_SRC = (ROOT / 'src' / 'render' / 'art.ts').read_text(encoding='utf8')
block = ART_SRC[ART_SRC.index('export const ART_SCALE'):]
block = block[:block.index('};')]
ART_SCALE = {m.group(1) or m.group(2): float(m.group(3)) for m in re.finditer(r"(?:'([\w-]+)'|(\b[a-z][\w]*)):\s*([\d.]+)", block)}
LAYOUT = json.loads((ROOT / 'src' / 'data' / 'layout.json').read_text(encoding='utf8'))


def base_type(name):
    n = re.sub(r'-(\d|f\d|fishing|desert)$', '', name)
    return 'cherry' if n.startswith('cherry') else n


def names():
    out = []
    for p in sorted((ROOT / 'src' / 'art' / 'buildings').rglob('*.png')):
        out.append(p.stem)
    return out


def measure(name):
    img = Image.open(art_file(name)).convert('RGBA')
    w, h = footprint(base_type(name))
    L = LAYOUT['arts'].get(name) or {}
    if not L and re.match(r'^monument-f\d$', name):
        L = LAYOUT['arts'].get('monument') or {}
    diam_w = (w + h) * TILE * K  # largura do losango na cena
    draw_w = diam_w * ART_SCALE.get(name, 1) * L.get('scale', 1)
    draw_h = draw_w * img.height / img.width
    k = draw_w / img.width  # px da cena por px da imagem
    # cena: ponta da frente do losango em (0, 0)
    cx, base = L.get('dx', 0), 4 + L.get('dy', 0)
    left_img, top_img = cx - draw_w / 2, base - draw_h
    corners = {'front': (0, 0), 'left': (-w * 24, -w * 12), 'right': (h * 24, -h * 12), 'back': ((h - w) * 24, -(w + h) * 12)}
    a = np.array(img)[:, :, 3] > 40
    cols = np.where(a.any(axis=0))[0]
    if not len(cols):
        return None
    low = np.array([a[:, x].nonzero()[0].max() if a[:, x].any() else -1 for x in range(img.width)])
    xs = cols
    sx = left_img + (xs + 0.5) * k
    sy = top_img + (low[xs] + 1) * k
    fi = int(np.argmax(sy))
    fx, fy = sx[fi], sy[fi]

    def fit(seg):
        if len(seg) < 6:
            return None
        n = len(seg)
        seg = seg[n // 8: n - n // 8]
        X, Y = sx[seg], sy[seg]
        m, b = np.polyfit(X, Y, 1)
        return float(m), float(b)

    lf = fit(np.arange(0, fi))
    rf = fit(np.arange(fi + 1, len(xs)))
    # tamanho do "pixel" do desenho: distância média entre trocas fortes de cor numa linha (px da imagem)
    rgb = np.array(img)[:, :, :3].astype(int)
    diff = (np.abs(np.diff(rgb, axis=1)).sum(axis=2) > 60) & a[:, 1:] & a[:, :-1]
    changes = diff.sum()
    opaque_run = (a[:, 1:] & a[:, :-1]).sum()
    px_img = opaque_run / max(1, changes)
    res = {
        'name': name, 'tiles': [w, h], 'img': [img.width, img.height], 'art_scale': ART_SCALE.get(name, 1), 'editor_scale': L.get('scale', 1),
        'drawn_w': round(draw_w, 1), 'diamond_w': round(diam_w, 1),
        'width_vs_diamond': round(draw_w / diam_w, 3),
        'slope_left': round(lf[0], 3) if lf else None, 'slope_right': round(-rf[0], 3) if rf else None,
        'front_dx': round(fx - corners['front'][0], 1), 'front_dy': round(fy - corners['front'][1], 1),
        'left_dx': round(sx[0] - corners['left'][0], 1), 'right_dx': round(sx[-1] - corners['right'][0], 1),
        'pixel_scene': round(px_img * k, 2), 'pixel_img': round(px_img, 2),
    }
    return res, img, (left_img, top_img, draw_w, draw_h), corners, (lf, rf), (sx, sy, fi), (w, h)


def annotate(m):
    res, img, (lx, ty, dw, dh), corners, (lf, rf), (sx, sy, fi), (w, h) = m
    pad = 14
    xs = [lx, lx + dw] + [c[0] for c in corners.values()]
    ys = [ty, ty + dh] + [c[1] for c in corners.values()]
    x0, y0 = min(xs) - pad, min(ys) - pad
    W, H = int((max(xs) - x0 + pad) * Z), int((max(ys) - y0 + pad) * Z) + 34
    S = lambda x, y: ((x - x0) * Z, (y - y0) * Z)  # noqa: E731
    can = Image.new('RGBA', (W, H), (92, 140, 70, 255))
    d = ImageDraw.Draw(can)
    # chão batido do jogo: retângulo arredondado em mundo (−4, −4, +8, +10) projetado (aqui os 4 cantos)
    def proj(wx, wy):  # mundo relativo ao canto (tx, ty) → cena relativa à ponta da frente
        fx, fy = (w * TILE - h * TILE) * K, ((w * TILE + h * TILE) * K) / 2
        return (wx - wy) * K - fx, ((wx + wy) * K) / 2 - fy
    earth = [proj(-4, -4), proj(w * TILE + 4, -4), proj(w * TILE + 4, h * TILE + 6), proj(-4, h * TILE + 6)]
    d.polygon([S(*p) for p in earth], fill=(120, 90, 55, 90))
    sm = img.resize((max(1, int(dw * Z)), max(1, int(dh * Z))), Image.NEAREST)
    can.alpha_composite(sm, (int((lx - x0) * Z), int((ty - y0) * Z)))
    dia = [corners['front'], corners['right'], corners['back'], corners['left']]
    d.polygon([S(*p) for p in dia], outline=(0, 255, 255, 255))
    d.line([S(*p) for p in dia + [dia[0]]], fill=(0, 255, 255, 255), width=2)
    d.line([S(lx, ty + dh), S(lx + dw, ty + dh)], fill=(255, 0, 255, 255), width=1)
    for f, rng in ((lf, (sx[0], sx[fi])), (rf, (sx[fi], sx[-1]))):
        if f:
            m_, b_ = f
            d.line([S(rng[0], m_ * rng[0] + b_), S(rng[1], m_ * rng[1] + b_)], fill=(255, 40, 40, 255), width=2)
    sl, sr = res['slope_left'], res['slope_right']
    ang = lambda s: f'{math.degrees(math.atan(s)):.1f}°' if s is not None else '—'  # noqa: E731
    d.text((4, H - 30), f"{res['name']}  terreno {w}x{h}  bordas {ang(sl)} / {ang(sr)} (alvo 26.6°)", fill=(255, 255, 255, 255))
    d.text((4, H - 16), f"frente dy {res['front_dy']}  cantos dx {res['left_dx']} / {res['right_dx']}  pixel {res['pixel_scene']} px", fill=(255, 255, 210, 255))
    return can


def sheet(cards, path, cols=4):
    cw = max(c.width for c in cards)
    rows = [cards[i:i + cols] for i in range(0, len(cards), cols)]
    H = sum(max(c.height for c in r) for r in rows) + 8 * len(rows)
    out = Image.new('RGBA', (cw * cols + 8 * cols, H), (30, 30, 30, 255))
    y = 0
    for r in rows:
        x = 0
        for c in r:
            out.alpha_composite(c, (x, y))
            x += cw + 8
        y += max(c.height for c in r) + 8
    out.save(path)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    results, cards = [], []
    for n in names():
        m = measure(n)
        if not m:
            continue
        results.append(m[0])
        cards.append((m[0], annotate(m)))
    (OUT / 'medidas.json').write_text(json.dumps(results, indent=1, ensure_ascii=False) + '\n', encoding='utf8')
    groups = {
        'predios': [c for r, c in cards if r['name'] in ('house', 'market', 'academy', 'hospital', 'library', 'forge', 'missions', 'kennel', 'intel', 'tower', 'hokage', 'port')],
        'deco': [c for r, c in cards if r['name'] in ('lantern', 'bench', 'flowers', 'banner', 'shrine', 'statue', 'cherry', 'fountain', 'pond', 'pagoda', 'memorial', 'monument')],
        'campos': [c for r, c in cards if r['name'] in ('farm', 'training', 'herbgarden', 'arena', 'lumber', 'quarry', 'ironmine', 'pharmacy', 'sealshop', 'puppetshop')],
    }
    for g, cs in groups.items():
        if cs:
            sheet(cs, OUT / f'{g}.png')
    print(len(results), 'artes medidas em', OUT.relative_to(ROOT).as_posix())


main()
