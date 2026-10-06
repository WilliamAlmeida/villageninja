# Camadas do ninja montado por código ("paper doll" de verdade): corpo-base sem roupa (src/art/ninja-base.png, malha
# cinza, careca) + peças (roupa, colete, cabelo, bandana, manto, chapéu, espada…).
#
# Cada peça é um pedido separado ao Codex, desenhada por cima de um MOLDE: o corpo já montado com as peças que ficam
# embaixo dela (`under`), na resolução do jogo, ampliado. Assim a peça nova acompanha os pixels do que está embaixo
# (a bandana anda junto com o cabelo). A peça vem numa cor-chave: cabelo verde; roupa magenta (cor principal,
# recolorida), amarelo (segunda cor) e ciano (metal). O Codex redesenha a imagem toda e cada pixel sai um pouco fora do
# lugar, então não dá para subtrair o molde: fica só a cor-chave, e cada quadro é encaixado no molde procurando a
# escala e a posição em que as cores coincidem. A peça sai na mesma grade do corpo (uma camada por cima da outra).
#
#   python scripts/prepare-layers.py [--force]     extrai todas as peças que já têm imagem gerada (as editadas à mão
#                                                  no editor de sprites ficam, a não ser com --force)
#   python scripts/prepare-layers.py tpl <peça>    grava os moldes da peça (docs/arte/layers/tpl-<peça>[-side].png)
#   bash scripts/layer-pieces.sh <peça>            gera a peça no Codex (folha inteira + vista de lado 2×2)
#   python scripts/preview-layers.py               prévia recolorida
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'src' / 'art'
SRC = ROOT / 'docs' / 'arte' / 'layers'
COLS, ROWS = 4, 3
BASE = OUT / 'ninja-base.png'
BODY = OUT / 'ninja-body.png'  # a base com folga no quadro (cabelo alto, chapéu, espada): é ela que o jogo desenha
PAD, PADX = 24, 18
EDITS = OUT / 'art-edits.json'  # artes editadas à mão no editor de sprites (scripts/editor.ts): não refazer

# peça → (tipo, peças de baixo no molde, cor neutra da peça no molde de quem vem depois [, segunda cor])
# As três primeiras foram geradas sobre o corpo puro (antes dos moldes em camadas).
PIECES = {
    'outfit-genin': ('cloth', [], '#2d4a9a'),
    'hair-spiky': ('hair', [], '#4a3020'),
    'vest-chunin': ('cloth', [], '#5f6b3a'),
    'headband': ('band', ['outfit-genin', 'hair-spiky'], '#2d4a9a'),
    'vest-jounin': ('cloth', ['outfit-genin'], '#4e5a3a'),
    'coat-sannin': ('cloth', ['outfit-genin'], '#8c2a22', '#d4a03a'),
    'cloak-kage': ('cloth', ['outfit-genin'], '#f0ece0', '#c8352a'),
    'hat-kage': ('band', ['outfit-genin', 'cloak-kage'], '#f0ece0', '#c8352a'),
    'sword-zabuza': ('cloth', ['outfit-genin'], '#3a2a20'),
}
HEAD = 0.42  # fração de cima da figura que é a cabeça (chibi)
HAIR_FILL = (30, 138, 43, 255)  # tom escuro da chave verde: cobre o topo careca que a peça deixou à mostra
OUTLINE = (24, 16, 28, 255)
METAL = (150, 158, 172)


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
    sat = (a[..., 3] > 100) & (s > 0.35) & (v > 0.25)
    if kind == 'hair':
        return sat & (h >= 85) & (h <= 165)
    # roupa: magenta (cor principal), amarelo (segunda cor) e ciano (metal)
    return sat & (((h >= 280) & (h <= 330)) | ((h >= 170) & (h <= 200)) | ((h >= 48) & (h <= 72) & (s > 0.5)))


def tint(a, kind, color, color2=None):
    """Recolore a camada como no jogo (dollArt): chave → cor mantendo o sombreado; ciano → metal."""
    a = a.copy()
    h, s, v = hsv(a)
    op = (a[..., 3] > 10) & (s > 0.35)
    hx = lambda c: np.array([int(c[i:i + 2], 16) for i in (1, 3, 5)], float)
    rules = []
    if kind == 'hair':
        rules.append((op & (h >= 85) & (h <= 165), hx(color), 0.8))
    else:
        rules.append((op & (h >= 280) & (h <= 330), hx(color), 1.0))
        rules.append((op & (h >= 170) & (h <= 200), np.array(METAL, float), 1.0))
        rules.append((op & (h >= 48) & (h <= 72), hx(color2 or color), 1.0))
    for m, to, mid in rules:
        k = (v / mid)[m][:, None]
        out = np.where(k <= 1, to * k, to + (255 - to) * np.minimum(1, k - 1))
        a[m, :3] = np.clip(out, 0, 255).astype(np.uint8)
    return a


def compose(names):
    """Corpo + peças `names` recoloridas com as cores neutras (o molde que o Codex recebe e com que o encaixe compara)."""
    out = Image.open(BODY).convert('RGBA')
    for n in names:
        spec = PIECES[n]
        a = np.array(Image.open(OUT / f'layer-{n}.png').convert('RGBA'))
        out.alpha_composite(Image.fromarray(tint(a, spec[0], spec[2], spec[3] if len(spec) > 3 else None), 'RGBA'))
    return out


def figure(a):
    ys, xs = np.nonzero(a[..., 3] > 100)
    return (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1) if len(ys) else None


def fit(ref, body, g, kind, k_fixed=None):
    """Escala e deslocamento do quadro gerado que fazem as cores (fora da peça) baterem com o molde. Peças da cabeça
    (cabelo, bandana, chapéu) comparam só a cabeça. Palpite: pés alinhados e mesma altura do corpo; busca em volta."""
    fb, fg = figure(body), figure(g)
    k0 = (fb[3] - fb[1]) / (fg[3] - fg[1])
    if kind in ('hair', 'band'):
        k0 *= 1.1  # o que vai na cabeça aumenta a figura gerada
    region = np.ones(ref.shape[:2], bool)
    if kind in ('hair', 'band'):
        region[fb[1] + int((fb[3] - fb[1]) * (HEAD + 0.08)):] = False
    ro = ref[..., 3] > 100
    rc = ref[..., :3].astype(int)
    H, W = ro.shape
    gi = Image.fromarray(g, 'RGBA')
    best = (-1.0, k0, 0, 0)
    for k in ([k_fixed] if k_fixed else np.linspace(k0 * 0.8, k0 * 1.2, 17)):
        gs = np.array(gi.resize((max(1, round(gi.width * k)), max(1, round(gi.height * k))), Image.BOX))
        gs[..., 3] = np.where(gs[..., 3] >= 110, 255, 0)
        gkey = key_mask(gs, 'hair' if kind == 'hair' else 'cloth')
        f = figure(gs)
        if f is None:
            continue
        gx, gy = (f[0] + f[2]) / 2, f[3]
        bx, by = (fb[0] + fb[2]) / 2, fb[3]
        for ddx in range(-8, 9):
            for ddy in range(-10, 11):
                dx, dy = round(bx - gx) + ddx, round(by - gy) + ddy
                y0, x0 = max(0, dy), max(0, dx)
                y1, x1 = min(H, dy + gs.shape[0]), min(W, dx + gs.shape[1])
                if y1 <= y0 or x1 <= x0:
                    continue
                vo = np.zeros((H, W), bool)
                vk = np.zeros((H, W), bool)
                vc = np.zeros((H, W, 3), int)
                vo[y0:y1, x0:x1] = gs[y0 - dy:y1 - dy, x0 - dx:x1 - dx, 3] > 0
                vk[y0:y1, x0:x1] = gkey[y0 - dy:y1 - dy, x0 - dx:x1 - dx]
                vc[y0:y1, x0:x1] = gs[y0 - dy:y1 - dy, x0 - dx:x1 - dx, :3]
                use = region & ~vk & (ro | vo)
                n = use.sum()
                if not n:
                    continue
                near = np.abs(vc - rc).sum(2) < 110
                score = (use & ro & vo & near).sum() / n
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


def skin_mask(b):
    h, s, v = hsv(b)
    return (b[..., 3] > 100) & (h >= 10) & (h <= 45) & (s > 0.12) & (s < 0.65) & (v > 0.55)


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
    skin = skin_mask(b)
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


def edited():
    import json
    return set(json.loads(EDITS.read_text())) if EDITS.exists() else set()


def body_sheet():
    """Corpo-base com folga em cima e dos lados de cada quadro."""
    if BODY.name in edited() and '--force' not in sys.argv:
        return
    raw = Image.open(BASE).convert('RGBA')
    rh, rw = raw.height // ROWS, raw.width // COLS
    base = Image.new('RGBA', ((rw + 2 * PADX) * COLS, (rh + PAD) * ROWS), (0, 0, 0, 0))
    for r in range(ROWS):
        for c in range(COLS):
            base.paste(raw.crop((c * rw, r * rh, (c + 1) * rw, (r + 1) * rh)), (c * (rw + 2 * PADX) + PADX, r * (rh + PAD) + PAD))
    base.save(BODY, optimize=True)


def templates(name):
    """Moldes da peça: o corpo montado com as peças de baixo, ampliado (folha 4×3 e perfis 2×2), fundo branco."""
    sheet = compose(PIECES[name][1])
    grid = cells(sheet)
    full = Image.new('RGBA', (1536, 1024), (255, 255, 255, 255))
    for r in range(ROWS):
        for c in range(COLS):
            f = grid[r][c].resize((grid[r][c].width * 4, grid[r][c].height * 4), Image.NEAREST)
            full.alpha_composite(f, (c * 384 + (384 - f.width) // 2, r * 341 + (341 - f.height) // 2))
    full.convert('RGB').save(SRC / f'tpl-{name}.png')
    side = Image.new('RGBA', (1536, 1024), (255, 255, 255, 255))
    for c in range(COLS):
        f = grid[0][c].resize((grid[0][c].width * 6, grid[0][c].height * 6), Image.NEAREST)
        side.alpha_composite(f, ((c % 2) * 768 + (768 - f.width) // 2, (c // 2) * 512 + (512 - f.height) // 2))
    side.convert('RGB').save(SRC / f'tpl-{name}-side.png')
    print('moldes', f'tpl-{name}.png', f'tpl-{name}-side.png')


def extract(name):
    spec = PIECES[name]
    kind, under = spec[0], spec[1]
    full, side = SRC / f'{name}.png', SRC / f'{name}-side.png'
    if not full.exists():
        print('falta', full.relative_to(ROOT))
        return
    bodyc = cells(Image.open(BODY).convert('RGBA'))
    refc = cells(compose(under))
    fw, fh = bodyc[0][0].size
    gen = cells(Image.open(full).convert('RGBA'))
    if side.exists():
        gen[0] = side_cells(side)
    sheet = Image.new('RGBA', (fw * COLS, fh * ROWS), (0, 0, 0, 0))
    scores = []
    for r in range(ROWS):
        # 1ª passada: escala livre em cada quadro; 2ª: a mesma escala (mediana) nos 4 quadros da vista, só a posição
        # muda — a peça não "respira" de um quadro para o outro e um quadro mal encaixado não sai do tamanho
        fits = {}
        for c in range(COLS):
            g = np.array(gen[r][c])
            if figure(g) is not None:
                fits[c] = fit(np.array(refc[r][c]), np.array(bodyc[r][c]), g, kind)
        k_row = float(np.median([f[0] for f in fits.values()])) if fits else None
        for c in range(COLS):
            b = np.array(bodyc[r][c])
            g = np.array(gen[r][c])
            if c not in fits:
                continue
            k, dx, dy, score = fit(np.array(refc[r][c]), b, g, kind, k_row)
            scores.append(score)
            only = g.copy()
            only[~key_mask(g, 'hair' if kind == 'hair' else 'cloth')] = 0
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
            if name == 'headband' and r == 1:
                # de frente as fitas do nó apareciam saindo dos lados da cabeça, como orelhas: corta fora da cabeça
                fb = figure(b)
                hx = np.nonzero(b[fb[1]:fb[1] + int((fb[3] - fb[1]) * HEAD), :, 3] > 100)[1]
                a[:, :hx.min()] = 0
                a[:, hx.max() + 1:] = 0
            if name == 'outfit-genin':
                # a bandana desta roupa saiu junto; agora ela é peça própria (headband), feita sobre o cabelo
                fb = figure(b)
                a[:int(fb[1] + (fb[3] - fb[1]) * HEAD * 0.97)] = 0
            a = outline(a)
            if np.concatenate([a[0, :, 3], a[:, 0, 3], a[:, -1, 3]]).any():
                print(f'  {name}: quadro {r + 1}x{c + 1} encosta na borda (aumente PAD/PADX)')
            sheet.alpha_composite(Image.fromarray(a, 'RGBA'), (c * fw, r * fh))
    sheet.save(OUT / f'layer-{name}.png', optimize=True)
    print(f'layer-{name}.png', f'encaixe médio {np.mean(scores):.2f} (pior {min(scores):.2f})')


if __name__ == '__main__':
    SRC.mkdir(parents=True, exist_ok=True)
    body_sheet()
    if len(sys.argv) > 2 and sys.argv[1] == 'tpl':
        for n in sys.argv[2:]:
            templates(n)
    else:
        names = [a for a in sys.argv[1:] if not a.startswith('--')]
        for n in PIECES:  # em ordem: as de baixo antes (o molde das de cima usa as camadas já extraídas)
            if names and n not in names:
                continue
            if f'layer-{n}.png' in edited() and '--force' not in sys.argv:
                print(f'layer-{n}.png editada à mão no editor: mantida (use --force para refazer)')
                continue
            extract(n)
