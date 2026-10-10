# Peças do kit de interface (src/art/ui/kit, já limpas no editor de sprites) → arte pronta para 9-slice (CSS
# border-image) em src/art/ui/frame/. Imprime as fatias (px) que o styles.css usa.
#   dialog        avisos/confirmações (#alertbox): pergaminho com moldura de madeira; a faixa do título sai do meio da
#                 borda de cima (a borda fica lisa para esticar) e vira dialog-title, que estica à parte (3-slice)
#   banner        faixa vermelha do alerta "Inimigos na sua vila" (sem o X: o alerta não fecha, ele leva até a luta)
#   bar-track     trilho das barras (madeira com friso), sem o preenchimento
#   bar-orange / bar-red / bar-blue   preenchimentos (progresso e XP / vida / chakra)
# Uso: python scripts/prepare-kit.py
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KIT = os.path.join(ROOT, 'src', 'art', 'ui', 'kit')
DST = os.path.join(ROOT, 'src', 'art', 'ui', 'frame')


def load(name):
    return Image.open(os.path.join(KIT, f'{name}.png')).convert('RGBA')


def save(im, name):
    im.save(os.path.join(DST, f'{name}.png'), optimize=True)


def fill_cols(im, x0, x1, src_x, y0=0, y1=None):
    """Troca as colunas x0..x1 (linhas y0..y1) por cópias da coluna src_x."""
    y1 = im.height if y1 is None else y1
    col = im.crop((src_x, y0, src_x + 1, y1))
    for x in range(x0, x1):
        im.paste(col, (x, y0))


os.makedirs(DST, exist_ok=True)

# --- diálogo: fatias de cima/direita/baixo/esquerda e a faixa do título
D_TOP, D_RIGHT, D_BOTTOM, D_LEFT = 66, 44, 36, 30
RIBBON = (60, 240)  # colunas da faixa do título (com os dois rolinhos)
dlg = load('janela-confirmar')
title = dlg.crop((RIBBON[0], 0, RIBBON[1], D_TOP))
plain = dlg.copy()
fill_cols(plain, D_LEFT, plain.width - D_RIGHT, 50, 0, D_TOP)  # borda de cima lisa (coluna entre o canto e a faixa)
# miolo (a parte que estica): cada linha vira um degradê entre as cores das bordas dele; some a mancha clara que
# sobrou da limpeza do texto e o esticado fica liso
px = plain.load()
L0, R1 = D_LEFT, plain.width - D_RIGHT
for y in range(D_TOP, plain.height - D_BOTTOM):
    lc = [sum(px[x, y][c] for x in range(L0, L0 + 6)) / 6 for c in range(4)]
    rc = [sum(px[x, y][c] for x in range(R1 - 6, R1)) / 6 for c in range(4)]
    for x in range(L0 + 6, R1 - 6):
        t = (x - L0 - 6) / max(1, R1 - L0 - 12)
        px[x, y] = tuple(round(lc[c] + (rc[c] - lc[c]) * t) for c in range(4))
save(plain, 'dialog')
save(title, 'dialog-title')
print(f'dialog {plain.width}x{plain.height}: fatias {D_TOP} {D_RIGHT} {D_BOTTOM} {D_LEFT}; '
      f'dialog-title {title.width}x{title.height}: pontas 26 px, começa em x={RIBBON[0]}')

# --- faixa do alerta: tira o X (colunas dele viram o vermelho liso de antes dele)
ban = load('aviso-toast')
fill_cols(ban, 312, 359, 300)
save(ban, 'banner')
print(f'banner {ban.width}x{ban.height}: esquerda 82, direita 26')

# --- barras: o trilho é a barra laranja sem o laranja; o laranja vira o preenchimento
bar = load('barra-laranja')
track = bar.copy()
fill_cols(track, 7, 102, 150)
save(track, 'bar-track')
save(bar.crop((7, 6, 100, 24)), 'bar-orange')
save(load('barra-vida'), 'bar-red')
save(load('barra-chakra'), 'bar-blue')
print(f'bar-track {track.width}x{track.height}: pontas 10 px, trilho de y=6 a 24')
