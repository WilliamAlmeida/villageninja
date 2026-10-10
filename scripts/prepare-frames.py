# Molduras da interface em 9-slice (CSS border-image), geradas pelo Codex em docs/arte/ui/frame/ e gravadas em
# src/art/ui/frame/. Recorta pelo contorno, reduz para perto do tamanho do pixel da arte (vizinho mais próximo, a
# interface amplia com image-rendering: pixelated) e imprime as fatias (px da saída) para o styles.css.
#   dock-bar      barra dos botões de baixo: pergaminho enrolado nas duas pontas, miolo esticável
#   window-frame  moldura das janelas: cantos com cantoneiras, bordas lisas (o miolo é a cor do CSS, não a imagem)
# Uso: python scripts/prepare-frames.py
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'docs', 'arte', 'ui', 'frame')
DST = os.path.join(ROOT, 'src', 'art', 'ui', 'frame')
SCALE = 3  # px da arte gerada por px da saída (a geração desenha "pixels" de ~3–4 px)


def crop(name):
    im = Image.open(os.path.join(SRC, f'{name}.png')).convert('RGBA')
    return im.crop(im.getbbox())


def small(im):
    return im.resize((round(im.width / SCALE), round(im.height / SCALE)), Image.NEAREST)


os.makedirs(DST, exist_ok=True)

# barra: onde termina o pergaminho da esquerda e começa o da direita = primeira/última coluna com a altura só da barra
bar = crop('dock-bar')
a = bar.split()[3]
mid = bar.width // 2
band = [y for y in range(bar.height) if a.getpixel((mid, y)) > 128]
top, bot = min(band), max(band)


def height(x):
    ys = [y for y in range(bar.height) if a.getpixel((x, y)) > 128]
    return (min(ys), max(ys)) if ys else (0, bar.height)


left = next(x for x in range(bar.width) if height(x) == (top, bot))
right = next(x for x in range(bar.width - 1, -1, -1) if height(x) == (top, bot))
# miolo: uma faixa estreita do meio repetida (sem nenhum detalhe do gerador que, esticado, viraria risco)
out = Image.new('RGBA', (left + 24 + (bar.width - right - 1), bar.height), (0, 0, 0, 0))
out.paste(bar.crop((0, 0, left, bar.height)), (0, 0))
strip = bar.crop((mid, 0, mid + 1, bar.height))
for x in range(24):
    out.paste(strip, (left + x, 0))
out.paste(bar.crop((right + 1, 0, bar.width, bar.height)), (left + 24, 0))
s = small(out)
s.save(os.path.join(DST, 'dock-bar.png'), optimize=True)
k = s.height / out.height
print(f'dock-bar {s.width}x{s.height}: esquerda {round(left * k)} px, direita {round((bar.width - right - 1) * k)} px, '
      f'barra de {round(top * k)} a {round(bot * k)} px de {s.height}')

# moldura: os quatro cantos + uma faixa das bordas; o miolo vira transparente (o CSS pinta a cor lisa)
fr = crop('window-frame')
fa = fr.split()[3]
cy = fr.height // 2
gold = lambda p: p[3] > 128 and p[0] > 150 and p[1] > 100 and p[2] < 110
# espessura da borda, pela coluna do meio de cima: madeira (do 1º px opaco) e o friso dourado até o contorno escuro dele
col = [fr.getpixel((fr.width // 2, y)) for y in range(fr.height // 3)]
edge = next(y for y, p in enumerate(col) if p[3] > 128)
trim = next(y for y, p in enumerate(col) if gold(p))
inner = next(y for y in range(trim, len(col)) if not gold(col[y]) and sum(col[y][:3]) < 30) + 2
# canto: até onde a cantoneira dourada vai por cima da madeira (entre a beirada e o friso)
corner = max(x for x in range(fr.width // 2) for y in range(edge + 2, trim - 3) if gold(fr.getpixel((x, y)))) + 4
corner = max(corner, inner)
N = corner * 2 + 24
frame = Image.new('RGBA', (N, N), (0, 0, 0, 0))
w, h = fr.size
for (sx, sy, dx, dy) in [(0, 0, 0, 0), (w - corner, 0, N - corner, 0), (0, h - corner, 0, N - corner), (w - corner, h - corner, N - corner, N - corner)]:
    frame.paste(fr.crop((sx, sy, sx + corner, sy + corner)), (dx, dy))
# bordas: uma linha/coluna do meio repetida
top_e = fr.crop((w // 2, 0, w // 2 + 1, corner))
bot_e = fr.crop((w // 2, h - corner, w // 2 + 1, h))
lef_e = fr.crop((0, h // 2, corner, h // 2 + 1))
rig_e = fr.crop((w - corner, h // 2, w, h // 2 + 1))
for i in range(24):
    frame.paste(top_e, (corner + i, 0))
    frame.paste(bot_e, (corner + i, N - corner))
    frame.paste(lef_e, (0, corner + i))
    frame.paste(rig_e, (N - corner, corner + i))
# o miolo da borda (dentro do friso) fica transparente: a janela pinta o fundo dela
px = frame.load()
for y in range(N):
    for x in range(N):
        if inner <= x < N - inner and inner <= y < N - inner:
            # mantém só as cantoneiras que entram no miolo (dourado/escuro de contorno perto do canto)
            near = (x < corner or x >= N - corner) and (y < corner or y >= N - corner)
            if not near:
                px[x, y] = (0, 0, 0, 0)
            elif not gold(px[x, y]) and sum(px[x, y][:3]) > 60:
                px[x, y] = (0, 0, 0, 0)
s = small(frame)
s.save(os.path.join(DST, 'window-frame.png'), optimize=True)
k = s.width / frame.width
print(f'window-frame {s.width}x{s.height}: fatia {round(corner * k)} px, borda {round(inner * k)} px')
