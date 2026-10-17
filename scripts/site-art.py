"""Prepara a arte do site (server/site/img) a partir dos originais em server/site/img/raw (fora do git).

  python scripts/site-art.py

- Cenas (Codex, 1536x1024) viram .webp: hero, village, battle, arena.
- region: recorte do mapa da janela Mundo de um print do jogo (region-shot.jpg).
- Emblema: PNG transparente recortado em 64, 256 e 512 px (ícone, cabeçalho, OG).
- Botão de jogar: recortado ao conteúdo (fundo já transparente pelo remove-bg).
- Pergaminho da abertura: folha de 8 quadros (640x300 cada) montada do rolo (scroll-roller.png) e do papel
  (scroll-paper.png): os dois rolos se afastam e o papel aparece do meio; o emblema surge nos últimos quadros.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent / 'server' / 'site' / 'img'
RAW = ROOT / 'raw'

# prints reais do jogo (server/site/img/screenshots, recortados sem HUD) valem mais que a arte inventada para vila e arena
SCENES = {'hero': 'hero2.png', 'village': 'shot-village-day.png', 'battle': 'battle3.png', 'arena': 'shot-arena-2.png', 'duel': 'duel3.png', 'night': 'shot-village-night.png'}


def first(*names):
    for n in names:
        if (RAW / n).exists():
            return RAW / n
    return None


def scene(name, src):
    im = Image.open(src).convert('RGB')
    im.save(ROOT / f'{name}.webp', 'WEBP', quality=86, method=6)
    print(f'{name}.webp {im.size}')


def trim(im):
    box = im.getchannel('A').getbbox()
    return im.crop(box) if box else im


for name, file in SCENES.items():
    src = first(file, file.replace('3.png', '2.png'), file.replace('2.png', '.png'))
    if src:
        scene(name, src)

shot = RAW / 'region-shot.jpg'
if shot.exists():
    im = Image.open(shot).convert('RGB')
    # área do mapa dentro da janela Mundo (print 1568x705 da vitrine)
    im = im.crop((335, 106, 1235, 661))
    im = im.resize((im.width * 2, im.height * 2), Image.NEAREST)
    im.save(ROOT / 'region.webp', 'WEBP', quality=88, method=6)
    print('region.webp', im.size)

emb = first('emblem3.png', 'emblem2.png', 'emblem.png')
if emb:
    im = trim(Image.open(emb).convert('RGBA'))
    side = max(im.size)
    sq = Image.new('RGBA', (side, side))
    sq.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
    for s in (64, 256, 512):
        sq.resize((s, s), Image.LANCZOS if s < side else Image.NEAREST).save(ROOT / f'emblem-{s}.png', optimize=True)
    print('emblem', sq.size)

btn = RAW / 'play-button.png'
if btn.exists():
    im = trim(Image.open(btn).convert('RGBA'))
    im = im.resize((im.width // 2, im.height // 2), Image.LANCZOS)
    im.save(ROOT / 'play-button.png', optimize=True)
    print('play-button', im.size)

roller, paper_src = RAW / 'scroll-roller.png', RAW / 'scroll-paper.png'
if roller.exists() and paper_src.exists() and (ROOT / 'emblem-256.png').exists():
    FW, FH, N = 640, 300, 8
    roll = trim(Image.open(roller).convert('RGBA'))
    rh = FH - 8
    rw = round(roll.width * rh / roll.height)
    roll = roll.resize((rw, rh), Image.LANCZOS)
    ph = round(rh * 0.78)  # altura do papel = o miolo do rolo, sem as pontas
    pw = FW - 2 * rw + 8  # o papel entra um pouco sob os rolos
    paper = Image.open(paper_src).convert('RGBA').resize((pw, ph), Image.LANCZOS)
    es = round(ph * 0.72)
    emb = Image.open(ROOT / 'emblem-256.png').convert('RGBA').resize((es, es), Image.LANCZOS)
    sheet = Image.new('RGBA', (FW * N, FH), (0, 0, 0, 0))
    for k in range(N):
        w = round((1 - (1 - k / (N - 1)) ** 3) * pw)  # desenrola rápido e freia no fim
        cx = k * FW + FW // 2
        if w > 0:
            x0 = (pw - w) // 2
            p = paper.crop((x0, 0, x0 + w, ph))
            if k >= N - 3:
                e = emb.copy()
                e.putalpha(e.getchannel('A').point(lambda v, a=(k - (N - 4)) / 3: int(v * a)))
                layer = Image.new('RGBA', p.size, (0, 0, 0, 0))
                layer.alpha_composite(e, ((w - es) // 2, (ph - es) // 2))
                p.alpha_composite(layer)
            sheet.alpha_composite(p, (cx - w // 2, (FH - ph) // 2))
        half = w // 2 - 4
        sheet.alpha_composite(roll, (cx - half - rw, (FH - rh) // 2))
        sheet.alpha_composite(roll, (cx + half, (FH - rh) // 2))
    sheet.quantize(256, method=Image.FASTOCTREE, dither=Image.NONE).save(ROOT / 'scroll-sheet.png', optimize=True)
    print('scroll-sheet', sheet.size)
