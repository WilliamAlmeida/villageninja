# Prepara a arte gerada (docs/arte/**, fundo transparente) para o jogo, em src/art:
# recorta a margem vazia e reduz para a resolução de pixel art (o jogo amplia sem suavizar).
#   - prédios isométricos (docs/arte/iso): largura ≈ 2× o losango da base; alguns são espelhados
#     para a porta ficar sempre na parede da frente-esquerda (onde fica a porta no jogo)
#   - folhas de sprite (docs/arte/sprites, padrão de scripts/sprite-template.py): fatiadas pela grade
#     fixa 4×3, VALIDADAS (quadro vazio, tamanho, direção, ordem do ciclo) e normalizadas. Cada pedaço do desenho vai
#     inteiro para a casa onde está a maior parte dele (cauda ou chama que passa para a casa vizinha não é cortada), e o
#     quadro sai com FOLGA (scripts/pad-sheets.py): a altura do corpo e a origem vão para o layout.json
#   - natureza (docs/arte/pixel): imagem única
# Uso: python scripts/prepare-art.py      (sai com erro se alguma folha não passar na validação)
import importlib.util
import json
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageOps

_spec = importlib.util.spec_from_file_location('pad_sheets', Path(__file__).with_name('pad-sheets.py'))
pad_sheets = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(pad_sheets)

ISO = Path('docs/arte/iso')
SPRITES = Path('docs/arte/sprites')
PIXEL = Path('docs/arte/pixel')
OUT = Path('src/art')
OUT.mkdir(parents=True, exist_ok=True)
# artes editadas à mão no editor de sprites (scripts/editor.ts): não refazer a partir da fonte (só com --force)
# --only a,b: refaz só essas artes (as outras ficam como estão)
ONLY = next((set(a.split('=', 1)[1].split(',')) for a in sys.argv if a.startswith('--only=')), None)
EDITED = set() if '--force' in sys.argv else set(json.loads((OUT / 'art-edits.json').read_text())) if (OUT / 'art-edits.json').exists() else set()

# largura final (px) = 2 × largura do losango na cena = 2 × 0,75 × 32 × (w + h) tiles, vezes SCENERY_SCALE
BUILDINGS = {'hokage': 6, 'house': 4, 'lumber': 4, 'quarry': 4, 'market': 4, 'academy': 6, 'hospital': 5, 'tower': 2.6,
             'library': 5, 'missions': 4, 'ironmine': 4, 'forge': 4, 'pharmacy': 4, 'sealshop': 4, 'monument': 6,
             'farm': 6, 'training': 6, 'herbgarden': 4, 'port': 5, 'kennel': 4, 'intel': 3.2, 'puppetshop': 4, 'arena': 12}
# prédios e cenário guardados em resolução maior: o jogo os amplia pelo zoom (até 2,5×) e pela densidade da tela, e em
# 1× ficavam borrados. O jogo desenha pelo tamanho no mundo (a altura sai da proporção), então só a nitidez muda;
# abaixo do tamanho guardado o drawArt reduz com suavização. Personagens e camadas do ninja seguem em 1×.
SCENERY_SCALE = 2
FLIP = {'lumber', 'quarry', 'market', 'academy', 'tower'}
# níveis de upgrade (<tipo>-2, <tipo>-3): mesma largura e mesmo espelhamento do nível 1
for _name in list(BUILDINGS):
    for _lv in (2, 3, 4):
        if (ISO / f'{_name}-{_lv}.png').exists():
            BUILDINGS[f'{_name}-{_lv}'] = BUILDINGS[_name]
            if _name in FLIP:
                FLIP.add(f'{_name}-{_lv}')
# altura (px) do quadro na folha final — ≈ 2× a altura em que aparece no mundo
SHEETS = {'villager': (56, 'biped'), 'rogue': (56, 'biped'),
          'ninja-base': (56, 'biped'),  # corpo-base das camadas: vai para docs/arte/layers (entrada do prepare-layers.py)
          **{f'villager-{a}': (56, 'action') for a in ('chop', 'mine', 'farm')},
          'tower-guard': (56, 'action'),
          'boar': (48, 'quadruped'), 'wolf': (48, 'quadruped'), 'bear': (64, 'quadruped'), 'snake': (64, 'quadruped'), 'crow': (40, 'quadruped'), 'monkey': (48, 'quadruped'), 'spider': (52, 'quadruped'), 'tiger': (56, 'quadruped'), 'rhino': (64, 'quadruped'), 'hydra': (72, 'quadruped'), 'golem': (64, 'biped'), 'puppet': (56, 'biped'),
          'dog': (44, 'quadruped'), 'dog-white': (44, 'quadruped'), 'dog-pug': (44, 'quadruped'), 'dog-bull': (44, 'quadruped'),
          'toad': (64, 'quadruped'), 'slug': (52, 'quadruped'),
          **{f'org-{m}': (56, 'biped') for m in ('goen', 'tetsuo', 'mizuchi', 'raiga', 'kagero', 'shiryo', 'tsuchigumo', 'yomi')},
          **{f'sound-{m}': (56, 'biped') for m in ('iwao', 'kumomaru', 'kanade', 'sokon', 'hakkotsu')}}
# natureza: isométrica (docs/arte/iso), menos as ervas (docs/arte/pixel)
# folhas conferidas a olho cuja silhueta engana a detecção de direção (aranha não parece o boneco de 4 patas)
TRUST_FACING = {'spider', 'slug', 'dog-white'}
SAME_SCALE = {'chest-open': 'chest'}
SINGLE = {'ruin': 128, 'chest': 48, 'chest-open': 48, 'cave': 132, 'tree0': 96, 'tree1': 96, 'stump0': 48, 'stump1': 48, 'rock': 56, 'rock-cracked': 56, 'rock-pebbles': 56, 'ore': 56, 'ore-empty': 56, 'herb': 48}
COLS, ROWS = 4, 3
TOOL_ONLY = {'ninja-base'}
problems: list[str] = []


def mask(im, cut=40):
    return im.getchannel('A').point(lambda a: 255 if a > cut else 0)


def trim(im):
    box = mask(im).getbbox()
    return im.crop(box) if box else None


def crisp(im):
    """Borda dura: pixel art não tem transparência parcial."""
    im.putalpha(mask(im, 110))
    return im


def save(im, name, palette=False):
    if ONLY is not None and name not in ONLY:
        return False
    if f'{name}.png' in EDITED:
        print(f'{name}.png editada à mão: mantida (use --force para refazer)')
        return False
    im = crisp(im)
    if palette:  # 256 cores com transparência: segura o peso do PNG em 2× (a arte reduzida tem milhares de tons)
        im = im.quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    # o corpo-base não vai para o jogo: é só a entrada das camadas (prepare-layers.py)
    dest = Path('docs/arte/layers') if name in TOOL_ONLY else OUT
    im.save(dest / f'{name}.png', optimize=True)
    print(f'{name}.png', im.size, f'{(dest / f"{name}.png").stat().st_size / 1024:.1f} KB')
    return True


def owner_cells(src, work=420):
    """Casa (0..11) dona de cada pixel: o pedaço de desenho conectado vai inteiro para a casa onde está a maior parte
    dele, se estiver quase todo nela (70%); pedaço que liga duas casas é cortado pela grade. Rotulado numa cópia
    reduzida (rápido); a máscara volta ao tamanho original."""
    k = work / max(src.size)
    small = np.array(src.getchannel('A').resize((max(1, round(src.width * k)), max(1, round(src.height * k))), Image.NEAREST)) > 40
    h, w = small.shape
    ch, cw = h / ROWS, w / COLS
    owner = np.full((h, w), -1, np.int16)
    seen = np.zeros((h, w), bool)
    for y0, x0 in zip(*np.nonzero(small)):
        if seen[y0, x0]:
            continue
        q = deque([(y0, x0)])
        seen[y0, x0] = True
        pts = []
        while q:
            y, x = q.popleft()
            pts.append((y, x))
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < h and 0 <= nx < w and small[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    q.append((ny, nx))
        ys, xs = np.array(pts).T
        cells = np.minimum((ys / ch).astype(int), ROWS - 1) * COLS + np.minimum((xs / cw).astype(int), COLS - 1)
        counts = np.bincount(cells)
        # pedaço que liga duas casas (chamas, efeito) sem dono claro: corta pela grade, como antes
        owner[ys, xs] = counts.argmax() if counts.max() >= 0.7 * len(cells) else cells
    big = Image.fromarray(owner.astype(np.int16).astype(np.int32)).resize(src.size, Image.NEAREST)
    return np.array(big)


def cell_frame(src, owner, r, c):
    """Quadro (r, c): só os pixels da casa, mesmo os que passaram para a vizinha; recortado no contorno."""
    cw, ch = src.width / COLS, src.height / ROWS
    a = np.array(src)
    own = owner == r * COLS + c
    # pixel sem dono (fraco, fora da máscara) fica com a casa da grade
    loose = owner < 0
    gy, gx = np.mgrid[0:src.height, 0:src.width]
    loose &= (np.minimum((gy / ch).astype(int), ROWS - 1) == r) & (np.minimum((gx / cw).astype(int), COLS - 1) == c)
    a[~(own | loose)] = 0
    return trim(Image.fromarray(a, 'RGBA'))


LAYOUT_PATH = Path('src/data/layout.json')
layout_data = json.loads(LAYOUT_PATH.read_text(encoding='utf8'))
layout_changed = False


def similarity(a, b, size=(40, 40)):
    """Quanto duas silhuetas se parecem (0..1), já normalizadas para o mesmo tamanho."""
    ma, mb = mask(a).resize(size), mask(b).resize(size)
    inter = ImageChops.multiply(ma, mb).histogram()[255]
    union = ImageChops.lighter(ma, mb).histogram()[255]
    return inter / max(1, union)


def facing(f, kind, c):
    """Para que lado o quadro de lado olha: >0 direita, <0 esquerda, 0 = não dá para saber.
    Personagem: lado em que fica a pele do rosto, na cabeça (45% de cima).
    Bicho: semelhança com o boneco do gabarito (cabeça à direita) contra o boneco espelhado."""
    if kind in ('biped', 'action'):
        px, (w, h) = f.load(), f.size
        xs = [x for y in range(int(h * 0.45)) for x in range(w)
              if (p := px[x, y])[3] > 128 and p[0] > 150 and p[0] > p[1] > p[2] and p[0] - p[2] > 40]
        if len(xs) < 4:
            return 0
        d = sum(xs) / len(xs) / w - 0.5
        return d if abs(d) > 0.02 else 0
    tm = TEMPLATES[kind][c]
    a = mask(f).resize((48, 32))
    iou = lambda m: ImageChops.multiply(a, m).histogram()[255] / max(1, ImageChops.lighter(a, m).histogram()[255])
    d = iou(tm) - iou(ImageOps.mirror(tm))
    return d if abs(d) > 0.008 else 0


def template_masks(kind):
    """Silhuetas dos 4 bonecos de lado do gabarito (cinza escuro; ignora grade e linha de base)."""
    t = Image.open(f'docs/arte/gabarito-{kind}.png').convert('L')
    cw, ch = t.width // COLS, t.height // ROWS
    out = []
    for c in range(COLS):
        m = t.crop((c * cw + 4, 4, (c + 1) * cw - 4, ch - 4)).point(lambda v: 255 if v < 180 else 0)
        out.append(m.crop(m.getbbox()).resize((48, 32)))
    return out


TEMPLATES = {k: template_masks(k) for k in ('biped', 'quadruped')}


def legs_width(im):
    """Largura ocupada pelos pés (25% de baixo): pernas abertas no quadro de contato, juntas na passagem."""
    m = mask(im)
    box = m.crop((0, int(im.height * 0.75), im.width, im.height)).getbbox()
    return (box[2] - box[0]) if box else 0


for name, tiles in BUILDINGS.items():
    im = trim(Image.open(ISO / f'{name}.png').convert('RGBA'))
    if name in FLIP:
        im = ImageOps.mirror(im)
    w = round(48 * tiles * SCENERY_SCALE)
    save(im.resize((w, round(im.height * w / im.width)), Image.BOX), name, palette=True)

for name, (frame_h, kind) in SHEETS.items():
    src = Image.open(SPRITES / f'{name}.png').convert('RGBA')
    if (ONLY is not None and name not in ONLY) or f'{name}.png' in EDITED:
        continue  # não vai ser regravada (evita o trabalho de fatiar)
    owner = owner_cells(src)
    grid = [[cell_frame(src, owner, r, c) for c in range(COLS)] for r in range(ROWS)]
    bad = False
    for r, row in enumerate(grid):
        if any(f is None for f in row):
            problems.append(f'{name}: linha {r + 1} tem quadro vazio')
            bad = True
            continue
        hs = sorted(f.height for f in row)
        med = hs[len(hs) // 2]
        for c, f in enumerate(row):
            if not 0.85 <= f.height / med <= 1.15:
                problems.append(f'{name}: linha {r + 1} quadro {c + 1} com altura fora do padrão ({f.height} vs {med})')
        # folhas de ação (golpe de ferramenta): mãos e ferramenta confundem a detecção de direção; confira a olho
        if r == 0 and kind != 'action' and name not in TRUST_FACING:
            # direção: todo quadro de lado tem que olhar para a DIREITA (o jogo espelha para a esquerda).
            # 1º pela direção absoluta (rosto/cabeça); quadro ambíguo segue os vizinhos já acertados.
            dirs = [facing(f, kind, c) for c, f in enumerate(row)]
            for c, d in enumerate(dirs):
                if d < 0:
                    problems.append(f'{name}: quadro {c + 1} de lado olhava para a esquerda (espelhado)')
                    row[c] = ImageOps.mirror(row[c])
            for c, d in enumerate(dirs):
                if d != 0:
                    continue
                known = [o for i, o in enumerate(row) if dirs[i] != 0]
                if not known:
                    problems.append(f'{name}: não deu para saber a direção do quadro {c + 1} de lado (confira)')
                    continue
                same = sum(similarity(row[c], o) for o in known)
                if sum(similarity(ImageOps.mirror(row[c]), o) for o in known) > same * 1.08:
                    problems.append(f'{name}: quadro {c + 1} de lado estava virado ao contrário (espelhado)')
                    row[c] = ImageOps.mirror(row[c])
        # ordem do ciclo: colunas 1 e 3 = contato (pernas abertas), 2 e 4 = passagem (pernas juntas)
        widths = [legs_width(f) for f in row]
        contact = sorted(range(COLS), key=lambda i: -widths[i])[:2]
        if r == 0 and kind != 'action' and sorted(contact) != [0, 2]:
            passing = [i for i in range(COLS) if i not in contact]
            order = [contact[0], passing[0], contact[1], passing[1]]
            problems.append(f'{name}: ordem do ciclo de lado reordenada {[i + 1 for i in order]}')
            grid[r] = [row[i] for i in order]
    if bad:
        continue
    # mesma escala para a folha toda (mantém o tamanho relativo entre quadros)
    k = frame_h / max(f.height for row in grid for f in row)
    frames = [[f.resize((max(1, round(f.width * k)), max(1, round(f.height * k))), Image.BOX) for f in row] for row in grid]
    fw = max(f.width for row in frames for f in row)
    sheet = Image.new('RGBA', (fw * COLS, frame_h * ROWS), (0, 0, 0, 0))
    for r, row in enumerate(frames):
        for c, f in enumerate(row):  # centrado na horizontal, pés na base da célula
            sheet.paste(f, (c * fw + (fw - f.width) // 2, (r + 1) * frame_h - f.height))
    if name in TOOL_ONLY or name == 'ninja-base':
        save(sheet, name)
        continue
    # folga em volta do quadro (editar além do contorno); o jogo desenha igual pela altura do corpo e pela origem
    padded, _, _, foot = pad_sheets.pad_sheet(sheet, fw, frame_h)
    if save(padded, name):
        a = layout_data.setdefault('arts', {}).setdefault(name, {})
        a['body'] = frame_h
        a['foot'] = foot
        layout_changed = True

for name, size in SINGLE.items():
    src = (PIXEL if name == 'herb' else ISO) / f'{name}.png'
    if (ISO / f'{name}-nograss.png').exists():  # sem o chão (scripts/strip-ground.py): o jogo desenha a sombra
        src = ISO / f'{name}-nograss.png'
    im = trim(Image.open(src).convert('RGBA'))
    if name in SAME_SCALE:  # mesma escala da arte base (baú aberto = baú fechado, a tampa deixa mais alto)
        base = trim(Image.open(ISO / f'{SAME_SCALE[name]}-nograss.png').convert('RGBA'))
        f = size * SCENERY_SCALE / max(base.size)
        im = im.resize((round(im.width * f), round(im.height * f)), Image.BOX)
    else:
        im.thumbnail((size * SCENERY_SCALE, size * SCENERY_SCALE), Image.BOX)
    save(im, name, palette=True)

if layout_changed:
    LAYOUT_PATH.write_text(json.dumps(layout_data, indent=1, ensure_ascii=False) + '\n', encoding='utf8')
    print('layout.json: altura do corpo e origem das folhas refeitas')

if problems:
    print('\nVALIDAÇÃO:')
    for p in problems:
        print(' -', p)
    if any('vazio' in p for p in problems):
        sys.exit(1)
