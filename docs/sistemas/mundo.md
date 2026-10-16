# Exploração, região, expedições e mapas jogáveis

> Detalhe movido do CLAUDE.md (o índice fica lá). Mantenha atualizado ao mexer no sistema.

- **Exploração** (`game/explore.ts`, `systems/explore.ts`): névoa em bitset (`state.explored`, 1 bit por tile);
  unidades/torres da vila revelam ao redor. Na névoa nada em pé é desenhado nem clicável (inimigos, recursos, locais).
  Locais especiais (`state.sites`, `data/sites.ts`): ruínas (guardiões que só lutam com ninjas → pergaminho proibido em
  `state.scrolls`, que libera jutsus `forbidden` com risco de sequela), baús e entradas de mina. Ordem `scout` (Explorar)
  e comando `investigate`.
- **Locais que voltam** (`siteTick` em explore.ts, sistema explore): ruína/baú feitos e mina esgotada somem e reaparecem
  noutro lugar depois de `SITE_RESPAWN_DAYS` (de preferência na névoa). A mina aguenta `MINE_USES` expedições
  (`spendMine` ao terminar ou perder uma; `Site.uses`). Drawer da mina em cartões (andares, usos, fundo, força por andar).
  Ruína e mina têm duas artes (`ruin`/`cave`, editadas pelo autor, e `ruin-alt`/`cave-alt` do Codex): cada área do mapa
  (grade 3×2) sorteia uma pela semente (`Renderer.siteArt`); o Editor de cenário lista e ajusta cada uma ("versão 2").
  **Gabarito de chão** (`scripts/iso_template.py`, usado pelo `deco-grid.py`): o Codex recebe como 1ª referência uma
  folha com o losango 2:1 EXATO do terreno de cada peça (tamanho em tiles de data/buildings.ts) na casa dela, e o recorte
  usa a largura do losango; sem ele a base saía no ângulo/tamanho errado. Prédio novo deve usar o mesmo gabarito.
  **Piloto do padrão novo** (`scripts/pilot-art.py`: gabarito v2 com a altura em ninjas, recorte do objeto principal, escala
  única por folha nos prédios, grade do boneco 0,536 px, até 64 cores; `--instalar` copia para src/art com backup e ajusta o
  layout): torre nível 1 em camadas (`tower` + `tower-top`, vigia a 100%), casas 1–3 (a 3 em 3×3), banco, gato, árvores
  (84/90 px), rochas (24) e veios (27) — alturas dos objetos em `NODE_ART_H`/`STAGE_H` (sprites.ts).
  **Estudo da arte isométrica** em `docs/design-arte-iso.md` (`scripts/iso-audit.py` mede ângulo, encaixe no terreno e
  tamanho do pixel de cada arte contra a projeção do jogo): regras em discussão com o autor antes de refazer.
  Baús sem chão na arte (`scripts/strip-ground.py` → `<nome>-nograss.png`, usado pelo prepare-art; `SAME_SCALE`) e com
  sombra desenhada pelo jogo, para encaixar em qualquer piso. Baú aberto fica `CHEST_LINGER` (10 s) no chão com a arte `chest-open` e some numa nuvem de poeira (`doneFor`), e abrir dispara o efeito `treasure` (luz dourada,
  moedas, confete). Barra das cenas (`ui/scene.ts`): título com uma marca por andar, etiquetas (inimigos, equipe, saque),
  ações à direita e o objetivo numa linha embaixo; recolhida na vila. Cartão de melhoria mostra o nível de vila exigido
  como etiqueta (ex.: Biblioteca nível 3 = Vila Oculta).
- **Expedições às minas** (`game/expeditions.ts`, `data/expeditions.ts`, `systems/expeditions.ts`): a equipe sai do mapa
  (`Unit.away`, ignorada pelos sistemas), desce andares com eventos sorteados e o jogador decide descer ou voltar; o saque
  (recursos raros `crystal`, `gold`, `darksteel`) só entra na volta. Itens lendários na forja/farmácia; ouro vende no mercado.
  Janela "Mundo" (botão e tecla R).
- **Mapa da região** (`data/region.ts`, `game/region.ts`, `systems/region.ts`; janela Mundo → Região, fundo `src/art/region.jpg`).
  A aba é o mapa ocupando a janela: zoom (roda, pinça, botões; até `MAP_ZOOM_MAX`) e arrastar (`Panel.map`, `applyMap`/
  `zoomMap`; a camada `.rlayer` cobre a vista em 3:2; o zoom `--z` muda a LARGURA dela, não um `scale`, para mapa e rótulos saírem nítidos; ampliada além da imagem, pixels duros, classe `px`); vila, vilarejos, covis e posto
  avançado são miniaturas desenhadas como no mapa do Ikariam (atlas `src/art/region-places.png`, `scripts/region-places.py`:
  uma grade do Codex fatiada; ordem = `REGION_ART` em panel.ts) com placa de pergaminho e bandeira da situação (`.rflag`);
  ilhas e lugares sagrados já estão pintados no fundo e ficam com ícone + placa. A sua vila muda de desenho com o nível
  (`HOME_ART`), vilarejo hostil aparece queimado (`<id>-x`) e a equipe em viagem segue uma trilha curva desenhada no
  terreno (`regionTrail`: SVG `.rtrails` pelas estradas do fundo, pontos de passagem em `REGION_ROUTES` de data/region.ts com
  `sail` = onde vira mar; chão batido por terra e rastro de barco pelo mar, pegadas andando). A equipe em viagem é um
  desenho pequeno do atlas (olham para a direita, espelhados pelo rumo): carroça vazia na ida, cheia na volta com
  espólio, vazia se recuou/não havia o que trazer, sem carroça (feridos) se perdeu (`Expedition.outcome`, posto por
  `resolveRegion`); no mar, barco vazio/cheio ou jangada. Mapa novo: refazer as rotas olhando a grade em %. Tocar num lugar abre o
  painel dele por cima (`.rsheet`, `focusNode` tira o lugar de baixo dele; se o painel da direita taparia o lugar, vai para a
  esquerda, classe `.side-l`, com legenda e zoom do outro lado e entrada espelhada); equipes em viagem andam no mapa pela trilha
  tracejada (`.rtoken`/`.rroute`); legenda e "como funciona" no canto. Quadro de missões numa tela só (disponíveis e
  recentes; as ativas na coluna da direita ou no alto na estreita).
  vilarejos (comerciar, proteger, saquear, anexar), ilhas (explorar, posto avançado, treinar no templo) e lugares sagrados
  (contrato de invocação). Cada ação é uma expedição `kind: 'region'`. Ilhas e lugares sagrados exigem o prédio Porto.
  Virada do dia: tributos, postos, vingança dos saqueados e ninjas errantes. Honra/infâmia em `state.honor/infamy`
  (bônus de troca e saque, caçadores de recompensa nas invasões). Posições dos lugares em % da imagem.
- **Mapas de missão jogáveis** (`game/scene.ts`, `ui/scene.ts`): saquear ou anexar à força um vilarejo abre um mapa
  próprio (`state.scene`, um `GameState` dentro do save da vila, com `sceneInfo`). A vila o roda junto no mesmo passo
  (`sceneRunSystem`; o mapa usa `SCENE_SYSTEMS`), a equipe é copiada para lá (`Unit.origin`) e `closeScene` devolve vida/
  XP/atributos/mortes (Hospital da vila pode resgatar). Torres do mapa atiram pelo inimigo (`state.towersFaction`).
  Ninjas no mapa avançam sozinhos para o objetivo (`advanceTarget`) se o jogador não der ordem. `app.home` é sempre a
  vila (HUD, menu, construção, janelas, save); `app.game` é o que está na tela (`app.viewScene`, `app.setView`); o
  renderer guarda terreno/estações por estado. Toast de outro mapa troca a tela ao tocar. **Minas** também: cada andar é
  uma caverna (`createMineScene`, autômato celular; tile `T.ROCK` bloqueia), escura com tochas, bichos guardando, baús que
  abrem ao encostar e a descida (local `cave`), enfeitada por `render/cave.ts` (só desenho: estalagmites, cristais e cogumelos com luz própria, poças,
  ossos, carrinho, escoras, tochas e caixotes; atlas `src/art/cave-props.png` de `scripts/cave-props.py`); vencido o andar a expedição fica em `choice` com o mapa aberto (Descer/
  Voltar na barra; `chooseExpedition` fecha e abre o próximo). Último andar: guardião (golem). `closeScene` devolve também
  o saque juntado no mapa. **Ilhas** (Explorar: `createIslandScene`, terra cercada de mar, bichos da ilha, amostras =
  baús; recolhidas todas, `explored`) e **lugares sagrados** (Contrato: `createTrialScene`, clareira com o guardião, o
  animal do contrato enorme; vencido, dá o contrato). **Covil da Ordem** (`createHideoutScene`, caverna com os
  guardiões e o líder; vencendo, `org.done`).
- **Mapas temáticos** (`SceneInfo.theme`, `shapeTheme` em game/scene.ts): saque/anexação da Vila dos Pescadores (`pesca`:
  mar ao sul com praia e o Porto) e da Cidade dos Mercadores (`mercadores`: deserto com oásis, sem árvores). Casa, mercado
  e torre trocam para `<tipo>-<tema>` no desenho e os enfeites vêm de `render/themeProps.ts` (atlas `theme-props`,
  `scripts/theme-art.py`). Vitrine: `cena-pesca`, `cena-deserto`. A prova do contrato (`createTrialScene`) põe a clareira num platô cercado de
  penhasco (anel de `T.ROCK` de raio `PLATEAU_R`) com a escada de pedra na abertura ao sul (`isStairs`; tema `cliff`, blocos
  `cliff-a/b/c` e `stairs` no mesmo atlas).
- **Colônias nas ilhas** (2026-10-15, docs/gdd-escala-ilhas-pvp.md seção 5; `game/colonies.ts`, `data/colonies.ts`,
  `systems/colonies.ts`, save v48): cada colônia é um `GameState` de 48×48 (`baseState(seed, { w, h })`) guardado em
  `state.colonies[ilha]` da vila, com `colony: ColonyInfo` (ilha, tema, dia da fundação, último dia resumido, diário) e
  `RegionState.colony` na ilha. O mapa é uma ilha cercada de mar com praia, no tema da ilha (`ISLAND_THEME`; `themeOf(s)`
  em scene.ts serve o renderer e os enfeites, para cenas e colônias), com o Porto na praia do sul e uma casa (duas se já
  havia posto avançado), tudo explorado e três bichos da ilha guardando o interior. Primeiro tema: pesca, na **Ilha do
  Recife** (`recife`, a oeste; rende peixe e pérolas = `food`/`ryo`). **Tesouro compartilhado**: `res` e `items` da colônia
  são o mesmo objeto da vila (`link` em `colonyGame`; o save guarda uma cópia e o carregar religa) — construir lá paga da
  vila e o que ela produz entra direto. **Fundar** (mapa da região → ilha explorada → "Fundar colônia", `COLONY.cost`,
  até `COLONY.max` = 3): o jogador escolhe quantos moradores (os sem emprego vão primeiro) e quais ninjas (`colonists`: sem
  Kage, ANBU, Sannin, em missão, de vigia ou com cão); `sendColonists` cria o mapa na hora e manda uma expedição
  `kind: 'colony'` em que os colonos viajam DENTRO dela (`Expedition.passengers`, já fora da lista da vila: equipe,
  emprego e casa desfeitos em `takeFromHome`); ao chegar (`arriveColony`, chamado por `tickExpeditions`) entram no mapa
  com ids novos perto do Porto (`settle`). A mesma tela manda mais gente para uma colônia que existe (sem custo). Quem
  mora lá conta no `popLimit` da vila (`Game.colonyPopulation`, descontado em `popCap`); a colônia tem o próprio teto
  (`COLONY.popLimit` = 48). **Tetos próprios** (`colonyCapOf`, `countBlock` → `colonyCountBlock` quando `state.colony`):
  4 casas, 3 de produção SOMADOS (lenhador, pedreira, mina), 1 mercado, 4 torres, 1 porto, 18 canteiros de campo cercado; decorações
  livres; o resto (Academia, Hospital, Biblioteca, oficinas, Arena…) "só na vila". `Game.buildingCap` usa essa tabela
  na colônia. **Fora da tela** (`colonySystem`, na vila, depois da região): na virada do dia `colonyDay` credita
  `colonyIncome` (fórmula fechada por trabalhador, `COLONY_YIELD` por dia, mercado escala com
  `marketYield`; campos cercados por `fieldDailyYield`, lenhador/pedreira/mina só com o recurso no mapa; mais o `outpost` da ilha, que o posto deixa de pagar
  quando há colônia), cobra a comida (`FOOD_PER_DAY` × gente × estação), termina obras e upgrades em andamento e sorteia
  uma ameaça (`COLONY.threatChance`; defesa = `unitPower` dos ninjas + torres × `towerPower` + moradores; perdendo,
  todos se ferem 30%, metade da produção se perde e, muito abaixo, alguém pode morrer) — sem simular luta, como as
  expedições. Guarda `colony.day` para não dobrar. **Na tela** (`App.openColony(id)`, `App.viewColony`,
  `Game.activeColony` posto pelo main; `app.game` passa a ser `colonyGame`): o sistema sincroniza hora/dia/clima/nível
  e dá `step` com `COLONY_SYSTEMS` (status, população, equipes, moradores, ninjas, inimigos, torres, técnicas,
  projéteis, efeitos, exploração, natureza — sem tempo, invasões, missões, Kage); `colony.day` acompanha o dia, então o
  resumo não passa por cima do que foi vivido. Barra do alto (`ui/scene.ts`) mostra "Colônia · ilha", a gente e "Voltar à
  vila"; o botão Construir e Selecionar funcionam lá (`BuildUI` usa `app.game`), as janelas de gestão voltam à vila
  primeiro; toasts da colônia levam o id (`toast.colony`) e o toque abre o mapa dela. Ficha da ilha na região: cartão
  da colônia (gente, prédios, rende por dia, última linha do diário, "Visitar colônia") e a escolha de quem vai; a
  ilha ganha a cabana do posto e bandeira azul no mapa; colonos em viagem aparecem na trilha e em Expedições
  ("Colonos"). Vitrine: `?demo&tela=colonia` (colônia no Recife com 6 moradores, 2 Genins, um campo de repolho e uma torre em obra).
  Testes em `tests/colonies.test.ts`. Pendente para depois: ataque às colônias (GDD 6.3), volta de gente para a vila,
  temas das outras ilhas (hoje só o Recife tem tema; as outras viram ilha comum).
