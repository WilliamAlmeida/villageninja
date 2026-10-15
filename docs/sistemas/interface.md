# Interface: telas, kit de UI, ícones, painéis

> Detalhe movido do CLAUDE.md (o índice fica lá). Mantenha atualizado ao mexer no sistema.

- **Quadro de missões** (redesenho a partir de mockup do Codex em `docs/arte/mockups/`): cabeçalho com chips e "Auto
  designar" (`autoAssign`), abas Ativas/Disponíveis/Recentes, cada missão é um contrato (pergaminho `src/art/ui-scroll.png`
  com selo do rank em CSS) com a equipe recomendada (`recommendTeam`: a mais fraca que dá conta), risco em palavras
  (`missionRisk`) e "Trocar equipe" (`teamsForMission`); na janela larga os contratos ativos ficam numa coluna. Retratos
  de ninja no DOM: `unitPortrait` / `artPortrait` (render/sprites.ts).
- **Visual das telas** segue os mockups do Codex em `docs/arte/mockups/` (gerados por `scripts/mockups.sh`, estilo do quadro
  de missões). Janelas com grupo usam o topo comum (`tabs()` → `winTop`: título, etiquetas `.mchip`, ações e abas
  sublinhadas `.mtabs`, preso ao rolar); selos de estado `.mpill` (safe/good/risky/danger/info), chaves liga/desliga
  `.btn.tog`, seções em cartões `.bsec`, cartão de melhoria `.bup`. Equipes: lista + equipe ao lado na janela larga
  (`WIDE_BOARD`). Desktop largo mostra o nome de cada recurso na barra de cima (vem do `data-tip-title`).
  **Assets de interface em pixel art** (gerados pelo Codex com `scripts/ui-assets.sh`, originais em `docs/arte/ui/`,
  preparados por `scripts/prepare-ui.py` → `src/art/ui/` + `src/ui/pxicons.ts`): ícones (`rich()`/`ico()` usam o PNG
  no lugar do SVG quando existe; a moeda de ryo é a referência de estilo), **molduras 9-slice** (`scripts/prepare-frames.py`:
  arte do Codex em `docs/arte/ui/frame/` → `src/art/ui/frame/`, usadas por `border-image` com as variáveis `--frame-dock` /
  `--frame-win` postas em ui/index.ts: a barra de baixo é madeira com pergaminho enrolado nas pontas e os ícones saltam
  para fora dela, sem caixa; as janelas têm cantoneiras douradas), selos de rank (**kit de interface** em andamento: `scripts/kit-split.py` separa o mockup do GPT
  `docs/arte/ui/Atlas de Interface Ninja em Português.png` em 89 peças em `src/art/ui/kit1/` com o uso de cada uma no
  `LEIAME.md` dali; o autor limpa o texto no editor de sprites, que lista `ui/kit1` e `ui/frame`, e depois elas entram
  no jogo como 9-slice/ícone; `scripts/prepare-kit.py` monta das peças limpas a arte em `src/art/ui/frame/` — já em uso:
  pergaminho dos avisos `#alertbox` com a faixa do título à parte, faixa vermelha do alerta de inimigos, trilho e
  preenchimentos das barras `.bar`/`.nc-bar`). **Minificador de CSS do Bun estraga `border-image`**: no atalho o `var()`
  some e em `border-image-slice` cai o 1º número — usar as propriedades separadas e as fatias numa variável (`--sl`).
  **Kit 2 (o que vale agora)**: uma peça-base de cada tipo pedida ao Codex em pixel art limpa, sem texto e pronta para
  9-slice (`scripts/kit2-codex.sh`, referência = recorte do mockup), reduzida ao pixel real e com as cores feitas por
  código (`scripts/prepare-kit2.py`: tinge o cinza mantendo o claro/escuro; botão escuro/laranja/vermelho, barras, selos)
  → `src/art/ui/kit2/`, variáveis `--k2-*` (`ui/kit.ts`); o editor de sprites abre `ui/kit2` e peça editada lá não é
  regravada pelo script (`art-edits.json`; `--force` regrava). Em uso: pergaminho dos avisos com faixa do título e fechar
  redondo, `.btn`, `.bar`/`.nc-bar`, `.mpill`, `#tip` e o drawer `#panel` com o telhado (molduras 2×, controles 1×);
  lote 2 (`scripts/kit2-codex-2.sh`): barra de cima (`hud-bar` + caixinha `hud-slot` por recurso), barra de baixo com
  telhado e lanterna nas pontas (`dock`) e um quadro por botão (`dock-slot`, ativo `dock-slot-on`), abas `.wtabs`, cartão
  de ninja com a moldura na cor da patente (`.ncard.r-<patente>`, `card-<patente>`) e retrato em quadro de bronze; `row` na lista da Pedra Memorial/Monte (`.memlist`) e
  `divider` como separador `.k2div` na ficha. **Passada geral** (bloco "kit 2, passada geral" no fim do styles.css):
  todo cartão/tile/linha (`.bsec`, `.statcard`, `.tcard`, `.vperk`, `.slot`, `.inv-cell`…) = caixinha `hud-slot`; chips,
  segmentos, `.mchip` e velocidade = botão escuro/laranja; `.mtabs` do drawer como as abas das janelas; `.iconbtn` e o
  fechar das janelas = botão redondo; menu de pausa = `panel`; `.bcard` = `dock-slot`; todo `h4` = faixa `label`.
  Componente novo deve entrar numa dessas listas, não ganhar caixa de CSS própria (`SEALS`), kunai do Hiraishin,
  animais dos Sannin e cenas das estações/festival/vila (`ART`). Tokens do tema (cores, bordas âmbar, botões com relevo)
  no bloco "Tema fiel aos mockups" no fim de styles.css.
  **Atlas**: ícones (64 px) em `src/art/ui/icons.png` e selos de rank (128 px, uma linha com os 5) em `badge-ranks.png`,
  desenhados por `atlasCell` (icons.ts); um arquivo só em vez de dezenas (pelo túnel, PNGs soltos atrasavam as janelas).
  **Organização das artes**: interface = glifo; recurso e item = casa do atlas (item SEMPRE em pixel art: `itemPx` em panel.ts
  força a casa mesmo havendo glifo, e cada item tem o seu ícone: `vest-crystal`, `chakra-crystal`, `blade-dark`; lâmina
  lendária = a espada solta `sword-<id>` deitada na diagonal, `bladeIcon`); o atlas só guarda o que aparece (ícone com glifo e sem `pxIco` não entra; `.perf/atlaskeep.py`
  confere); ilustração maior que 64 px solta em `ui/art`; o que é desenhado no mapa (recolorido/animado/em peças) solto em
  `src/art`. O que saiu fica em `docs/arte/_backup/<data>/` com um LEIAME (o autor apaga à mão). Ilustrações soltas até
  256 px, pré-carregadas. **Gerar vários de uma vez**: `scripts/ui-grid.py` pede uma grade (ex.: 4×4) numa geração e
  fatia — gasta 1/16 da cota. **Bustos dos ninjas** (`src/art/bust-<penteado>.png`, cores-chave como as bases dos
  sprites): `unitPortrait(u)` recolore com `tintedArt`; `unitPortrait(u, true)` dá o corpo inteiro do sprite. Emblemas
  (`eclipse`, `path-*`) e o fundo do retrato do Kage (`kage-bg`): `scripts/ui-busts.sh`.
  **Regra de ícones (como no mockup)**: interface = SVG liso do Phosphor com cor por tipo (`.ic-<nome>` no CSS) —
  títulos, abas, etiquetas, botões, selos; pixel art só para recursos, itens, retratos, bustos, animais, cenas e selos
  de rank. Listas e grades que precisam de visual uniforme (números das Estatísticas, marcos e requisitos da Vila)
  usam só glifos, todos na mesma cor bege (o CSS força a cor; marco cumprido fica dourado). O que o Phosphor não tem é
  desenhado à mão no mesmo estilo em `scripts/custom-glyphs.mjs` (`kage` = chapéu do Kage, no lugar da coroa;
  `shinobi` = cabeça de ninja; `grave` = lápide; todos na cor base dos glifos). A barra de atalhos de baixo usa as
  sprites do atlas mesmo havendo glifo (`pxIco` em icons.ts).
  Pixel art em interface: no máximo 64 px e sempre no atlas. **Cabeçalho das janelas** numa linha (`winTop`): título · abas em botões (`.wtabs`) · etiquetas e ações à
  direita (`.wright`; no celular as etiquetas somem). Abas que preenchem a janela sem sobra: `.kfill` (Kage) e `.vfill`
  (Vila, Estatísticas) — o corpo da janela vira coluna flex e os painéis esticam. Retrato do Kage: `kagePortrait`
  (bustos `kage-bust-<penteado>` com chapéu e manto, recoloridos). "Preparar defesa": `prepareDefense` (org.ts).
  **Atualização dos painéis**: `morph` (ui/morph.ts) aplica só a diferença do HTML novo (o botão sob o dedo continua o
  mesmo elemento; `Panel.pressing` segura a troca enquanto o ponteiro está apertado) — não volte a usar innerHTML em
  algo que se atualiza sozinho. **Ritmo das telas** (`Panel.update`): o laço da interface roda 5×/s e só remonta o que está
  aberto (aba escondida não é calculada); o drawer remonta a cada vez, listas com barras/tempos (`SLOW_VIEWS`: Ninjas,
  Equipes, Missões, Expedições, Região, Oficinas) a cada 0,5 s e as telas paradas (`STATIC_VIEWS`: Bingo Book,
  Estatísticas, Kage, Vila, Clãs) só quando `Game.rev` muda (nascer/cair, prédio, aviso, ação do jogador) ou o dia, com
  rede de 3 s; pausado, nada se remonta sozinho. Ação do jogador e troca de tela chamam `update(true)` (na hora).
  **Padrão de botões** (panel.ts): liga/desliga = `togBtn` (rótulo curto; o botão muda de cor: ligado = verde com ✓,
  desligado = escuro apagado; sem chavinha e nada de "ligado/desligado" escrito: "Auto", "Auto-ensino", "Auto-sensei"); ação em lote = verbo curto + contagem ("Ensinar
  (4)", "Montar (3)", "Equipar"), explicação na dica; custo = `costTag` dentro do botão; linhas de botões seguidas têm
  espaço entre si. Cão de dono treinando no campo fica escondido junto dele (estado `withOwner`).
  **Glifos de interface** (fechar, voltar, menu, relógio, cadeado, engrenagem, casa, gráfico…) vêm do Phosphor Icons
  (MIT, só devDependency): `node scripts/glyphs.mjs` grava os caminhos em `src/ui/glyphs.ts`; `ico()` usa glifo →
  atlas pixel art → SVG de traço antigo. Retratos são blob URLs com cache (`canvasUrl` em sprites.ts; nada de data URL
  no HTML) e `pimg()` (panel.ts) mostra esqueleto enquanto geram/carregam. Com janela aberta o mapa é desenhado a
  ~12 quadros/s (main.ts). `prepare-ui.py` limpa o halo branco do contorno (`defringe`, também no tamanho final), pontinhos soltos (`despeck`) e
  vãos fechados que ficaram com o branco do fundo (`HOLES`: cadeado, engrenagem, quadrado;
  arte nova com o mesmo problema entra ali) — não corrija o PNG de saída à mão, o script regrava; bustos e ilustrações com filtro
  bilinear no CSS.
- **Câmera segue o selecionado** (`followSelected` em main.ts, `Camera.track`/`trackId`): lerp suave; arrastar solta; se a
  unidade se perder (caiu, saiu do mapa) volta suave para a Residência. Menu "Câmera segue o ninja" (`followCam`, padrão sim).
  Menu de pausa numa coluna (ações, configurações, novo jogo) com botão "Guia" para as dicas. **Processamento**
  (`simRate` em ui/settings.ts, por aparelho): Normal = 60 passos de simulação por segundo de jogo; Reduzido = 30, cada
  um com o dobro do tempo (main.ts, `simStep`): metade da conta para celular fraco, onde a simulação comia ~11 ms por
  quadro. O projétil mais rápido (420 px/s) anda 14 px por passo, menos que a caixa de acerto: não atravessa ninguém
  (`tests/sim-rate.test.ts` confere obra, coleta e luta nos dois passos). Vai no relatório do medidor. **Medidor de FPS**
  (`ui/fps.ts`, Configurações → "Medidor de FPS": Mostrar/Detalhado/Esconder, `fpsMode`, preferência por dispositivo):
  atual, média de 10 s e pior quadro, arrastável (posição guardada), duplo clique zera; `window.fps()` no console dá os
  mesmos números. **Detalhado** soma por meio segundo os ms de desenho, simulação (e passos por quadro) e interface
  (`FpsMeter.times`, medidos em main.ts), as 5 etapas mais caras do desenho (`Renderer.prof`) e a memória do JS: para o
  autor achar o que pesa num celular sem ligar o USB. **Botão de salvar** (canto do medidor, `.fpssave`): manda um
  relatório (`FpsMeter.report`: modelo pelos client hints do Chrome, GPU pelo WebGL, núcleos, memória, tela, PWA;
  qualidade e oclusão; FPS com p50/p95/p99 e faixas de ms; últimos 30 s do modo detalhado; memória do JS; situação do
  jogo e um `bench()` em `fps.info`, posto pelo main.ts) para `POST /api/perf-report`, que os dois servidores tratam em
  `scripts/perfReport.ts` e gravam em `.perf/devices/<data>_<modelo>.json` (fora do git). Endereço público: até 256 KB,
  um envio a cada 5 s por IP, no máximo 300 arquivos (os mais antigos saem). Mudou o `live.ts`/`perfReport.ts`:
  `pm2 restart villageninja` (o PM2 só refaz o build do jogo sozinho).
- **Oficinas** (janela, tecla F): uma oficina por aba (`craftTab`), estoque/produção/upgrade à esquerda e receitas à direita.
- Painel de inimigo/animal tem a seção "Atacar" (mais próximos / equipe / todos) — `availableFighters` em teams.ts.
- **Inventário do ninja** (aba "Inventário" do drawer, `equipSection`): boneco no meio com os espaços em volta (arma, colete,
  consumível) e o bônus somado; embaixo a grade do estoque com filtro por tipo (`invFilter`), seta verde no que é melhor
  que o equipado, lâminas com o ícone recortado do sprite (`bladeIcon`). Toque no item equipa; no espaço, tira.
  Listas longas em drawers rolam por dentro (`.scrollist`: Canil, jutsus, grupo, "Lá dentro", candidatos da equipe,
  receitas, inventário).
- **Alerta de inimigos** (`ui/hud.ts`, `#banners`): a faixa vermelha ("N inimigos na sua vila") leva a câmera a um inimigo
  dentro da vila e, a cada toque, ao próximo (`foe('threat', next)`); a faixa do chefe ("Kagerō ×2", com a vida somada)
  faz o mesmo entre os chefes vivos (`foe('boss', next)`). Cada faixa tem o seu botão "Ficha" (`.threatrow .bsheet`), que
  abre o painel do inimigo em foco (`Game.select`), porque o toque no mapa em cima de uma luta cheia de etiquetas raramente
  acerta nele. **Uma Ficha por vez** (pedido do autor: duas faixas com botão poluem): ela só aparece na faixa tocada por
  último (`sheetFor`) e some quando aquele alerta acaba. A linha é `.threatrow` (era `.brow`, que colidia com o
  chaveamento do Exame e ganhava fundo marrom).
