# Bustos por patente: o busto de cada penteado (src/art/bust-<penteado>.png, editado à mão pelo autor) vai como referência
# ao Codex, que redesenha o MESMO busto com o colete tático (Chunin/Jounin) ou o sobretudo de Sannin em magenta puro
# (cor-chave: o jogo pinta na cor da patente/caminho, `tintedArt` com `vest`). Saída: docs/arte/ui/busts-rank/<nome>.png
# (cru) e src/art/bust-<penteado>-<vest|coat>.png no mesmo tamanho do busto base.
# Uso: python scripts/bust-ranks.py            (gera o que falta, 4 de cada vez)
import os
import subprocess
from concurrent.futures import ThreadPoolExecutor

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'docs', 'arte', 'ui', 'busts-rank')
STYLES = ['spiky', 'ponytail', 'short', 'long', 'buns', 'bald']
KINDS = {
    'vest': 'now wearing a ninja tactical flak vest (thick padded vest with a high collar and scroll pockets on the chest) colored PURE MAGENTA #FF00FF over the blue shirt',
    'coat': 'now wearing a long open sage coat (haori) with wide lapels colored PURE MAGENTA #FF00FF over the blue shirt, with a thin golden trim on the edges',
}


def job(style: str, kind: str):
    raw = os.path.join(OUT, f'{style}-{kind}.png')
    base = os.path.join(ROOT, 'src', 'art', f'bust-{style}.png')
    if not os.path.exists(raw):
        desc = (
            'Redraw EXACTLY the attached pixel art bust portrait (same character, same face, same hair shape and green hair color, same blue '
            f'headband, same framing, same pixel art style and size), {KINDS[kind]}. Keep the magenta perfectly flat and pure (it is a color key '
            'that the game recolors), shading only with darker magenta. Pure white background, no text, no border.'
        )
        subprocess.run(['node', 'scripts/codex-image.mjs', raw, desc, '--ref', os.path.relpath(base, ROOT), '--size', '1024x1024'], cwd=ROOT, check=True)
    im = Image.open(raw).convert('RGBA')
    bb = im.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox()
    im = im.crop(bb)
    ref = Image.open(base)
    k = min(ref.width / im.width, ref.height / im.height)
    small = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    a = small.getchannel('A').point(lambda v: 255 if v > 110 else 0)  # contorno duro como o resto da pixel art
    small.putalpha(a)
    out = Image.new('RGBA', ref.size, (0, 0, 0, 0))
    out.alpha_composite(small, ((ref.width - small.width) // 2, ref.height - small.height))
    out.save(os.path.join(ROOT, 'src', 'art', f'bust-{style}-{kind}.png'), optimize=True)
    print('ok', style, kind)


os.makedirs(OUT, exist_ok=True)
with ThreadPoolExecutor(4) as ex:
    list(ex.map(lambda a: job(*a), [(s, k) for k in KINDS for s in STYLES]))
