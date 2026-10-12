# Arte isométrica (prédios, decorações, campos): estudo e proposta de regras

Documento para o autor analisar e fechar um consenso antes de refazer artes. Medidas de 2026-10-12 com
`python scripts/iso-audit.py` (números em `docs/design/arte-iso/medidas.json`, folhas anotadas na mesma pasta).

## 1. Como o jogo desenha (a "verdade" que a arte precisa seguir)

| O quê | Valor | Onde |
|---|---|---|
| Projeção do chão | **2:1 exato**: um tile de 32 px de mundo vira um losango de **48 × 24 px** de cena | `core/iso.ts` (`ISO_K = 0.75`) |
| Ângulo das bordas do chão | **26,57°** (sobe 1 px a cada 2 px na horizontal) | idem |
| Terreno w×h tiles | losango de largura **(w + h) × 24** px de cena e altura metade disso | `renderer.footprint` |
| Onde a arte é apoiada | meio da base da imagem na **ponta da frente** do losango, **4 px abaixo** dela, + dx/dy do Editor de cenário | `renderer.artBox` |
| Largura da arte na cena | largura do losango × `ART_SCALE[arte]` × escala do Editor | `render/art.ts` |
| Chão batido (a "sombra" do código) | retângulo **arredondado** do terreno com folga (−4 … +8/+10 px de mundo), marrom 35% | `renderer.render`, passada do chão |
| Guardado em disco | 2× (`SCENERY_SCALE`), paleta de 256 cores | `prepare-art.py` |
| Pixel do boneco (ninja) | ~0,66 px de cena por pixel da folha | `render/art.ts` (`frameFit`) |

## 2. O que as medições mostram

Folhas: `docs/design/arte-iso/predios.png`, `deco.png`, `campos.png`. Em cada cartão: **ciano** = losango
verdadeiro do terreno, **marrom** = chão batido do jogo, **vermelho** = bordas de baixo medidas na arte, **magenta** =
base da imagem.

1. **O ângulo da arte não é o do jogo.** A mediana das bordas é **28,0°** (alvo 26,6°); **60 das 75** artes passam de
   ±2,5°. O mais claro são as peças planas (o desenho é só o chão), onde não há dúvida sobre o que medir:

   | Peça | Bordas (esq / dir) |
   |---|---|
   | fazenda (1–3) | 32,1° / 32,0° |
   | campo de treino (1–3) | 31,5° / 31,5° |
   | horta | 29,6° / 29,6° |
   | lagoa, fonte (refeitas hoje, com gabarito) | 29,3° / 29,2° |
   | canteiro de flores | 29,5° / 31,0° |

   Ou seja: o Codex desenha um losango de ~1,65:1 a 1,8:1, não 2:1. O gabarito ajudou a posição, mas **não força o
   ângulo**. É o "iso diferente" que aparece em volta da fonte e da lagoa.
2. **O tamanho do "pixel" do desenho varia muito**: de **0,64 a 6,58 px de cena** (mediana 1,77). A Residência do Hokage
   nível 1 tem pixels de 6,6 px; a fazenda, de 0,7 px. Lado a lado no mapa, uma parece "pixel art grossa" e a outra
   "pintura fina". Os bonecos ficam em ~0,66.
3. **A base não bate com o terreno**:
   - por regra do código, a base da imagem fica **4 px abaixo** da ponta do losango (a placa de chão da fonte e da lagoa
     "desce" do terreno);
   - **27 artes têm `ART_SCALE` ≠ 1** (0,45 a 1,30): a base fica menor ou maior que o terreno (a fonte com 0,95 não
     chega aos cantos do losango; a Mesa de Missões com 1,25 passa dele);
   - o chão batido é arredondado e maior que o terreno, então nunca coincide com uma base desenhada em losango.
4. **Cantos cortados** (fonte, lagoa): o recorte que fiz hoje usa exatamente a largura do losango do gabarito; como o
   Codex desenhou a placa um pouco maior, as pontas esquerda e direita foram cortadas.
5. **A medida só vale onde a base desenhada é o chão.** Torres sobre pernas, árvores, estandarte e lanterna dão ângulos
   sem sentido (a silhueta de baixo não é o losango). Para essas, vale a posição dos pés, não o ângulo.

## 3. Proposta de regras (para consenso)

**R1 — Ângulo.** Todo chão e toda aresta horizontal da arte em 2:1 exato (26,57°), como os tiles do jogo.

**R2 — Base = terreno.** A placa/base da arte é exatamente o losango do terreno (w×h): a ponta da frente na ponta da
frente, a esquerda e a direita nos cantos. Sem `ART_SCALE` para a base; quem precisa ser "menor que o tile" (lanterna,
estátua) desenha o objeto pequeno **dentro** de um losango cheio (com ou sem chão desenhado) e o código não encolhe.

**R3 — Sem os 4 px.** A base da imagem fica na ponta da frente (o "+4" do `artBox` sai quando todas seguirem R2).

**R4 — Tamanho do pixel fixo.** Um tamanho só para toda a arte de cenário. Sugestão: **1 pixel de arte = 1 px de
cena no zoom 1** (guardado em 2×: blocos de 2×2). Fica um pouco mais grosso que os bonecos (0,66), o que costuma ler
bem (prédio "pesado", personagem fino); a alternativa é 0,66 para casar com os bonecos, com muito mais detalhe por
prédio.

**R5 — Contorno e luz.** Contorno escuro de 1 pixel de arte; luz da esquerda-em-cima (face esquerda clara, direita
escura), como a maioria já está.

**R6 — Chão batido.** Ou o losango exato do terreno (sem arredondar nem folga) sob prédios sem chão próprio, ou nada
quando a arte já traz a placa de chão (fonte, lagoa, campos).

## 4. Como garantir (pipeline)

O Codex não acerta ângulo nem grade de pixel sozinho; o controle tem que vir depois da geração:

1. **Gabarito** (já existe: `scripts/iso_template.py`) para posição e tamanho do terreno.
2. **Correção do ângulo**: medir as bordas da base (o mesmo código da auditoria) e **esticar na vertical** a imagem toda
   pelo fator `0,5 / inclinação medida` (corrige a "câmera" sem mexer na largura). Ex.: fazenda 32° → ×0,80 na altura.
3. **Encaixe no terreno**: recortar pelos cantos medidos (não pela largura do gabarito) e escalar para a largura exata do
   losango.
4. **Grade de pixel**: reduzir para a grade de R4 (vizinho mais próximo a partir do tamanho de pixel detectado) e
   limitar a paleta.
5. **Validador** no `prepare-art.py`: recusa (ou avisa) se, depois disso, o ângulo passar de ±1° ou os cantos de ±1 px,
   e a auditoria roda de novo para conferir tudo.

Os passos 2–4 são automáticos: dá para aplicar já às artes atuais e ver o resultado antes de decidir o que precisa
ser gerado de novo (artes com perspectiva errada demais, como o Monte e o Hokage nível 1, provavelmente precisam).

## 5. Decisões do autor

- [ ] R1–R3 e R6 como estão?
- [ ] Tamanho do pixel (R4): 1 px de cena ou 0,66 (igual aos bonecos)?
- [ ] Testar a correção automática (passos 2–4) primeiro nas peças planas (fazenda, treino, horta, lagoa, fonte) e
      comparar lado a lado antes de mexer no resto?
- [ ] Quais artes editadas à mão (`art-edits.json`) podem ser refeitas?
