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
  segunda camada como máscara (`maskPass` evita a fumaça repetida).
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
