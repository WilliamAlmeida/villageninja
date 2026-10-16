# Desenho: vista isométrica, oclusão e efeitos

> Detalhe movido do CLAUDE.md (o índice fica lá). Mantenha atualizado ao mexer no sistema.

- `src/render/` desenho. **Vista isométrica**: a simulação segue ortogonal (px de mundo); só a projeção muda
  (`core/iso.ts`). `renderer.ts` desenha em duas passadas — "chão" (terreno, chão dos campos e marcações, em coordenadas de
  mundo com `groundTransform`) e "em pé" (prédios, árvores, unidades e as plantas e cercas dos campos no ponto projetado, ordenados por profundidade).
  A profundidade é a LINHA ONDE O DESENHO TOCA O CHÃO (`Renderer.baseLine`: pés do boneco = ponto + 9 px, base da
  rocha/árvore, base do baú/ruína), mais o ajuste `depth` da arte no Editor de cenário (modo Arte, linha laranja).
  Prédios com peças usam a âncora de cada peça; prédios inteiros, o centro com a regra das faces da frente.
  **Quem passa atrás** (`occluders` devolve quem cada prédio/árvore tapa; Configurações → "Atrás de prédios",
  `OcclusionCfg` em ui/settings.ts → `Renderer.occl`, por aparelho): Silhueta (o desenho do personagem numa cor,
  recortado pelos pixels de quem o tapa, por cima; só ninjas da vila, inimigos, bicho lutando e o selecionado),
  Esmaecer (o prédio inteiro a 38%, o padrão), Furo (círculo em volta de quem está atrás) e Pontilhado (a transparência
  vira um xadrez de Bayer 4×4 no tamanho do pixel da arte, alinhado ao mundo); combinam. Furo e pontilhado desenham o
  prédio numa camada fora da tela só do tamanho dele (`toLayer`/`occludedBlock`). **Silhueta em passada adiada**
  (`prepareSilhouettes`/`flushSilhouettes`): numa GPU de celular o que pesa é cada TROCA de canvas (fecha uma passada de
  render), e a versão antiga trocava 4 vezes por personagem no meio do desenho do mapa (a meia distância, ~23 ninjas atrás
  de árvores: o G100 caía a 40 qps). Agora a passada principal só anota, na ordem em que desenhou, quem ganha silhueta e
  os blocos que tapam algum deles (`silEvents`); no fim, de trás para a frente e fora da tela: bloco → camada M (máscara =
  tudo desenhado depois do personagem da vez; `maskPass` evita a fumaça repetida); personagem → corpo numa cor só
  (`drawUnitSilhouette` em sprites.ts, `solidArt` em cache) recortado por M e somado em O; O vai à tela uma vez, a 60%.
  Até `MAX_SILHOUETTES` (16) por quadro: selecionado/grupo primeiro, depois inimigos, depois os mais perto do centro da
  tela; com o zoom afastado (`far`, < 0,85), sem os ninjas da vila (miúdos, quase todos atrás de alguma árvore). Medido no
  PC a zoom 1: 1,3 ms de CPU e ~40 trocas de canvas (eram 2,1 ms e ~92).
- **Desempenho com o mapa inteiro à vista** (medido 2026-10-13 no save do autor: 2.316 recursos, 169 unidades, PC 1920×863,
  Alta + Silhueta: zoom 0,45 ia a ~24 qps mesmo pausado; agora 57-60 qps de dia e de noite, CPU do desenho 31 → 13 ms):
  - **Suavização**: reduzir arte com `imageSmoothingQuality = 'high'` faz a GPU refazer o mipmap a cada desenho (~2 mil por
    quadro). `drawShrunk`/`drawWhole` (art.ts) desenham pela cópia reduzida pronta (½, ¼, ⅛, feitas uma vez por arte,
    `mipFor` escolhe a que fica entre ½ e 1) com suavização `'low'`; ampliando, sem suavização. Nada de `'high'` no
    canvas principal: o `render` começa cada quadro com `'low'` (a "high" que sobrava fazia o chão em blocos, que é canvas,
    refazer o mipmap de cada bloco todo quadro, o maior custo de todos).
    As cópias são feitas FORA da thread (`createImageBitmap` com redução de qualidade, cadeia ½ → ¼ → ⅛ por arte,
    `buildMips`): na hora, no quadro em que a arte aparecia, custavam 20-40 ms por arte grande no celular fraco (primeiro
    quadro de 1,4 s no K12); enquanto não está pronta, sai a melhor cópia que existe ou a original com suavização
    simples. `warmMips` pede as do cenário em pé logo depois do carregamento. Sem `createImageBitmap` (testes), na hora.
  - **Chão em blocos**: o orçamento (3 ms) é conferido ANTES de pintar cada bloco, com o custo médio dos últimos
    (`paintMs`), sempre ao menos um por quadro; o primeiro quadro tem 40 ms (`FIRST_MS`) e o resto entra nos seguintes.
  - **Qualidade Leve**: sem chão molhado nem respingos da chuva (a textura refeita a cada meio segundo custava até 10 ms
    no K12; `seasonal.ts`, `light`) e, com uma janela de gestão aberta, o mapa fica parado na última imagem (main.ts;
    nas outras qualidades segue a 12 qps por baixo da janela).
  - **Ondinhas da água** (`drawWaterAnim`): juntadas em 6 faixas de transparência, um `stroke` por faixa (antes um por tile
    de água, ~2 mil); na névoa não desenha.
  - **Profundidade**: os prédios entram num balde por coluna de tile (`depthCols`) e cada coisa em pé só compara com os da
    sua coluna (antes todos × todos: 11 ms por quadro).
  - **Caminho das árvores**: `drawArt` guarda a geometria por imagem (`geoOf`: folha, quadro, layout) e só usa save/restore
    espelhando; `drawNode` só salva com achatamento; esmaecer dos recursos pelo id (`nodeFade`), sem chave de texto.
  - **Cenário parado em blocos** (`render/scenery.ts`, zoom < `STRIPS_BELOW` = 1): árvores, rochas, veios e ervas
    pintados uma vez em blocos (faixas de `BAND` = 128 px da cena × colunas de 512, com folga para a copa) e colados
    prontos; o índice (`sceneryIndex`: ponto, linha de base com a regra das faces dos prédios, retângulo do maior
    desenho do recurso por `nodeRect`) é refeito quando recursos, prédios, layout ou nível mudam. O bloco entra na
    ordem no começo da faixa; tudo o que é desenhado na faixa redesenha por cima, recortadas no seu retângulo, as
    árvores do bloco que estão na frente dele (`redrawFront`): a ordem fica igual à do desenho um a um. Recurso
    trabalhado (até `LIVE_KEEP` = 30 s depois), caindo ou marcado para limpar sai do bloco e vai sozinho. Bloco cujo
    conteúdo mudou (estágio, exploração, estação, neve) é repintado em até 3 ms por quadro; sem orçamento, o mesmo
    conteúdo noutra escala ou os recursos um a um. Escala do bloco: a potência de 2 acima do zoom × resolução, até 2
    (`stripScale`). Fora com Furo/Pontilhado e com Esmaecer de perto; afastado, o Esmaecer vira o recorte a 38% em
    volta do personagem. Silhueta: árvore do bloco entra na máscara quando é desenhada (bloco ou redesenho) depois de
    alguém com silhueta (`silDrawn`/`silPushed`). Medido no PC com o save do autor: zoom 0,45 de 19,7 → 5,6 ms de
    desenho, 0,6 de 12,3 → 6,4, 0,85 de 9,8 → 7,2; de perto os blocos perdiam (por isso o limite). Comparação pixel a
    pixel com e sem blocos: só reamostragem nas bordas (Silhueta e "nenhum" iguais). `renderer.stripsOff = true` no
    console desliga, para comparar.
  - **Estação e neve** (`seasonal.ts`): as artes refeitas pixel a pixel (`seasonalTree`, `snowCap`, `snowField`) saem
    num canvas comum (`settle`), não no `willReadFrequently` usado para ler os pixels (memória da CPU, reenviado à
    placa a cada desenho). Recurso com neve é uma imagem só, arte + camada juntas (`withSnow`, em degraus de 1/16 da
    neve): antes eram dois desenhos por árvore/rocha (PC, inverno, zoom 1,18: "em pé" 7-8 ms e 46-48 qps).
  - **Pausado** (main.ts): sem toque/tecla e com câmera, seleção e contagens paradas, o quadro não é redesenhado (seria
    idêntico: o relógio das animações para junto); a cada 0,5 s redesenha por garantia.
  - **Medir**: no console, `bench()` devolve `render` (ms de CPU) e `steps` (ms por etapa: terreno, ruas, lista, prof:*,
    quem tapa, em pé, silhuetas, efeitos, tela; o chão em "chão: estação/névoa/batido/campos") e `simSteps` (ms por
    sistema num passo: `Game.prof`, nomes em `System.label` de systems/index.ts). No aparelho, sem USB: Configurações → Medidor de FPS → **Detalhado**
    (`ui/fps.ts`: ms por quadro de desenho, simulação com passos e interface, as 5 etapas mais caras do desenho via
    `Renderer.prof`, memória do JS). CPU baixa com FPS baixo = GPU: teste forçando `imageSmoothingQuality`/desligando
    partes (ex.: `renderer.node = () => {}`) e meça com `requestAnimationFrame`.
  A câmera trabalha na cena projetada; fora do render use `camera.focus/jump/screenToWorld/worldToScreen` (mundo).
  Cliques no mapa comparam em coordenadas de tela (`ui/index.ts`).
- Efeitos visuais extras ficam em `render/particles.ts` (só visual, fora do estado): rastro de projétil e explosão por natureza.
  **Estilo visual dos golpes** (`data/vfx.ts`): cada jutsu/arte leva um `Vfx` (fogo, água, raio, terra, vento, gelo, lava,
  calor, madeira, tempestade, sombra, sangue, agulha, folha, genjutsu, impacto, metal, ouro, som, osso, teia) — `JutsuDef.vfx`
  ou o da natureza (`jutsuVfx`) — passado a projéteis (`Projectile.vfx`), efeitos (`Effect.vfx`) e estados (`Unit.stunVfx`,
  `Unit.shieldVfx`); nada de adivinhar pela cor. Efeitos novos: `hit` (impacto do golpe), `beam` (cura/dreno/ilusão),
  `wave` (som, miragem, onda de choque), `gust` (rajada). Projéteis `jet`, `shard`, `needle`, `arrow`. Atordoado/escudo
  desenhados pelo estilo (`drawStunned`/`drawShield` em sprites.ts; a Cúpula de Terra é um domo de pedra, `drawDome`).
  **Doryuuheki** (`game/walls.ts`): a muralha brota do chão entre o ninja e o inimigo e FICA ali (efeito `wall`, na ordem de
  profundidade do renderer, `drawWall`); para projéteis inimigos (`wallHit`) e o escudo só vale perto dela (`wallCovers`).
  **Sawarabi no Mai** (Hakkotsu, Som): ossos brotam do chão em volta do alvo (efeito `bones`), dano em área e prende. **Golpe comum**: avanço curto do sprite (`u.anim`,
  `STRIKE_ANIM`) e o dano entra no AUGE do avanço (`Unit.strike` marcado em `engage`, `resolveStrike` pelo statusSystem;
  saiu do alcance = errou). **Com lâmina lendária**, a espada some das costas (boneco montado sem ela) e a espada solta
  `src/art/sword-<id>.png` (gerada por `scripts/weapon-grid.py`, uma grade só; recolorida pelas cores-chave como a
  camada) gira em volta do ponto `hand` do corpo-base, do alto atrás até a frente embaixo, com dois vultos (`drawSlash`);
  `SWORD_LEN` dá o tamanho de cada uma. Quem leva dano pisca BRANCO (`whiteArt`, por `hitFlash`); empurrado (`knockT`)
  ou pousando do Shunshin (`landT`) o sprite "esmaga e estica" por um instante. Tudo só desenho, em `drawUnitArt`.
  **Laboratório de jutsus** (http://localhost:3011/lab, `tools/jutsu-lab/`; também no build de produção, em
  https://ninja.wmst.com.br/lab, pelo `scripts/live.ts`: só ele, os editores que gravam arquivos ficam só no 3011): campo limpo com ninja e boneco de treino; cada
  botão solta um jutsu/golpe/técnica/arte/lâmina com o código real; "Duelo IA × IA" mostra o estilo de luta. Arrastar o ninja ou o
  boneco no campo muda a posição deles (`spot`/`target`; a Distância mantém a direção entre os dois, Reiniciar volta ao
  padrão); arrastar o chão move a câmera. No console,
  `lab.pause()`, `lab.step(s)`, `lab.act('Chidori')`.

## Barra de vida sobre a unidade (2026-10-15)
`drawBars` (sprites.ts), chamada por `drawUnit`. Selecionado (ou no grupo) e chefe: sempre. Os outros: só nos
`HURT_BAR` = 4 s depois de levar dano (os últimos 0,6 s esmaecendo) e só se a vida estiver abaixo de 98% (`BAR_FULL`).
O dano é visto pelo renderer comparando a vida de cada unidade com a do quadro anterior (`hurt`, WeakMap só de desenho,
conferido também fora da tela); queda menor que `HURT_MIN` = 0,5 num quadro não conta, então a fome e o dreno dos modos
não acendem a barra. Ferido parado (a vida volta a 0,5/s) fica sem barra. No interior dos prédios a barra aparece em
quem está abaixo de 98%. Invisível de fora da vila (`cloak`) e o vulto do Shunshin (`bare`) não têm barra. Chakra (azul):
ninja que não é clone, selecionado ou em combate, só quando a barra de vida aparece.

## Projéteis Katon animados

`sprites.ts`, `drawProjectile`: tipos `housenka` e `goukakyuu`, escolhidos por `JutsuDef.projKind`.
PNGs em `art/effects`, carregados pelo registro de `art.ts`. Oito quadros em grade 4x2 a 16 fps,
núcleo em 75% da largura e 50% da altura da célula. O desenho gira pela velocidade já projetada;
células desenhadas a 32 e 52 px, respectivamente, sem suavização. Fase pelo id evita cinco
chamas sincronizadas no Housenka. Desenho procedural enquanto a imagem carrega; rastros e impactos
usam o `vfx` existente. Fontes, prompts e preparo em `docs/arte/jutsus/README.md`.

## Rastros das sprites e Suiton

Os tipos `housenka`, `goukakyuu`, `mizurappa` e `suiryuudan` têm cauda na própria arte.
`Particles.trail` emite somente resíduos pequenos: brasas a 32% de opacidade ou gotas a 26%,
sem mistura aditiva, desenhados na camada `trail` ANTES dos projéteis. Os impactos continuam na
camada `effect`. Isso evita o rastro branco opaco por cima da bola de fogo.

`render/jutsuSprites.ts` desenha as quatro folhas e a Prisão d'Água. Mizurappa é um jato
alongado (célula a 48 px); Suiryuudan usa uma sequência única de surgimento, arco e mergulho (detalhe abaixo).
A prisão usa `effect-suirou`, centrada no corpo, célula a 57,6 px (+20%) e alpha adicional de 0,68,
ativada por `stunVfx: water` (a técnica de Mizuchi). Os loops têm oito quadros a 16 fps; o dragão acompanha o progresso da trajetória.
O render mantém alternativas procedurais enquanto as imagens carregam. A mecânica de dano,
alcance, chakra e duração segue as definições existentes.

## Suiryuudan: bote em arco

Simulação (`game/dragonFlight.ts`, `Projectile.dragon`, save v43): a fonte nasce um tile atrás do lançador e a cabeça
segue uma curva cúbica no chão cujos dois pontos de controle ficam ENTRE a fonte e o alvo (a 1/3 e 2/3 do caminho,
desviados `bend` px para o lado). A cabeça sempre chega de frente, sem passar do alvo e voltar (a versão anterior
punha o 2º controle além do alvo e fazia um gancho no fim). O arco visível é a altura: sobe `lift` px e mergulha no
alvo; só acerta descendo. Forma em `jutsu-fx.json` → `jutsus.suiryuudan.flight` (`lift` 42, `bend` 0; `out`/`in` =
onde ficam os controles, pequeno = sai/mergulha quase na vertical; `sourceZ` = altura em que o corpo sai da fonte,
`DragonFlight.z0`, save v44), ajustável no painel "Ajuste". Desenho (`jutsuSprites.ts`, `drawDragonChain`): fonte fixa
no chão (base em `parts.originX/Y`), corpo em juntas pela curva (faixa `parts.bandTop/bandHeight` da folha do corpo) e
cabeça na tangente com a âncora na ponta; o corpo termina exatamente no pescoço (`parts.neckX/Y`, ponto da célula da
cabeça), não mais num corte fixo de meia cabeça. Projétil antigo sem `dragon` cai no desenho de folha única (`projectileMotion.ts`:
escala igual nos dois eixos entre `minSize` e `maxSize`, desliza até o alvo em vez de esticar).

## Hirudora e "nasce da mão"

O Hirudora solta um tigre de ar comprimido: o projétil (mesma mecânica de antes: voa reto, acerta com a cabeça e
explode com raio 56) ganhou a folha `projectile-hirudora` (detalhe em `arte.md`), com âncora no focinho. Corpo comprido
em sprite usa `SpriteFx.emerge` ("Nasce da mão" no painel): `drawSpriteFx` corta (clip) o que ainda está atrás do ponto
de lançamento, reconstruído pelo tempo de voo (`traveled` em jutsuSprites.ts), então o tigre sai do punho em vez de
aparecer inteiro em cima do lançador. O rastro do jutsu é só um resíduo de vento atrás da cauda (exceção no JSON).

## Painel "Ajuste" do Laboratório

`tools/jutsu-lab/fxPanel.ts`, dados em `src/data/jutsu-fx.json` (tipos e leitura em `data/jutsuFx.ts`), gravados pelo
3011 (`/api/fx`, cópia em `docs/arte/backup-editor`). Largura arrastável pela borda esquerda; seções que abrem e fecham;
todo número com barra, campo e ‹ › de passo fino (Shift ×10). Abas: Sprite (folha; "Pontos (zoom)" é um inspetor de
quadro com zoom pela roda, onde se arrastam âncora, pescoço, base da fonte e faixa do corpo, setas = 1 px da arte e
Shift+setas 0,25 px; tamanho e aparência; peças e trajetória do dragão), Partículas (com jutsu escolhido, cada parte
mostra o que está EM USO, estilo ou "Só deste jutsu", e edita isso; avisa quais outros jutsus o estilo muda) e Projétil (velocidade, tamanho, raio, quantidade, leque, alcance; entram no
`JutsuDef` ao carregar, o original fica em `JUTSU_BASE`). Projéteis e explosões levam o jutsu de origem
(`Projectile.fx`/`Effect.fx`, save v42). Emissores: `n` por segundo no rastro (tamanho > 6 dobra) ou quantidade na
explosão (+`nR` por px de raio, até `max`); "$" nas cores = a cor do jutsu; estilo sem rastro cai no da natureza/tipo.

## Rasengan e Ōdama: mão, impacto e cratera

`drawHandJutsu` desenha a folha compartilhada no ponto da mão da pose (`drawUnitArt`), crescendo nos primeiros
0,12 s da investida. A esfera some no contato. `JutsuFx.impact` e `.crater` em `jutsu-fx.json` configuram as duas
peças adicionais; `formatFx` preserva ambos ao gravar pelo editor. Ōdama usa as mesmas folhas com tamanho 2x.
`drawJutsuImpact` usa quadro explícito, sem reiniciar o ciclo; `drawJutsuCrater` entra na passada do chão, em
coordenadas já projetadas, antes das unidades. A imagem da cratera já é 2:1 e não recebe novo achatamento.
Ela cresce em 0,12 s e desvanece nos últimos 30% da duração. Rastro e partículas procedurais ficam vazios neste par
para não cobrir a arte. As configurações de impacto/cratera são editadas no JSON; o painel ainda edita a esfera.

Rasenshuriken usa esse mesmo caminho: nos últimos 0,3 s dos selos, `drawUnitArt` forma a folha de quatro lâminas
na mão; no voo, `drawJutsuProjectile` anima a mesma folha em 24 qps, sem giro adicional pela direção do voo.
`drawJutsuImpact` mostra o domo em oito fases a 10 qps, opacidade 0,75, com fade nos últimos 0,16 s; cratera de
164 px na passada do chão, por 20 s. O domo recebe +8 px no eixo Y para assentar melhor no chão. Rastro e partículas de explosão ficam vazios para preservar a leitura das sprites.

## Sprites de Doton e areia

`jutsuSprites.ts`: `drawEarthWall` usa três folhas direcionais, sem comprimir ou cisalhar a face.
`earthSandMotion.wallView` escolhe frontal para base quase horizontal (`abs(dy) <= 0,25 * abs(dx)`), perfil
para base quase vertical (`abs(dx) < 0,8 * abs(dy)`) e diagonal nos demais ângulos. `JutsuFx.oblique` e `.profile`
têm volume desenhado, topo e lateral visíveis; espelham pelo sinal da inclinação da base projetada, e não pelo
lado do atacante. Frontal usa tamanho 64; diagonal e perfil usam 58 para manter altura próxima entre as folhas.
As três compartilham as fases; não aplicar novamente a inclinação da base às imagens que já estão em perspectiva.
`earthSandMotion.wallFrame` controla subida (0,25 s), quadro estável, rachaduras e desmoronamento (últimos 0,45 s).
Doryuudan usa `JutsuFx.origin` (também preservado por `formatFx`): folha, duração, boca e aparência da cabeça.
O efeito `jutsuOrigin` é ordenado com os objetos pela base (`jutsuOriginBase`), fica parado onde foi disparado,
espelha conforme a direção projetada. `origin.forward` afasta só a arte da cabeça 12 px de cena na direção do disparo, incluindo sua base de ordenação; a simulação do projétil mantém a origem anterior. A boca permanece registrada na folha, na altura de voo de 8 px. Cabeça dura
0,65 s e desvanece nos últimos 0,15 s. O projétil tem folha própria girando com a trajetória, sem rastro de partículas.
`drawShield` usa `drawSandShield` para areia: loop em 12 qps, abertura transparente e opacidade 0,9. `drawStunned`
usa `drawSandCoffin`: formação nos primeiros 0,45 s, fechado durante a prisão, compressão nos últimos 0,65 s e
desmanche nos últimos 0,3 s. O tempo vem de `Unit.stun`; as fases não alteram a mecânica. Base em `u.y + 9` nos dois.
Todos mantêm fallback procedural se a folha não carregar. Os ajustes de fonte são feitos no JSON; o painel de
sprite do laboratório continua editando a folha principal.

## Kirin, Jukai Kōtan, Raikyuu e Chidori Nagashi

Kirin desenha `JutsuFx.impact` também no efeito `thunder` (`drawEffect`), oito fases de formação/descida/descarga,
em execução única de 0,8 s. Nagashi usa `burst` com sua folha, centro transparente e a mesma duração, acompanhando
o lançador por `uid` no `effectSystem`; o preparo registra o fundo da abertura central dos oito quadros em Y=0,78. `dy: -9` alinha essa referência aos pés. Ambos substituem o anel e a explosão procedural e desvanecem nos últimos
0,16 s. Kirin fica no ponto original atingido, mesmo que o alvo seja empurrado. Raikyuu usa a folha em loop de
16 qps, com giro pela direção projetada, sem rastro adicional; impacto usa pequenas faíscas azul-brancas.
`drawStunned`, estilo `wood`, chama `drawJukaiRoots` ancorado nos pés (`y+9`): cresce em 0,45 s, forma a gaiola,
ganha folhas, permanece até os últimos 0,45 s da prisão e recua (`earthSandMotion.jukaiFrame`). Fallback procedural
se a folha não carregar. Raikyuu/Jukai usam `.sprite`; Kirin/Nagashi usam `.impact`, editado pelo JSON.

## Yōkai, Daitoppa, Shinkuu Ha e Sekizō

Yōkai usa projétil de lava próprio e `JutsuFx.impact` de 0,8 s. Shinkuu Ha usa uma lâmina curva em loop nos três
projéteis atuais. Sekizō usa a sequência de canhões de ar descrita abaixo, substituindo a coluna de impacto antiga.
`projectileSystem.explode` usa a duração da folha configurada para preservar os oito quadros do impacto; não aplica
dano adicional durante a animação. Os demais impactos conservam a duração anterior quando não têm folha.

Daitoppa usa `JutsuFx.gust`, preservado por `formatFx`: o evento `gust` carrega o ID do jutsu e dura 0,5 s.
`drawJutsuGust` orienta a folha entre origem e alvo projetados, com âncora (0,15;0,5), largura140 e execução única.
Substitui os arcos, partículas de rajada e burst/ring procedurais; mantém o dano em área aplicado uma vez no lançamento.
Fallback de desenho disponível se a imagem não carregar. Novo lote integrado e aprovado visualmente pelo autor em 2026-10-15.

## Contato visual, impactos de chão e canhões do Sekizō (2026-10-15)

Projéteis com folha usam `game/projectileCollision.ts`: ponto de contato na frente opaca medida em
`data/sprite-contacts.json`, substituível por `SpriteFx.hitX/hitY/hitRadius`. Tamanho, âncora, giro, espelho,
offsets e altura do voo entram na mesma projeção da arte. Discos giratórios podem orientar só o contato
(`contactRotate`). A colisão varre o segmento até a elipse do corpo e escolhe o primeiro alvo, evitando
atravessar unidades ou acertar pela caixa antiga `projSize+9`. Projéteis procedurais preservam o contato anterior;
Suiryuudan continua exigindo o mergulho baixo. Reproduzir medidas: `scripts/audit-projectile-contacts.ps1`;
reproduzir os 240 disparos: `scripts/audit-jutsu-projectiles.ts` → `docs/auditoria-projeteis.md`.

`impact.layer: ground` desenha o impacto na passada da cratera, antes dos personagens. No Yōkai, a explosão
usa o chão do alvo atingido; a área de dano continua no ponto físico da colisão. Camada `body` conserva
efeitos sobre o corpo. `SpriteFx.dx/dy/forward/side` são offsets em pixels de cena; a rajada do Daitoppa
começa 18 px à frente do lançador e pode ser afinada no painel.

Sekizō substitui o antigo leque e a coluna vertical: cinco socos nos instantes 0/0,30/0,54/0,72/0,84 s,
com velocidade crescente. Entre socos, o atacante muda de lado ao redor do alvo, pousando apenas em terreno
andável e respeitando a arena. Cada projétil conserva sua fonte fixa (`Projectile.cannon`); o renderer desenha
um canhão longo de ar comprimido, transparente, com largura padrão28 e opacidade0,62. O último trecho dura
0,32 s após contato. Largura, opacidade e origem são configuráveis em `JutsuFx.cannon`. A folha
`effect-sekizo-impact-v1.png` foi preservada para reaproveitamento, sem uso padrão no Sekizō.
