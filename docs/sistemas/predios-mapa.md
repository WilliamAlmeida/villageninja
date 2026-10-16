# Prédios, mapa, terreno e recursos

> Detalhe movido do CLAUDE.md (o índice fica lá). Mantenha atualizado ao mexer no sistema.

- **Upgrade de prédios** (nível 1–3; `data/upgrades.ts` + `game/upgrade.ts`): casa, fazenda, lenhador, pedreira, mercado,
  torre, hospital, campo de treino e academia (estudo mais rápido, recruta já sai com nível). A Residência do Hokage
  não tem upgrade: o nível dela (`Building.level`) segue o da vila (+1, `syncHokage` na automação) e o
  terreno cresce junto: 3×3, 3×3, 4×4, 5×5 (`sizes`; sem espaço, espera; save v37); arte `hokage`, `hokage-2..4`. A obra é feita pelos construtores (`needsBuilders`) com o prédio funcionando.
  Efeitos por nível via helpers (`housingOf`, `workersOf`, `farmYield`…) — use-os em vez de `BUILDINGS[t].housing`.
  Arte por nível: `<tipo>-2` / `<tipo>-3` em src/art (gerada pelo Codex com o nível 1 como referência).
- **Teto de prédios por nível da vila** (2026-10-15, docs/gdd-escala-ilhas-pvp.md seção 3; `BuildingDef.maxCount`
  `[n0..n3]`, `maxCountOf(type, level)`, `Game.buildingCount/buildingCap`, `countBlock` em commands.ts dentro de
  `canBuild`): a vila cresce subindo o nível dos prédios, não repetindo. Casa 5/8/11/14; lenhador e pedreira
  2/3/4/5; mina de ferro 0/2/3/4 (fazenda e horta viraram campos cercados, teto de canteiros abaixo); mercado 1/2/2/3; torre 3/5/8/12; campo de treino 1/2/3/4; únicos = 1;
  decorações e ruas sem teto. Prédio em obra conta. **Casa abriga 4 / 8 / 12** (`housingOf` = 4 × nível; era 4/6/8) e
  o `popLimit` é o das casas do teto cheias: 40/90/130/170 (era 60/100/150/200), imposto 3/4/4/5. Save antigo acima
  do teto: nada é demolido; `canBuild` só recusa o próximo ("Limite de 8 casas no nível Vila: suba a vila de nível (11
  no nível Vila Oculta) ou melhore os que tem."). Mover continua livre. UI: contador `3/8` no card do menu de construção
  (`.cnt`, cheio em `--warn`; o toque abre o cartão com o motivo), fato "Até N neste nível" no cartão, cartão "Casas
  N / teto" na janela Vila e aviso na aba de melhoria do drawer quando no teto. Sem migração de save. Testes em
  `tests/limits.test.ts`.
- **Campos cercados** (2026-10-16, save v49; `data/crops.ts`, `game/fields.ts`, `systems/crops.ts`, desenho em
  `render/fields.ts` com as folhas de `src/art/fields`, ver arte.md): substituem a Fazenda e a Horta de Ervas (que ficaram `buildable: false`, só como enfeite dos
  vilarejos invadidos). Modo "Cercar campo" (primeiro card da construção, `BuildUI.startField`, `roadMode: 'field'`):
  pinta canteiros tile a tile em **formato livre** (rascunho `FieldDraft` como as ruas, vale no "Pronto"; `commitFields`
  paga `FIELD.cost` de madeira por canteiro, tira árvore/toco/rua embaixo e refaz os cercados com `regroup`).
  Canteiros vizinhos (4 lados) = um cercado com **uma cultura** (`Field.crop`); partir ao meio vira dois com a mesma
  cultura, juntar fica com a do maior. **Teto total de canteiros** por nível (`FIELD.maxPlots` 18/36/48/60; colônia
  `FIELD.colonyPlots` 18; `plotCap`). `World.fieldTile` marca o campo de cada tile; prédio não entra no canteiro e fica a
  um tile da cerca. **Canteiro** (`Plot`): `st` 0 terra crua → 1 arada → 2 plantada (`g` 0..1 por dias de jogo × estação
  da cultura × água) → 3 madura (`ripe` conta; passados `FIELD.witherDays` murcha e volta a arada). Água: vizinho de água
  (`isPaddy`) ou debaixo da chuva local fica úmido; seco cresce `FIELD.dryGrowth`. **Culturas** (`CROPS`): trigo, nabo
  (rápido, aguenta frio), repolho (outono), arroz (só em canteiro vizinho de água, rende muito), abóbora (lenta, rende
  mais, a geada do inverno mata) e ervas (nível 1, era a Horta). **Solo** (`fert`): repetir a cultura tira
  `FIELD.fertStep`, trocar devolve; rende 50–100%. **Fazendeiros**: `Unit.fieldId` + `Field.desired/workers`
  (`assignJobs` enche os campos antes dos prédios; `maxWorkers` = 1 por `FIELD.plotsPerWorker` canteiros); a tarefa é
  o canteiro mais importante e livre (`nextPlot`: colher > semear > arar > regar; `taskId` = índice do tile), estados
  `toPlot`/`tending` em villagers.ts, `workPlot` aplica. Corvos bicam canteiro maduro (volta a arado) e levam comida.
  Drawer (`View.kind 'field'`, toque num canteiro): canteiros por etapa, mapinha do formato (`.plotgrid`), próxima
  colheita, solo, cultura em chips (bloqueadas com o motivo), fazendeiros, "Aumentar ou recortar" e "Desfazer".
  Migração v49 (`farmsToFields`): cada Fazenda vira 3×3 de trigo e cada Horta 2×2 de ervas nos mesmos tiles, já
  crescendo, com os mesmos trabalhadores, na vila e nas colônias. Jogo novo começa com 3×3 de trigo semeado. Colônia
  fora da tela: `fieldDailyYield`. Vitrine: um campo de cada cultura em etapas variadas (`f-campo`, `f-arroz`, `cercar`).
  Testes em `tests/fields.test.ts`. **Arte pendente**: folha do Codex de 32×32 por cultura e etapa, chão do canteiro e
  peças de cerca (lados do losango, cantos, portão) no lugar do desenho provisório.
- **Tamanho do mapa por estado** (`GameState.mapW/mapH`; `VILLAGE_W/H` = 112×112 e `SCENE_W/H` = 72×48 em config.ts):
  não há mais `MAP_W`/`WORLD_W` globais. Índices e limites vêm do mapa: `World.idx/inBounds/fidx/inFine/cellCenter` e
  `world.mapW/fineW`, ou `idx(s, …)`/`inBounds(s, …)`/`centerOf(s)` com o estado (`CENTER_TX/TY` = centro da VILA; os
  mapas de missão usam `SCENE_CX/CY` em scene.ts). Bitsets (`emptyExplored(s)`, `emptyRoads(s)`), câmera (`camera.map`,
  posto pelo `Renderer.render`), névoa, terreno e estações (`new Seasonal(s)`) pelo tamanho do estado; buffers do A* do
  tamanho do maior (`MAX_MAP_W/H`). Save v35/v36 (`growMap` em save.ts): a vila 72×48 foi para o meio do mapa novo
  (+20, +32 tiles) com tudo que tem posição (rotas = células remapeadas, névoa, ruas) e o terreno em volta gerado pela
  seed com a costura suavizada; território 19/26/36 e o mapa todo (era 12/17/23); nuvens de chuva pela área; a clareira
  inicial do `generateMap` acompanha o território do nível 0 (×1,6), não o mapa.
  **Chão em blocos** (`render/terrain.ts`, `Terrain`): o chão é pintado por blocos de 16×16 tiles só quando entram na
  tela (`visibleTiles` pela câmera), guardados por 10 s fora dela, nas duas resoluções (inteira e metade, usada com
  zoom < 0,75; trocar o zoom não repinta o que já existe); a memória é a do que se vê e o mapa não esbarra no limite de
  imagem do celular. **Orçamento por quadro** (`BUDGET_MS` = 3 ms; o 1º quadro pinta tudo): ao dar zoom entravam dezenas
  de blocos de uma vez e o FPS despencava; agora o que não cabe espera o quadro seguinte mostrando a outra resolução já
  guardada ou um bloco liso (`paintFlat`, só as cores base, marcado `flat` e repintado de verdade depois). Detalhe de cada tile com aleatoriedade fixa por
  tile (sai igual em qualquer bloco); as ondinhas da água só nos tiles à vista.
  **Construções no padrão novo** (`scripts/building-art.py <lote>`; funções comuns em `scripts/iso_art.py`): uma imagem
  por peça no Codex com o gabarito v2 do terreno do nível, a arte de hoje como identidade, as casas do piloto como estilo
  e o nível anterior já novo como referência; recorte, tamanho pela base (= losango) e grade do boneco →
  `docs/arte/predios/final/`; `--instalar` copia com backup (`docs/arte/_backup/<data>/<lote>/`), põe escala/posição
  no layout.json e tira peças antigas, ART_SCALE provisório e a marca de editada à mão. Lotes em `BATCHES` (feitos: kage;
  lote1 = academia, hospital, biblioteca com os 3 níveis, mercado; lote2 = forja, farmácia e selos (redesenhadas:
  botica de ervas com cortina roxa; oficina de papel de telhado cinza), lenhador, pedreira; `redesign` no lote = sem a
  arte de hoje como referência). O nível 3 ocupa mais terreno em mercado, forja,
  farmácia, selos, lenhador, pedreira (3×3), academia (4×4), hospital e biblioteca (4×3) (`sizes`; save v38: cresce no
  lugar, muda para o espaço livre mais perto ou volta ao nível 2 com a obra pronta esperando espaço).
- **Terreno por nível** (`BuildingDef.sizes`, `defOf(b)` e `layoutKey(b)` em data/buildings.ts): a casa nível 3 ocupa 3×3
  (cresce para a direita e para baixo a partir do canto). Onde o tamanho importa e há um prédio, use `defOf(b)`, não
  `BUILDINGS[b.type]`; terreno/porta/pontos do layout desse nível ficam em `<tipo>-<nível>`. O upgrade pede o espaço
  (`growRoom`) e, se fecharem o espaço durante a obra, ela espera (`Building.waitRoom`). Save v34 cresceu as casas nível 3.
- **Torre de Vigia 2×2** (save v33: a 1×1 cresceu no lugar ou foi para o lugar livre mais perto, `growBuildings` em
  save.ts). Arte em camadas: `<arte>` = base e `<arte>-top` = telhado/pilastras/parapeito da frente, no mesmo retângulo; o
  renderer desenha base → vigia → topo (`Drawable.top`, `drawTop`). Os 3 níveis usam a MESMA arte (`tower` + `tower-top`,
  pedido do autor; só os bônus mudam com o nível); as temáticas (`tower-fishing`/`-desert`) ainda são a 1×1 de antes
  20% maior (`ART_SCALE` provisório).
- **Vigia da torre** (`game/towerWatch.ts`, seção "Vigia" no drawer da Torre; `Building.guardId` ↔ `Unit.onTower`, save
  v32): um ninja da vila (fora de equipe, não estudando, não Kage) sobe e arremessa as kunais no lugar da torre com o dano
  e o ritmo dele (Força/Velocidade) e o XP é dele (`watchTick` no sistema dos ninjas, antes da IA comum). Fica fora das
  lutas comuns (`availableFighters`, auto-sensei, auto-ensino e "Montar" o ignoram); desce se for tirado, se a torre virar
  obra, ferido (< 30%: trata até o fim e volta), mandado estudar, ou sem alternativa (inimigo a menos de 70 px da porta e
  ninguém da vila lutando por perto). A posição lógica é a porta (é alvo de quem chega); o desenho fica na plataforma
  (marca `guard` da arte no Editor de cenário, `Renderer.guardSpot`), depois das peças de baixo e antes das peças com
  "Por cima do vigia" (`LayoutPiece.over`: o parapeito da frente de cada torre). Sem vigia a torre atira sozinha, sem
  ninguém desenhado (a folha `tower-guard` saiu).
  No desenho (`Renderer.watchPose`) ele fica a 70%, anda a cada ~5 s entre os pontos da plataforma (`guard`, `guard2`,
  `guard3` no Editor de cenário; sem eles, dois passos atrás de cada lado) e olha para os lados; arremessando, vira para o
  alvo. Não conta como "alguém atrás" da própria torre e esmaece junto com ela (`towerFade`).
  `remove-bg.py --vaos` limpa vãos brancos fechados (torres, porto, ruína). O `remove-bg.py` só considera fundo o quase
  branco SEM cor (parede creme e grama clara encostadas no fundo ficam) e tira a franja clara do contorno.
  `python scripts/rebg.py [nome]` refaz o fundo das artes de docs/arte/iso a partir da crua do Codex (achada no
  `.codex.txt`; anteriores em `docs/arte/iso/_antes-rebg/`).
- **Recursos crescem de volta** (`data/regrow.ts`, `systems/nature.ts`): árvore/rocha/veio esgotado vira toco/rocha rachada
  (`ResourceNode.regrow`) em vez de sumir. A rebrota fica mais lenta com o nível da vila (`regrowTime`, `CLEAR.levelMult`
  1/2/3/4× em game/clearing.ts). **Limpar área** (cartão na seção Decoração da barra de construção, mesmo modo de pintar
  da rua, `App.roadMode` 'clear'): arrastar marca árvores, tocos, rochas e veios (`ResourceNode.clear`, anel
  tracejado laranja): toque e arraste marcam só os recursos por onde o ponteiro passa de fato (`BuildUI.pickNode` pela
  arte em pé na tela, a copa da árvore conta; entre vários, o tronco mais perto; o arraste amostra a linha na tela a cada
  ~6 px desde onde começou), e o mouse mostra qual antes do clique; morador sem obra vai lá (`toClear`/`clearing` em systems/villagers.ts) e arranca: rende o que
  sobrava, o recurso fica `cleared` (sem desenho nem colisão, `nodeArt` 'cleared') e só volta depois de
  `CLEAR.regrowMult` (4×) a rebrota normal; com prédio ou rua em cima, sai do mapa de vez (`regrowCleared`).
  **Aterrar e cavar** (`game/earthworks.ts`, cartões ao lado do Limpar área, modos 'fill'/'dig'/'unearth'): marca tiles
  dentro do território (`state.earthworks`, save v40); aterrar paga `EARTH.fillCost` ao marcar (volta ao desmarcar),
  cavar é grátis (sem árvore/pedra/prédio no tile). Morador sem obra faz o trabalho de um tile vizinho em terra
  (`toEarth`/`earthwork`; prioridade: obras > terreno > limpar área), então o lago fecha pela margem. Pronto: troca o
  tile, refaz a areia em volta (`reshore`), a colisão e `Game.terrainRev`, que faz o renderer refazer o chão em blocos
  e a água da neve/gelo (`Seasonal.refreshWater`).
  **A luta marca o cenário** (`game/battleScars.ts`, chamado por `areaDamage` fora do duelo do Exame): golpe em área corta
  árvores (perdem madeira, esgotadas viram toco; golpe enorme arranca, rebrota ×2) e racha/quebra rochas e veios, sem render
  recurso; Katon põe a árvore para queimar (`ResourceNode.burn`, `burnTick` no sistema da natureza: chamas e fumaça,
  pode pegar nas vizinhas, sobra o toco queimado com rebrota ×2); Suiton e chuva apagam (save v41). Esgotado não bloqueia construção e é removido ao construir em cima. Alcance de
  coleta `searchTiles` (cresce com o nível; círculo tracejado no mapa ao selecionar lenhador/pedreira/mina).
- **Prédios repetidos com papel próprio** (`game/specialize.ts`, `data/specialize.ts`): Campo de Treino tem vagas
  (`TRAIN_SLOTS` 3/5/7 por nível; `Unit.trainId`), o ninja vai ao campo livre mais perto preferindo o do seu foco
  (`pickField`), e cada campo pode ter um foco (`Building.focus`, +50%; quem não tem foco treina o do campo). Cada
  Mercado pode vender o excedente de uma mercadoria (`Building.sells`, `marketSale`, sempre deixando a reserva `keep`).
  Únicos (um por vila): Hokage, Academia, Hospital, Biblioteca, Missões, Forja, Farmácia, Selos, Porto, Inteligência,
  Marionetes, Canil, Arena, Monte.
- **Decorações e ruas** (pedido do autor a partir dos mockups): decorações são prédios com `deco`/`mood` em
  data/buildings.ts (lanterna, banco, canteiro, estandarte, pedra sagrada, gato da sorte, cerejeira, fonte, lago de carpas,
  pagode; arte do Codex numa grade, `scripts/deco-grid.py` → docs/arte/iso → prepare-art; tamanho no mapa por
  `ART_SCALE`), seção "Decoração" na barra de construção; somam felicidade até `DECO_MOOD_MAX` (`decoMood` em mood.ts; a
  cerejeira floresce na primavera, fica verde e sem folhas no inverno: arte pela estação em `Renderer.artBox`; a lanterna
  acende à noite). **Ruas calçadas** (`game/roads.ts`, `state.roads` bitset por tile): cartão "Rua calçada" abre o modo de
  pintar (`App.roadMode`, arraste usa a caixa de seleção do Input; "Tirar" apaga), custo por tile, +30% de velocidade
  (`roadSpeed` em movement.ts) e o A* prefere a rua (`ROAD.pathCost`). A pintura é um **rascunho** (`App.roadDraft`,
  `draftRoad`/`commitRoads`): nada muda nem é pago até o "Pronto"; o X, Esc ou recarregar descartam. Nos quatro modos de pintar
  (rua, limpar, aterrar, cavar) não há botão "Tirar": o primeiro tile do toque/traço decide (`BuildUI.strokeDel`): em cima
  do que já está calçado/marcado, tira; senão, põe. Prédios e campos ficam quase transparentes (`Renderer.thinB`, 28%), e
  árvores/pedras também (`thinN`, inclusive os blocos do cenário), menos ao limpar. O tile sob o mouse aparece verde
  (põe), vermelho (não dá) ou rosado (vai tirar) (`paintPreview`, `App.roadHover.del`); o rascunho com contorno amarelo
  (calçar) ou vermelho (tirar). O X fica na quina de cima à direita da barra. A rua vale **embaixo de prédio** (calça-se por baixo e ela fica ao
  construir/mover/subir de nível); só campo/área aberta (`walkable`) tira o calçamento e não deixa calçar.
  Desenho no chão em `Renderer.drawRoads`.
- **Monte dos Kages e Pedra Memorial**: o monte é um paredão de montanha com um rosto esculpido por Kage de
  `state.kageHistory` (arte `monument-f1..6` de `scripts/monument-faces.py`, escolhida em `Renderer.artBox`; o antigo,
  bloco com arco, foi reprovado e está em docs/arte/_backup/2026-10-11/monte-antigo). Pedra Memorial (`memorial`, prédio
  único): lista `state.fallen` no drawer e o luto passa duas vezes mais rápido (systems/seasons.ts).
- Prédios podem ser movidos de graça (`canMove`/`moveBuilding` em commands.ts; o Hokage só se ninguém sair do território).
