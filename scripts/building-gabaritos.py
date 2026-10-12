# Gabaritos de construção com o ninja como régua (para o autor decidir o padrão; docs/design-arte-iso.md).
# Tudo na escala do jogo (px da cena no zoom 1: tile = losango 48×24, ninja = 30 px de altura) ampliado Z vezes.
# Saídas em docs/design/arte-iso/:
#   gabarito-alturas.png  terreno 1×1, 2×2, 3×2, 3×3 com as alturas propostas (porta, andar, parapeito, telhado) em
#                         arame isométrico e o ninja de verdade em pé na frente
#   torre-camadas.png     a torre proposta em 3 camadas (base · vigia · telhado com pilastras) e a torre de hoje ao lado
#   pixel-comparacao.png  a mesma casa com o pixel de 1 px da cena e com o do boneco (0,54), ao lado do ninja
# Uso: python scripts/building-gabaritos.py
import sys
from importlib import import_module
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).parent))
from artpaths import art_file  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'docs' / 'design' / 'arte-iso'
Z = 4
H = 30  # altura do ninja na cena
NINJA_K = 30 / 56  # px da cena por px da folha do boneco (corpo de 56 px = 30 px)

# padrão proposto, em alturas de ninja (H)
STD = {'porta': 1.15, 'andar': 1.5, 'parapeito': 0.45, 'telhado': 0.8}
TOWER = {'plataforma': 2.0, 'pe_direito': 1.8, 'telhado': 0.8}  # pé-direito: 1H do vigia + 0,4H (o meio da plataforma fica meio tile acima da ponta da frente na tela) + folga

L = import_module('prepare-layers')


def ninja_img():
    body = Image.open(art_file('ninja-body')).convert('RGBA')

    def layer(name, color):
        p = art_file(f'layer-{name}')
        kind = 'hair' if name.startswith('hair') else 'cloth'
        return Image.fromarray(L.tint(np.array(Image.open(p).convert('RGBA')), kind, color, None), 'RGBA')

    t = body.copy()
    for n, c in (('outfit-genin', '#2d4a9a'), ('hair-spiky', '#f2c94c'), ('headband', '#2d4a9a')):
        t.alpha_composite(layer(n, c))
    fw, fh = t.width // 4, t.height // 3
    f = t.crop((fw, fh, 2 * fw, 2 * fh))  # de frente, parado
    a = np.array(f)[:, :, 3] > 40
    ys, xs = a.any(axis=1).nonzero()[0], a.any(axis=0).nonzero()[0]
    return f.crop((xs[0], ys[0], xs[-1] + 1, ys[-1] + 1))


NINJA = ninja_img()


def put_ninja(can, x, y, z=Z):
    """Ninja com os pés em (x, y) da tela já ampliada; altura de 30 px da cena."""
    s = H * z / NINJA.height
    im = NINJA.resize((max(1, round(NINJA.width * s)), max(1, round(NINJA.height * s))), Image.NEAREST)
    can.alpha_composite(im, (round(x - im.width / 2), round(y - im.height)))


def iso(w, h, ox, oy, z=Z):
    """Cantos do terreno w×h com a ponta da frente em (ox, oy) na tela ampliada: frente, direita, fundo, esquerda."""
    return [(ox, oy), (ox + h * 24 * z, oy - h * 12 * z), (ox + (h - w) * 24 * z, oy - (w + h) * 12 * z), (ox - w * 24 * z, oy - w * 12 * z)]


def prism(d, base, height, color, width=2):
    """Caixa em arame: o losango do chão e o mesmo erguido `height` px (já ampliado); arestas verticais visíveis."""
    top = [(x, y - height) for x, y in base]
    d.line(base + [base[0]], fill=color, width=width)
    d.line(top + [top[0]], fill=color, width=width)
    for i in (0, 1, 3):
        d.line([base[i], top[i]], fill=color, width=width)
    return top


FONT = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 15)
BOLD = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', 17)


def label(d, x, y, text, color=(255, 255, 255, 255), bold=False):
    d.text((x, y), text, fill=color, font=BOLD if bold else FONT)


def gabarito_alturas():
    cats = [('1x1 (torre, decoração)', 1, 1, 1), ('2x2 (casa, mercado, oficinas)', 2, 2, 1), ('3x2 (hospital, biblioteca)', 3, 2, 2), ('3x3 (academia, Residência)', 3, 3, 2)]
    cw = 640
    can = Image.new('RGBA', (cw * len(cats), 760), (88, 136, 66, 255))
    d = ImageDraw.Draw(can)
    for i, (title, w, h, floors) in enumerate(cats):
        ox, oy = i * cw + cw // 2, 640
        base = iso(w, h, ox, oy)
        d.polygon(base, fill=(150, 150, 165, 255), outline=(60, 60, 80, 255))
        for gx in range(1, w):  # linhas dos tiles
            a = (ox - (w - gx) * 24 * Z, oy - (w - gx) * 12 * Z)
            d.line([a, (a[0] + h * 24 * Z, a[1] - h * 12 * Z)], fill=(90, 90, 110, 255), width=1)
        for gy in range(1, h):
            a = (ox + (h - gy) * 24 * Z, oy - (h - gy) * 12 * Z)
            d.line([a, (a[0] - w * 24 * Z, a[1] - w * 12 * Z)], fill=(90, 90, 110, 255), width=1)
        andar = STD['andar'] * H * Z
        top = base
        for f in range(floors):
            top = prism(d, [(x, y - f * andar) for x, y in base], andar, (255, 230, 120, 255))
        # telhado: pirâmide até o meio, STD['telhado'] acima do último andar
        cx = sum(p[0] for p in top) / 4
        cy = sum(p[1] for p in top) / 4 - STD['telhado'] * H * Z
        for p in top:
            d.line([p, (cx, cy)], fill=(255, 140, 90, 255), width=2)
        # porta na face da frente-esquerda
        door = STD['porta'] * H * Z
        fx, fy = ox - 10 * Z, oy - 5 * Z
        d.line([(fx, fy), (fx, fy - door)], fill=(120, 220, 255, 255), width=3)
        put_ninja(can, ox + 14 * Z, oy + 2 * Z)
        # régua de alturas à esquerda
        rx = ox - w * 24 * Z - 70
        for k in range(0, int((floors * STD['andar'] + STD['telhado']) * 10) + 1, 5):
            y = oy - k / 10 * H * Z
            d.line([(rx, y), (rx + 12, y)], fill=(255, 255, 255, 255), width=1)
            label(d, rx - 34, y - 6, f'{k / 10:.1f}H')
        label(d, i * cw + 12, 8, title, bold=True)
        label(d, i * cw + 12, 32, f'{floors} andar(es) de {STD["andar"]}H + telhado {STD["telhado"]}H = {(floors * STD["andar"] + STD["telhado"]):.1f}H ({(floors * STD["andar"] + STD["telhado"]) * H:.0f} px)')
        label(d, i * cw + 12, 52, f'porta {STD["porta"]}H (azul) - ninja = 1H = {H} px - terreno {w}x{h}')
    can.save(OUT / 'gabarito-alturas.png')


def torre_camadas():
    can = Image.new('RGBA', (1500, 820), (88, 136, 66, 255))
    d = ImageDraw.Draw(can)
    # proposta: 3 camadas lado a lado e montada
    plat = TOWER['plataforma'] * H * Z
    pe = TOWER['pe_direito'] * H * Z
    roof = TOWER['telhado'] * H * Z
    cols = [('1 - base (embaixo do vigia)', (130, 200, 255, 255)), ('2 - vigia', None), ('3 - telhado + pilastras (por cima)', (255, 150, 110, 255)), ('montada', 'all')]
    for i, (title, color) in enumerate(cols):
        ox, oy = 190 + i * 360, 760
        base = iso(1, 1, ox, oy)
        d.polygon(base, outline=(60, 60, 80, 255))
        floor = [(x, y - plat) for x, y in base]
        if color in ((130, 200, 255, 255), 'all'):
            c = (130, 200, 255, 255)
            for p in (base[1], base[3], base[0]):
                d.line([p, (p[0], p[1] - plat)], fill=c, width=3)  # pilares até a plataforma
            d.polygon(floor, outline=c)
            back = [floor[1], floor[2], floor[3]]
            rail = STD['parapeito'] * H * Z
            d.line([(x, y - rail) for x, y in back], fill=c, width=2)  # parapeito do fundo (fica atrás do vigia)
            for p in back:
                d.line([p, (p[0], p[1] - rail)], fill=c, width=2)
        if color is None or color == 'all':
            put_ninja(can, ox, oy - plat - 4 * Z)
        if color in ((255, 150, 110, 255), 'all'):
            c = (255, 150, 110, 255)
            front = [floor[3], floor[0], floor[1]]
            d.line([(x, y - STD['parapeito'] * H * Z) for x, y in front], fill=c, width=3)  # parapeito da frente
            for p in (floor[1], floor[3], floor[0]):
                d.line([p, (p[0], p[1] - pe)], fill=c, width=3)  # pilastras até o beiral
            eave = [(x, y - pe) for x, y in floor]
            d.line(eave + [eave[0]], fill=c, width=2)
            cx = sum(p[0] for p in eave) / 4
            cy = sum(p[1] for p in eave) / 4 - roof
            for p in eave:
                d.line([p, (cx, cy)], fill=c, width=2)
        label(d, ox - 160, 70, title, bold=True)
    label(d, 20, 44, f'plataforma a {TOWER["plataforma"]}H ({TOWER["plataforma"] * H:.0f} px) · pé-direito {TOWER["pe_direito"]}H até o beiral · telhado {TOWER["telhado"]}H · total {(sum(TOWER.values())):.1f}H ({sum(TOWER.values()) * H:.0f} px) — hoje: 82 px, beiral a ~0,7H da plataforma')
    # torre de hoje na mesma escala, para comparar
    cur = Image.open(art_file('tower')).convert('RGBA')
    w = 48 * Z
    cur = cur.resize((w, round(cur.height * w / cur.width)), Image.NEAREST)
    can2 = Image.new('RGBA', (can.width + 340, can.height), (88, 136, 66, 255))
    can2.alpha_composite(can, (0, 0))
    ox, oy = can.width + 170, 760
    can2.alpha_composite(cur, (ox - cur.width // 2, oy + 4 * Z - cur.height))
    put_ninja(can2, ox + 40 * Z, oy)
    label(ImageDraw.Draw(can2), can.width + 20, 70, 'hoje (mesma escala)', bold=True)
    can2.save(OUT / 'torre-camadas.png')


def pixel_comparacao():
    # da imagem original do Codex (alta resolução): reduzir a arte do jogo (pixel de ~1,9 px) não mostraria o detalhe
    src = ROOT / 'docs' / 'arte' / 'iso' / 'house-2.png'
    house = Image.open(src if src.exists() else art_file('house-2')).convert('RGBA')
    house = house.crop(house.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox())
    gw = 96  # largura do losango 2×2 na cena
    can = Image.new('RGBA', (1400, 560), (88, 136, 66, 255))
    d = ImageDraw.Draw(can)
    x = 30
    for title, px in (('pixel de 1 px da cena', 1.0), ('pixel do boneco (0,54 px)', NINJA_K), ('pixel de 2 px (grosso)', 2.0)):
        n = round(gw / px)
        small = house.resize((n, round(house.height * n / house.width)), Image.BOX)
        a = np.array(small)
        a[:, :, 3] = np.where(a[:, :, 3] > 110, 255, 0)
        small = Image.fromarray(a, 'RGBA').quantize(48, method=Image.Quantize.FASTOCTREE).convert('RGBA')
        big = small.resize((gw * Z, round(small.height * gw * Z / small.width)), Image.NEAREST)
        y = 520 - big.height
        can.alpha_composite(big, (x, y))
        put_ninja(can, x + big.width + 40, 520)
        label(d, x, 16, title, bold=True)
        label(d, x, 40, f'casa 2x2 com {n} px de largura no jogo')
        x += big.width + 120
    can.save(OUT / 'pixel-comparacao.png')


def piloto_comparacao():
    """Antes × depois de cada peça do piloto (scripts/pilot-art.py) na escala do jogo, sobre o losango do terreno, com o
    ninja ao lado; a torre nova montada (base, vigia a 100% no ponto da plataforma, topo)."""
    import json
    import re
    meta_p = ROOT / 'docs' / 'arte' / 'piloto' / 'meta.json'
    if not meta_p.exists():
        return
    meta = json.loads(meta_p.read_text(encoding='utf8'))
    final = ROOT / 'docs' / 'arte' / 'piloto' / 'final'
    art_src = (ROOT / 'src' / 'render' / 'art.ts').read_text(encoding='utf8')
    blk = art_src[art_src.index('export const ART_SCALE'):]
    blk = blk[:blk.index('};')]
    art_scale = {m.group(1) or m.group(2): float(m.group(3)) for m in re.finditer(r"(?:'([\w-]+)'|(\b[a-z][\w]*)):\s*([\d.]+)", blk)}
    lay = json.loads((ROOT / 'src' / 'data' / 'layout.json').read_text(encoding='utf8'))['arts']
    node_h = {'tree0': 48, 'tree1': 48, 'stump0': 20, 'stump1': 20, 'rock': 22, 'rock-cracked': 22, 'rock-pebbles': 11, 'ore': 26, 'ore-empty': 22}
    Zc = 3
    cards = []
    for name, m in meta.items():
        w, h = m['tiles']
        cw_ = 2 * ((w + h) * 24 + 70) * Zc + 60
        tall = 250 if (w + h) > 2 else 120
        can = Image.new('RGBA', (cw_, tall * Zc), (88, 136, 66, 255))
        d = ImageDraw.Draw(can)
        for j, (title, path, sc, dx, dy, nh) in enumerate((
            ('hoje', art_file(name), art_scale.get(name, 1) * (lay.get(name, {}).get('scale', 1)), lay.get(name, {}).get('dx', 0), lay.get(name, {}).get('dy', 0), node_h.get(name)),
            ('novo', final / f'{name}.png', m['scale'], m['dx'], m['dy'], None),
        )):
            if not Path(path).exists():
                continue
            im = Image.open(path).convert('RGBA')
            ox = (j + 0.5) * cw_ / 2
            oy = can.height - 30 * Zc
            dia = iso(w, h, ox, oy, Zc)
            d.polygon(dia, outline=(0, 255, 255, 255))
            if nh and j == 0:  # objeto (árvore, rocha) hoje: pela altura fixa do jogo
                hh = nh * Zc
                ww = im.width * hh / im.height
                left, top = ox - ww / 2, oy + 0.2 * 24 * Zc - hh
            elif j == 1 and name in node_h:  # objeto novo: tamanho natural na grade do boneco
                ww, hh = im.width * NINJA_K * Zc, im.height * NINJA_K * Zc
                left, top = ox + dx * Zc - ww / 2, oy + (4 + dy) * Zc - hh
            else:
                ww = (w + h) * 24 * sc * Zc
                hh = ww * im.height / im.width
                left, top = ox + dx * Zc - ww / 2, oy + (4 + dy) * Zc - hh
            big = im.resize((max(1, round(ww)), max(1, round(hh))), Image.NEAREST)
            can.alpha_composite(big, (round(left), round(top)))
            if j == 1 and name == 'tower':
                gx, gy = m['marks']['guard']
                put_ninja(can, round(ox + dx * Zc + gx * Zc), round(top + hh + gy * Zc), Zc)
                topp = final / 'tower-top.png'
                if topp.exists():
                    t2 = Image.open(topp).convert('RGBA').resize(big.size, Image.NEAREST)
                    can.alpha_composite(t2, (round(left), round(top)))
            put_ninja(can, round(ox + (w + h) * 13 * Zc), oy + 2 * Zc, Zc)
            label(d, round(ox - 60), 10, f'{name} — {title}', bold=True)
        cards.append(can)
    if not cards:
        return
    per = 3
    cwm = max(c.width for c in cards)
    rows = [cards[i:i + per] for i in range(0, len(cards), per)]
    out = Image.new('RGBA', (cwm * per + 8 * per, sum(max(c.height for c in r) + 8 for r in rows)), (30, 30, 30, 255))
    y = 0
    for r in rows:
        for j, c in enumerate(r):
            out.alpha_composite(c, (j * (cwm + 8), y))
        y += max(c.height for c in r) + 8
    out.save(OUT / 'piloto-comparacao.png')
    print('ok piloto-comparacao.png')


OUT.mkdir(parents=True, exist_ok=True)
if '--piloto' in sys.argv:
    piloto_comparacao()
    sys.exit()
gabarito_alturas()
torre_camadas()
pixel_comparacao()
print('ok', OUT.relative_to(ROOT).as_posix())
