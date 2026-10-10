# Vila Ninja — guia para o Claude Code

Jogo de construção de vila ninja (inspirado em Naruto), top-down, **mobile-first em paisagem**.
TypeScript + Bun + Canvas 2D, **sem engine e sem dependências em runtime**. Idioma do jogo e dos textos: português (BR).

## Comandos
- `bun install` · `bun run dev` (HMR, mostra IP para abrir no celular) · `bun run build` · `bun run preview`
- `bun run check` = `tsc --noEmit` + `bun test` — rode sempre antes de commitar.
- Testes de simulação usam aleatoriedade: rode a suíte várias vezes ao mexer em combate/IA para pegar instabilidade.

## Arquitetura (ver README e docs/ROADMAP.md)
- `src/data/` conteúdo declarativo (jutsus, prédios, animais, missões, itens, níveis, kekkei, chefes).
- `src/game/` simulação pura, **sem DOM** (roda nos testes). Estado = `GameState` JSON serializável.
  - `systems/` uma função `(game, dt)` por mecânica, registrada em `systems/index.ts` (ordem importa).
  - Ações do jogador ficam em módulos de comando (`commands.ts`, `teams.ts`, `missions.ts`, `gear.ts`,
    `exam.ts`, `clans.ts`, `kage.ts`, `village.ts`) e retornam `{ ok } | { ok: false, error }`.
  - Regra única de alvo: `canHit` em `factions.ts` (duelos da arena, convidados neutros).
- `src/render/` desenho. **Vista isométrica**: a simulação segue ortogonal (px de mundo); só a projeção muda
  (`core/iso.ts`). `renderer.ts` desenha em duas passadas — "chão" (terreno, campos e marcações, em coordenadas de
  mundo com `groundTransform`) e "em pé" (prédios, árvores e unidades no ponto projetado, ordenados por profundidade).
  A profundidade é a LINHA ONDE O DESENHO TOCA O CHÃO (`Renderer.baseLine`: pés do boneco = ponto + 9 px, base da
  rocha/árvore, base do baú/ruína), mais o ajuste `depth` da arte no Editor de cenário (modo Arte, linha laranja).
  Prédios com peças usam a âncora de cada peça; prédios inteiros, o centro com a regra das faces da frente.
  A câmera trabalha na cena projetada; fora do render use `camera.focus/jump/screenToWorld/worldToScreen` (mundo).
  Cliques no mapa comparam em coordenadas de tela (`ui/index.ts`).
- Arte em pixel art: PNGs em `src/art` (registro em `render/art.ts`), preparados com `scripts/prepare-art.py`
  (originais em `docs/arte`). Prédios e cenário (árvores, rochas, baú, ruína, caverna) são guardados em 2×
  (`SCENERY_SCALE`, paleta de 256 cores): o jogo desenha pelo tamanho no mundo e só ganha nitidez com zoom; abaixo do
  tamanho guardado `smoothIfShrunk` (art.ts) reduz com suavização. Personagens e camadas do ninja seguem em 1×. **Gerar pelo Codex CLI** (`scripts/codex-image.mjs`, incluso no plano ChatGPT do autor;
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
- **Ninjas**: o penteado sai do id (`NINJA_HAIRSTYLES`, 6 com careca) e as cores do `look` (`tintedArt`/`dollArt` recolorem
  as cores-chave). As folhas antigas por penteado (`ninja-hair-*`, `ninja.png`) saíram: o ninja é sempre montado em camadas.
- **Ninja em camadas**: corpo-base careca de malha cinza
  (`docs/arte/sprites/ninja-base.png` → `docs/arte/layers/ninja-base.png`, só entrada do prepare-layers, não vai para o jogo) + peças, cada uma num pedido separado ao Codex desenhada
  por cima de um MOLDE (o corpo já montado com as peças de baixo, `under` em `PIECES`, para a peça acompanhar os pixels
  do que fica embaixo) em cor-chave (roupa magenta, segunda cor amarelo, metal ciano, cabelo verde):
  `python scripts/prepare-layers.py tpl <peça>` grava o molde; `bash scripts/layer-pieces.sh <peça>` gera a folha inteira
  e a vista de lado (2×2, maior); `python scripts/prepare-layers.py` fica só com a cor-chave, encaixa cada quadro no molde
  (escala comum por vista + posição por quadro) e grava `src/art/layer-<peça>.png` + `ninja-body.png` (corpo com folga
  no quadro, `FRAME_PAD` em art.ts). Peças: roupa de Genin, cabelo espetado, bandana, coletes de Chunin e Jounin,
  sobretudo de Sannin (cor por caminho), manto e chapéu de Kage (Kage = base careca com chapéu), espadas do anime
  (`SWORDS`/`dollSword` em doll.ts: os Sete Espadachins da Névoa, Kusanagi, Sabre de Chakra, lâminas do Asuma, Raijin,
  sete espadas do Bee, tantō: o sprite mostra a lâmina lendária EQUIPADA, `bladeOf`) e ANBU (`outfit-anbu` + máscara
  `mask-<animal>` pelo melhor atributo, `data/anbu.ts`; veste quem foi nomeado, `NinjaInfo.anbu`). Máscaras só geram a
  folha inteira (sem a vista de lado). `dollArt` (art.ts) monta e recolore; `dollParts` (sprites.ts) escolhe pela patente.
  Os 5 penteados têm camada (espetado, rabo de cavalo, curto, longo, coques; feitos sobre a roupa) — `DOLL_HAIR`; penteado novo precisa da camada. Prévia: `python scripts/preview-layers.py`.
  Regras das peças e a recoloração ficam em `src/render/doll.ts` (puro, sem DOM), usado pelo jogo e pelo editor.
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
- Campos andáveis com arte (fazenda, treino, horta) são decalques no chão, desenhados antes das unidades.
- Moradores trabalhando usam folhas de ação (`villager-chop|mine|farm`, gabarito `action`: levanta · balança · impacto ·
  recupera); árvore vira toco e rocha racha conforme se esgotam (o recurso treme no quadro do impacto do golpe, `workImpact`, e a
  árvore que vira toco tomba para o lado com poeira, `Renderer.node`; só visual); colheita deixa um canteiro (`fx 'harvest'`) que rebrota.
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
  **Laboratório de jutsus** (http://localhost:3011/lab, `tools/jutsu-lab/`): campo limpo com ninja e boneco de treino; cada
  botão solta um jutsu/golpe/técnica/arte/lâmina com o código real; "Duelo IA × IA" mostra o estilo de luta. No console,
  `lab.pause()`, `lab.step(s)`, `lab.act('Chidori')`.
- **Upgrade de prédios** (nível 1–3; `data/upgrades.ts` + `game/upgrade.ts`): casa, fazenda, lenhador, pedreira, mercado,
  torre, hospital, campo de treino e academia (estudo mais rápido, recruta já sai com nível). A Residência do Hokage
  não tem upgrade: a arte segue o nível da vila (`hokage-2..4`). A obra é feita pelos construtores (`needsBuilders`) com o prédio funcionando.
  Efeitos por nível via helpers (`housingOf`, `workersOf`, `farmYield`…) — use-os em vez de `BUILDINGS[t].housing`.
  Arte por nível: `<tipo>-2` / `<tipo>-3` em src/art (gerada pelo Codex com o nível 1 como referência).
- Torre: guarda (`tower-guard`, folha de ação) aparece na plataforma arremessando e fica uns segundos de vigia.
  `remove-bg.py --vaos` limpa vãos brancos fechados (torres, porto, ruína). O `remove-bg.py` só considera fundo o quase
  branco SEM cor (parede creme e grama clara encostadas no fundo ficam) e tira a franja clara do contorno.
  `python scripts/rebg.py [nome]` refaz o fundo das artes de docs/arte/iso a partir da crua do Codex (achada no
  `.codex.txt`; anteriores em `docs/arte/iso/_antes-rebg/`).
- Inimigos especiais: animais ladrões (`thief` em `data/animals.ts`: corvo bica a fazenda, macaco rouba ryo/ervas e foge;
  o saque fica em `Unit.loot` e volta ao abater) e renegados com função (`Unit.role`, `data/enemies.ts`: bombardeiro
  derruba prédios pela metade, médico cura os aliados), que entram nas invasões por `raidRoles` (spawner.ts). Animais com golpe (`ability`): aranha (teia que prende,
  projétil com stun), tigre das sombras (`night`: só à noite, bote) e rinoceronte (investida que atropela e danifica prédio).
  Folha cuja silhueta engana a detecção de direção do prepare-art vai em `TRUST_FACING`.
  Renegados da 2ª leva: espião (`cloak`: `canHit` o ignora até torre/ninja com Inteligência alta o revelar; sabota e foge),
  marionetista (cria `role: 'puppet'` que desmontam se ele cair) e invocador (lobos com `ownerId` e `life`, sem recompensa).
  Chefes novos: Hidra (`heads`: ao zerar a vida perde uma e volta inteira) e Golem de Barro (`tier`: ao cair se divide em 2,
  até 7 pedaços; conta como chefe derrotado uma vez só), ambos em `killUnit` (combat.ts).
  Missões de caça das feras novas ficam no FIM de `MISSION_TEMPLATES` (o save guarda o índice); feras de missão usam o golpe
  especial em `guardHome`.
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
  `docs/arte/ui/Atlas de Interface Ninja em Português.png` em 89 peças em `src/art/ui/kit/` com o uso de cada uma no
  `LEIAME.md` dali; o autor limpa o texto no editor de sprites, que lista `ui/kit` e `ui/frame`, e depois elas entram
  no jogo como 9-slice/ícone) (`SEALS`), kunai do Hiraishin,
  animais dos Sannin e cenas das estações/festival/vila (`ART`). Tokens do tema (cores, bordas âmbar, botões com relevo)
  no bloco "Tema fiel aos mockups" no fim de styles.css.
  **Atlas**: ícones (64 px) em `src/art/ui/icons.png` e selos de rank (128 px, uma linha com os 5) em `badge-ranks.png`,
  desenhados por `atlasCell` (icons.ts); um arquivo só em vez de dezenas (pelo túnel, PNGs soltos atrasavam as janelas).
  **Organização das artes**: interface = glifo; recurso e item = casa do atlas (item SEMPRE em pixel art: `itemPx` em panel.ts
  força a casa mesmo havendo glifo, e cada item tem o seu ícone: `vest-crystal`, `chakra-crystal`, `blade-dark`; lâmina
  lendária = recorte do sprite); o atlas só guarda o que aparece (ícone com glifo e sem `pxIco` não entra; `.perf/atlaskeep.py`
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
  **Padrão de botões** (panel.ts): liga/desliga = `togBtn` (rótulo curto + chave, nada de
  "ligado/desligado" escrito: "Auto", "Auto-ensino", "Auto-sensei"); ação em lote = verbo curto + contagem ("Ensinar
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
- **Lâminas lendárias** (`data/blades.ts`, `game/blades.ts`): itens de arma únicos (`blade-<id>`, `ItemDef.blade`), cada um
  com o efeito do anime em combate (`bladeHit`/`bladeMult`/`bladeDefense` em `applyDamage`, alcance/ritmo em `meleeStats`,
  Raijin em `bladeTick`). `state.blades` = as que a vila já conseguiu (`grantBlade`); quem cai com uma, ela volta ao
  estoque (`recoverBlades`, sistema `legends`). Origem: as 7 da Névoa (Espadachins), Kusanagi (Sannin das Serpentes), Sete
  espadas (explorar a Ilha Vulcânica), Sabre de Chakra/Lâminas do Asuma/Raijin (Forja nível 3, `minBuildingLevel`,
  `craftBlock`; Raijin `kageOnly`). Sem "Manter" nem lote.
- **Espadachins da Névoa** (`data/swordsmen.ts`, `game/swordsmen.ts`, `state.swordsmen`): da Vila Oculta em diante invadem
  em dupla com escolta (`swordsmenTick`), caçam ninjas em vez de roubar (`swordsmanPrey`). Só UMA espada por invasão: o
  primeiro derrubado cai e deixa a lâmina (`swordsmanFall` em `killUnit`); os outros somem na névoa (cloak + fuga) e voltam.
  Tomadas as sete, continuam vindo atrás delas (o primeiro derrubado cai e dá ryo). Sprite montado como ninja com a lâmina (`swordsmanPortrait`). Ordem do Eclipse, Espadachins e
  Quinteto do Som ficam na aba **Bingo Book** da janela Vila (`View 'bingo'`); a aba Kage tem o Kage, a ANBU e os Sannin
  No Bingo Book todos aparecem pelo sprite (`artPortrait(org-<id>, true)` / `swordsmanPortrait`), num padrão só (os bustos
  pintados da Ordem saíram; o atlas dos selos é `badge-ranks.png`); `.bingo` deixa todos os cartões com a mesma altura).
- **Quinteto do Som** (`data/sound.ts`, `game/sound.ts`, `state.sound`, arte `sound-<membro>` via `scripts/sound-sprites.sh`):
  da Vila Oculta em diante, 4 membros invadem para RAPTAR o ninja mais talentoso (`soundTarget`: kekkei genkai, nível,
  atributos; nunca Kage nem Sannin). `soundBrain` (hostiles): vão atrás dele (até dentro de casa), um carrega
  (`Unit.carrying`/`captiveOf`; o raptado não é alvo, `canHit`) e foge devagar levando o dobro de dano, os outros cobrem e
  os ninjas da vila por perto recebem ordem de atacar quem carrega. Matam no máximo `SOUND.maxKills` (4) por invasão; dali em
  diante o golpe deles NOCAUTEIA (`soundKnockout`, `raid.kills`). Impedido: recompensa e honra. Levado: fica `away = WITH_SOUND`, o nó `som` (Esconderijo do Som) aparece na
  Região com prazo (`SOUND.rescueDays`); ação `rescue` abre `createSoundScene` (líder Hakkotsu + 2). Passou o prazo: selo
  amaldiçoado (`cursed`, vira inimigo mais forte e vem nas invasões; derrotado, volta para a vila, `cursedDefeated`).
  Voltam sempre (não acabam). Seção no Bingo Book com o placar.
- **ANBU** (`game/anbu.ts`, seção na aba Kage): o Kage nomeia Chunins/Jounins (Torre de Inteligência; 3 vagas); saem das
  equipes comuns e só formam equipe entre si (`teamKind`/`teamFit` em teams.ts: o Kage não tem equipe, ANBU só com ANBU,
  Sannin só com Sannin; `enforceTeamRules` roda na automação e no "Montar" e conserta saves antigos);
  a máscara é escolhida ao nomear (`NinjaInfo.mask`, qualquer animal) e dá +1 no atributo que ela representa (`maskKey`). Invisíveis (`cloak`) só com inimigo à vista (`ANBU.alert`) e até atacar — emboscada (`anbuAmbush`) —, ficam na
  rua à noite patrulhando, revelam espiões como o espião da vila e acodem o Kage com Shunshin (`anbuTick`). Missão secreta
  na Região: ação `covert` (`startCovert`, expedição com `teamId -1`): metade do saque sem infâmia se não forem descobertos.
- **Editor de cenário** (http://localhost:3011/cenario, `tools/scene-editor/`; dados em `src/data/layout.json`, lidos por
  `data/layout.ts`): ajuste fino de cada construção (e nível), local (ruína, mina, baú) e objeto (árvore, rocha). **Peças**:
  máscara pintada com pincel ou lata de tinta (troca a área contínua da máscara clicada pela peça ativa) ou POLÍGONO por peça (pontos arrastáveis em 0–1 da imagem, `LayoutPiece.poly`, peça com polígono = exatamente o polígono, `applyPolys`; clique na aresta cria ponto, botão direito apaga, "Adivinhar forma" = contorno convexo, `fillPoly`/`hullOf` em render/pieces.ts; atalhos B/G/P/E) separa a arte em pedaços (`render/pieces.ts`); cada peça é desenhada na profundidade da sua
  âncora (onde toca o chão), o "resto" vai no chão (`ground`) ou em pé; transparência por peça (área própria ou o
  contorno). **Terreno**: tamanho em tiles (sobrepõe `w`/`h` do prédio) e células de MEIO tile (16 px) muro `#` /
  portão `g` / livre `.` (`tiles` com h×2 linhas de w×2 letras; clique troca, arrastar pinta; `World.rebuild` e `blockSites`) e **bloqueios
  avulsos** numa margem de 3 tiles em volta do prédio (`TypeLayout.extra`, células relativas ao canto, podem ser
  negativas): a arte que passa do terreno (muro da arena) bloqueia sem aumentar o prédio.
  **Prédio de margem** (`BuildingDef.shore`: o Porto): célula `~` (água) no terreno = píer/barco em cima da água; para
  construir, tile só com `~` precisa ser água, só com `#` terra (os dois = a beira) e a porta em terra (`World.shoreFits`).
  Terreno quadrado pode ser espelhado (`Building.flip`, `canFlip`): troca x por y no terreno, nos bloqueios e pontos
  (`tileOf`/`extraOf`/`layoutPoint` com `flip`) e espelha a arte em volta da ponta da frente (`artBox`). Ao posicionar,
  o fantasma gruda na beira mais perto já com o lado certo (`shoreSpot`). Chão: terra batida só sob o muro e sombra na água
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
- **Arena do Exame redonda** (6×6, coliseu com portão na frente-esquerda; muro, portão e peças no layout.json; `game/arena.ts`): os dois do duelo ficam no círculo (`arenaRing`): Shunshin e Kawarimi
  só pousam dentro (`keepInRing`), a distância de luta cabe nele (`ringDesired`) e andar não tira ninguém; empurrado para
  fora por um golpe (`Unit.knockT`, setado em `push`) perde (ring-out, `systems/exam.ts`). Migração 23 desloca a arena que
  cresceu e encostou noutro prédio. **Plateia na arquibancada**: quem não luta anda até o chão logo abaixo do seu lugar
  (`arenaSpots.seat(i)`/`below`, pontos `seat1…8` do Editor de cenário ou um arco no fundo) e salta para ele (`takeSeat`,
  `Unit.perch` = id da arena); o renderer o desenha logo depois da peça mais ao fundo (a arquibancada), sem deixá-la
  transparente. Chamado para lutar ou fim do exame: desce (`leaveSeat`). **Vagas** 4 ou 8 no drawer da arena
  (`flags.examSize`, `setExamSize`).
- **Estratégia de luta** (`game/tactics.ts`): papel automático pelo atributo (`roleOf`: tanque, atacante, atirador,
  suporte = quem tem cura), com etiqueta no drawer e marca pequena na cabeça durante a luta; **duelos**: `pickFoe` escolhe o
  mais perto penalizando quem já está sendo enfrentado (o bolo vira lutas lado a lado) e o inimigo prefere o tanque
  (provocação); **tática da equipe** (`Team.tactic`, painel da equipe): livre, focar o mais forte, segurar posição
  (`anchor`), flanquear (`engageAdjust` no `engage`); formação pelo papel ao mover (`roleOffset`); afastamento leve entre
  aliados colados (`spreadSystem`, menu "Afastar aliados na luta", `flags.spread`). Legibilidade: anel vermelho em inimigo
  lutando, barra só de quem está ferido, dano somado no mesmo alvo (`fxDamage`, fonte menor). **Câmera de batalha**
  (`ui/battle.ts`): luta com 6+ mostra "Ver luta" (segue o duelo principal sem abrir drawer) e, com a câmera seguindo e
  nada selecionado, enquadra sozinha uma vez. **Momento especial** (`fxMoment`, efeito `moment`): técnica de Kage, Sannin,
  Ordem/Som ou jutsu proibido dá câmera lenta curta (main.ts), fundo escuro e o nome no centro (no máximo a cada 8 s).
- **Câmera segue o selecionado** (`followSelected` em main.ts, `Camera.track`/`trackId`): lerp suave; arrastar solta; se a
  unidade se perder (caiu, saiu do mapa) volta suave para a Residência. Menu "Câmera segue o ninja" (`followCam`, padrão sim).
  Menu de pausa numa coluna (ações, configurações, novo jogo) com botão "Guia" para as dicas. **Medidor de FPS**
  (`ui/fps.ts`, Configurações → "Medidor de FPS", preferência por dispositivo): atual, média de 10 s e pior quadro,
  arrastável (posição guardada), duplo clique zera; `window.fps()` no console dá os mesmos números.
- **Oficinas** (janela, tecla F): uma oficina por aba (`craftTab`), estoque/produção/upgrade à esquerda e receitas à direita.
- Painel de inimigo/animal tem a seção "Atacar" (mais próximos / equipe / todos) — `availableFighters` em teams.ts.
- **Exploração** (`game/explore.ts`, `systems/explore.ts`): névoa em bitset (`state.explored`, 1 bit por tile);
  unidades/torres da vila revelam ao redor. Na névoa nada em pé é desenhado nem clicável (inimigos, recursos, locais).
  Locais especiais (`state.sites`, `data/sites.ts`): ruínas (guardiões que só lutam com ninjas → pergaminho proibido em
  `state.scrolls`, que libera jutsus `forbidden` com risco de sequela), baús e entradas de mina. Ordem `scout` (Explorar)
  e comando `investigate`.
- **Biblioteca de Jutsus** (`game/library.ts`, prédio com upgrade 1–3, arte nova `library` pensando nos níveis): jutsus
  básicos (rank E/D) a Academia ensina direto; do rank C em diante o pergaminho precisa ser ABERTO na Biblioteca (custo
  `SCROLL_COST` por rank, `openScroll`) para aparecer em "Ensinar jutsu" (`jutsuOptions(u, studyable(state))`). Nível 1
  abre até C, 2 até B, 3 até A/S (`LIBRARY.maxRank`) e acelera o estudo (`libraryLearnMult`). Kekkei e proibidos à parte.
  `state.jutsuOpen` (migração 22 abre o que a vila já sabe/estuda). Drawer: abas Fechados/Abertos.
- **Locais que voltam** (`siteTick` em explore.ts, sistema explore): ruína/baú feitos e mina esgotada somem e reaparecem
  noutro lugar depois de `SITE_RESPAWN_DAYS` (de preferência na névoa). A mina aguenta `MINE_USES` expedições
  (`spendMine` ao terminar ou perder uma; `Site.uses`). Drawer da mina em cartões (andares, usos, fundo, força por andar).
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
  `zoomMap`; a camada `.rlayer` cobre a vista em 3:2; o zoom `--z` muda a LARGURA dela, não um `scale`, para mapa e rótulos saírem nítidos; ampliada além da imagem, pixels duros, classe `px`); tocar num lugar abre o
  painel dele por cima (`.rsheet`, `focusNode` tira o lugar de baixo dele); equipes em viagem andam no mapa pela trilha
  tracejada (`.rtoken`/`.rroute`); legenda e "como funciona" no canto. Quadro de missões numa tela só (disponíveis e
  recentes; as ativas na coluna da direita ou no alto na estreita).
  vilarejos (comerciar, proteger, saquear, anexar), ilhas (explorar, posto avançado, treinar no templo) e lugares sagrados
  (contrato de invocação). Cada ação é uma expedição `kind: 'region'`. Ilhas e lugares sagrados exigem o prédio Porto.
  Virada do dia: tributos, postos, vingança dos saqueados e ninjas errantes. Honra/infâmia em `state.honor/infamy`
  (bônus de troca e saque, caçadores de recompensa nas invasões). Posições dos lugares em % da imagem.
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
- **Recursos crescem de volta** (`data/regrow.ts`, `systems/nature.ts`): árvore/rocha/veio esgotado vira toco/rocha rachada
  (`ResourceNode.regrow`) em vez de sumir. Esgotado não bloqueia construção e é removido ao construir em cima. Alcance de
  coleta `searchTiles` (cresce com o nível; círculo tracejado no mapa ao selecionar lenhador/pedreira/mina).
- **Inventário do ninja** (aba "Inventário" do drawer, `equipSection`): boneco no meio com os espaços em volta (arma, colete,
  consumível) e o bônus somado; embaixo a grade do estoque com filtro por tipo (`invFilter`), seta verde no que é melhor
  que o equipado, lâminas com o ícone recortado do sprite (`bladeIcon`). Toque no item equipa; no espaço, tira.
  Listas longas em drawers rolam por dentro (`.scrollist`: Canil, jutsus, grupo, "Lá dentro", candidatos da equipe,
  receitas, inventário).
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
- **Técnicas ninja** (`game/techniques.ts`, `systems/techniques.ts`, tudo automático): **Shunshin** (some num redemoinho e
  aparece adiante: chegar na luta, recuar quem luta de longe, fugir ferido; visual pela natureza em `flickerStyle`:
  água, areia (Terra), brasas (Fogo), raios em zigue-zague (Raio), riscos de vento (Vento); sem natureza, folhas (vila) / névoa (renegados); deixa um vulto `afterimage`), **Kawarimi** (golpe forte/fatal vira tronco, chance por
  Velocidade+Inteligência). **Ritmo do combate** (`state.pace`, menu): rápido = jutsu na hora; tático = selos antes
  (`Unit.cast`, `sealTime`), golpe ≥ `SEAL_BREAK` da vida ou atordoamento interrompe (taijutsu e cura sem selos).
  Investidas (Chidori) correm até o alvo (`Unit.dash`, `dashTick`). **Artes do Kage** (`data/kageArts.ts`,
  `ninja.kageArt`): por enquanto só o Hiraishin (kunai marca o alvo → `Unit.mark`; aparece no clarão e golpeia; ferido
  volta para a Residência); a lista foi feita para crescer.
- **Cuidado com os ninjas** (`game/care.ts`): XP do abate dividido (`noteHit`/`shareXp`: quem derrubou 100%, quem
  acertou 50%, equipe perto 25%); **Proteger novatos** (`flags.shelterRookies`, botão na lista de Ninjas): Genin se abriga
  de inimigo `CARE.danger`× mais forte (`fightPower`, sem usar nível) se houver Chunin+ em casa; **resgate** (`tryRescue`):
  com Hospital, quem zera a vida pode ir ferido para o Hospital em vez de morrer (chance por nível + médico perto);
  **recuperação de atraso** (`catchingUp`): 3+ níveis abaixo da média treina com XP em dobro. Invasões (`raidStrength`)
  seguem a força militar da vila (`villageMight`) mais que os dias.
- **Prédios repetidos com papel próprio** (`game/specialize.ts`, `data/specialize.ts`): Campo de Treino tem vagas
  (`TRAIN_SLOTS` 3/5/7 por nível; `Unit.trainId`), o ninja vai ao campo livre mais perto preferindo o do seu foco
  (`pickField`), e cada campo pode ter um foco (`Building.focus`, +50%; quem não tem foco treina o do campo). Cada
  Mercado pode vender o excedente de uma mercadoria (`Building.sells`, `marketSale`, sempre deixando a reserva `keep`).
  Únicos (um por vila): Hokage, Academia, Hospital, Biblioteca, Missões, Forja, Farmácia, Selos, Porto, Inteligência,
  Marionetes, Canil, Arena, Monte.
- **Automação e fim de jogo** (`game/automation.ts`, `systems/automation.ts` a cada 2 s): Forja/Farmácia/Selos têm
  upgrade (arte `-2/-3`; `craftMult`/`queueMax` em upgrade.ts) e do nível 2 em diante fabricam sozinhas para manter o
  estoque (`Building.keep`, `autoCraftTick`); Academia ensina em lote/sozinha (`teachAll`, `flags.autoTeach`, até
  `maxLearners`, sem proibidos); equipes sem sensei recebem um (`autoSenseiTick`, `flags.autoSensei`); destinos do ryo:
  mercenários na Mesa de Missões (`hireMercenary`) e cristal/aço negro no Mercado (`buyRare`). Janela "Oficinas" (tecla
  F, `View 'crafts'`). Ninja aberto de uma lista da janela mostra "Voltar" (`app.back`); a equipe volta para onde veio
  (`teamFrom`); no desktop largo (`SIDE_BY_SIDE` em ui/dom.ts) a janela não fecha: encolhe para a esquerda e o painel
  lateral abre ao lado. Desktop: mouse parado sobre um prédio mostra a dica (`ui/maptip.ts`, `#maptip`), fixa onde surgiu.
  A lista de construção (`#buildbar`) é uma faixa logo acima dos botões de baixo.
- **Os Três Sannin** (`data/sannin.ts`, `game/sannin.ts`, seção na aba Kage): título para até 3 Jounins nv 20+ (um por
  caminho: sapo/serpente/lesma) com contrato do animal (invoca mais), teto de atributo 10 (`statCapOf`) e técnica
  lendária: Modo Sábio (`Unit.sage`, +40% dano/+30% velocidade; visual: contorno de energia laranja seguindo a silhueta do sprite, `solidArt` em
  `sageGlow`, e chamas subindo pelas bordas, `sageWisps`), Troca de Pele (`sanninSurvive`), Selo da Força de Cem.
- **Mapas de missão jogáveis** (`game/scene.ts`, `ui/scene.ts`): saquear ou anexar à força um vilarejo abre um mapa
  próprio (`state.scene`, um `GameState` dentro do save da vila, com `sceneInfo`). A vila o roda junto no mesmo passo
  (`sceneRunSystem`; o mapa usa `SCENE_SYSTEMS`), a equipe é copiada para lá (`Unit.origin`) e `closeScene` devolve vida/
  XP/atributos/mortes (Hospital da vila pode resgatar). Torres do mapa atiram pelo inimigo (`state.towersFaction`).
  Ninjas no mapa avançam sozinhos para o objetivo (`advanceTarget`) se o jogador não der ordem. `app.home` é sempre a
  vila (HUD, menu, construção, janelas, save); `app.game` é o que está na tela (`app.viewScene`, `app.setView`); o
  renderer guarda terreno/estações por estado. Toast de outro mapa troca a tela ao tocar. **Minas** também: cada andar é
  uma caverna (`createMineScene`, autômato celular; tile `T.ROCK` bloqueia), escura com tochas, bichos guardando, baús que
  abrem ao encostar e a descida (local `cave`); vencido o andar a expedição fica em `choice` com o mapa aberto (Descer/
  Voltar na barra; `chooseExpedition` fecha e abre o próximo). Último andar: guardião (golem). `closeScene` devolve também
  o saque juntado no mapa. **Ilhas** (Explorar: `createIslandScene`, terra cercada de mar, bichos da ilha, amostras =
  baús; recolhidas todas, `explored`) e **lugares sagrados** (Contrato: `createTrialScene`, clareira com o guardião, o
  animal do contrato enorme; vencido, dá o contrato). **Covil da Ordem** (`createHideoutScene`, caverna com os
  guardiões e o líder; vencendo, `org.done`).
- **Ordem das organizações (história)**: Som (Vila Oculta) → Espadachins (depois da 1ª invasão do Som, `swordsmenAwake`) →
  Eclipse (depois da 1ª dos Espadachins, `swordsmen.raids`); uma organização por vez no mapa; todas voltam sempre.
- **Defesa proporcional** (`findThreat` em systems/ninjas.ts): um inimigo atrai no máximo `DEFEND_CAP` (4; chefe/organização 6)
  ninjas da vila; quem está colado nele (90 px) ou é o alvo dele sempre reage. Quem escolhe alvo conta na hora
  (`Game.noteEngaged`; a contagem é por passo). O Som chama só os `SOUND.chasers` (6) mais perto para perseguir quem carrega.
  Com o save do autor, ninjas atrás do Som: 78 → 14.
- **Ordem do Eclipse** (`data/org.ts`, `game/org.ts`, `systems/org.ts`, arte `org-<membro>`): 8 membros com técnica
  própria (`useArt`: Inferno, Corpo de Ferro –50% dano, Prisão d'Água, Trovão Veloz, Miragem, Mortos-vivos, Ninho,
  Repulsão). Da Vila Oculta em diante as 3 duplas atacam a cada 4–6 dias e caçam o ninja mais forte (`orgBrain`; caça
  em `Unit.life`, depois recuam). Quem cai entra em `state.org.down`; caídas as duplas, o covil aparece na
  Região (nó `covil`, ação `assault`) e a Ordem recruta membros novos (`regroup`, `org.cycle`: +30% de vida por volta);
  covil destruído (`org.wins`), ela some `ORG.restDays` e se reergue do zero. Vida cresce com a quantidade de Jounins da vila. Seção na aba Kage.
- Ninjas descansando (`rest`) ficam dentro do prédio (escondidos) e só saem para lutar com 60% de vida.
- Prédios podem ser movidos de graça (`canMove`/`moveBuilding` em commands.ts; o Hokage só se ninguém sair do território).
- `src/ui/` DOM sobre o canvas. `Panel` (`panel.ts`) tem dois modos: **drawer** (lateral, para o que foi tocado no mapa:
  ninja, prédio, grupo — compacto, com abas) e **window** (janela central com abas, para telas de gestão: Vila/Kage/
  Estatísticas, Ninjas/Equipes/Clãs, Missões; tela cheia no celular). Botões de baixo e atalhos (B, N, V, M, R, F, S, Esp,
  Esc) abrem a janela. Não criar outro tipo de painel: telas novas de gestão viram aba da janela.
  O painel recria HTML só quando a estrutura muda;
  valores dinâmicos usam `data-t` / `data-b`. Ações via `data-act` (delegação de eventos).

## Desempenho (medido com o save do autor: ~190 unidades, 561 recursos)
- Simulação ~0,9 ms por passo (era 8,6). Regras: nada de varrer `state.units` por unidade a cada passo — use as
  listas por passo do `Game` (`foesOf(facção)`: quem dá para atacar; `engagedOn(facção, alvo)`: quantos lutam com
  ele), refeitas no início do `step` e ao nascer alguém. Busca de caminho sem saída falha na hora (ilhas) e não se
  repete por 1,5 s; `chase` não refaz a rota se o alvo quase não andou e, longe da câmera (`Game.view`, posto pelo
  main), refaz a cada 2 s.
- `main.ts`: a simulação tem orçamento de 8 ms por quadro (`SIM_BUDGET_MS`); o que não cabe fica para trás (o jogo
  fica mais lento em vez de o FPS despencar). Console: `bench()` mede desenho, passo e interface; `window.renderer`.
- **Qualidade** (Configurações; `ui/settings.ts`, `QUALITY_CFG`): Alta (resolução até 2×), Equilibrada (1,5×, 70% das
  partículas; padrão no celular), Leve (1×, 45% das partículas, clima leve, até 30 qps). Zoom < 0,85: metade das
  partículas e sem anéis no chão/marcas de missão (`far` no renderer). Retratos do Bingo/Kage feitos com o jogo ocioso
  (`ui/warm.ts`). **Teto de população** pelo nível da vila (`popLimit` 60/100/150/200 em villageLevels; `popCap` =
  casas até o teto).

## Convenções
- **Save versionado**: ao adicionar campo no estado, suba `SAVE_VERSION` em `config.ts` e adicione a migração
  em `game/save.ts` (`MIGRATIONS[n]` transforma vN → vN+1) + teste de migração. Hoje: v27.
- Novas mecânicas: arquivo em `systems/` + registrar no índice + testes em `tests/`.
- Comentários e textos de UI em português; nomes de código em inglês.
- **Sem emoji**: ícones são SVG (`src/ui/icons.ts`). Textos (dados, toasts, `costLabel`) marcam o ícone com token
  `{nome}`; a UI passa por `rich()`, o canvas e `title` por `plainTokens()` (`core/tokens.ts`). Ícone novo = entrada
  em `icons.ts` (o teste `ui-text` confere que todo ícone dos dados existe).
- CSS em `rem`: o tamanho de texto (P/M/G no menu, `ui/settings.ts`) escala a interface inteira. Nada de `<select>`
  (lista nativa fica ilegível no desktop) — usar `.seg` ou `.chips`.
- Estado só de interface (grupo selecionado, hover, caixa de seleção) fica em `App`, não no `GameState`.
- **Dicas e avisos próprios** (`ui/popup.ts`), nada de `title`/`alert` nativo: `tipAttr(título, texto, tap?)` dá dica ao
  passar o mouse ou segurar o dedo (`tap` = um toque já mostra, para o que não tem ação). Botão que não pode agir não usa
  `disabled`: `blocked(g, [motivos], custo)` deixa clicável e o toque abre o aviso com o que falta (calculado na hora). Drawers mostram só números e botões: a explicação de uma seção vai no "i" ao lado do título (`infoTip` em panel.ts), não em parágrafo. Ícone inline tem `margin-inline` (`.ic`) para não colar no texto/número. Trabalhadores: uma marca por vaga (cheia = trabalhando, contorno = pedido) e o alcance em etiquetas.
- UI tem que funcionar em 844×390 (celular deitado), mas a conferência visual é do autor: não abrir navegador nem tirar
  screenshot sem ele pedir.

## Decisões de design (do autor)
- Combate automático + ordens do jogador; pixel art no futuro (Fase 2 adiada até haver arte);
  sandbox com marcos; missões no próprio mapa; mapa 72×48 com território que cresce por nível.
- Se o jogo for publicado: trocar nomes do anime (Chidori, Kage Bunshin, Hyōton…) por nomes originais.

## Estado atual
- Fases 1 e 3–8 do roadmap prontas (equipes/ordens, níveis da vila, missões, economia/equipamento,
  Exame Chunin, clãs/kekkei genkai, Kage/ameaças chefes), mais exploração, minas, região, profissões, estações, ninken e técnicas ninja (Shunshin, Kawarimi, selos, Hiraishin) o visual das estações, o cuidado com os ninjas e prédios especializados, chuva local, automação, Sannin, invasões, minas, ilhas, provas e o covil jogáveis e a Ordem do Eclipse. 163 testes.
- Desktop: cursor por contexto, Shift+arrastar (ou botão Selecionar) marca vários ninjas, botão direito dá ordem,
  hover em lista destaca o ninja no mapa. Prédios mostram o interior e quem está dentro (`game/interior.ts`).
- **PWA**: `public/` (`app.webmanifest` com `display: fullscreen` e paisagem, `app-icons/`, `sw-v1.js` sem cache) é servido por
  `scripts/public.ts` no dev e copiado para `dist/` no build; as tags entram por `main.ts` (o bundler do Bun não resolve
  caminhos absolutos no `index.html`). Botão de tela cheia na barra de cima e "Instalar como app" no menu
  (`ui/fullscreen.ts`); no iPhone só funciona "Adicionar à Tela de Início".
- Acesso externo: https://ninja.wmst.com.br (túnel Cloudflare → localhost:3010). O PM2 roda `scripts/live.ts`: build de
  produção em `dist/` refeito sozinho a cada mudança, `index.html` com no-store e arquivos com hash em cache longo.
  **Não** expor `scripts/dev.ts` (HMR) pelo túnel: ele mantém o nome do CSS/JS e a Cloudflare entrega versão velha. A Cloudflare guarda 404 de `.js`/`.png`
  em cache por 4 h (sem acesso ao painel para limpar): os 404 do servidor saem com `no-store`, e um arquivo que já
  deu 404 pela URL pública precisa de outro nome.
- Roda local via PM2 (`ecosystem.local.config.cjs`, porta 3010).
- Próximos passos possíveis: sprites (Fase 2), playtest/balanceamento, sons, PWA instalável.
