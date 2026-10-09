# Dá FOLGA (margem transparente) aos quadros das folhas de personagem e bicho em src/art, sem mudar como aparecem no
# jogo: grava no layout.json a altura do corpo (`body` = a altura antiga do quadro) e a origem (`foot` = o meio da base
# antiga). Com folga, o editor de sprites deixa desenhar além do contorno (cauda, asa, arma) e ajustar a origem.
# Não refaz da fonte: reempacota o PNG atual (mantém o que foi editado à mão). Folha que já tem `body` no layout é pulada.
# Uso: python scripts/pad-sheets.py [nome ...]
import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / 'src' / 'art'
LAYOUT = ROOT / 'src' / 'data' / 'layout.json'
COLS, ROWS = 4, 3
# folga em fração do quadro: lados, topo (cabeça, orelhas, asas) e base (pés que passam do chão)
SIDE, TOP, BOTTOM = 0.25, 0.3, 0.1
# o boneco em camadas (ninja-body + layer-*) tem geometria própria e fica de fora
SHEETS = ['villager', 'rogue', 'villager-chop', 'villager-mine', 'villager-farm', 'tower-guard', 'boar', 'wolf', 'bear', 'snake', 'crow',
          'monkey', 'spider', 'tiger', 'rhino', 'hydra', 'golem', 'puppet', 'dog', 'dog-white', 'dog-pug', 'dog-bull', 'toad', 'slug',
          *[f'org-{m}' for m in ('goen', 'tetsuo', 'mizuchi', 'raiga', 'kagero', 'shiryo', 'tsuchigumo', 'yomi')],
          *[f'sound-{m}' for m in ('iwao', 'kumomaru', 'kanade', 'sokon', 'hakkotsu')]]


def pad_sheet(im, fw, fh):
    """Reempacota a folha com folga; devolve a nova imagem, o novo quadro e a origem (pés) no quadro."""
    l, t, b = round(fw * SIDE), round(fh * TOP), round(fh * BOTTOM)
    nfw, nfh = fw + 2 * l, fh + t + b
    out = Image.new('RGBA', (nfw * COLS, nfh * ROWS), (0, 0, 0, 0))
    for r in range(ROWS):
        for c in range(COLS):
            out.paste(im.crop((c * fw, r * fh, (c + 1) * fw, (r + 1) * fh)), (c * nfw + l, r * nfh + t))
    return out, nfw, nfh, [l + fw / 2, t + fh]


def main(names):
    lay = json.loads(LAYOUT.read_text(encoding='utf8'))
    arts = lay.setdefault('arts', {})
    for n in names:
        a = arts.setdefault(n, {})
        if 'body' in a:
            print(f'{n}: já tem folga (body {a["body"]}), pulada')
            continue
        p = ART / f'{n}.png'
        im = Image.open(p).convert('RGBA')
        if im.width % COLS or im.height % ROWS:
            print(f'{n}: tamanho {im.size} não divide na grade 4x3, pulada')
            continue
        fw, fh = im.width // COLS, im.height // ROWS
        out, nfw, nfh, foot = pad_sheet(im, fw, fh)
        if 'points' in a:  # pontos (px da imagem) acompanham o quadro
            for key, pts in a['points'].items():
                for i, pt in enumerate(pts):
                    if pt:
                        r, c = divmod(i, COLS)
                        pts[i] = [pt[0] - c * fw + c * nfw + (nfw - fw) // 2, pt[1] - r * fh + r * nfh + round(fh * TOP)]
        out.save(p, optimize=True)
        a['body'] = fh
        a['foot'] = foot
        print(f'{n}: quadro {fw}x{fh} -> {nfw}x{nfh}, origem {foot}')
    LAYOUT.write_text(json.dumps(lay, indent=1, ensure_ascii=False) + '\n', encoding='utf8')


if __name__ == '__main__':
    main(sys.argv[1:] or SHEETS)
