# Vila e ninjas: biblioteca, profissões, estações, ninken, equipamento, automação

> Detalhe movido do CLAUDE.md (o índice fica lá). Mantenha atualizado ao mexer no sistema.

- **Biblioteca de Jutsus** (`game/library.ts`, prédio com upgrade 1–3, arte nova `library` pensando nos níveis): jutsus
  básicos (rank E/D) a Academia ensina direto; do rank C em diante o pergaminho precisa ser ABERTO na Biblioteca (custo
  `SCROLL_COST` por rank, `openScroll`) para aparecer em "Ensinar jutsu" (`jutsuOptions(u, studyable(state))`). Nível 1
  abre até C, 2 até B, 3 até A/S (`LIBRARY.maxRank`) e acelera o estudo (`libraryLearnMult`). Kekkei e proibidos à parte.
  `state.jutsuOpen` (migração 22 abre o que a vila já sabe/estuda). Drawer: abas Fechados/Abertos.
  **Estudo** (systems/ninjas.ts, `studyTick`): a 1ª metade dentro da Academia (escondido, lendo); passada `PRACTICE_FROM`
  sai com o pergaminho nas costas e pratica no Campo de Treino mais perto da Academia (sem campo, no pátio em frente;
  estados `toPractice`/`practice`), ensaiando sem dano (`rehearse`): coreografia do golpe (`moves`), soco no taijutsu
  sem coreografia, ou os três selos e um brilho na cor do jutsu (`animKind 'seals'`, `SEAL_REHEARSAL` em data/moves.ts).
  **Treino no campo** (`trainMotion`, só desenho; o atributo é escolhido ao chegar, `trainKey` → `Unit.trainStat`): Taijutsu
  soco+chute (`train-tai` em `MOVE_SEQS`), Força golpe lento com poeira (`train-forca`), Velocidade corre em volta do campo
  com vultos (`runLap`; a volta é escolhida inteira livre ao começar, `freeLap`/`Unit.trainLap`; sem espaço, golpes), Stamina corre mais devagar e salta (`train-jump`), Selos os três selos em ciclo,
  Ninjutsu/Genjutsu meditam com aura (natureza / roxo, `meditating` em sprites.ts) e Inteligência lê sentado com o
  pergaminho no colo (`lapScroll`, desenhado por código). Trocar o foco no meio do treino troca na hora. Nenhuma folha nova.
  **Bonecos do campo** (`game/trainingField.ts`, pontos `post1..5` do tipo `training` no Editor de cenário): o destino
  sai pelo atributo em `goTrain` (Taijutsu/Força: o boneco menos usado, `freePost`, golpeando de frente; Velocidade/
  Stamina: a volta por fora dos bonecos, `fieldRoute`; o resto: canto longe deles, `quietSpot`); sem pontos, o jeito
  antigo (volta livre `freeLap`). Tudo no teto (`statsMaxed`): some o foco, "Treinar" bloqueado (`trainBlocked`),
  rotina Treinar volta para Auto e o Auto não treina.
  Foco em atributo já no teto da patente fica bloqueado (`focusCapped` em progression.ts: botão com `blocked` e o aviso
  dizendo a patente que libera; `setFocus` recusa); chegando ao teto treinando, o foco volta para Aleatório com aviso.
- **Profissões e invocações** (`data/specs.ts`, `data/contracts.ts`, `game/specs.ts` via `specTick` no sistema dos ninjas):
  Chunin+ aprende médico (Hospital nv 2), espião (Torre de Inteligência: revela espiões e marca alvos +15%) ou marionetista
  (Oficina de Marionetes: boneco = clone com `role: 'puppet'`). Contrato (lugares sagrados) invoca sapo/serpente/lesma:
  bichos `faction: 'village'` com `ownerId` e `life`, IA `ally` em hostiles.ts (a lesma cura).
- **Estações, clima e felicidade** (`data/seasons.ts`, `game/mood.ts`, `systems/seasons.ts`): estação derivada do dia
  (5 dias cada), clima sorteado na virada (colheita, velocidade, natureza +20%), felicidade 0–100 que se aproxima do alvo
  (`moodFactors`): acelera trabalho/nascimentos, abaixo de 25 moradores vão embora. Festival na janela Vila. O dia vem de
  `state.time` (testes avançam o relógio, não `state.day`). Chuva/neve/tom da estação desenhados em `weatherOverlay`.
  Neve acumulada no chão: `state.snow` (sobe enquanto `isSnowing`, derrete devagar; constantes `SNOW`). O resto do visual
  sazonal é só desenho, em `render/seasonal.ts`: textura de neve em células de 8 px (trilhas pisadas, pegadas, Katon
  derrete, Suiton congela poça), neve pintada no desenho dos canteiros (`snowField`), gelo na água pela profundidade (`iceLevel`), neve no alto dos desenhos (`snowCap`, por
  código; prédios com `roof`), árvore folhosa de outono/inverno (`seasonalTree`; o pinheiro fica verde), montes de
  neve, boneco de neve, lanternas do festival, fumaça de chaminé, bafo, nevasca (tempestade no inverno), folhas e
  pétalas caindo. Menu "Clima: Completo | Leve" (`setLightWeatherFx`) corta pegadas, bafo, fumaça e névoa da nevasca.
  **Chuva local** (`game/weather.ts`, `state.clouds`): em dia de chuva/tempestade (fora do inverno) nuvens cruzam o mapa
  com o vento; os efeitos do clima (`harvestMult`, `weatherSpeed`, `natureWeather` com x/y) só valem embaixo delas
  (`weatherAt`). O desenho (gotas no mapa, respingos, sombra, chão molhado/poças, raios) fica em `Seasonal.rainFrame`.
- **Ninken** (`game/ninken.ts`, prédio Canil): cão adotado pelo painel do ninja; bicho `faction: 'village'` com `ownerId`
  (IA `ally`), fareja espiões invisíveis e acha ervas fora da vila. Raças em `data/breeds.ts` (`Unit.breed`: shiba, branco
  gigante, pug farejador, buldogue) com arte `dog` / `dog-<raça>` e multiplicadores de vida, mordida, faro e ervas; a raça
  se escolhe no Canil. **Canil com upgrade** (sem arte nova): nível = vagas (`KENNEL_DOGS` 3/6/10, contando os sem dono) e
  raças (`BreedDef.kennel`: Shiba e Pug no 1, Cão branco no 2, Buldogue no 3). `releaseDog` solta o cão (volta ao Canil
  sem dono, `freeDogs`) e `giveDog` o passa a outro ninja sem custo; dono que cai: o cão para de lutar e corre para o Canil
  (morre se for abatido no caminho); lá dentro recupera a vida (`kennelRest`) e espera outro dono. Drawer do
  Canil: raças ordenadas pelo nível (cartão baixo com o cão de lado em meio corpo e o nível no canto; travada abre o aviso
  em vez de trocar) e abas "Sem cão" / "Com cão" (`kennelTab`, até 20 ninjas, os de nível mais alto; botões na linha do rank/nível); cães sem
  dono numa lista rolável para escolher qual vai no "Dar" (`dogPick`); o topo mostra só vagas e o custo de adotar. Dono escondido (em casa) ou em expedição: de dia o cão patrulha a vila farejando (`dogPatrol`), à noite dorme no Canil (`goKennel`, em hostiles.ts); volta a seguir o dono quando ele sai. **Sannin não fica com ninken** (já tem a invocação): `dogBlock`/`giveDog` recusam, quem vira Sannin solta o cão e `releaseSanninDogs` (automação) conserta saves antigos.
- **Desgaste e conserto** (`game/wear.ts`, `WEAR`/`ItemDef.dura` em data/items.ts): a arma gasta a cada golpe que acerta
  (corpo a corpo e kunai) e o colete com o dano que segura (`wearOut` em `applyDamage`/projéteis; só ninjas da vila, fora
  do duelo do Exame); expedição fora do mapa gasta `WEAR.away` na volta e o mapa jogável devolve o equipamento. Durabilidade
  em `Equip.dura` (sem = nova): abaixo de 25% fica gasta (metade do bônus), em 0 quebrada (nada) até consertar; lâmina
  lendária fica cega (-30%), nunca quebra (`gearBonus` já aplica). Peça gasta tirada vai para `state.worn` (não volta nova).
  Conserto na Forja (`repairUnit`/`repairAll`, `repairCost` = 30% do custo de fabricar pelo desgaste; só dentro da vila);
  Forja nv 2+ conserta sozinha abaixo de 60% (`autoRepairTick`, `flags.autoRepair`, padrão sim). Calibrado no save do autor:
  em 10 dias os que mais lutam gastam ~45% da arma e ~70% do colete (`.perf/wear.ts`). UI: barra e selo no inventário,
  filtro "Equip. gasto" na lista de Ninjas, seção Conserto na Forja (janela Oficinas e drawer).
  **Consumíveis**: a bolsa carrega pela patente (`CARRY`: Genin 1, Chunin 2, Jounin/Kage 3; `Equip.itemCount`) e repõe na
  vila; o gasto dos últimos 7 dias (`state.usage`, `noteUse`/`weekUse`) aparece no estoque da Farmácia e dos Selos.
- **Equipamento automático** (`autoEquipAll`/`setAutoGear` em gear.ts, `systems/gear.ts`, `state.flags.autoGear`): botões
  na lista de ninjas e nas oficinas. Promovido a Chunin numa equipe sem sensei vira o sensei (`promoteToSensei`).
- **Automação e fim de jogo** (`game/automation.ts`, `systems/automation.ts` a cada 2 s): Forja/Farmácia/Selos têm
  upgrade (arte `-2/-3`; `craftMult`/`queueMax` em upgrade.ts) e do nível 2 em diante fabricam sozinhas para manter o
  estoque (`Building.keep`, `autoCraftTick`); Academia ensina em lote/sozinha (`teachAll`, `flags.autoTeach`, até
  `maxLearners`, sem proibidos); equipes sem sensei recebem um (`autoSenseiTick`, `flags.autoSensei`); destinos do ryo:
  mercenários na Mesa de Missões (`hireMercenary`) e cristal/aço negro no Mercado (`buyRare`). Janela "Oficinas" (tecla
  F, `View 'crafts'`). Ninja aberto de uma lista da janela mostra "Voltar" (`app.back`); a equipe volta para onde veio
  (`teamFrom`); no desktop largo (`SIDE_BY_SIDE` em ui/dom.ts) a janela não fecha: encolhe para a esquerda e o painel
  lateral abre ao lado. Desktop: mouse parado sobre um prédio mostra a dica (`ui/maptip.ts`, `#maptip`), fixa onde surgiu.
  A lista de construção (`#buildbar`) é uma faixa logo acima dos botões de baixo.
