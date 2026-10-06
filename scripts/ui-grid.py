# Gera VÁRIOS assets de interface numa imagem só pelo Codex (economiza cota: 16 ícones = 1 geração) e fatia.
# A imagem sai em grade (colunas × linhas) com um item por casa, centrado e com margem; cada casa vira
# docs/arte/ui/<grupo>/<nome>.png com o fundo removido. Depois: python scripts/prepare-ui.py.
#
# Uso: python scripts/ui-grid.py <grupo> <ref.png> "nome: descrição" "nome: descrição" ... [--cols 4] [--size 1024x1024]
#   ex.: python scripts/ui-grid.py icons docs/arte/ui/icons/ryo.png "bow: a wooden bow" "rope: a coiled rope"
# Até cols×linhas itens por chamada (padrão 4×4 = 16). Itens que já existem são pulados.
import math
import os
import subprocess
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
args = sys.argv[1:]


def flag(name, default):
    if name in args:
        i = args.index(name)
        v = args[i + 1]
        del args[i:i + 2]
        return v
    return default


cols = int(flag('--cols', '4'))
size = flag('--size', '1024x1024')
group, ref, *items = args
items = [tuple(x.split(':', 1)) for x in items]
items = [(n.strip(), d.strip()) for n, d in items if not os.path.exists(os.path.join(ROOT, 'docs', 'arte', 'ui', group, f'{n.strip()}.png'))]
if not items:
    sys.exit('nada a gerar')
rows = math.ceil(len(items) / cols)
sheet = os.path.join(ROOT, 'docs', 'arte', 'ui', 'grids', f'{group}-{items[0][0]}.png')
os.makedirs(os.path.dirname(sheet), exist_ok=True)
cells = '\n'.join(f'Row {i // cols + 1}, column {i % cols + 1}: {d}.' for i, (_, d) in enumerate(items))
desc = (
    f'A SHEET of {len(items)} separate pixel art game UI icons arranged in a strict grid of {cols} columns and {rows} rows, '
    'every cell the same size, ONE item centered in each cell, each item filling about 70% of its cell with clear empty '
    'white space between items (items never touch or overlap the cell borders). Same style for all items, matching the '
    'attached reference exactly (16-bit look, crisp dark outline, 3-4 flat shades with a bright highlight, front view). '
    'Pure white background, no grid lines, no labels, no text, no shadows.\n' + cells
)
r = subprocess.run(['node', 'scripts/codex-image.mjs', sheet, desc, '--ref', ref, '--size', size], cwd=ROOT, capture_output=True, text=True, shell=os.name == 'nt')
print((r.stdout or '').strip().splitlines()[-1:] or r.stderr)
if not os.path.exists(sheet):
    sys.exit('falhou: veja ' + sheet + '.codex.txt')

# fatia pela grade; em cada casa recorta pelo contorno do que sobrou depois de tirar o fundo
im = Image.open(sheet).convert('RGBA')
cw, ch = im.width / cols, im.height / rows
out = os.path.join(ROOT, 'docs', 'arte', 'ui', group)
os.makedirs(out, exist_ok=True)
for i, (name, _) in enumerate(items):
    x, y = (i % cols) * cw, (i // cols) * ch
    cell = im.crop((round(x), round(y), round(x + cw), round(y + ch)))
    box = cell.getbbox()
    if not box:
        print('vazio:', name)
        continue
    cell.crop(box).save(os.path.join(out, f'{name}.png'))
    print('ok', name)
