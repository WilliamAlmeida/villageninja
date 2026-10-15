# Desenho: vista isométrica, oclusão e efeitos

> Detalhe movido do CLAUDE.md (o índice fica lá). Mantenha atualizado ao mexer no sistema.

- `src/render/` desenho. **Vista isométrica**: a simulação segue ortogonal (px de mundo); só a projeção muda
  (`core/iso.ts`). `renderer.ts` desenha em duas passadas — "chão" (terreno, campos e marcações, em coordenadas de
  mundo com `groundTransform`) e "em pé" (prédios, árvores e unidades no ponto projetado, ordenados por profundidade).
  A profundidade é a LINHA ONDE O DESENHO TOCA O CHÃO (`Renderer.baseLine`: pés do boneco = ponto + 9 px, base da
  rocha/árvore, base do baú/ruína), mais o ajuste `depth` da arte no Editor de cenário (modo Arte, linha laranja).
  Prédios com peças usam a âncora de cada peça; prédios inteiros, o centro com a regra das faces da frente.
  **Quem passa atrás** (`occluders` devolve quem cada prédio/árvore tapa; Configurações → "Atrás de prédios",
  `OcclusionCfg` em ui/settings.ts → `Renderer.occl`, por aparelho): Silhueta (o desenho do personagem numa cor,
  recortado pelos pixels de quem o tapa, por cima; só ninjas da vila, inimigos, bicho lutando e o selecionado),
  Esmaecer (o prédio inteiro a 38%, o padrão), Furo (círculo em volta de quem está atrás) e Pontilhado (a transparência
  vira um xadrez de Bayer 4×4 no tamanho do pixel da arte, alinhado ao mundo); combinam. Furo e pontilhado desenham o
  prédio numa camada fora da tela só do tamanho dele (`toLayer`/`occludedBlock`); a silhueta redesenha quem tapa numa
  segunda camada como máscara (`maskPass` evita a fumaça repetida). Com o zoom afastado (`far`, < 0,85) a silhueta fica
  só para o selecionado/grupo e os inimigos, no máximo `FAR_SILHOUETTES` (12): os ninjas são miúdos e quase todos estão
  atrás de alguma árvore.
- **Desempenho com o mapa inteiro à vista** (medido 2026-10-13 no save do autor: 2.316 recursos, 169 unidades, PC 1920×863,
  Alta + Silhueta: zoom 0,45 ia a ~24 qps mesmo pausado; agora 57-60 qps de dia e de noite, CPU do desenho 31 → 13 ms):
  - **Suavização**: reduzir arte com `imageSmoothingQuality = 'high'` faz a GPU refazer o mipmap a cada desenho (~2 mil por
    quadro). `drawShrunk`/`drawWhole` (art.ts) desenham pela cópia reduzida pronta (½, ¼, ⅛, feitas uma vez por arte,
    `mipFor` escolhe a que fica entre ½ e 1) com suavização `'low'`; ampliando, sem suavização. Nada de `'high'` no
    canvas principal: o `render` começa cada quadro com `'low'` (a "high" que sobrava fazia o chão em blocos, que é canvas,
    refazer o mipmap de cada bloco todo quadro, o maior custo de todos).
  - **Ondinhas da água** (`drawWaterAnim`): juntadas em 6 faixas de transparência, um `stroke` por faixa (antes um por tile
    de água, ~2 mil); na névoa não desenha.
  - **Profundidade**: os prédios entram num balde por coluna de tile (`depthCols`) e cada coisa em pé só compara com os da
    sua coluna (antes todos × todos: 11 ms por quadro).
  - **Caminho das árvores**: `drawArt` guarda a geometria por imagem (`geoOf`: folha, quadro, layout) e só usa save/restore
    espelhando; `drawNode` só salva com achatamento; esmaecer dos recursos pelo id (`nodeFade`), sem chave de texto.
  - **Pausado** (main.ts): sem toque/tecla e com câmera, seleção e contagens paradas, o quadro não é redesenhado (seria
    idêntico: o relógio das animações para junto); a cada 0,5 s redesenha por garantia.
  - **Medir**: no console, `bench()` devolve `render` (ms de CPU) e `steps` (ms por etapa: terreno, ruas, lista, prof:*,
    quem tapa, em pé, silhuetas, efeitos, tela). CPU baixa com FPS baixo = GPU: teste forçando
    `imageSmoothingQuality`/desligando partes (ex.: `renderer.node = () => {}`) e meça com `requestAnimationFrame`.
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
espelha conforme a direção projetada e alinha a boca ao início do projétil, na altura de voo de 8 px. Cabeça dura
0,65 s e desvanece nos últimos 0,15 s. O projétil tem folha própria girando com a trajetória, sem rastro de partículas.
`drawShield` usa `drawSandShield` para areia: loop em 12 qps, abertura transparente e opacidade 0,9. `drawStunned`
usa `drawSandCoffin`: formação nos primeiros 0,45 s, fechado durante a prisão, compressão nos últimos 0,65 s e
desmanche nos últimos 0,3 s. O tempo vem de `Unit.stun`; as fases não alteram a mecânica. Base em `u.y + 9` nos dois.
Todos mantêm fallback procedural se a folha não carregar. Os ajustes de fonte são feitos no JSON; o painel de
sprite do laboratório continua editando a folha principal.
## Kirin, Jukai Kōtan, Raikyuu e Chidori Nagashi

Kirin desenha `JutsuFx.impact` também no efeito `thunder` (`drawEffect`), oito fases de formação/descida/descarga,
em execução única de 0,8 s. Nagashi usa `burst` com sua folha, centro transparente e a mesma duração, acompanhando
o lançador por `uid` no `effectSystem`; `dy: 18` alinha a base da descarga aos pés (o centro do anel na arte fica
acima da âncora da célula). Ambos substituem o anel e a explosão procedural e desvanecem nos últimos
0,16 s. Kirin fica no ponto original atingido, mesmo que o alvo seja empurrado. Raikyuu usa a folha em loop de
16 qps, com giro pela direção projetada, sem rastro adicional; impacto usa pequenas faíscas azul-brancas.
`drawStunned`, estilo `wood`, chama `drawJukaiRoots` ancorado nos pés (`y+9`): cresce em 0,45 s, forma a gaiola,
ganha folhas, permanece até os últimos 0,45 s da prisão e recua (`earthSandMotion.jukaiFrame`). Fallback procedural
se a folha não carregar. Raikyuu/Jukai usam `.sprite`; Kirin/Nagashi usam `.impact`, editado pelo JSON.

