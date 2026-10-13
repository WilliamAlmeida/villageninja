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
  botão solta um jutsu/golpe/técnica/arte/lâmina com o código real; "Duelo IA × IA" mostra o estilo de luta. No console,
  `lab.pause()`, `lab.step(s)`, `lab.act('Chidori')`.
