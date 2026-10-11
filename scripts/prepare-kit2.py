# Kit limpo de interface (lote do Codex em docs/arte/ui/kit2, pixel art pronta para 9-slice) → src/art/ui/kit2/.
# Cada geração desenha o "pixel" num tamanho (PX: 4 a 16 px da imagem); a saída volta para 1 px real (a interface amplia
# por inteiro com image-rendering: pixelated). Peças que vieram em par na mesma imagem são separadas pela linha vazia.
# As cinzas (botão, preenchimento da barra, selo) ganham as cores por código: o cinza é tingido mantendo o claro/escuro,
# e o que já tem cor (aro de bronze, contorno) fica como está.
# Uso: python scripts/prepare-kit2.py
import colorsys
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'docs', 'arte', 'ui', 'kit2')
DST = os.path.join(ROOT, 'src', 'art', 'ui', 'kit2')
# tamanho do pixel de cada geração (distância mais comum entre bordas de cor na imagem)
PX = {'dialog': 9, 'title': 4, 'panel': 5, 'crest': 5, 'button': 12, 'round': 16, 'bar': 8, 'pill': 9,
      'hudbar': 4, 'dock': 4, 'slots': 9, 'card': 8, 'row': 5, 'ribbon': 5}
# cores por código (matiz 0–1, saturação): botões, preenchimentos e selos
COLORS = {
    'green': (0.36, 0.5, 0.9), 'red': (0.0, 0.7), 'orange': (0.085, 0.85), 'blue': (0.58, 0.7),
    'dark': (0.07, 0.4, 0.42), 'gray': (0.0, 0.0), 'purple': (0.76, 0.5), 'amber': (0.11, 0.75),
}


def load(name):
    im = Image.open(os.path.join(SRC, f'{name}.png')).convert('RGBA')
    im = im.crop(im.getbbox())
    a = im.split()[3].point(lambda v: 255 if v > 110 else 0)  # borda dura: sem meio-transparente
    im.putalpha(a)
    return im


def small(im, px):
    return im.resize((max(1, round(im.width / px)), max(1, round(im.height / px))), Image.NEAREST)


def split_rows(im):
    """Separa as peças empilhadas (linhas totalmente transparentes entre elas), de cima para baixo."""
    a = im.split()[3]
    rows = [any(a.getpixel((x, y)) for x in range(0, im.width, 2)) for y in range(im.height)]
    parts, start = [], None
    for y, on in enumerate(rows + [False]):
        if on and start is None:
            start = y
        elif not on and start is not None:
            if y - start > 6:
                p = im.crop((0, start, im.width, y))
                parts.append(p.crop(p.getbbox()))
            start = None
    return parts


def split_cols(im):
    """Separa as peças lado a lado (colunas transparentes entre elas), da esquerda para a direita."""
    return [p.rotate(90, expand=True) for p in split_rows(im.rotate(-90, expand=True))]


def tint(im, hue, sat, light=1.0):
    """Pinta o que é cinza (saturação baixa) com a cor, mantendo o claro/escuro (× `light`); o resto fica."""
    out = im.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if not a:
                continue
            h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
            if s > 0.22 or l < 0.12:
                continue  # aro de bronze, contorno escuro
            nr, ng, nb = colorsys.hls_to_rgb(hue, min(0.92, l * light * (0.95 if sat else 1.0)), sat)
            px[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255), a)
    return out


def save(im, name):
    im.save(os.path.join(DST, f'{name}.png'), optimize=True)
    print(f'{name}: {im.width}x{im.height}')


os.makedirs(DST, exist_ok=True)
for name in ['dialog', 'title', 'panel', 'crest', 'round']:
    save(small(load(name), PX[name]), name)
btn = small(load('button'), PX['button'])
save(btn, 'button')
for c in ['green', 'red', 'orange', 'blue', 'dark']:
    save(tint(btn, *COLORS[c]), f'button-{c}')
track, fill = [small(p, PX['bar']) for p in split_rows(load('bar'))]
save(track, 'bar-track')
save(fill, 'bar-fill')
for c in ['green', 'red', 'orange', 'blue', 'amber']:
    save(tint(fill, *COLORS[c]), f'bar-{c}')
pill, tip = [small(p, PX['pill']) for p in split_rows(load('pill'))]
save(pill, 'pill')
for c in ['green', 'red', 'amber', 'orange', 'blue', 'purple', 'gray']:
    save(tint(pill, *COLORS[c]), f'pill-{c}')
# dica: a setinha embaixo sai da caixa (no 9-slice ela esticaria); a borda de baixo fica lisa e a seta vira peça
a = tip.split()[3]
full = [y for y in range(tip.height) if sum(1 for x in range(tip.width) if a.getpixel((x, y))) > tip.width * 0.8]
bottom = full[-1] + 1
box = tip.crop((0, 0, tip.width, bottom))
arrow = tip.crop((0, bottom, tip.width, tip.height))
arrow = arrow.crop(arrow.getbbox())
col = box.crop((12, bottom - 4, 13, bottom))
for x in range(12, box.width - 12):
    box.paste(col, (x, bottom - 4))
save(box, 'tooltip')
save(arrow, 'tooltip-arrow')

# --- lote 2: barras do alto e de baixo, botões da barra de baixo, cartão por patente, linha de missão, rótulo, separador
hud, slot = [small(p, PX['hudbar']) for p in split_rows(load('hudbar'))]
save(hud, 'hud-bar')
save(slot, 'hud-slot')
save(small(load('dock'), PX['dock']), 'dock')
slot_off, slot_on = [small(p, PX['slots']) for p in split_cols(load('slots'))]
save(slot_off, 'dock-slot')
save(slot_on, 'dock-slot-on')
card, face = [small(p, PX['card']) for p in split_cols(load('card'))]
save(face, 'portrait')
# cartão pela patente (as cores dos selos de patente do jogo)
RANK = {'genin': (0.30, 0.55), 'chunin': (0.74, 0.55), 'jounin': (0.13, 0.85), 'sannin': (0.0, 0.7), 'kage': (0.075, 0.9)}
save(card, 'card')
for r, (h, sat) in RANK.items():
    save(tint(card, h, sat), f'card-{r}')
row = small(load('row'), PX['row'])
save(row, 'row')
# linha lisa (sem o marcador vermelho do canto, que estica junto com a linha): o canto esquerdo vira o espelho do direito
plain = row.copy()
plain.paste(row.crop((row.width - 26, 0, row.width, row.height)).transpose(Image.FLIP_LEFT_RIGHT), (0, 0))
save(plain, 'row-plain')
label, divider = [small(p, PX['ribbon']) for p in split_rows(load('ribbon'))]
save(label, 'label')
save(divider, 'divider')
