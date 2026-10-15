# Ferramentas (localhost:3011): editor de sprites, laboratório, editor de cenário

> Detalhe movido do CLAUDE.md (o índice fica lá). Mantenha atualizado ao mexer no sistema.

- **Ferramentas** em http://localhost:3011: a raiz é o início com os três editores (cada um tem o link "Início").
  Visual comum em `tools/shared/tools.css` (tons do jogo: barra no alto com nome, modos e ações; painéis em cartões;
  trilho de ferramentas com ícone e tecla; chaves liga/desliga `label.tog`; dicas instantâneas por `data-tip`, nada de
  `title`; botão Salvar com ponto quando há mudança) e `tools/shared/ui.ts` (`ico`, `applyIcons` para `data-ico`,
  `helpDialog` = diálogo de atalhos no botão "?" e na tecla ?). Glifos só das ferramentas (lápis, borracha, balde…)
  em `tools/shared/glyphs.ts`, gerados pelo mesmo `scripts/glyphs.mjs` (lista `TOOLS`), fora do jogo. Botão com ícone:
  o clique pode cair no `<svg>`, então quem lê `e.target` usa `closest('button')`.
  **Editor de sprites** (ferramenta de desenvolvimento): http://localhost:3011/spr (`bun run editor` ou PM2
  `villageninja-editor`; `scripts/editor.ts` + `tools/sprite-editor/`). Só escuta em 127.0.0.1, fora do túnel. Monta o
  ninja por patente/penteado/cores igual ao jogo, mostra a animação (lado nos dois sentidos, frente, costas), o tamanho
  real no jogo e a folha inteira; edita pixel (lápis, borracha, linha com Shift reta, balde, conta-gotas, cores-chave; botão direito ou
  "apagar"/X fazem lápis, linha e balde apagarem), seleciona um retângulo (S) ou pela varinha mágica (W: área da mesma
  cor com tolerância, "Adjacente" ou o quadro todo; Shift soma, Ctrl tira; forma livre em `selMask`) e move só o
  selecionado como **seleção flutuante** (`float` em editor.ts: levantado da camada e solto por cima até fixar com Enter,
  Esc, outra ferramenta/quadro/camada ou salvar; Ctrl+arrastar duplica; setas = 1 px; Delete apaga, Ctrl+C/V copia e cola,
  também com a área de transferência do sistema: dá para colar do Photoshop, e o colado nasce flutuando) ou, sem seleção,
  a camada inteira num quadro ou na vista toda; com desfazer. Ferramenta **Ponto** (P): marca pontos nomeados por quadro em
  `src/data/layout.json` (`arts[nome].points`, lidos por `artPoint`): `hand` no corpo-base (a mão que segura a arma,
  por vista e quadro) e `grip` nas espadas soltas `sword-<id>` (modo Arquivo); "Aplicar à vista/a todos" copia. Ferramenta **Origem** (O): mostra e ajusta a origem (clique/arraste), o alto do corpo (Shift+clique ou o campo Corpo) e a sombra (largura/altura) das folhas de personagem e bicho, com a prévia no tamanho do jogo já com a sombra. A origem vale para a Folha, a Vista ou só o Quadro (bicho que muda de forma conforme a pose, como a cobra): `arts[nome].feet` por quadro, senão `foot` (`frameFit` em art.ts); a animação da prévia alinha cada quadro pela sua origem. Modo "Arquivo" abre qualquer PNG de src/art, inclusive os de interface (`ui/…`): os atlas `ui/icons` e `ui/cards` abrem divididos nas casas, com o nome do ícone da casa (do `pxicons.ts`), e a folha inteira à direita escolhe a casa. `prepare-ui.py` respeita o `art-edits.json`: atlas editado é remontado guardando as casas existentes (só ícone novo sai da fonte), ilustração editada não é refeita; `--refresh=nome,…` refaz só esses, `--force` tudo. Salvar grava em src/art
  (cópia do anterior em docs/arte/backup-editor/); arquivo salvo no editor entra em `src/art/art-edits.json` e o
  `prepare-art.py` / `prepare-layers.py` não o refazem a partir da fonte (só com `--force`).
- **Editor de cenário** (http://localhost:3011/cenario, `tools/scene-editor/`; dados em `src/data/layout.json`, lidos por
  `data/layout.ts`): ajuste fino de cada construção (e nível, e a arte dos mapas temáticos), local (ruína, mina, baú, com
  as versões 2) e objeto (árvore, rocha). A prévia desenha exatamente a arte do item (`Renderer.previewArt`); a lista é
  montada depois do `preloadArt` (`fillItems`). Variantes sem ajuste próprio usam o da arte-base (`artFamily` em
  data/layout.ts: as 6 faces `monument-fN` usam o do "Monte dos Kages", a cerejeira verde/sem folhas o da cerejeira). **Peças**:
  máscara pintada com pincel ou lata de tinta (troca a área contínua da máscara clicada pela peça ativa) ou POLÍGONO por peça (pontos arrastáveis em 0–1 da imagem, `LayoutPiece.poly`, peça com polígono = exatamente o polígono, `applyPolys`; clique na aresta cria ponto, botão direito apaga, "Adivinhar forma" = contorno convexo, `fillPoly`/`hullOf` em render/pieces.ts; atalhos B/G/P/E) separa a arte em pedaços (`render/pieces.ts`); cada peça é desenhada na profundidade da sua
  âncora (onde toca o chão), o "resto" vai no chão (`ground`) ou em pé; transparência por peça (área própria ou o
  contorno). **Terreno**: tamanho em tiles (sobrepõe `w`/`h` do prédio) e células de MEIO tile (16 px) muro `#` /
  portão `g` / livre `.` (`tiles` com h×2 linhas de w×2 letras; clique troca, arrastar pinta; `World.rebuild` e `blockSites`) e **bloqueios
  avulsos** numa margem de 3 tiles em volta do prédio (`TypeLayout.extra`, células relativas ao canto, podem ser
  negativas): a arte que passa do terreno (muro da arena) bloqueia sem aumentar o prédio.
  Célula `~` (água) em qualquer prédio (ciclo livre → muro → portão → água no Editor de cenário): o tile com célula de
  água PODE ficar em cima da água do mapa (a roda d'água do lenhador nível 3 na beira do rio) ou em terra (em terra
  nada é desenhado embaixo; sobre água de verdade, a sombra, `shoreGround`); nada é obrigatório e o fantasma não gruda
  (`hasWater`/`wetTile` em world.ts; `World.groundBlock` = a regra do chão de um prédio comum: rocha nunca, água só sob
  tile com `~`, porta em terra firme; vale em `canPlace`, `placeError` e `growRoom`). O autor reprovou a versão em que a
  água no terreno tornava o nível um prédio de margem (obrigava água e grudava): só o Porto é assim.
  **Prédio de margem** (`BuildingDef.shore`: só o Porto; `isShore`): célula `~` (água) no terreno = píer/barco em cima da
  água; para construir, tile só com `~` precisa ser água, só com `#` terra (os dois = a beira) e a porta em terra
  (`World.shoreFits`).
  **Todo prédio pode ser espelhado** (`Building.flip`, `canFlip`; botão "Girar" e tecla R ao posicionar ou mover): troca x
  por y no terreno, nos bloqueios e pontos (`tileOf`/`extraOf`/`layoutPoint` com `flip`, também os da arena), espelha a
  arte em volta da ponta da frente (`artBox`) e as marcas (`guard`, `chimney`); terreno retangular troca largura e
  altura (`defOf({…, flip})`); sem porta marcada, a porta vai para a face da frente-direita (`doorTile`). Ao posicionar o
  Porto, o fantasma gruda na beira mais perto já com o lado que põe mais água do terreno sobre água de verdade
  (`shoreSpot`); depois do Girar o lado fica travado (`Ghost.flipLocked`). Chão: terra batida só sob o muro e sombra na água
  sob o `~` (`shoreGround`). A prévia usa o `artBox` (escala/deslocamento do editor), igual ao prédio pronto.
  **Colisão em meio tile** (`SUB`/`CELL`/`FINE_W` em config.ts): `World.fine` é a colisão de verdade (`walkablePx`,
  `walkableCell`), a busca de caminho anda nas células (`findPathPx`/`findCells`; `u.path` guarda índices de célula,
  `cellCenter`); `World.blocked`/`walkable(tx,ty)` seguem em tiles (bloqueado se qualquer pedaço for) para escolher
  lugar de nascer/trabalhar. Caminho que começa dentro de muro sai pela célula livre mais perto. **Objetos de cenário**
  também têm terreno, pela arte do estágio (`nodeArt`: tree0/tree1/stump0/stump1/rock/rock-cracked/rock-pebbles/ore/ore-empty/herb; `nodeTiles`):
  rocha, rocha rachada e veio vêm com 1 tile; árvores livres. Estágios (`nodeArt`, o mesmo para colisão e desenho): toco de
  cada árvore (`stump0` folhosa, `stump1` pinheiro), rocha rachada depois da metade, rocha esgotada some numa nuvem e deixa
  `rock-pebbles` (sem colisão) até voltar, veio esgotado vira `ore-empty` (sem os cristais). Recurso é obstáculo MACIO (`World.soft`): o A* desvia
  (custo `SOFT_COST`) e a linha reta do `chase` não passa (`clearPx`), mas atravessa se não houver saída (aglomerado de
  rochas nunca prende ninguém). `World.refreshNodes` (sistema da natureza, a cada 1 s) refaz só as células macias.
  **Ilhas** (`World.region`, refeitas na colisão dura): destino noutra ilha falha na hora em vez de varrer o mapa; e
  `setDestination` não repete a mesma busca sem saída por 1,5 s (sem isso, um morador sem caminho custava 7 ms/passo). Bandeira de "defender ponto"
  some quando o ninja chega nela. **Arte**: escala e deslocamento (`Renderer.artBox`/`siteBox`, `drawNode`). **Pontos**:
  porta (`doorPos`), Exame (`center`, `edge`, `left`, `right`, `seat1`…`seat8`), marcas na arte (`guard`, `chimney`). Bonecos de
  teste (vários; arrastar ou mandar andar pelo caminho de verdade), com "Mostrar" para ver junto as peças, o terreno,
  os pontos e a linha do chão (lembrado no navegador). Salvar grava o JSON (cópia em docs/arte/backup-editor) e
  o jogo se refaz. A arena começou de `scripts/layout-arena.py` (rodar de novo sobrescreve a arena).

## Ajuste fino dos jutsus: peças e diagnóstico de contato (2026-10-15)

A aba Sprite seleciona Principal/projétil, Impacto, Rajada, Fonte, Cratera, Perfil ou Diagonal. Cada peça com
folha tem as mesmas seções Pontos (zoom), Tamanho e aparência e Grade da folha. Ao escolher um jutsu,
o painel abre a primeira peça existente; Kirin/Nagashi abrem Impacto, Daitoppa abre Rajada. Fonte também
edita a boca e duração; cratera edita a duração; impacto escolhe chão ou corpo.

Para ajustar a colisão: ligar Diagnóstico de contato e Pausar no contato, disparar e observar a elipse azul
do corpo, o ponto amarelo da arte e o segmento laranja. A última sprite fica como referência transparente.
Ajustar o marcador Contato em Pontos (zoom) e o raio em Contato do projétil, repetir em outras direções
e distâncias e salvar. Restaurar frente medida remove o ajuste manual e usa `sprite-contacts.json`.
O botão Passo e a tecla ponto avançam um único `SIM_DT`, em vez de 0,25 s. Ajustes também redesenham pausado.
Daitoppa: selecionar Rajada e ajustar À frente da origem, Lateral da origem e Deslocamento X/Y.
Sekizō tem controles próprios de largura, opacidade e origem dos canhões; seus cinco socos não usam leque.

Links reproduzíveis para inspeção: `/lab?jutsu=sekizo&at=0.95`, por exemplo, solta o jutsu, avança até o
instante e pausa. Apenas IDs existentes e intervalos de 0 a 3 s são aceitos.

O protocolo de salvamento do laboratório está na revisão2 (`X-Fx-Editor-Version`). O servidor recusa com409
páginas antigas antes de escrever; é necessário recarregar uma página que estava aberta antes da atualização.
`formatFx` também conserva campos futuros de peças. Correção motivada pelo servidor antigo descartar
`gust/cannon` ao salvar ajustes. O editor local foi reiniciado para carregar o novo formato.

Capturas verificadas no laboratório: `output/playwright/sekizo-canhoes.png`,
`daitoppa-origem.png` e `yokai-impacto-chao.png`. Yōkai usa camada de chão e deslocamentoY+12,
alinhando a poça à base dos pés. O corpo humano da colisão fica no centro da arte (base+9, altura30),
não no ponto acima do corpo usado pela caixa anterior.
