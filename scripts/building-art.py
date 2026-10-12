# Construções no padrão novo da arte isométrica (docs/design-arte-iso.md; o piloto aprovado pelo autor em 2026-10-12):
# uma imagem por peça no Codex (mais resolução que a folha em grade do piloto), com o GABARITO v2 como 1ª referência
# (losango exato do terreno do nível + volume da altura em ninjas + silhueta do ninja), a arte de hoje como identidade e,
# do nível 2 em diante, o nível anterior JÁ NOVO (o prédio cresce, não vira outro).
#
#   1. gera  docs/arte/predios/<lote>/_<peça>.png (+ _<peça>-gabarito.png); o que já existe não é gerado de novo
#   2. recorta o objeto principal, fixa o tamanho pela BASE (a linha mais larga do terço de baixo = largura do losango) e
#      reduz para a grade do boneco (0,536 px da cena por px, até 64 cores)       → docs/arte/predios/final/<peça>.png
#   3. grava docs/arte/predios/<lote>/meta.json (escala e deslocamento para o layout.json, altura em H)
#   4. --instalar: copia para src/art (backup das antigas, do trecho do layout e das peças/ART_SCALE em
#      docs/arte/_backup/<data>/<lote>/), põe escala/posição no layout.json, tira as peças (polígonos da arte antiga), o
#      ART_SCALE provisório e a marca de "editada à mão" das trocadas
#
# Uso: python scripts/building-art.py <lote>                (gera o que falta e processa)
#      python scripts/building-art.py <lote> --so-processar  (não chama o Codex)
#      python scripts/building-art.py <lote> --refazer=peça,… (apaga essas fontes e gera de novo)
#      python scripts/building-art.py <lote> --instalar
import datetime
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from artpaths import ART, EDITS, art_file  # noqa: E402
from iso_art import PIX, base_span, drop_specks, main_object, to_grid  # noqa: E402
from iso_template import H_SCENE, PROMPT_V2, draw_v2  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'docs' / 'arte' / 'predios'
FINAL = OUT / 'final'
# estilo do jogo no padrão novo: as casas do piloto (aprovadas)
STYLE = 'docs/arte/piloto/_casas.png'

KAGE = ('the residence and office of the village leader (the Kage): a ROUND cylindrical building with cream plaster walls '
        'and dark wooden posts, RED lacquered conical roofs in tiers with a dark round finial on top, red banners with a '
        'white flame emblem, paper lanterns; the main wooden double door faces the viewer at the FRONT')

ACADEMY = ('the Ninja Academy: cream plaster walls with dark wooden frames, ORANGE-red ceramic tiled pagoda roofs with '
           'curved eaves, red banners with a white leaf-swirl emblem, round wooden training targets near the door')
HOSPITAL = 'the village hospital: white plaster walls, GREEN ceramic tiled roofs, red cross signs, a small chimney'
LIBRARY = ('the Jutsu Library: dark wooden frames, DARK BLUE ceramic tiled roof with curved eaves, an open front showing '
           'shelves full of scrolls, paper lanterns, a low wooden fence around a small yard')
MARKET = ('the village market shop: cream walls, a flat ORANGE roof, cloth awnings over wooden stalls with crates of fruit, '
          'vegetables and goods, paper lanterns, stone paving in front')

FORGE = ('the village forge: grey stone walls with dark timber, a DARK RED tiled roof with a stone chimney, a glowing '
         'furnace mouth, an anvil, a water trough')
PHARMACY = ('a traditional ninja APOTHECARY (herbal medicine shop): dark wooden building with a curved roof of BROWN cypress '
            'bark shingles, an open shopfront with a counter and shelves of colored medicine jars and gourds, bundles of '
            'drying herbs hanging from the eaves, a big stone mortar and pestle, a PURPLE noren curtain at the door with a '
            'white round pill symbol, small planters of medicinal herbs')
SEALSHOP = ('a workshop of seal paper and paper bombs: white plaster walls with dark wood, a DARK SLATE-GREY tiled roof, '
            'white paper sheets drying on bamboo racks, paper talismans with red ink seals at the door, an ink stone')
LUMBER = 'the lumberjack camp: a log cabin with a BROWN wooden shingle roof, an axe stuck in a chopping block, stacked logs'
QUARRY = 'the stone quarry workshop: a hut of rough grey stone blocks with a stone slab roof, cut stone blocks, tools'

# lote → peças: (nome da arte, (tiles w, tiles h, altura total em H), descrição). Na ordem dos níveis: do nível 2 em
# diante cada uma usa a anterior DO MESMO PRÉDIO (já nova) como referência de "o mesmo prédio, menor". A identidade é a
# arte de hoje do prédio (todos os níveis que existirem).
BATCHES = {
    'lote1': {
        'items': [
            ('academy', (3, 3, 3.3), f'LEVEL 1: {ACADEMY}. A one-story school hall under one big hip roof, two round targets'),
            ('academy-2', (3, 3, 4.2),
             'LEVEL 2: THE SAME academy grown to two stories with a two-tier pagoda roof and a small bell turret on top, a '
             'porch with posts, banners and targets'),
            ('academy-3', (4, 4, 5.4),
             'LEVEL 3 on a BIGGER plot: a grand three-story academy with two side wings, a stone base, a courtyard gate, '
             'banners with the emblem and a bell tower; clearly bigger and richer than level 2, same style'),
            ('hospital', (3, 2, 2.8), f'LEVEL 1: {HOSPITAL}. A one-story clinic under a hip roof, the door with a red cross sign, a narrow garden strip'),
            ('hospital-2', (3, 2, 3.3),
             'LEVEL 2: THE SAME hospital grown: L-shaped with an attached side ward under its own green roof, more windows, a '
             'bench and potted plants'),
            ('hospital-3', (4, 3, 4.4),
             'LEVEL 3 on a BIGGER plot: a two-story main building with two side wings, a covered entrance porch and a small '
             'herb garden with a stone path; clearly bigger than level 2, same style'),
            ('library', (3, 2, 3.0), f'LEVEL 1: {LIBRARY}. A one-story scroll hall'),
            ('library-2', (3, 2, 3.6),
             'LEVEL 2: THE SAME library grown to two stories with a balcony on the second floor, more shelves and a reading '
             'table with scrolls in the yard'),
            ('library-3', (4, 3, 4.7),
             'LEVEL 3 on a BIGGER plot: a two-story library hall with a tall three-floor archive tower on one side, a stone '
             'base, stone lanterns and the fenced yard with a scroll rack; clearly bigger than level 2, same style'),
            ('market', (2, 2, 2.4), f'LEVEL 1: {MARKET}. A small one-story shop with one awning and two crates'),
            ('market-2', (2, 2, 2.8),
             'LEVEL 2: THE SAME shop grown on the same plot and clearly BIGGER and TALLER than level 1: a small upper loft '
             'floor with a balcony, stalls with awnings on BOTH visible sides, many more crates, baskets and sacks, a hanging '
             'wooden sign and more lanterns'),
            ('market-3', (3, 3, 3.8),
             'LEVEL 3 on a BIGGER plot: a two-story merchant house with a balcony and banners and a covered row of stalls in '
             'front with many crates, barrels and lanterns; clearly bigger than level 2, same style'),
        ],
    },
    'lote2': {
        # farmácia e selos: desenho novo (o autor não gostou da farmácia; a de selos se confundia com academia e casa)
        'redesign': ('pharmacy', 'sealshop'),
        'items': [
            ('forge', (2, 2, 2.6), f'LEVEL 1: {FORGE}. A small one-story smithy with one furnace and an anvil'),
            ('forge-2', (2, 2, 3.0),
             'LEVEL 2: THE SAME forge grown and clearly bigger: two furnaces, a taller chimney, a covered work area with a '
             'grindstone, a rack of finished swords and a water barrel'),
            ('forge-3', (3, 3, 3.7),
             'LEVEL 3 on a BIGGER plot: a large stone-and-timber forge hall with three glowing furnaces, two chimneys, a '
             'water wheel turning a big hammer, weapon racks and stacked iron ingots; clearly bigger than level 2'),
            ('pharmacy', (2, 2, 2.5), f'LEVEL 1: {PHARMACY}. A small one-story herb shop with one counter'),
            ('pharmacy-2', (2, 2, 2.9),
             'LEVEL 2: THE SAME apothecary grown: a second floor storage loft, a bamboo drying rack full of herbs on the side, '
             'more jars and gourds, potted medicinal plants'),
            ('pharmacy-3', (3, 3, 3.7),
             'LEVEL 3 on a BIGGER plot: a two-story apothecary with a small glass greenhouse full of herbs, a copper '
             'distillation still with steam, a terrace of herb planters and drying racks; clearly bigger than level 2'),
            ('sealshop', (2, 2, 2.6), f'LEVEL 1: {SEALSHOP}. A small one-story workshop with one paper rack outside'),
            ('sealshop-2', (2, 2, 3.0),
             'LEVEL 2: THE SAME workshop grown: a second floor, more bamboo racks of drying paper, a work table with ink and '
             'brushes, red-ink talismans hanging at the door'),
            ('sealshop-3', (3, 3, 3.8),
             'LEVEL 3 on a BIGGER plot: a two-story paper workshop with a side shed holding big vats of paper pulp, long '
             'drying racks of white sheets, crates of paper bombs with red seals; clearly bigger than level 2. The roof keeps '
             'EXACTLY the dark slate-GREY of the previous level (charcoal grey, NOT blue)'),
            ('lumber', (2, 2, 2.4), f'LEVEL 1: {LUMBER}. A small log cabin with a chopping block and a few logs'),
            ('lumber-2', (2, 2, 2.7),
             'LEVEL 2: THE SAME lumber camp clearly BIGGER and TALLER than level 1 on the same plot: a two-story cabin with a '
             'storage loft and a hoist beam, a covered open-sided sawing shed attached on one side with a big two-man saw, '
             'tall neat stacks of planks'),
            ('lumber-3', (3, 3, 3.4),
             'LEVEL 3 on a BIGGER plot: a sawmill with a water wheel driving the saw, a log ramp, big stacks of planks and '
             'logs; clearly bigger than level 2'),
            ('quarry', (2, 2, 2.2), f'LEVEL 1: {QUARRY}. A small stone hut with a pile of cut blocks and a pickaxe'),
            ('quarry-2', (2, 2, 2.6),
             'LEVEL 2: THE SAME quarry clearly BIGGER and TALLER than level 1 on the same plot: the hut gets a second floor '
             'of stone with a wooden balcony, a tall wooden crane lifting a block, a covered stone-cutting bench and a wheelbarrow'),
            ('quarry-3', (3, 3, 3.2),
             'LEVEL 3 on a BIGGER plot: a stone workshop with a big wooden crane, a mine cart on rails, stacks of cut blocks '
             'and gravel piles; clearly bigger than level 2'),
        ],
    },
    'kage': {
        'items': [
            ('hokage', (3, 3, 3.2),
             f'LEVEL 1 (a small hamlet): {KAGE}. A modest ONE-story round hall on a low stone base under ONE wide red conical '
             'roof, two small red banners beside the door'),
            ('hokage-2', (3, 3, 4.3),
             'LEVEL 2 (a village): THE SAME round hall grown to TWO stories: the ground floor drum and a narrower upper drum, '
             'TWO red roof tiers, a taller stone base with three steps to the door, hanging lanterns by the door, more banners'),
            ('hokage-3', (4, 4, 5.5),
             'LEVEL 3 (a hidden village) on a BIGGER plot: THE SAME building, now a grand two-story round tower-hall with a '
             'wraparound wooden balcony with railing on the second floor, a big round flame emblem over the door, TWO wide '
             'red roof tiers and a small round cupola on top, a stone stair and a low stone platform ring around the base'),
            ('hokage-4', (5, 5, 6.9),
             'LEVEL 4 (the great hidden village) on the BIGGEST plot: THE SAME building as a majestic round PAGODA PALACE of '
             'three stories with THREE red roof tiers with golden ridge ornaments and golden finial, balconies on each floor, '
             'a tall red banner with the flame emblem over the entrance, a wide stone staircase and a stone plaza ring with '
             'stone lanterns around the base; clearly the most important building of the village'),
        ],
    },
}


def canvas_for(w, h, hh):
    """Tamanho da imagem do Codex pela forma do volume (largura do losango × altura): retrato, quadrada ou paisagem."""
    width = w + h  # em passos de tile
    height = (w + h) / 2 + hh * H_SCENE / 24  # o losango + a altura (1 passo de tile = 24 px da cena)
    r = height / width
    return (1024, 1536) if r > 0.85 else (1024, 1024) if r > 0.6 else (1536, 1024)


def template(path, w, h, hh):
    """Gabarito de uma peça só, o maior que couber (largura e altura do volume dentro da imagem, com folga)."""
    W, H = canvas_for(w, h, hh)
    fill = 0.84
    for _ in range(30):
        ds = draw_v2(path, [(w, h, hh)], 1, 1, W=W, H=H, fill=fill, base=0.95)
        g = ds[0]
        top = g['by'] - (w + h) * g['unit'] / 2 - hh * H_SCENE / g['scene_k']
        if top >= H * 0.05:
            return (W, H), ds
        fill *= 0.95
    return (W, H), ds


def base_of(name):
    """Prédio da arte: 'academy-3' → 'academy'."""
    return re.sub(r'-\d+$', '', name)


def identity_sheet(batch, name):
    """As artes de hoje do prédio (todos os níveis que existirem) lado a lado: a identidade para o Codex. Lidas do
    backup quando o lote já foi instalado (aí as de src/art já são as novas)."""
    base = base_of(name)
    p = OUT / batch / f'_hoje-{base}.png'
    if p.exists():
        return p
    files = [art_file(n) for n in [base] + [f'{base}-{k}' for k in range(2, 5)]]
    ims = [Image.open(f).convert('RGBA') for f in files if f.exists()]
    hmax = max(i.height for i in ims)
    out = Image.new('RGBA', (sum(i.width for i in ims) + 40 * (len(ims) - 1), hmax), (255, 255, 255, 255))
    x = 0
    for i in ims:
        out.paste(i, (x, hmax - i.height), i)
        x += i.width + 40
    out.convert('RGB').save(p)
    return p


def generate(batch, cfg, i, item):
    name, (w, h, hh), desc = item
    src = OUT / batch / f'_{name}.png'
    tpl = OUT / batch / f'_{name}-gabarito.png'
    size, _ = template(tpl, w, h, hh)
    if src.exists():
        return src
    before = cfg['items'][i - 1][0] if i else None
    prev = OUT / batch / f'_{before}.png' if before and base_of(before) == base_of(name) else None
    # imagens de referência na ordem em que o texto as cita (a numeração muda com o que entra)
    refs = [tpl]
    parts = []
    if base_of(name) not in cfg.get('redesign', ()):
        refs.append(identity_sheet(batch, name))
        parts.append(f'Image {len(refs)} shows the CURRENT versions of this building at its levels, left to right: keep its '
                     'identity (shape, colors, emblem) but follow the new size of image 1. ')
    else:
        parts.append('This is a NEW design for this building (do not copy older versions): follow only the description. ')
    refs.append(ROOT / STYLE)
    parts.append(f'Image {len(refs)} is the art style of the game (detailed 16-bit pixel art with SMALL pixels, clean dark '
                 'outline, light from the top-left): same finish and palette. ')
    if prev:
        refs.append(prev)
        parts.append(f'Image {len(refs)} is the PREVIOUS level of this same building, already in the new style: draw the same '
                     'building grown, with the same materials, colors and details, clearly bigger and richer. ')
    text = (
        f'ONE isometric game building for a cozy ninja village builder, alone in the image. Ground footprint {w}x{h} tiles, '
        f'total height {hh:.1f} ninjas (top of the roof). {desc}. ' + ''.join(parts)
        + 'Pure white background, no ground tiles, no grass, no shadow outside the building, no text. ' + PROMPT_V2
    )
    rel = ','.join(os.path.relpath(r, ROOT) for r in refs)
    subprocess.run(['node', 'scripts/codex-image.mjs', str(src), text, '--ref', rel, '--size', f'{size[0]}x{size[1]}', '--vaos'], cwd=ROOT, check=True)
    return src


def process(batch, item, meta):
    """Recorta, fixa o tamanho pela base (= largura do losango) e reduz para a grade do boneco."""
    name, (w, h, hh), _ = item
    src = OUT / batch / f'_{name}.png'
    im = Image.open(src).convert('RGBA')
    a = np.array(im)[:, :, 3] > 40
    x0, y0, x1, y1 = main_object(a)
    crop = im.crop((x0, y0, x1, y1))
    m = np.array(crop)[:, :, 3] > 40
    span, (b0, b1) = base_span(m)
    per = (w + h) * 24 / span  # px da cena por px da imagem
    full = drop_specks(to_grid(crop, crop.width * per))
    base_dx = ((b0 + b1 + 1) / 2 - crop.width / 2) * per
    FINAL.mkdir(parents=True, exist_ok=True)
    full.save(FINAL / f'{name}.png')
    h_scene = full.height * PIX
    meta[name] = {
        'tiles': [w, h], 'target_H': hh, 'height_H': round(h_scene / H_SCENE, 2), 'img': list(full.size),
        # layout.json: largura do losango × scale; o meio da BASE na ponta da frente; a base da imagem na ponta
        'scale': round(float(full.width * PIX / ((w + h) * 24)), 4),
        'dx': round(float(-base_dx), 2),
        'dy': -4.0,
    }
    print('ok', name, full.size, meta[name])


def install(batch, cfg):
    names = [it[0] for it in cfg['items']]
    meta = json.loads((OUT / batch / 'meta.json').read_text(encoding='utf8'))
    bk = ROOT / 'docs' / 'arte' / '_backup' / datetime.date.today().isoformat() / batch
    bk.mkdir(parents=True, exist_ok=True)
    layout_p = ROOT / 'src' / 'data' / 'layout.json'
    L = json.loads(layout_p.read_text(encoding='utf8'))
    (bk / 'layout-antigo.json').write_text(json.dumps({n: L['arts'].get(n) for n in names}, indent=1, ensure_ascii=False) + '\n', encoding='utf8')
    art_ts = ROOT / 'src' / 'render' / 'art.ts'
    src_ts = art_ts.read_text(encoding='utf8')
    edits = json.loads(EDITS.read_text(encoding='utf8'))
    removed_scale = []
    for n in names:
        dst = art_file(n)
        if dst.exists():
            shutil.copy2(dst, bk / f'{n}.png')
        shutil.copy2(FINAL / f'{n}.png', dst)
        rel = dst.relative_to(ART).as_posix()
        if rel in edits:
            edits.remove(rel)
        m = meta[n]
        # escala/posição do padrão; as peças (polígonos) e o achatamento eram da arte antiga
        L['arts'][n] = {'scale': m['scale'], 'dx': m['dx'], 'dy': m['dy']}
        # ART_SCALE provisório da arte antiga sai (a escala da meta já é a final)
        pat = re.compile(rf"\s*'{re.escape(n)}': [\d.]+,|\s*\b{re.escape(n)}: [\d.]+,")
        block_a = src_ts.index('export const ART_SCALE')
        block_b = src_ts.index('};', block_a)
        block = src_ts[block_a:block_b]
        mm = pat.search(block)
        if mm:
            removed_scale.append(mm.group(0).strip())
            block = block[: mm.start()] + block[mm.end():]
            src_ts = src_ts[:block_a] + block + src_ts[block_b:]
    art_ts.write_text(src_ts, encoding='utf8')
    layout_p.write_text(json.dumps(L, indent=1, ensure_ascii=False) + '\n', encoding='utf8')
    EDITS.write_text(json.dumps(sorted(edits), indent=2, ensure_ascii=False) + '\n', encoding='utf8')
    (bk / 'LEIAME.md').write_text(
        f'# Artes trocadas pelo padrão novo (lote "{batch}", scripts/building-art.py)\n\n'
        'Como estavam em src/art antes da instalação (inclusive as editadas à mão), o trecho delas no layout.json '
        '(layout-antigo.json, com as peças e o achatamento) e o ART_SCALE que saiu de render/art.ts: '
        + (', '.join(removed_scale) or 'nenhum') + '.\nPode apagar quando quiser.\n', encoding='utf8')
    print('instalado:', ', '.join(names), '| ART_SCALE tirado:', removed_scale or '-', '| backup em', bk.relative_to(ROOT).as_posix())


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not args or args[0] not in BATCHES:
        print('lotes:', ', '.join(BATCHES))
        return
    batch = args[0]
    cfg = BATCHES[batch]
    if '--instalar' in sys.argv:
        install(batch, cfg)
        return
    (OUT / batch).mkdir(parents=True, exist_ok=True)
    redo = next((a.split('=', 1)[1].split(',') for a in sys.argv if a.startswith('--refazer=')), [])
    for n in redo:
        (OUT / batch / f'_{n}.png').unlink(missing_ok=True)
    meta = {}
    for i, item in enumerate(cfg['items']):
        if '--so-processar' not in sys.argv:
            generate(batch, cfg, i, item)
        if (OUT / batch / f'_{item[0]}.png').exists():
            process(batch, item, meta)
    (OUT / batch / 'meta.json').write_text(json.dumps(meta, indent=1, ensure_ascii=False) + '\n', encoding='utf8')


main()
