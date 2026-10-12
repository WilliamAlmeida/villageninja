# Funções comuns da arte isométrica no padrão novo (docs/design-arte-iso.md): recorte do objeto principal, a base do
# prédio, a redução para a grade do boneco (1 px da imagem = 0,536 px da cena, o pixel do ninja) com cores limitadas e a
# limpeza de fiapos. Usadas por scripts/pilot-art.py (o piloto) e scripts/building-art.py (o resto das construções).
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PIX = 30 / 56  # px da cena por px da imagem (o pixel do boneco)


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
    q = rgb.quantize(palette=pal, dither=Image.Dither.NONE) if pal else rgb.quantize(64, method=Image.Quantize.MAXCOVERAGE, dither=Image.Dither.NONE)
    out = np.array(q.convert('RGBA'))
    out[:, :, 3] = np.where(alpha, 255, 0)
    return Image.fromarray(out, 'RGBA')


def drop_specks(img, frac=0.006):
    """Tira da imagem final os pedacinhos soltos (menos de `frac` dos pixels opacos), como pontas de beiral que se
    descolaram na redução. Só para prédios (nos objetos, pedriscos soltos são de verdade)."""
    from collections import deque
    a = np.array(img)
    m = a[:, :, 3] > 0
    total = m.sum()
    seen = np.zeros(m.shape, bool)
    h, w = m.shape
    for sy, sx in zip(*np.nonzero(m)):
        if seen[sy, sx]:
            continue
        comp = [(sy, sx)]
        seen[sy, sx] = True
        q = deque(comp)
        while q:
            y, x = q.popleft()
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < h and 0 <= xx < w and m[yy, xx] and not seen[yy, xx]:
                        seen[yy, xx] = True
                        q.append((yy, xx))
                        comp.append((yy, xx))
        if len(comp) < total * frac:
            for y, x in comp:
                a[y, x, 3] = 0
    return Image.fromarray(a, 'RGBA')


def main_object(mask, cell=None):
    """Caixa (x0, y0, x1, y1) do objeto principal: o pedaço opaco com mais pixels DENTRO da casa `cell` (x0, y0, x1, y1 na
    janela; sem ela, o maior) e o que estiver colado nele, sem fiapos de fundo nem pedaços de vizinhos. A janela pode ser
    maior que a casa: o objeto que passa da borda dela (beiral, galho) não é cortado. Componentes numa grade de 4 px."""
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
    if cell:
        cx0, cy0, cx1, cy1 = (v // S for v in cell)
        inside = np.bincount(lab[cy0:cy1, cx0:cx1].ravel(), minlength=len(sizes))
        inside[0] = 0
        big = int(np.argmax(inside))
    else:
        big = int(np.argmax(sizes))
    keep = lab == big
    ys, xs = np.nonzero(keep)
    bx0, by0, bx1, by1 = xs.min(), ys.min(), xs.max(), ys.max()
    for n in range(1, len(sizes)):  # pedaços pequenos dentro do contorno (folhas soltas, pedrinhas); nada do vizinho
        if n == big or sizes[n] > sizes[big] * 0.15 or sizes[n] < max(6, sizes[big] * 0.004):
            continue
        ys2, xs2 = np.nonzero(lab == n)
        if xs2.min() >= bx0 - 1 and xs2.max() <= bx1 + 1 and ys2.min() >= by0 - 1 and ys2.max() <= by1 + 1:
            keep |= lab == n
    ys, xs = np.nonzero(keep)
    return xs.min() * S, ys.min() * S, (xs.max() + 1) * S, (ys.max() + 1) * S


def base_span(m):
    """A base do prédio: a linha mais larga do terço de baixo da máscara (largura e o meio, em px)."""
    lo = int(m.shape[0] * 0.67)
    best, span = (0, 0), 0
    for r in range(lo, m.shape[0]):
        c = np.nonzero(m[r])[0]
        if len(c) and c.max() - c.min() + 1 > span:
            span, best = c.max() - c.min() + 1, (c.min(), c.max())
    return span, best
