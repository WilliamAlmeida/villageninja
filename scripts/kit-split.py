# Separa o "Atlas de Interface Ninja" (mockup gerado pelo GPT em docs/arte/ui/) em peças soltas, uma por arquivo, em
# src/art/ui/kit/<grupo>-<nome>.png, para limpar o texto no editor de sprites e depois virar 9-slice / ícone no jogo.
# Cada peça é achada pelo contorno (alfa forte, para os halos não grudarem vizinhos) e reconhecida por um ponto dela na
# folha (tabela PIECES); as que vêm encostadas na folha têm o retângulo à mão (SPLIT). Recorta do original com 2 px de
# folga e apaga só o halo quase invisível. Peça já editada no editor (src/art/art-edits.json) não é sobrescrita
# (--force sobrescreve). Gera também src/art/ui/kit/LEIAME.md com o uso de cada peça.
# Uso: python scripts/kit-split.py [--force]
import json
import os
import sys
from collections import deque

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'docs', 'arte', 'ui', 'Atlas de Interface Ninja em Português.png')
DST = os.path.join(ROOT, 'src', 'art', 'ui', 'kit')
DOC = DST  # o índice fica junto das peças (docs/arte/ui está fora do git)
FORCE = '--force' in sys.argv

# nome → (ponto da peça na folha x, y, uso no jogo)
PIECES = {
    # HUD
    'hud-recursos': (500, 50, 'Barra de recursos do alto (#topbar): fundo + uma "pílula" por recurso. Limpar: nomes e números (o jogo escreve).'),
    'hud-dia-clima': (1090, 60, 'Relógio do dia e clima (canto de cima). Limpar: dia, hora, estação e clima.'),
    'hud-velocidade': (1300, 52, 'Pausa / 1x / 2x / 3x, configurações e menu. Limpar: 1x, 2x, 3x (os ícones de pausa/engrenagem/menu podem ficar).'),
    'dock-menu': (500, 170, 'Barra de baixo (#dock): moldura com telhado e lanternas nas pontas e um botão por tela (o do meio = ativo). Limpar: nomes e ícones dos botões; deixar um botão normal e o ativo vazios.'),
    # janelas e painéis
    'janela-missao': (240, 420, 'Janela/diálogo grande em pergaminho com título em faixa e botão fechar (popup de missão, avisos com recompensa). Limpar: título, texto, recompensas e botões.'),
    'painel-predio': (1250, 400, 'Drawer do prédio (#panel): telhado, retrato redondo, abas Geral/Melhorias, lista de números, botão Melhorar, Mover e Demolir. Limpar: todo o texto e os números.'),
    'dica-felicidade': (735, 670, 'Dica (tooltip) com seta em cima: ícone + título + texto. Limpar: título e texto.'),
    'dica-madeira': (946, 676, 'Dica (tooltip) com seta embaixo. Limpar: título e texto.'),
    'aviso-toast': (1250, 690, 'Aviso que aparece (toast): faixa vermelha com megafone e fechar. Limpar: título e texto.'),
    # cartões
    'cartao-ninja-jonin': (805, 500, 'Cartão pequeno de ninja (borda verde/roxa = patente), retrato, estrelas, barra de vida, nível. Limpar: nome, nível, número das estrelas e o retrato.'),
    'cartao-ninja-detalhe': (965, 400, 'Cartão de ninja com atributos (vida, chakra, Força, Agilidade, Inteligência). Limpar: nome, nível, números e o retrato.'),
    'linha-tarefa-1': (318, 640, 'Linha de missão/tarefa em pergaminho: ícone redondo, título, barra de progresso, recompensas e seta. Limpar: textos e números.'),
    'linha-tarefa-2': (318, 735, 'Outra linha de tarefa (ícone de prédio). Limpar: textos e números.'),
    # etiquetas, selos, barras
    'etiqueta-bonus-verde': (1175, 753, 'Etiqueta de bônus (verde = positivo). Limpar: texto.'),
    'etiqueta-bonus-roxa': (1345, 753, 'Etiqueta de bônus/título (roxa = especial). Limpar: texto.'),
    'selo-funcionando': (1274, 836, 'Selo de estado "Funcionando" (verde). Limpar: texto.'),
    'selo-construcao': (1384, 836, 'Selo de estado "Em construção" (escuro/âmbar). Limpar: texto.'),
    'selo-bloqueado': (1274, 867, 'Selo de estado "Bloqueado" (vermelho). Limpar: texto.'),
    'selo-pausado': (1384, 867, 'Selo de estado "Pausado" (cinza). Limpar: texto.'),
    'barra-verde': (150, 842, 'Barra de progresso verde (trilho + preenchimento). Limpar: número; separar trilho e preenchimento se quiser.'),
    'barra-laranja': (440, 842, 'Barra de progresso da obra (laranja). Limpar: número.'),
    'barra-vida': (1050, 833, 'Barra de vida (vermelha). Limpar: número.'),
    'barra-chakra': (1050, 857, 'Barra de chakra (azul). Limpar: número.'),
    'icone-chakra-mini': (893, 858, 'Gota de chakra pequena (ao lado da barra).'),
    'rotulo-1': (85, 809, 'Faixa de rótulo de seção (título pequeno). Limpar: texto.'),
    'rotulo-2': (410, 809, 'Faixa de rótulo de seção. Limpar: texto.'),
    'rotulo-3': (660, 809, 'Faixa de rótulo de seção. Limpar: texto.'),
    'rotulo-4': (935, 809, 'Faixa de rótulo de seção. Limpar: texto.'),
    'rotulo-5': (1253, 809, 'Faixa de rótulo de seção. Limpar: texto.'),
    'rotulo-6': (107, 888, 'Faixa de rótulo com ponta de pergaminho. Limpar: texto.'),
    'rotulo-7': (107, 1017, 'Faixa de rótulo com ponta de pergaminho. Limpar: texto.'),
    'rotulo-8': (920, 1038, 'Faixa de rótulo com ponta de pergaminho. Limpar: texto.'),
    'divisor-nuvens': (235, 1055, 'Separador ornamental (nuvens + selo no meio) entre seções.'),
}
# botões redondos (da esquerda para a direita, na linha de cima dos ícones)
ROUND = ['fechar', 'confirmar', 'esquerda', 'direita', 'cima', 'baixo', 'mais', 'menos', 'info', 'ajuda', 'config', 'menu',
         'medalha', 'estrela', 'trofeu', 'shuriken', 'carta', 'carta-aberta', 'grupo', 'alerta', 'pino-vermelho', 'pino',
         'carta-2']
# ícones em quadro (linha de baixo)
SQUARE = ['casa', 'martelo', 'bigorna', 'kunai', 'pergaminho', 'mochila', 'saco', 'madeira', 'pedra', 'ferro', 'ervas',
          'comida', 'mapa', 'binoculo', 'torii', 'estrela', 'busto']
BANNERS = ['vermelha-espiral', 'vermelha-shuriken', 'azul-fogo', 'verde-folha', 'azul-nuvem']
EMBLEMS = ['bronze', 'prata', 'ouro', 'vermelho', 'ouro-2', 'roxo-chakra', 'verde']
# encostadas na folha: retângulo à mão (x0, y0, x1, y1)
SPLIT = {
    'janela-confirmar': ((464, 249, 752, 558), 'Diálogo pequeno de confirmação (demolir, gastar…): faixa de título, texto, ilustração e Cancelar/Confirmar. Limpar: título, texto e a ilustração; botões viram peças separadas se quiser.'),
    'cartao-ninja-genin': ((753, 249, 856, 414), 'Cartão pequeno de ninja (borda vermelha). Limpar: nome, nível, estrelas e retrato.'),
    'barra-azul': ((583, 823, 820, 860), 'Barra de pesquisa/estudo (azul). Limpar: tempo.'),
    'botao-avancar': ((820, 823, 860, 860), 'Botão quadrado de avançar/acelerar (>>).'),
}


def segment(a):
    """Peças pelo contorno: caixa (x0, y0, x1, y1) de cada uma e o mapa de rótulos (qual peça é cada pixel)."""
    H, W = a.shape
    lab = np.zeros(a.shape, np.int32)
    out = []
    n = 0
    for y in range(H):
        for x in range(W):
            if a[y, x] and not lab[y, x]:
                n += 1
                q = deque([(y, x)])
                lab[y, x] = n
                x0 = x1 = x
                y0 = y1 = y
                c = 0
                while q:
                    cy, cx = q.popleft()
                    c += 1
                    x0, x1, y0, y1 = min(x0, cx), max(x1, cx), min(y0, cy), max(y1, cy)
                    for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                        if 0 <= ny < H and 0 <= nx < W and a[ny, nx] and not lab[ny, nx]:
                            lab[ny, nx] = n
                            q.append((ny, nx))
                if c > 200:
                    out.append((x0, y0, x1 + 1, y1 + 1, n))
    return out, lab


def grow(m, r):
    """Dilata a máscara r px (pega a borda suave que ficou fora do alfa forte)."""
    for _ in range(r):
        g = m.copy()
        g[1:] |= m[:-1]
        g[:-1] |= m[1:]
        g[:, 1:] |= m[:, :-1]
        g[:, :-1] |= m[:, 1:]
        m = g
    return m


im = Image.open(SRC).convert('RGBA')
arr = np.array(im)
boxes, LAB = segment(arr[:, :, 3] > 230)
edits = {}
try:
    edits = json.load(open(os.path.join(ROOT, 'src', 'art', 'art-edits.json'), encoding='utf8'))
except Exception:
    pass

found = {}
used = set()
def box_at(x, y):
    """A peça sob o ponto: a de menor caixa que o contém (a caixa de uma peça grande pode cobrir uma vizinha menor)."""
    hits = [b for b in boxes if b[0] <= x < b[2] and b[1] <= y < b[3] and LAB[y, x] == b[4]]
    hits = hits or [b for b in boxes if b[0] <= x < b[2] and b[1] <= y < b[3]]
    return min(hits, key=lambda b: (b[2] - b[0]) * (b[3] - b[1])) if hits else None

for name, (x, y, use) in PIECES.items():
    b = box_at(x, y)
    if not b:
        print('não achei', name)
        continue
    found[name] = (b, use)
    used.add(b)
row = lambda y0, y1: sorted([b for b in boxes if y0 <= b[1] <= y1 and b not in used], key=lambda b: b[0])
for names, prefix, (y0, y1), use in [
    (ROUND, 'botao', (893, 912), 'Botão redondo com ícone (ação em ícone: fechar, confirmar, setas, +/−, info, ajuda…).'),
    (SQUARE, 'icone', (958, 970), 'Ícone em quadro (atalho, recurso, item).'),
]:
    r = row(y0, y1)
    if len(r) != len(names):
        print(f'{prefix}: esperava {len(names)}, achei {len(r)}')
    for n, b in zip(names, r):
        found[f'{prefix}-{n}'] = (b, use)
        used.add(b)
r = [b for b in row(1020, 1035) if b[2] - b[0] < 90]
ban = [b for b in r if b[0] < 830]
emb = [b for b in r if b[0] > 1000]
for n, b in zip(BANNERS, ban):
    found[f'bandeira-{n}'] = (b, 'Bandeira/estandarte (clã, aba, facção).')
for n, b in zip(EMBLEMS, emb):
    found[f'emblema-{n}'] = (b, 'Emblema/distintivo (conquista, patente, título).')
for name, (b, use) in SPLIT.items():
    owner = box_at((b[0] + b[2]) // 2, (b[1] + b[3]) // 2)
    found[name] = ((*b, owner[4] if owner else 0), use)

os.makedirs(DST, exist_ok=True)
os.makedirs(DOC, exist_ok=True)
written = kept = 0
lines = ['# Kit de interface (recortado de "Atlas de Interface Ninja em Português.png")', '',
         'Gerado por `scripts/kit-split.py`. Cada peça está em `src/art/ui/kit/` e abre no editor de sprites (modo Arquivo,',
         'pasta `ui/kit`). Limpe o texto lá; o que foi salvo no editor não é sobrescrito ao rodar o script de novo.', '',
         '| Peça | Tamanho | Uso / o que limpar |', '|---|---|---|']
for name, (b, use) in sorted(found.items()):
    x0, y0, x1, y1, lid = b
    x0, y0, x1, y1 = max(0, x0 - 3), max(0, y0 - 3), min(im.width, x1 + 3), min(im.height, y1 + 3)
    a = arr[y0:y1, x0:x1].copy()
    if lid:
        # só os pixels da própria peça (e a borda suave dela): nada do vizinho que cai no mesmo retângulo
        keep = grow(LAB[y0:y1, x0:x1] == lid, 3)
        a[~keep] = 0
    a[a[:, :, 3] < 24] = 0  # halo quase invisível da remoção de fundo
    # lasquinhas soltas (pedaço do vizinho que caiu no retângulo): fica só o que tem 5%+ do maior pedaço
    if a.shape[0] * a.shape[1] < 2_000_000:
        parts, pl = segment(a[:, :, 3] > 0)
        sizes = {lid2: int((pl == lid2).sum()) for *_, lid2 in parts}
        if sizes:
            big = max(sizes.values())
            for lid2, n in sizes.items():
                if n < big * 0.05:
                    a[pl == lid2] = 0
            a[(pl == 0) & (a[:, :, 3] > 0)] = 0  # restos com menos de 200 px
    crop = Image.fromarray(a)
    crop = crop.crop(crop.getbbox())
    rel = f'ui/kit/{name}.png'
    path = os.path.join(DST, f'{name}.png')
    lines.append(f'| `{name}` | {crop.width}×{crop.height} | {use} |')
    if rel in edits and os.path.exists(path) and not FORCE:
        kept += 1
        continue
    crop.save(path, optimize=True)
    written += 1
open(os.path.join(DOC, 'LEIAME.md'), 'w', encoding='utf8').write('\n'.join(lines) + '\n')
print(f'{len(found)} peças: {written} gravadas, {kept} editadas mantidas')
