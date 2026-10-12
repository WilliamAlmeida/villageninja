# Gabarito de CHÃO para arte isométrica de prédios e decorações (o equivalente do gabarito de poses dos personagens).
# O jogo projeta o chão em 2:1 exato (um tile de 32 px vira um losango de 48×24, core/iso.ts); o Codex, só com "2:1
# isometric" no texto, erra o ângulo e o tamanho da base. O gabarito é uma imagem do mesmo tamanho da folha pedida com,
# em cada casa da grade, o losango exato do terreno da peça (w×h tiles, linhas de tile por dentro) apoiado embaixo da
# casa; vai como 1ª referência, e o recorte depois usa a largura do losango (a base fica do tamanho certo no jogo).
import re
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
GRAY = (150, 150, 165)
LINE = (90, 90, 110)


def footprint(type_: str) -> tuple[int, int]:
    """Tamanho em tiles (w, h) do prédio/decoração em src/data/buildings.ts (1×1 se não achar)."""
    src = (ROOT / 'src' / 'data' / 'buildings.ts').read_text(encoding='utf8')
    m = re.search(rf"type: '{re.escape(type_)}'.*?\bw: (\d+), h: (\d+)", src, re.S)
    return (int(m.group(1)), int(m.group(2))) if m else (1, 1)


def diamonds(foots, cols, rows, W, H, fill=0.8, base=0.88):
    """Losango de cada casa: dict com a ponta da frente (cx, by), a largura, o tamanho em tiles e a faixa x0–x1. O maior
    (w+h) da folha ocupa `fill` da largura da casa; os outros na mesma escala (o tile tem o mesmo tamanho na folha toda)."""
    cw, ch = W / cols, H / rows
    biggest = max(w + h for w, h in foots) or 1
    unit = cw * fill / biggest  # largura na tela de um passo de tile (meia largura de cada lado do losango)
    out = []
    for i, (w, h) in enumerate(foots):
        cx = (i % cols) * cw + cw / 2 + (w - h) * unit / 2  # o losango fica centrado na casa
        by = (i // cols) * ch + ch * base
        out.append({'cx': cx, 'by': by, 'width': unit * (w + h), 'w': w, 'h': h, 'unit': unit,
                    'x0': cx - w * unit, 'x1': cx + h * unit, 'top': by - (w + h) * unit / 2})
    return out


def draw(path, foots, cols, rows, W=1536, H=1024):
    """Grava o gabarito em `path` e devolve os losangos (ver `diamonds`)."""
    im = Image.new('RGB', (W, H), (255, 255, 255))
    d = ImageDraw.Draw(im)
    ds = diamonds(foots, cols, rows, W, H)
    for g in ds:
        cx, by, unit, w, h = g['cx'], g['by'], g['unit'], g['w'], g['h']
        # tile (gx, gy) do terreno na projeção 2:1, com a ponta da frente (w, h) em (cx, by)
        P = lambda gx, gy: (cx + ((gx - gy) - (w - h)) * unit, by - ((w - gx) + (h - gy)) * unit / 2)  # noqa: E731
        d.polygon([P(w, h), P(w, 0), P(0, 0), P(0, h)], fill=GRAY, outline=LINE)
        for gx in range(1, w):
            d.line([P(gx, 0), P(gx, h)], fill=LINE, width=2)
        for gy in range(1, h):
            d.line([P(0, gy), P(w, gy)], fill=LINE, width=2)
    im.save(path)
    return ds


# ------------------------------------------------------------------ alturas-padrão (docs/design-arte-iso.md, seção 6)
H_SCENE = 30  # altura do ninja na cena (px, zoom 1) = 1H
STD = {'porta': 1.15, 'andar': 1.5, 'parapeito': 0.45, 'telhado': 0.8}
TOWER = {'plataforma': 2.0, 'pe_direito': 1.8, 'telhado': 0.8}


def draw_v2(path, items, cols, rows, W=1536, H=1024, fill=0.62, base=0.93):
    """Gabarito v2: o losango exato de cada peça e, por cima, o VOLUME-GUIA em arame até a altura dela (em H, altura do
    ninja) e a silhueta cinza de um ninja na mesma escala ao lado, para o Codex ter tamanho e altura. `items`: lista de
    (w, h, altura_H). Devolve os losangos (como `diamonds`, com `scene_k` = px da cena por px da folha)."""
    im = Image.new('RGB', (W, H), (255, 255, 255))
    d = ImageDraw.Draw(im)
    ds = diamonds([(w, h) for w, h, _ in items], cols, rows, W, H, fill=fill, base=base)
    sil = _ninja_silhouette()
    for g, (_, _, hh) in zip(ds, items):
        cx, by, unit, w, h = g['cx'], g['by'], g['unit'], g['w'], g['h']
        g['scene_k'] = 24 / unit  # 1 passo de tile = 24 px da cena
        P = lambda gx, gy: (cx + ((gx - gy) - (w - h)) * unit, by - ((w - gx) + (h - gy)) * unit / 2)  # noqa: E731
        d.polygon([P(w, h), P(w, 0), P(0, 0), P(0, h)], fill=GRAY, outline=LINE)
        for gx in range(1, w):
            d.line([P(gx, 0), P(gx, h)], fill=LINE, width=2)
        for gy in range(1, h):
            d.line([P(0, gy), P(w, gy)], fill=LINE, width=2)
        up = hh * H_SCENE / g['scene_k']  # altura do volume em px da folha
        base_pts = [P(w, h), P(w, 0), P(0, 0), P(0, h)]
        top = [(x, y - up) for x, y in base_pts]
        d.line(top + [top[0]], fill=(120, 170, 230), width=2)
        for i in (0, 1, 3):
            d.line([base_pts[i], top[i]], fill=(120, 170, 230), width=2)
        # silhueta do ninja (1H) em pé na frente-esquerda, fora do losango
        nh = round(H_SCENE / g['scene_k'])
        s2 = sil.resize((max(1, round(sil.width * nh / sil.height)), nh), Image.NEAREST)
        im.paste((150, 150, 150), (round(g['x0'] - s2.width - 6), round(by - s2.height)), s2)
    im.save(path)
    return ds


def _ninja_silhouette():
    """Máscara do ninja de frente, parado (corpo-base), recortada."""
    import numpy as np
    from artpaths import art_file
    body = Image.open(art_file('ninja-body')).convert('RGBA')
    fw, fh = body.width // 4, body.height // 3
    f = body.crop((fw, fh, 2 * fw, 2 * fh))
    a = f.getchannel('A').point(lambda v: 255 if v > 40 else 0)
    return a.crop(a.getbbox())


PROMPT_V2 = (
    'Image 1 is a placement and SIZE TEMPLATE with the same grid: in each cell the flat grey diamond is the EXACT ground '
    'footprint (isometric, thin lines = map tiles), the blue wireframe box shows the TOTAL HEIGHT the object must reach '
    '(top of the roof), and the grey person silhouette is a ninja of the game at the same scale (only a size reference). '
    'Draw each object standing on its diamond (base covering the whole diamond, same position) and as tall as its blue '
    'box. Do NOT draw the template lines, the box or the person. '
)


PROMPT = (
    'Image 1 is a placement TEMPLATE with the same grid: in each cell a flat grey diamond shows the EXACT ground footprint '
    'of that object (true 2:1 isometric, the thin lines are the map tiles). Draw each object standing on exactly its '
    'diamond: the object\'s ground or base covers the whole diamond with the same size, position and angle (left, right, '
    'front and back corners on the diamond corners); tall parts may rise above it. Do not draw the template itself. '
)
