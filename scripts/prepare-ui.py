# Prepara os assets de interface gerados pelo Codex (docs/arte/ui/*) para o jogo (src/art/ui/*):
#   icons/  → 64 px (ícones pixel art; `rich()` usa o PNG no lugar do SVG quando existe)
#   seals/  → 128 px (selos de rank das missões)
#   art/    → 320 px no lado maior (kunai, animais dos Sannin, cenas)
# Recorta pelo contorno, reduz com média de blocos (mantém o pixel art limpo) e escreve src/ui/pxicons.ts com
# os imports. Uso: python scripts/prepare-ui.py
import glob
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'docs', 'arte', 'ui')
DST = os.path.join(ROOT, 'src', 'art', 'ui')
GROUPS = {'icons': 64, 'seals': 128, 'art': 320}


def prep(path, size, square):
    im = Image.open(path).convert('RGBA')
    box = im.getbbox()
    if not box:
        return None
    im = im.crop(box)
    w, h = im.size
    if square:
        side = max(w, h)
        sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
        sq.paste(im, ((side - w) // 2, (side - h) // 2))
        im = sq
        w = h = side
    k = size / max(w, h)
    return im.resize((max(1, round(w * k)), max(1, round(h * k))), Image.BOX)


names = {g: [] for g in GROUPS}
for group, size in GROUPS.items():
    out = os.path.join(DST, group)
    os.makedirs(out, exist_ok=True)
    for f in sorted(glob.glob(os.path.join(SRC, group, '*.png'))):
        name = os.path.splitext(os.path.basename(f))[0]
        im = prep(f, size, square=group != 'art')
        if im is None:
            print('vazio:', f)
            continue
        im.save(os.path.join(out, f'{name}.png'), optimize=True)
        names.setdefault(group, []).append(name)
    print(group, len(names.get(group, [])))

# módulo com os imports (o bundler do Bun resolve os PNGs)
lines = ['// Gerado por scripts/prepare-ui.py: assets de interface em pixel art (ícones, selos, ilustrações).', '']
for group, lst in names.items():
    const = group.upper()
    for n in lst:
        lines.append(f"import {group[:2]}_{n.replace('-', '_')} from '../art/ui/{group}/{n}.png';")
lines.append('')
for group, lst in names.items():
    body = ', '.join(f"'{n}': {group[:2]}_{n.replace('-', '_')}" for n in lst)
    lines.append(f'export const {group.upper()}: Record<string, string> = {{{f" {body} " if body else ""}}};')
with open(os.path.join(ROOT, 'src', 'ui', 'pxicons.ts'), 'w', encoding='utf8', newline='\n') as fh:
    fh.write('\n'.join(lines) + '\n')
print('ok src/ui/pxicons.ts')
