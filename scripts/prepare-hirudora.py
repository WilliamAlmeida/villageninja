"""Prepara a folha do Hirudora (tigre de ar) gerada pelo Codex para o jogo.

Fonte: docs/arte/jutsus/hirudora/hirudora-source.png, grade 2 colunas x 4 linhas (8 quadros em loop, ordem de
leitura), tigre voando para a direita sobre fundo verde puro (#00FF00): o tigre é branco-azulado, então a remoção de
fundo branco do codex-image.mjs comeria os brilhos dele.

Saída: src/art/effects/projectile-hirudora.png, 2x4 células de CELL_W x CELL_H. Todos os quadros com a MESMA escala,
alinhados pelo focinho (ponta mais à direita) e pelo centro da cabeça, que ficam no mesmo ponto de cada célula (a
âncora do jutsu-fx.json: anchorX = SNOUT_X / CELL_W, anchorY = 0,5). Confere quadro vazio e folga nas bordas.

    python scripts/prepare-hirudora.py [fonte.png]
"""
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'docs/arte/jutsus/hirudora/hirudora-source.png'
OUT = ROOT / 'src/art/effects/projectile-hirudora.png'
COLS, ROWS = 2, 4
CELL_W, CELL_H = 192, 64
MARGIN = 2
SNOUT_X = CELL_W - MARGIN - 1


def key_green(img: Image.Image) -> Image.Image:
    """Fundo verde vira transparente; a franja esverdeada da borda perde o verde (despill)."""
    img = img.convert('RGBA')
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if g > 110 and g - max(r, b) > 60:
                px[x, y] = (0, 0, 0, 0)
            elif g > max(r, b) + 12:
                px[x, y] = (r, max(r, b), b, a)
    return img


def frames(img: Image.Image):
    cw, ch = img.width / COLS, img.height / ROWS
    for i in range(COLS * ROWS):
        cx, cy = i % COLS, i // COLS
        yield img.crop((round(cx * cw), round(cy * ch), round((cx + 1) * cw), round((cy + 1) * ch)))


def head_point(f: Image.Image):
    """Focinho (coluna opaca mais à direita) e centro vertical da cabeça (pixels opacos nos 15% da direita)."""
    bbox = f.getchannel('A').point(lambda a: 255 if a > 128 else 0).getbbox()
    if not bbox:
        return None
    x0, y0, x1, y1 = bbox
    a = f.getchannel('A').load()
    band = x1 - max(1, (x1 - x0) * 15 // 100)
    ys = [y for x in range(band, x1) for y in range(y0, y1) if a[x, y] > 128]
    return bbox, x1, sum(ys) / len(ys)


def main():
    src = key_green(Image.open(SRC))
    parts = [(f, head_point(f)) for f in frames(src)]
    for i, (_, hp) in enumerate(parts):
        if hp is None:
            sys.exit(f'quadro {i + 1} vazio')
    # uma escala para todos: o maior quadro cabe à esquerda do focinho e acima/abaixo do centro da cabeça
    scale = 1.0
    for _, ((x0, y0, x1, y1), sx, hy) in parts:
        scale = min(scale, (SNOUT_X - MARGIN) / max(1, sx - x0), (CELL_H / 2 - MARGIN) / max(1, hy - y0), (CELL_H / 2 - MARGIN) / max(1, y1 - hy))
    sheet = Image.new('RGBA', (CELL_W * COLS, CELL_H * ROWS), (0, 0, 0, 0))
    for i, (f, ((x0, y0, x1, y1), sx, hy)) in enumerate(parts):
        crop = f.crop((x0, y0, x1, y1))
        w, h = max(1, round(crop.width * scale)), max(1, round(crop.height * scale))
        # média por área (BOX) e alfa recortado: bordas nítidas, sem meio-transparente
        small = crop.resize((w, h), Image.Resampling.BOX)
        alpha = small.getchannel('A').point(lambda a: 255 if a >= 128 else 0)
        small.putalpha(alpha)
        cell = Image.new('RGBA', (CELL_W, CELL_H), (0, 0, 0, 0))
        dx = round(SNOUT_X - (sx - x0) * scale)
        dy = round(CELL_H / 2 - (hy - y0) * scale)
        cell.alpha_composite(small, (max(0, dx), max(0, dy)))
        bb = cell.getbbox()
        if not bb:
            sys.exit(f'quadro {i + 1} ficou vazio')
        if bb[0] == 0 or bb[1] == 0 or bb[2] == CELL_W or bb[3] == CELL_H:
            sys.exit(f'quadro {i + 1} sem folga na borda: {bb}')
        sheet.alpha_composite(cell, ((i % COLS) * CELL_W, (i // COLS) * CELL_H))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT)
    print(f'ok {OUT.relative_to(ROOT)} ({sheet.width}x{sheet.height}, escala {scale:.3f}, âncora x {SNOUT_X / CELL_W:.3f} y 0.5)')


if __name__ == '__main__':
    main()
