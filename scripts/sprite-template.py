# Gabarito de poses das folhas de sprite (docs/arte/gabarito-<tipo>.png).
# Ele vai como imagem de referência no prompt (scripts/sprite.mjs) e também serve de "verdade" para o
# validador (scripts/prepare-art.py), que compara cada quadro gerado com o boneco da mesma célula.
#
# PADRÃO DA FOLHA (igual para todo personagem/monstro):
#   1536×1024, grade de 4 colunas × 3 linhas, células iguais (384×341), pés na linha de base de cada célula.
#   linha 0: andando de LADO, virado para a DIREITA   (o jogo espelha para a esquerda)
#   linha 1: andando de FRENTE, vindo para a câmera  (direção "para baixo" na tela)
#   linha 2: andando de COSTAS, indo para longe       (direção "para cima" na tela)
#   colunas (ciclo de caminhada): 0 contato (perna da frente adiantada) · 1 passagem · 2 contato (outra perna) · 3 passagem
#   o quadro "parado" é a coluna 1.
# Uso: python scripts/sprite-template.py
from PIL import Image, ImageDraw

W, H, COLS, ROWS = 1536, 1024, 4, 3
CW, CH = W // COLS, H // ROWS
BASE = CH - 28  # linha dos pés dentro da célula
FAR = (150, 150, 160)  # perna/braço de trás (mais claro)
NEAR = (70, 70, 85)  # perna/braço da frente
BODY = (110, 110, 125)


def limb(d, a, b, color, w=22):
    d.line([a, b], fill=color, width=w)
    d.ellipse([b[0] - w / 2, b[1] - w / 2, b[0] + w / 2, b[1] + w / 2], fill=color)


def biped(d, cx, row, col):
    """Boneco chibi (cabeça grande). Pés em BASE."""
    hip = (cx, BASE - 95)
    neck = (cx, BASE - 175)
    contact, passing = col in (0, 2), col in (1, 3)
    swap = col == 2  # no 2º contato a outra perna vai à frente (mesma silhueta, outra cor)
    if row == 0:  # de lado, olhando para a direita
        front, back = ((cx + 55, BASE), (cx - 50, BASE)) if contact else ((cx + 4, BASE), (cx - 8, BASE - 28))
        near_leg, far_leg = (front, back) if not swap else (back, front)
        limb(d, hip, far_leg, FAR)
        d.rounded_rectangle([cx - 34, neck[1], cx + 34, hip[1] + 10], 14, fill=BODY)
        limb(d, hip, near_leg, NEAR)
        arm = 40 if contact else 8
        limb(d, (cx, neck[1] + 20), (cx - arm if not swap else cx + arm, neck[1] + 75), NEAR, 16)
        head = (cx + 6, neck[1] - 62)
        d.ellipse([head[0] - 70, head[1] - 66, head[0] + 70, head[1] + 66], fill=BODY)
        d.polygon([(head[0] + 66, head[1] - 6), (head[0] + 90, head[1] + 6), (head[0] + 66, head[1] + 18)], fill=NEAR)  # nariz = frente
    else:  # de frente (1) ou de costas (2): pernas alternam a altura do pé
        lift_l = 26 if col == 0 else 0
        lift_r = 26 if col == 2 else 0
        limb(d, (cx - 20, hip[1]), (cx - 26, BASE - lift_l), NEAR)
        limb(d, (cx + 20, hip[1]), (cx + 26, BASE - lift_r), NEAR)
        d.rounded_rectangle([cx - 44, neck[1], cx + 44, hip[1] + 10], 16, fill=BODY)
        sw = 14 if contact else 0
        limb(d, (cx - 40, neck[1] + 15), (cx - 52, neck[1] + 80 + (sw if col == 0 else -sw)), NEAR, 16)
        limb(d, (cx + 40, neck[1] + 15), (cx + 52, neck[1] + 80 + (sw if col == 2 else -sw)), NEAR, 16)
        head = (cx, neck[1] - 62)
        d.ellipse([head[0] - 72, head[1] - 66, head[0] + 72, head[1] + 66], fill=BODY)
        if row == 1:  # rosto: dois olhos
            for ex in (-26, 26):
                d.ellipse([head[0] + ex - 9, head[1] - 4, head[0] + ex + 9, head[1] + 14], fill=(255, 255, 255))


def quadruped(d, cx, row, col):
    """Bicho de quatro patas. Pés em BASE."""
    contact = col in (0, 2)
    if row == 0:  # de lado, olhando para a direita
        body = [cx - 110, BASE - 150, cx + 90, BASE - 60]
        s = 26 if contact else 6
        for hx, sign, color in ((cx + 55, 1, FAR), (cx - 75, -1, FAR), (cx + 65, -1, NEAR), (cx - 65, 1, NEAR)):
            off = s * sign * (1 if col != 2 else -1)
            limb(d, (hx, BASE - 90), (hx + off, BASE - (0 if contact or sign > 0 else 18)), color, 24)
        d.ellipse(body, fill=BODY)
        d.ellipse([cx + 60, BASE - 200, cx + 170, BASE - 100], fill=BODY)  # cabeça na frente (direita)
        d.polygon([(cx + 160, BASE - 160), (cx + 195, BASE - 145), (cx + 160, BASE - 125)], fill=NEAR)
    else:
        lift = [26 if col == 0 else 0, 26 if col == 2 else 0]
        for i, hx in enumerate((cx - 40, cx + 40)):
            limb(d, (hx, BASE - 90), (hx, BASE - lift[i]), NEAR, 26)
        d.ellipse([cx - 85, BASE - 170, cx + 85, BASE - 60], fill=BODY)
        if row == 1:
            d.ellipse([cx - 60, BASE - 230, cx + 60, BASE - 120], fill=BODY)
            for ex in (-24, 24):
                d.ellipse([cx + ex - 9, BASE - 190, cx + ex + 9, BASE - 172], fill=(255, 255, 255))


TOOL = (160, 110, 60)  # cabo da ferramenta (marrom)


def action(d, cx, row, col):
    """Golpe de ferramenta (machado, picareta, enxada). Colunas: 0 levanta · 1 balança · 2 impacto · 3 recupera.
    Pernas paradas e afastadas; a ferramenta é um cabo marrom com cabeça cinza."""
    hip = (cx, BASE - 95)
    neck = (cx, BASE - 175)
    limb(d, hip, (cx - 30, BASE), NEAR)
    limb(d, hip, (cx + 30, BASE), NEAR)
    d.rounded_rectangle([cx - 36, neck[1], cx + 36, hip[1] + 10], 14, fill=BODY)
    hand = (cx + 10, neck[1] + 40)
    # ponta da ferramenta por coluna; de lado o golpe vai para a direita, de frente/costas vai para baixo
    side = [(cx - 70, neck[1] - 110), (cx + 70, neck[1] - 60), (cx + 120, BASE - 10), (cx + 60, neck[1] + 30)]
    front = [(cx + 5, neck[1] - 120), (cx + 5, neck[1] - 30), (cx + 5, BASE + 0), (cx + 40, neck[1] + 60)]
    tip = (side if row == 0 else front)[col]
    head = (cx + (6 if row == 0 else 0), neck[1] - 62)
    d.ellipse([head[0] - 70, head[1] - 66, head[0] + 70, head[1] + 66], fill=BODY)
    if row == 0:
        d.polygon([(head[0] + 66, head[1] - 6), (head[0] + 90, head[1] + 6), (head[0] + 66, head[1] + 18)], fill=NEAR)
    elif row == 1:
        for ex in (-26, 26):
            d.ellipse([head[0] + ex - 9, head[1] - 4, head[0] + ex + 9, head[1] + 14], fill=(255, 255, 255))
    # ferramenta por cima de tudo (no golpe ela passa acima da cabeça)
    limb(d, (cx, neck[1] + 15), hand, NEAR, 16)
    d.line([hand, tip], fill=TOOL, width=12)
    d.rectangle([tip[0] - 18, tip[1] - 10, tip[0] + 18, tip[1] + 10], fill=(120, 120, 130))


def strike(d, cx, row, col):
    """Golpe de mão (soco/kunai) em base afastada. Colunas: 0 prepara (braço para trás) · 1 avança · 2 impacto (braço
    todo esticado) · 3 recupera. De lado o golpe vai para a direita; de frente/costas o braço vem para a câmera/longe."""
    hip = (cx, BASE - 95)
    neck = (cx, BASE - 175)
    lean = [-8, 6, 16, 4][col] if row == 0 else 0
    limb(d, hip, (cx - 45, BASE), FAR if row == 0 else NEAR)
    limb(d, hip, (cx + 50, BASE), NEAR)
    d.rounded_rectangle([cx - 36 + lean, neck[1], cx + 36 + lean, hip[1] + 10], 14, fill=BODY)
    sh = (cx + lean, neck[1] + 20)
    if row == 0:
        fist = [(cx - 80, neck[1] + 10), (cx + 40, neck[1] + 30), (cx + 130, neck[1] + 25), (cx + 55, neck[1] + 55)][col]
        guard = (cx + 30 + lean, neck[1] + 45)
    else:
        fist = [(cx + 70, neck[1] - 10), (cx + 50, neck[1] + 40), (cx + 25, neck[1] + 75), (cx + 55, neck[1] + 70)][col]
        guard = (cx - 45, neck[1] + 50)
    head = (cx + (6 if row == 0 else 0) + lean, neck[1] - 62)
    d.ellipse([head[0] - 70, head[1] - 66, head[0] + 70, head[1] + 66], fill=BODY)
    if row == 0:
        d.polygon([(head[0] + 66, head[1] - 6), (head[0] + 90, head[1] + 6), (head[0] + 66, head[1] + 18)], fill=NEAR)
    elif row == 1:
        for ex in (-26, 26):
            d.ellipse([head[0] + ex - 9, head[1] - 4, head[0] + ex + 9, head[1] + 14], fill=(255, 255, 255))
    limb(d, sh, guard, FAR, 16)
    limb(d, sh, fist, NEAR, 18)
    d.ellipse([fist[0] - 16, fist[1] - 16, fist[0] + 16, fist[1] + 16], fill=(200, 60, 60))  # punho (vermelho)


def cast(d, cx, row, col):
    """Selos de mão (jutsu): parado, pernas firmes, as duas mãos juntas na frente do peito em selos diferentes; na
    última coluna solta o jutsu com um braço esticado. Colunas: 0 selo baixo · 1 selo alto (perto do queixo) · 2 outro
    selo no peito · 3 solta (braço esticado para a frente)."""
    hip = (cx, BASE - 95)
    neck = (cx, BASE - 175)
    limb(d, hip, (cx - 30, BASE), NEAR)
    limb(d, hip, (cx + 30, BASE), NEAR)
    d.rounded_rectangle([cx - 36, neck[1], cx + 36, hip[1] + 10], 14, fill=BODY)
    head = (cx + (6 if row == 0 else 0), neck[1] - 62)
    d.ellipse([head[0] - 70, head[1] - 66, head[0] + 70, head[1] + 66], fill=BODY)
    if row == 0:
        d.polygon([(head[0] + 66, head[1] - 6), (head[0] + 90, head[1] + 6), (head[0] + 66, head[1] + 18)], fill=NEAR)
    elif row == 1:
        for ex in (-26, 26):
            d.ellipse([head[0] + ex - 9, head[1] - 4, head[0] + ex + 9, head[1] + 14], fill=(255, 255, 255))
    hy = [neck[1] + 45, neck[1] + 15, neck[1] + 40, None][col]
    if hy is not None:
        hx = cx + (30 if row == 0 else 0)
        limb(d, (cx - 30, neck[1] + 20), (hx, hy), NEAR, 16)
        limb(d, (cx + 30, neck[1] + 20), (hx, hy), NEAR, 16)
        d.ellipse([hx - 18, hy - 18, hx + 18, hy + 18], fill=(200, 60, 60))  # mãos juntas (vermelho)
    else:
        tip = (cx + 125, neck[1] + 30) if row == 0 else (cx + 45, neck[1] + 80)
        limb(d, (cx, neck[1] + 20), tip, NEAR, 18)
        d.ellipse([tip[0] - 18, tip[1] - 18, tip[0] + 18, tip[1] + 18], fill=(200, 60, 60))


def kick(d, cx, row, col):
    """Chute giratório (Konoha Senpuu): 0 prepara (gira o tronco, joelho dobrado erguido, guarda) · 1 chute ALTO (perna
    esticada na altura da cabeça, de lado para a direita) · 2 chute RASTEIRO (agachado numa perna, a outra esticada rente
    ao chão) · 3 volta à guarda. De frente/costas o chute vem para a câmera / vai para longe (perna na diagonal)."""
    neck_y = BASE - 175
    hip = (cx, BASE - 95)
    foot = (200, 60, 60)  # pé do chute (vermelho)
    if col == 2:  # agachado: quadril baixo
        hip = (cx - 10, BASE - 55)
        neck_y = BASE - 130
    head = (cx + (6 if row == 0 else 0) + (-10 if col == 2 else 0), neck_y - 62)
    lean = -18 if (col == 1 and row == 0) else 0
    # perna de apoio
    limb(d, hip, (cx - 20, BASE), NEAR if row else FAR)
    d.rounded_rectangle([cx - 36 + lean + (-10 if col == 2 else 0), neck_y, cx + 36 + lean + (-10 if col == 2 else 0), hip[1] + 10], 14, fill=BODY)
    # perna do chute
    if row == 0:
        tip = [(cx + 45, BASE - 110), (cx + 135, neck_y - 40), (cx + 140, BASE - 4), (cx + 30, BASE)][col]
        knee = [(cx + 55, BASE - 140), None, None, None][col]
    else:
        tip = [(cx + 40, BASE - 115), (cx + 75, neck_y - 10), (cx + 95, BASE - 6), (cx + 30, BASE)][col]
        knee = [(cx + 45, BASE - 145), None, None, None][col]
    if knee:
        limb(d, hip, knee, NEAR)
        limb(d, knee, tip, NEAR)
    else:
        limb(d, hip, tip, NEAR)
    d.ellipse([tip[0] - 16, tip[1] - 16, tip[0] + 16, tip[1] + 16], fill=foot)
    d.ellipse([head[0] - 70, head[1] - 66, head[0] + 70, head[1] + 66], fill=BODY)
    if row == 0:
        d.polygon([(head[0] + 66, head[1] - 6), (head[0] + 90, head[1] + 6), (head[0] + 66, head[1] + 18)], fill=NEAR)
    elif row == 1:
        for ex in (-26, 26):
            d.ellipse([head[0] + ex - 9, head[1] - 4, head[0] + ex + 9, head[1] + 14], fill=(255, 255, 255))
    # braços na guarda
    sh = (cx + lean, neck_y + 20)
    limb(d, sh, (cx - 40 + lean, neck_y + 55), FAR, 14)
    limb(d, sh, (cx + 30 + lean, neck_y + 40), NEAR, 14)


for kind, draw in (('biped', biped), ('quadruped', quadruped), ('action', action), ('strike', strike), ('cast', cast), ('kick', kick)):
    im = Image.new('RGB', (W, H), (255, 255, 255))
    d = ImageDraw.Draw(im)
    for r in range(ROWS):
        for c in range(COLS):
            x0, y0 = c * CW, r * CH
            d.rectangle([x0, y0, x0 + CW - 1, y0 + CH - 1], outline=(200, 200, 210), width=2)
            d.line([x0 + 20, y0 + BASE + 2, x0 + CW - 20, y0 + BASE + 2], fill=(235, 120, 120), width=2)
            # desenha numa camada da célula para não vazar para a vizinha
            cell = Image.new('RGB', (CW, CH), (255, 255, 255))
            cell_d = ImageDraw.Draw(cell)
            cell_d.line([20, BASE + 2, CW - 20, BASE + 2], fill=(235, 120, 120), width=2)
            draw(cell_d, CW // 2, r, c)
            im.paste(cell.crop((2, 2, CW - 2, CH - 2)), (x0 + 2, y0 + 2))
    im.save(f'docs/arte/gabarito-{kind}.png')
    print(f'docs/arte/gabarito-{kind}.png')
