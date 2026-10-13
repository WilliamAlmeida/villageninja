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
