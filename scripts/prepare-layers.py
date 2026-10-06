# Camadas do ninja montado por código ("paper doll" de verdade): corpo-base sem roupa (src/art/ninja-base.png, malha
# cinza, careca) + peças (roupa, colete, cabelo, chapéu…). Cada peça é um pedido separado ao Codex: ele redesenha o
# corpo-base com SÓ aquela peça a mais, numa cor-chave (cabelo verde; roupa magenta, que o jogo recolore; metal da
# bandana ciano). O Codex redesenha a imagem toda e cada pixel sai um pouco fora do lugar, então não dá para subtrair a
# base: aqui fica só a cor-chave, e cada quadro é encaixado no quadro do corpo-base procurando a escala e a posição em
# que pele e malha coincidem. A peça sai na mesma grade da base (um desenho por cima do outro no jogo).
# A vista de lado sai melhor num pedido à parte, maior: os 4 perfis numa grade 2×2 (molde docs/arte/layers/base-side.png).
# Uso: python scripts/prepare-layers.py   (prévia recolorida: python scripts/preview-layers.py)
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'src' / 'art'
SRC = ROOT / 'docs' / 'arte' / 'layers'
COLS, ROWS = 4, 3
BASE = OUT / 'ninja-base.png'
BODY = OUT / 'ninja-body.png'  # a base com folga em cima de cada quadro (cabelo alto, chapéu): é ela que o jogo desenha
PAD, PADX = 24, 12  # folga em cima e de cada lado do quadro (cabelo alto, fitas da bandana, chapéu, capa)
BASE_SRC = ROOT / 'docs' / 'arte' / 'sprites' / 'ninja-base.png'

# peça → tipo. Fontes: docs/arte/layers/<peça>.png (folha inteira) e <peça>-side.png (perfis 2×2).
PIECES = {'outfit-genin': 'cloth', 'hair-spiky': 'hair', 'vest-chunin': 'cloth'}
HEAD = 0.42  # fração de cima da figura que é a cabeça (chibi)
HAIR_FILL = (30, 138, 43, 255)  # tom escuro da chave verde: cobre o topo careca que a peça deixou à mostra
OUTLINE = (24, 16, 28, 255)


def hsv(a):
    rgb = a[..., :3].astype(float) / 255
    mx, mn = rgb.max(2), rgb.min(2)
    d = mx - mn
    h = np.zeros_like(mx)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    nz = d > 0
    hr = nz & (mx == r)
    hg = nz & (mx == g) & ~hr
    hb = nz & ~hr & ~hg
    h[hr] = ((g - b)[hr] / d[hr]) % 6
    h[hg] = (b - r)[hg] / d[hg] + 2
    h[hb] = (r - g)[hb] / d[hb] + 4
    return h * 60, np.where(mx > 0, d / np.maximum(mx, 1e-6), 0), mx


def key_mask(a, kind):
    h, s, v = hsv(a)
    op = a[..., 3] > 100
    sat = op & (s > 0.35) & (v > 0.25)
    if kind == 'hair':
        return sat & (h >= 85) & (h <= 165)
    # roupa: magenta (recolorida) e ciano (metal)
    return sat & (((h >= 280) & (h <= 330)) | ((h >= 170) & (h <= 200)))


def cats(a, kind=None):
    """Categorias para comparar quadros: 0 vazio, 1 pele, 2 malha (cinza escuro), 3 resto (contorno, olhos);
    -1 = peça (cor-chave), fica de fora da comparação."""
    h, s, v = hsv(a)
    op = a[..., 3] > 100
    c = np.where(op, 3, 0)
    c[op & (h >= 10) & (h <= 45) & (s > 0.12) & (s < 0.65) & (v > 0.55)] = 1
    c[op & (s < 0.2) & (v > 0.18) & (v < 0.55)] = 2
    if kind:
        c[key_mask(a, kind)] = -1
    return c


def figure(a):
    ys, xs = np.nonzero(a[..., 3] > 100)
    return (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1) if len(ys) else None


def fit(b, g, kind):
    """Escala e deslocamento do quadro gerado que fazem pele/malha/contorno baterem com o corpo-base (na cabeça para
    cabelo, no corpo todo para roupa). Palpite: pés alinhados e mesma altura; busca em volta."""
    fb, fg = figure(b), figure(g)
    k0 = (fb[3] - fb[1]) / (fg[3] - fg[1])
    if kind == 'hair':
        k0 *= 1.1  # o cabelo aumenta a figura gerada por cima
    cb = cats(b)
    region = np.ones(cb.shape, bool)
    if kind == 'hair':
        region[fb[1] + int((fb[3] - fb[1]) * (HEAD + 0.08)):] = False
    H, W = cb.shape
    gi = Image.fromarray(g, 'RGBA')
    best = (-1.0, k0, 0, 0)
    for k in np.linspace(k0 * 0.8, k0 * 1.2, 17):
        gs = np.array(gi.resize((max(1, round(gi.width * k)), max(1, round(gi.height * k))), Image.BOX))
        gs[..., 3] = np.where(gs[..., 3] >= 110, 255, 0)
        cg = cats(gs, kind)
        f = figure(gs)
        if f is None:
            continue
        gx, gy = (f[0] + f[2]) / 2, f[3]
        bx, by = (fb[0] + fb[2]) / 2, fb[3]
        for ddx in range(-8, 9):
            for ddy in range(-10, 11):
                dx, dy = round(bx - gx) + ddx, round(by - gy) + ddy
                y0, x0 = max(0, dy), max(0, dx)
                y1, x1 = min(H, dy + cg.shape[0]), min(W, dx + cg.shape[1])
                if y1 <= y0 or x1 <= x0:
                    continue
                view = np.zeros((H, W), int)
                view[y0:y1, x0:x1] = cg[y0 - dy:y1 - dy, x0 - dx:x1 - dx]
                use = region & (view != -1) & ((cb > 0) | (view > 0))
                n = use.sum()
                if n:
                    score = (cb[use] == view[use]).sum() / n
                    if score > best[0]:
                        best = (score, k, dx, dy)
    return best[1], best[2], best[3], best[0]


def islands(on):
    """Regiões conectadas (8 vizinhos)."""
    seen = np.zeros_like(on)
    h, w = on.shape
    for y0, x0 in zip(*np.nonzero(on)):
        if seen[y0, x0]:
            continue
        q, pts = deque([(y0, x0)]), []
        seen[y0, x0] = True
        while q:
            y, x = q.popleft()
            pts.append((y, x))
            for ny in (y - 1, y, y + 1):
                for nx in (x - 1, x, x + 1):
                    if 0 <= ny < h and 0 <= nx < w and on[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        q.append((ny, nx))
        yield pts


def despeck(a, min_px=6):
    for pts in islands(a[..., 3] > 0):
        if len(pts) < min_px:
            for y, x in pts:
                a[y, x, 3] = 0
    return a


def outline(a):
    on = a[..., 3] > 0
    ring = np.zeros_like(on)
    ring[1:, :] |= on[:-1, :]
    ring[:-1, :] |= on[1:, :]
    ring[:, 1:] |= on[:, :-1]
    ring[:, :-1] |= on[:, 1:]
    a[ring & ~on] = OUTLINE
    return a


def hair_fix(a, b, row):
    """Cabelo por vista: de frente não cobre o rosto; de lado (olhando para a direita) só a metade de trás desce abaixo
    da testa; de costas cobre a nuca. O topo careca que a peça não cobriu vira cabelo."""
    fb = figure(b)
    fh = fb[3] - fb[1]
    head_end = fb[1] + fh * HEAD
    brow = fb[1] + fh * HEAD * 0.4
    op = b[..., 3] > 100
    rows = np.arange(a.shape[0])[:, None]
    cols = np.arange(a.shape[1])[None, :]
    hx = np.nonzero(op[fb[1]:int(head_end)])[1]
    cx = (hx.min() + hx.max()) / 2
    skin = cats(b) == 1
    face = op & (rows > brow) & (rows < head_end)
    if row == 0:
        face &= cols >= cx
    if row != 2:
        a[face & (a[..., 3] > 0), 3] = 0
    bare = skin & (rows <= brow)
    if row == 2:
        bare |= skin & (rows < head_end)
    a[bare & (a[..., 3] == 0)] = HAIR_FILL
    return a


def cells(im):
    cw, ch = im.width / COLS, im.height / ROWS
    return [[im.crop((round(c * cw), round(r * ch), round((c + 1) * cw), round((r + 1) * ch))) for c in range(COLS)] for r in range(ROWS)]


def side_cells(path):
    im = Image.open(path).convert('RGBA')
    w, h = im.width // 2, im.height // 2
    return [im.crop(((c % 2) * w, (c // 2) * h, (c % 2 + 1) * w, (c // 2 + 1) * h)) for c in range(COLS)]


def side_template():
    """Molde da vista de lado: os 4 perfis da folha-fonte do corpo-base, ampliados numa grade 2×2 (1536×1024)."""
    src = Image.open(BASE_SRC).convert('RGBA')
    cw, ch = src.width / COLS, src.height / ROWS
    out = Image.new('RGBA', (1536, 1024), (255, 255, 255, 255))
    for c in range(COLS):
        f = src.crop((round(c * cw), 0, round((c + 1) * cw), round(ch)))
        f = f.crop(f.getbbox())
        k = min(700 / f.width, 470 / f.height)
        f = f.resize((round(f.width * k), round(f.height * k)), Image.NEAREST)
        out.alpha_composite(f, ((c % 2) * 768 + (768 - f.width) // 2, (c // 2) * 512 + (512 - f.height) // 2))
    out.convert('RGB').save(SRC / 'base-side.png')


if __name__ == '__main__':
    SRC.mkdir(parents=True, exist_ok=True)
    side_template()
    raw = Image.open(BASE).convert('RGBA')
    rh, rw = raw.height // ROWS, raw.width // COLS
    base = Image.new('RGBA', ((rw + 2 * PADX) * COLS, (rh + PAD) * ROWS), (0, 0, 0, 0))
    for r in range(ROWS):
        for c in range(COLS):
            base.paste(raw.crop((c * rw, r * rh, (c + 1) * rw, (r + 1) * rh)), (c * (rw + 2 * PADX) + PADX, r * (rh + PAD) + PAD))
    base.save(BODY, optimize=True)
    bcells = cells(base)
    fw, fh = bcells[0][0].size
    for name, kind in PIECES.items():
        full, side = SRC / f'{name}.png', SRC / f'{name}-side.png'
        if not full.exists():
            print('falta', full.relative_to(ROOT))
            continue
        gen = cells(Image.open(full).convert('RGBA'))
        if side.exists():
            gen[0] = side_cells(side)
        sheet = Image.new('RGBA', base.size, (0, 0, 0, 0))
        top = Image.new('RGBA', base.size, (0, 0, 0, 0))
        scores = []
        for r in range(ROWS):
            for c in range(COLS):
                b = np.array(bcells[r][c])
                g = np.array(gen[r][c])
                if figure(g) is None:
                    continue
                k, dx, dy, score = fit(b, g, kind)
                scores.append(score)
                only = g.copy()
                only[~key_mask(g, kind)] = 0
                img = Image.fromarray(only, 'RGBA')
                img = img.resize((max(1, round(img.width * k)), max(1, round(img.height * k))), Image.BOX)
                sa = np.array(img)
                sa[..., 3] = np.where(sa[..., 3] >= 110, 255, 0)
                cell = Image.new('RGBA', (fw, fh), (0, 0, 0, 0))
                piece = Image.fromarray(despeck(sa), 'RGBA')
                cell.paste(piece, (dx, dy), piece)
                a = np.array(cell)
                if kind == 'hair':
                    a = hair_fix(a, b, r)
                a = outline(a)
                edge = np.concatenate([a[0, :, 3], a[:, 0, 3], a[:, -1, 3]])
                if edge.any():
                    print(f'  {name}: quadro {r + 1}x{c + 1} encosta na borda (aumente PAD/PADX)')
                if kind == 'cloth':
                    # o que a roupa tem na cabeça (bandana) vai numa camada à parte, desenhada depois do cabelo
                    fb = figure(b)
                    cut = int(fb[1] + (fb[3] - fb[1]) * HEAD * 0.75)
                    t = a.copy()
                    t[cut:] = 0
                    a[:cut] = 0
                    top.alpha_composite(Image.fromarray(t, 'RGBA'), (c * fw, r * fh))
                sheet.alpha_composite(Image.fromarray(a, 'RGBA'), (c * fw, r * fh))
        sheet.save(OUT / f'layer-{name}.png', optimize=True)
        if top.getbbox():
            top.save(OUT / f'layer-{name}-top.png', optimize=True)
        print(f'layer-{name}.png', f'encaixe médio {np.mean(scores):.2f} (pior {min(scores):.2f})')
