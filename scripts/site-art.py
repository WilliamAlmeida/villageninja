"""Prepara a arte do site (server/site/img) a partir dos originais em server/site/img/raw (fora do git).

  python scripts/site-art.py

- Cenas (Codex, 1536x1024) viram .webp: hero, village, battle, arena.
- region: recorte do mapa da janela Mundo de um print do jogo (region-shot.jpg).
- Emblema: PNG transparente recortado em 64, 256 e 512 px (ícone, cabeçalho, OG).
- Botão de jogar: recortado ao conteúdo (fundo já transparente pelo remove-bg).
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent / 'server' / 'site' / 'img'
RAW = ROOT / 'raw'

SCENES = {'hero': 'hero2.png', 'village': 'village-clean.png', 'battle': 'battle2.png', 'arena': 'arena-night.png'}


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
    src = first(file, file.replace('2.png', '.png'))
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

emb = first('emblem2.png', 'emblem.png')
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
