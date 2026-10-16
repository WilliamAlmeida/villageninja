# Arte: pixel art, folhas de sprite, pipeline do Codex

> Detalhe movido do CLAUDE.md (o índice fica lá). Mantenha atualizado ao mexer no sistema.

- Arte em pixel art: PNGs em `src/art`, **cada um na pasta do seu tipo** (`ninja/body`, `ninja/layers`, `ninja/busts`,
  `characters`, `animals`, `weapons`, `buildings`, `buildings/deco`, `scenery`, `props`, `region`, `ui/…`; regra única pelo
  nome em `scripts/artpaths.py`, que todo script que grava arte usa via `art_file(nome)`; o NOME da arte é a chave em todo
  lugar: `render/art.ts`, `layout.json`, editores) (registro em `render/art.ts`), preparados com `scripts/prepare-art.py`
  (originais em `docs/arte`). Prédios e cenário (árvores, rochas, baú, ruína, caverna) são guardados em 2×
  (`SCENERY_SCALE`, paleta de 256 cores): o jogo desenha pelo tamanho no mundo e só ganha nitidez com zoom; abaixo do
  tamanho guardado `drawShrunk` (art.ts) reduz pela cópia reduzida pronta (½, ¼, ⅛) com suavização simples (ver
  render.md, Desempenho). Personagens e camadas do ninja seguem em 1×. **Gerar pelo Codex CLI** (`scripts/codex-image.mjs`, incluso no plano ChatGPT do autor;
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
- **Modelo do Codex** (2026-10-15): o `gpt-5.5` passou a ser recusado no login do ChatGPT; `scripts/codex-image.mjs`
  usa `gpt-6-sol` por padrão (`CODEX_MODEL` troca; os slugs aceitos estão em `~/.codex/models_cache.json`). Em
  `scripts/ui-grid.py` as descrições das casas vão numa linha só: no Windows (`shell=True`) uma quebra de linha no
  argumento engolia tudo depois dela e o Codex desenhava qualquer coisa.
- Campos andáveis com arte (treino; fazenda e horta só nos vilarejos invadidos) são decalques no chão, desenhados antes das unidades.
- **Campos cercados** (game/fields.ts, desenho em `render/fields.ts`): folhas separadas na pasta `src/art/fields`
  (`scripts/artpaths.py`), feitas por `scripts/field-art.py` (Codex, uma folha por cultura e uma de chão e cerca; originais
  em `docs/arte/fields/`): `crop-<cultura>` (6 casas: semente, broto, crescendo, quase, maduro e **passando do ponto**,
  maduro há mais de metade de `FIELD.witherDays`, avisa que vai murchar), `field-soil` (terra crua, arada, arada úmida,
  crua no inverno) e `field-fence` (cerca "\" no lado de baixo-esquerdo do tile, cerca "/" no de baixo-direito, portão
  "\" e poste solto). Casas quadradas de 112 px em 2× (56 na cena) numa fila, com o losango do tile na mesma posição em
  todas (ponta de cima em 56,56 e da frente em 56,104). **Cultura nova**: o id em `CROPS` do script, rodar, registrar
  `crop-<id>` em `render/art.ts` (o teste `tests/fields-art.test.ts` confere toda cultura de `CROP_LIST`). Cada peça é
  desenhada na casa do tile (`piece`); o lado de cima de um tile é o de baixo do vizinho. Só o chão vai na passada do chão:
  plantas (no meio do tile) e cada trecho de cerca (no meio do lado) entram na ordem de profundidade com as unidades
  (`fieldItems`/`drawFieldItem`), e o fazendeiro mira ~10 px antes do centro do tile (os pés saem 9 px abaixo do ponto),
  então trabalha dentro do canteiro, atrás da cerca da frente. O gabarito de cada folha (`iso_template.draw`, com linha
  vermelha no lado da cerca) dá o tamanho, mas o Codex não acerta a posição: o recorte encaixa pelo próprio desenho (chão
  no losango, 6% maior e recortado nele para o contorno escuro não virar grade; cerca pelos pés dos postes nas pontas do
  lado, com a largura do poste solto; planta centrada com a base na ponta da frente) e apaga os vãos brancos fechados
  (entre ripas e folhas). Refazer: `python scripts/field-art.py --refazer trigo,cerca`; só recortar de novo: `--pack`. Sem
  a folha (carregando, testes) fica o desenho à mão de antes.
- **Cards de pintar terreno** do menu Construir (Campo cercado, Rua calçada, Limpar área, Aterrar, Cavar; `ui/build.ts`,
  `cardBg`): uma vinheta isométrica cada, `src/art/ui/cards/card-<nome>.png` (192 px de largura), de
  `scripts/card-art.py` (uma folha do Codex com gabarito 2×2 e a casa e o atlas dos campos de referência; `--refazer`).
- **Variantes dos prédios repetidos** (docs/gdd-escala-ilhas-pvp.md, seção 4; feitas em 2026-10-15): a casa tem três
  desenhos por nível (`house`, `house-b`, `house-c`, `house-b-2`, `house-c-3`…; a letra entra ANTES do nível) e lenhador,
  pedreira e fazenda dois (a fazenda hoje só aparece nos vilarejos invadidos: na vila virou campo cercado) (`<tipo>`, `<tipo>-b`, também por nível). A escolha é só no desenho, em `render/variants.ts`
  (`VARIANTS`, `variantArt`): `id % 3` na casa e `id % 2` na produção, chamada pelo `artBox` do renderer e pelo topo do
  drawer do prédio; nada muda no save, e sem a arte da variante (não registrada ou ainda carregando) fica a base do
  nível. O cartão do menu Construir mostra a base. Cada variante tem a sua entrada no `layout.json` (escala/posição
  medidas na instalação). Para gerar: casa, lenhador e pedreira são lotes de `scripts/building-art.py` com `variant: True`
  (`casa-b`, `casa-c`, `lenhador-b`, `pedreira-b`): a referência é a arte DE HOJE do mesmo nível (`_hoje-<arte>.png`,
  régua de tamanho, paleta e acabamento) e o pedido é OUTRO prédio do mesmo tipo (telhado, fachada e detalhes
  diferentes), com o nível anterior da própria variante como "o mesmo crescido"; `--instalar` grava em `src/art` e no
  layout como nos outros lotes. A fazenda (decalque do pipeline antigo) sai de `scripts/field-variants.py` (Codex com a
  fazenda de hoje do nível como referência do losango → `docs/arte/iso/farm-b*.png` → `src/art/buildings/`, largura
  576 como a `farm`). Variante nova (`-d`…): acrescentar a letra em `VARIANTS`, gerar, registrar em `render/art.ts`
  (`URLS`) e o teste `tests/art-variants.test.ts` confere que todos os níveis existem.
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

## Rasengan e Ōdama: esfera, impacto e cratera compartilhados

`src/art/effects/effect-rasengan-v1.png`: RGBA 256x128, grade 4x2, oito quadros de 64x64,
centro (32,32), esfera com aproximadamente 48 px de diâmetro na célula. Gerada com ImageGen integrado;
fonte, prompt e prévia animada em `docs/arte/jutsus/rasengan/`. Preparo: `scripts/prepare-rasengan.ps1`.
Decisão do autor: uma única spritesheet; Rasengan em escala normal e Ōdama em 2x.
Integrada à mão da pose, com formação curta por escala. Célula desenhada a 24/48 px (diâmetro visível ~18/36 px).
`effect-rasengan-impact-v1.png`: RGBA 384x192, grade 4x2, células 96x96, oito quadros a 16 qps, uma execução;
âncora (0,5; 0,72), largura 72/144 px. `effect-rasengan-crater-v1.png`: RGBA 128x64, decalque estático 2:1,
largura 56/112 px. As três imagens são compartilhadas entre as variações, com escala 2x no Ōdama.
Fontes, prompts e `preview-impacto.html` em `docs/arte/jutsus/rasengan/`; preparo técnico reproduzível em
`scripts/prepare-rasengan-impact.ps1` (escala comum, nearest-neighbor e corte de alpha residual abaixo de 32).
Prévia independente: `bun scripts/preview-rasengan.ts`. Aprovação visual em `docs/PENDENCIAS.md`;
inventário dos 56 jutsus e prioridades em `docs/jutsus-sprites.md`.

## Rasenshuriken: lâminas e domo

`projectile-rasenshuriken-v1.png`: RGBA 384x192, grade 4x2 de células 96x96; oito fases a 24 qps,
centro (0,5; 0,5), largura 56 px. `effect-rasenshuriken-impact-v1.png`: RGBA 512x256, grade 4x2 de células
128x128; oito fases a 10 qps, largura 208 px, âncora de chão (0,5; 0,78), opacidade 0,75 e deslocamento vertical +8 px.
Cratera reaproveitada do Rasengan, largura 164 px. ImageGen integrado; fontes, prompts e prévia em
`docs/arte/jutsus/rasenshuriken/`. Preparo técnico: `scripts/prepare-rasenshuriken.ps1`, com limpeza de ruído
solto, alpha mínimo 32, nearest-neighbor, escala comum e alinhamento da base do domo entre as fases.
Prévia autocontida: `bun scripts/preview-rasenshuriken.ts`. Configuração do lote: `scripts/configure-rasenshuriken.ts`.

## Doryuuheki, Doryuudan, Suna no Tate e Sabaku Kyū: artes v1

Lote integrado no renderer e aprovado pelo autor em 2026-10-15. PNGs em `src/art/effects/`: `effect-doryuuheki-v1`,
`effect-doryuudan-origin-v1`, `effect-sunanotate-v1` e `effect-sabakukyu-v1` têm 384x192, células de 96x96;
`projectile-doryuudan-v1` tem 256x128, células de 64x64. Todas são RGBA, grade 4x2 com oito quadros.
Base das peças de chão em (0,5; 0,78); projétil centrado em (0,5; 0,5). Escala comum preserva a subida da muralha
e formação/compressão do casulo; folhas de Suna no Tate, cabeça e projétil são loops.
Fontes ImageGen integrado, prompts, metadados (`sheets.json`) e `preview.html` em `docs/arte/jutsus/doton-suna/`.
Preparo: `scripts/prepare-doton-suna.ps1` (alpha mínimo 32, remoção de ruído solto, nearest-neighbor, base alinhada,
conferência de bordas). Prévia: `bun scripts/preview-doton-suna.ts`.
Configuração de runtime: `scripts/configure-doton-suna.ts` → `jutsu-fx.json`: muralha 64 px, cabeça 68 px,
lama 22 px, escudo 64 px (opacidade 0,9), casulo 56 px. Na folha preparada, boca da cabeça em (0,76; 0,52).

Correção de perfil do Doryuuheki (2026-10-14): `effect-doryuuheki-profile-v1.png`, RGBA 384x192, oito células 96x96,
variação da frontal com face lateral e topo espesso, mesma paleta e fases. Gerada com ImageGen integrado usando
a folha original como referência; fonte e prompt em `docs/arte/jutsus/doton-suna/`. Preparo isolado:
`scripts/prepare-doton-suna.ps1 -Only doryuuhekiProfile` (base centralizada na profundidade, inset 0,20).
Galeria das oito direções: `bun scripts/preview-doryuuheki.ts` → `preview-doryuuheki.html`.

Complemento da correção: `effect-doryuuheki-oblique-v1.png`, RGBA 384x192, oito quadros, vista diagonal 2:1
com topo e face lateral. Fonte e prompt em `doryuuhekiOblique-source.png`/`doryuuheki-oblique-prompt.json` na mesma
pasta; ImageGen integrado usando a frontal como referência. Preparo com `-Only doryuuhekiOblique`.
Runtime usa três folhas sem deformação, tamanhos 64/58/58 (frontal/diagonal/perfil); galeria atualizada para 16 direções.

## Kirin, Jukai Kōtan, Raikyuu e Chidori Nagashi

Iniciado em 2026-10-14. Quatro folhas RGBA, grade 4x2, oito quadros: `effect-kirin-v1` e
`effect-chidorinagashi-v1` (512x256, células128), `effect-jukai-v1` (384x192, células96) e
`projectile-raikyuu-v1` (256x128, células64). Fontes, prompts ImageGen integrado e prévia em
`docs/arte/jutsus/raiton-mokuton/`. Preparo: `scripts/prepare-raiton-mokuton.ps1`; prévia:
`bun scripts/preview-raiton-mokuton.ts`. No Kirin, manter o registro vertical da célula ao preparar,
e registrar a ponta da cabeça descendo nos quatro primeiros quadros antes do impacto. Demais efeitos de chão usam base alinhada;
Raikyuu tem centro fixo. Integradas em 2026-10-15; Amaterasu e Susano'o adiados pelo autor.
Dados de runtime em `jutsu-fx.json`: `kirin.impact` tamanho180, 10 qps; `jukai.sprite` tamanho76;
`raikyuu.sprite` tamanho30, 16 qps, gira com o voo; `chidorinagashi.impact` tamanho142, 10 qps, opacidade0,95.
Configuração reproduzível: `scripts/configure-raiton-mokuton.ts`.

## Lava e vento: Yōkai, Daitoppa, Shinkuu Ha e Sekizō

Cinco folhas ImageGen integrado em `src/art/effects/`, RGBA, oito quadros 4x2: `projectile-yokai-v1` e
`projectile-shinkuuha-v1` têm células64; `effect-yokai-impact-v1`, `effect-daitoppa-v1` e
`effect-sekizo-impact-v1` têm células128. Fontes e prompts em `docs/arte/jutsus/lava-vento/`.
Preparo técnico: `scripts/prepare-lava-vento.ps1`, alpha mínimo32, remoção de ruído, nearest-neighbor e escala
comum por folha. Frente dos projéteis em (0,75;0,5), rajada em (0,15;0,5), impactos em (0,5;0,78).
Configuração: `scripts/configure-lava-vento.ts`; prévia autocontida: `scripts/preview-lava-vento.ts`.

Nagashi (correção de 2026-10-15): registra o fundo da abertura do ninja entre os quadros, usando os pontos da fonte
em `prepare-raiton-mokuton.ps1`. Mantém escala comum; evita a oscilação Y causada pela borda externa dos raios.
Montagem com referência fixa: `docs/arte/jutsus/raiton-mokuton/nagashi-alinhamento.png`.

## Arte do site

`scripts/codex-image.mjs ... --cena` gera arte com cenário (sem fundo branco e sem `remove-bg`). Originais em
`server/site/img/raw/` (fora do git); `python scripts/site-art.py` gera os `.webp`, o emblema em 64/256/512 e o botão de
jogar recortado. Nada de personagens, símbolos ou lugares do anime (ver CLAUDE.md, nome público).
