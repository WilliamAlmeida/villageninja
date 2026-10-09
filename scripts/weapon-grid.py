# Espadas soltas (para a animação de golpe: a lâmina sai das costas e gira em volta da mão do ninja).
# Gera as 13 lâminas lendárias numa grade só pelo Codex (1 geração), cada uma VERTICAL com a lâmina para cima e o cabo
# embaixo, nas cores-chave das camadas (magenta = cabo/bainha, amarelo = segunda cor, ciano = metal) para o jogo
# recolorir com `tintPixels` como faz com a camada nas costas. Fatia a grade e grava src/art/sword-<id>.png (64 px de
# altura, nítido). O ponto do cabo (onde a mão segura) é ajustado no Editor de sprites e fica em src/data/layout.json.
#
# Uso: python scripts/weapon-grid.py [--force]
import os
import subprocess
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'docs', 'arte', 'weapons')
SHEET = os.path.join(OUT, 'swords-grid.png')
MAG, YEL, CYA = 'pure magenta (#ff00ff)', 'pure yellow (#ffee00)', 'pure cyan (#00e5ff)'
SWORDS = [
    ('zabuza', f'the Kubikiribocho executioner cleaver: a huge flat rectangular blade with a round hole near the tip and a half-moon notch on the back edge, long wrapped handle; blade ONLY {CYA}, handle wrapping ONLY {MAG}'),
    ('samehada', f'the Samehada great sword: a thick club-like blade covered in rows of small spiky scales, partly wrapped in bandages; scales ONLY {MAG}, bandages ONLY {YEL}, metal pommel ONLY {CYA}'),
    ('kiba', f'one Kiba lightning sword: a short sword with a jagged lightning-bolt shaped blade; blade ONLY {CYA}, handle ONLY {MAG}, small sparks along the edge ONLY {YEL}'),
    ('hiramekarei', f'the Hiramekarei: a broad flat blade wrapped in cloth bandages with two handles side by side at the bottom; bandages ONLY {MAG}, the two handles ONLY {YEL}, metal tip ONLY {CYA}'),
    ('nuibari', f'the Nuibari needle sword: a very long thin blade shaped like a giant sewing needle with a wire thread coiled from the eye at the handle; needle ONLY {CYA}, handle wrap ONLY {MAG}, wire ONLY {YEL}'),
    ('kabutowari', f'the Kabutowari: a big one-sided battle axe with a short chain and a small round hammer hanging from the handle; axe blade and hammer head ONLY {CYA}, handles ONLY {MAG}, chain ONLY {YEL}'),
    ('shibuki', f'the Shibuki explosive sword: a broad blade made of a rolled scroll of paper tags held in a metal frame; frame ONLY {CYA}, paper scroll ONLY {YEL}, handle ONLY {MAG}'),
    ('kusanagi', f'the Kusanagi chokuto: a straight single-edged sword drawn from its sheath, long handle; blade ONLY {CYA}, handle ONLY {MAG}, guard and pommel ONLY {YEL}'),
    ('sakumo', f'the White Light chakra sabre: a short straight tanto blade glowing white; blade ONLY {CYA}, handle wrapping ONLY {YEL}, guard ONLY {MAG}'),
    ('asuma', f'one trench knife (chakra blade): a short triple-edged blade with a knuckle-guard grip; blade ONLY {CYA}, grip ONLY {MAG}, knuckle guard ONLY {YEL}'),
    ('raijin', f'the Raijin Thunder God sword: a sword with small crackling lightning bolts along the blade; blade ONLY {CYA}, handle ONLY {MAG}, lightning ONLY {YEL}'),
    ('bee', f'one katana: a curved single-edged sword with a round guard; blade ONLY {CYA}, handle ONLY {YEL}, round guard ONLY {MAG}'),
    ('tanto', f'an ANBU tanto: a short straight sword; blade ONLY {CYA}, handle wrapping ONLY {YEL}, guard ONLY {MAG}'),
]
COLS, ROWS = 4, 4
force = '--force' in sys.argv

os.makedirs(OUT, exist_ok=True)
if force or not os.path.exists(SHEET):
    cells = '\n'.join(f'Row {i // COLS + 1}, column {i % COLS + 1}: {d}.' for i, (_, d) in enumerate(SWORDS))
    desc = (
        f'A SHEET of {len(SWORDS)} separate pixel art weapons arranged in a strict grid of {COLS} columns and {ROWS} rows '
        '(the last 3 cells of the last row stay EMPTY), every cell the same size, ONE weapon centered in each cell, drawn '
        'VERTICALLY with the blade pointing UP and the handle at the BOTTOM, held by nobody, unsheathed, filling about 80% '
        'of the cell height, clear empty white space between items. Same pixel art style as the attached reference '
        '(crisp dark outline, 3-4 flat shades, bright highlight). These are COLOR KEYS, not final colors: every part must '
        'use ONLY the exact flat color named for it (with darker and lighter shades of that same hue for shading), '
        'nothing else. Pure white background, no grid lines, no labels, no text, no shadows.\n' + cells
    )
    r = subprocess.run(['node', 'scripts/codex-image.mjs', SHEET, desc, '--ref', 'docs/arte/layers/preview-swords.png,docs/arte/layers/sword-zabuza-side.png,docs/arte/layers/sword-samehada-side.png,docs/arte/layers/sword-kabutowari-side.png', '--size', '1024x1024'], cwd=ROOT, capture_output=True, text=True, shell=os.name == 'nt')
    print((r.stdout or '').strip().splitlines()[-1:] or r.stderr)
    if not os.path.exists(SHEET):
        sys.exit('falhou: veja ' + SHEET + '.codex.txt')

# O Codex embaralhou a ordem das casas (e ignorou as cores-chave; as cores reais ficam, o tintPixels só mexe nas chaves):
# casa da grade → espada. A 13ª casa saiu outro cutelo e o tantō usa a katana (encurtada pelo SWORD_LEN do jogo).
SLICE = {'zabuza': 0, 'sakumo': 1, 'hiramekarei': 2, 'kabutowari': 3, 'kiba': 4, 'nuibari': 5, 'asuma': 6, 'raijin': 7, 'kusanagi': 8, 'samehada': 9, 'shibuki': 10, 'bee': 11}  # o tantō da ANBU só existe nas costas (layer-sword-tanto)
im = Image.open(SHEET).convert('RGBA')
cw, ch = im.width / COLS, im.height / ROWS
for name, _ in SWORDS:
    if name not in SLICE:
        continue  # tantō: só a camada das costas
    i = SLICE.get(name, SWORDS.index(next(s for s in SWORDS if s[0] == name)))
    x, y = (i % COLS) * cw, (i // COLS) * ch
    cell = im.crop((round(x), round(y), round(x + cw), round(y + ch)))
    box = cell.getbbox()
    if not box:
        print('vazio:', name)
        continue
    sw = cell.crop(box)
    sw.save(os.path.join(OUT, f'sword-{name}.png'))
    # no jogo: 64 px de altura (desenhada em ~20 px, com suavização ao encolher)
    k = 64 / sw.height
    small = sw.resize((max(1, round(sw.width * k)), 64), Image.LANCZOS)
    # tira a meia-transparência do contorno (pixel art nítido)
    px = small.load()
    for yy in range(small.height):
        for xx in range(small.width):
            r_, g_, b_, a_ = px[xx, yy]
            px[xx, yy] = (r_, g_, b_, 255 if a_ > 110 else 0)
    small.save(os.path.join(ROOT, 'src', 'art', f'sword-{name}.png'))
    print('ok', name, small.size)
