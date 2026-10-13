# Arte: pixel art, folhas de sprite, pipeline do Codex

> Detalhe movido do CLAUDE.md (o índice fica lá). Mantenha atualizado ao mexer no sistema.

- Arte em pixel art: PNGs em `src/art`, **cada um na pasta do seu tipo** (`ninja/body`, `ninja/layers`, `ninja/busts`,
  `characters`, `animals`, `weapons`, `buildings`, `buildings/deco`, `scenery`, `props`, `region`, `ui/…`; regra única pelo
  nome em `scripts/artpaths.py`, que todo script que grava arte usa via `art_file(nome)`; o NOME da arte é a chave em todo
  lugar: `render/art.ts`, `layout.json`, editores) (registro em `render/art.ts`), preparados com `scripts/prepare-art.py`
  (originais em `docs/arte`). Prédios e cenário (árvores, rochas, baú, ruína, caverna) são guardados em 2×
  (`SCENERY_SCALE`, paleta de 256 cores): o jogo desenha pelo tamanho no mundo e só ganha nitidez com zoom; abaixo do
  tamanho guardado `smoothIfShrunk` (art.ts) reduz com suavização. Personagens e camadas do ninja seguem em 1×. **Gerar pelo Codex CLI** (`scripts/codex-image.mjs`, incluso no plano ChatGPT do autor;
  usa `-m gpt-5.5` e tira o fundo localmente com `scripts/remove-bg.py`). A Runware (`scripts/runware.mjs`,
  `scripts/sprite.mjs`, paga por imagem) é só alternativa quando o Codex não estiver disponível. O jogo é sempre pixel art
  (a opção de arte antiga saiu); o desenho procedural de `sprites.ts` só aparece enquanto a imagem carrega e nos testes.
- **Folhas de sprite (personagens e bichos) têm um padrão fixo** — nunca gere "um sprite sheet" solto:
  `node scripts/codex-image.mjs docs/arte/sprites/<nome>.png "<descrição>" --sheet biped|quadruped [--ref visual.png]`
  manda o gabarito de poses (`docs/arte/gabarito-*.png`, criado por `scripts/sprite-template.py`) como 1ª referência.
  Grade 4×3: linha 1 de lado olhando para a DIREITA, linha 2 de frente, linha 3 de costas; colunas = ciclo
  contato · passagem · contato · passagem (parado = coluna 2). `prepare-art.py` fatia pela grade e valida
  (quadro vazio, altura, direção pelo rosto/gabarito, ordem do ciclo), corrigindo o que dá e listando o resto.
  Para incluir um novo: gere, adicione em `SHEETS` do `prepare-art.py` e no `URLS`/`SHEETS` de `render/art.ts`.
  Cada pedaço do desenho vai inteiro para a casa onde está quase todo (70%+; cauda/chama que passa da casa não é cortada) e
  o quadro sai com **folga** (25% dos lados, 30% em cima, 10% embaixo; `scripts/pad-sheets.py` faz o mesmo nas folhas já
  prontas, sem refazer da fonte). O jogo desenha pela **altura do corpo** (`arts[nome].body`, px do quadro que valem a
  altura no mundo) e pela **origem** (`foot`, os pés) do layout.json, e a sombra multiplica por `shadow` (`frameFit` em
  render/art.ts; sem esses campos, o quadro inteiro é o corpo e a origem é o meio da base). Altura no mundo e sombra padrão:
  `render/unitShape.ts` (puro, usado pelo editor).
- Campos andáveis com arte (fazenda, treino, horta) são decalques no chão, desenhados antes das unidades.
- Moradores trabalhando usam folhas de ação (`villager-chop|mine|farm`, gabarito `action`: levanta · balança · impacto ·
  recupera); árvore vira toco e rocha racha conforme se esgotam (o recurso treme no quadro do impacto do golpe, `workImpact`, e a
  árvore que vira toco tomba para o lado com poeira, `Renderer.node`; só visual); colheita deixa um canteiro (`fx 'harvest'`) que rebrota.
- **Achatamento** (`ArtLayout.squash`, modo Arte do Editor de cenário, 0,75–1, botão 0,866): só a altura na tela, a imagem
  não muda; o Codex desenha o chão a ~30° e 0,866 leva ao 2:1. **Paleta do cenário**: `/paleta` nas ferramentas marca as
  artes preferidas (`docs/design/arte-iso/paleta-favoritos.json`).

## Projéteis Katon animados

`src/art/effects/projectile-housenka.png` e `projectile-goukakyuu.png` são registrados em
`render/art.ts`. Folhas RGBA 4x2 (8 quadros de 64x64), próprias para efeitos; o padrão de
personagem 4x3 não se aplica. Núcleo em (48,32), loop a 16 fps. Originais e prompts em
`docs/arte/jutsus/`; preparo por `scripts/prepare-katon.ps1`. Gerados pela ferramenta integrada ImageGen.

## Suiton animado

Folhas RGBA 256x128 em `src/art/effects`: `projectile-mizurappa.png` e `effect-suirou.png`. Grade 4x2, quadros de 64x64.
Projéteis ancorados na cabeça em (48,32); esfera em (32,32).
Gerados por ImageGen integrado; originais, prompts e prévia em `docs/arte/jutsus/suiton`.
O dragão passou por ajuste de folga e a prisão por ajuste de transparência no ImageGen.
Preparo técnico: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/prepare-suiton.ps1`.
Confere quadros vazios e folga; preserva alpha e reduz por nearest-neighbor.

## Hirudora: tigre de ar

`src/art/effects/projectile-hirudora.png`: RGBA 384x256, grade 2x4 (células de 192x64, comprimidas 3:1), oito quadros em
loop na ordem de leitura: o tigre de ar inteiro voando para a direita, corpo ondulando, cauda tremulando, boca rugindo.
Gerado pelo Codex (`codex exec -m gpt-5.5`) com a referência do autor; prompt, referência e fonte em
`docs/arte/jutsus/hirudora/`. A fonte vem em **fundo verde** (#00FF00), não branco: o tigre é branco-azulado e a
remoção de fundo branco comeria os brilhos. Preparo: `python scripts/prepare-hirudora.py` (tira o verde e a franja,
mesma escala em todos os quadros, focinho alinhado em x 0,984 / y 0,5 = a âncora, confere folga e quadro vazio). No
jogo (`jutsu-fx.json` → `hirudora`): largura 110, 10 qps, gira com o voo, espelha à esquerda e "nasce da mão"
(`emerge`: o corpo aparece saindo do punho).
