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
- `src/render/` desenho em **vista isométrica**: a simulação segue ortogonal (px de mundo), só a projeção muda
  (`core/iso.ts`); fora do render use `camera.focus/jump/screenToWorld/worldToScreen`. Detalhe em `docs/sistemas/render.md`.
- Arte em pixel art em `src/art`, cada PNG na pasta do seu tipo (`scripts/artpaths.py`), **gerada pelo Codex CLI**
  (`scripts/codex-image.mjs`; Runware só como alternativa paga). Folha de personagem/bicho **sempre** pelo padrão
  `--sheet biped|quadruped` (grade 4×3), nunca um sprite sheet solto. Detalhe em `docs/sistemas/arte.md`.
- `src/ui/` DOM sobre o canvas. `Panel` (`panel.ts`) tem dois modos: **drawer** (lateral, para o que foi tocado no mapa:
  ninja, prédio, grupo — compacto, com abas) e **window** (janela central com abas, para telas de gestão: Vila/Kage/
  Estatísticas, Ninjas/Equipes/Clãs, Missões; tela cheia no celular). Botões de baixo e atalhos (B, N, V, M, R, F, S, Esp,
  Esc) abrem a janela. Não criar outro tipo de painel: telas novas de gestão viram aba da janela.
  O painel recria HTML só quando a estrutura muda;
  valores dinâmicos usam `data-t` / `data-b`. Ações via `data-act` (delegação de eventos).

## Detalhes por sistema (ler o arquivo antes de mexer no assunto)
Cada sistema tem o seu arquivo em `docs/sistemas/`, com nomes de funções, campos do save e regras do autor. Ao mudar
um sistema, atualize o arquivo dele (não este).
- `render.md` — renderer em duas passadas, profundidade (`baseLine`), oclusão (silhueta/esmaecer/furo/pontilhado),
  partículas e estilo visual dos golpes (`data/vfx.ts`), Doryuuheki, golpe comum, lâmina girando.
- `arte.md` — pastas e escala das artes (`SCENERY_SCALE`), Codex, folhas de sprite e folga, `body`/`foot`/`shadow`,
  folhas de ação dos moradores, achatamento e paleta.
- `ninja-sprite.md` — ninja em camadas (`PIECES`, cores-chave, `dollArt`), penteados, capa/pergaminho, bustos por
  patente, espadas, ANBU, poses (`strike`, `kick`, `cast`, `air`, `hurt`, `sit`, `carry`) e `data/moves.ts`.
- `ferramentas.md` — localhost:3011: início, visual comum, editor de sprites, laboratório de jutsus, editor de cenário
  (peças, terreno, água, espelhar, colisão em meio tile, pontos).
- `interface.md` — quadro de missões, mockups, `winTop`, kit 1/kit 2 (9-slice, `--k2-*`), atlas e regra de ícones,
  `morph`, ritmo das telas, padrão de botões, câmera que segue, Oficinas, Inventário.
- `predios-mapa.md` — upgrades e terreno por nível (`defOf`, `layoutKey`), tamanho do mapa por estado, chão em blocos,
  construções no padrão novo, Torre e vigia, recursos que voltam, limpar/aterrar/cavar, marcas da luta, prédios
  especializados, decorações e ruas, Monte e Pedra Memorial, mover prédio.
- `combate.md` — inimigos especiais, arena do Exame, tática da equipe, Shunshin/Kawarimi/selos/Hiraishin, cuidado com
  os ninjas, Bijuu e modos, Dōjutsu, jutsus de clã, defesa proporcional, descanso.
- `organizacoes.md` — ordem da história, lâminas lendárias, Espadachins, Quinteto do Som, Ordem do Eclipse, ANBU, Sannin.
- `mundo.md` — exploração e névoa, locais que voltam, expedições às minas, mapa da região, mapas jogáveis e temáticos.
- `vila-ninjas.md` — Biblioteca e estudo/treino, profissões e invocações, estações/clima/felicidade, ninken, desgaste e
  conserto, equipamento automático, automação.

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

## Balanceamento (2026-10-11, medido com o save do autor: dia 314, 77 ninjas, força militar ~5.000)
- Réguas em `.perf/` (fora do git): `bal-jutsus.ts` (cada jutsu: dano no alvo/total, tempo preso, valor por segundo
  de recarga e por chakra; meta ~9 no D/C até ~13 no S), `bal-melee.ts` (dano/s de cada arma, lâmina e modo; lendárias
  ±15% da mediana, Raijin no topo), `bal-threats.ts` (cada ameaça contra a vila real: tempo e perdas), `econ.ts`
  (entradas e saídas por dia e de onde vêm). Rode antes e depois de mexer em números.
- Regras: nada cresce com o dia sem teto (recompensa de renegado = `rogueBounty`, pela patente e atributos; roubos e
  relíquias param no dia 60); XP mais íngreme depois do nível 20 (`xpToNext`); golpe comum mais fraco que antes
  (`derive`: jutsus voltam a valer); ameaças crescem com a força da vila (`threatScale`/`scaleThreat`: vida ×k e dano
  ×√k a partir de 1.500, até 3×; invasão comum usa √k).

## Convenções
- **Save versionado**: ao adicionar campo no estado, suba `SAVE_VERSION` em `config.ts` e adicione a migração
  em `game/save.ts` (`MIGRATIONS[n]` transforma vN → vN+1) + teste de migração. Hoje: v41.
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
- **Vitrine de interface** (`?demo` na URL, ex.: http://localhost:3010/?demo): vila de fim de jogo gerada na hora
  (`game/demo.ts`: todos os prédios no nível 3, ninjas de toda patente, Kage, Sannin, ANBU, clãs, cães, equipes em missão e
  expedição, oficinas com fila e "Manter", lâminas, região em cada situação, mapa explorado; sem invasões) que não lê nem
  grava o save. O botão "Vitrine" (`ui/demoMenu.ts`) abre qualquer janela, drawer de prédio, ninja em cada situação, equipe
  ou local; `?demo&tela=<chave>` já abre direto (`crafts`, `b-forge`, `n-kage`, `group`…; mapas jogáveis: `cena-mina`, `cena-saque`). Tela nova que precisa de requisito
  para aparecer: garantir que a vitrine a alcança (teste em `tests/demo.test.ts`).
- UI tem que funcionar em 844×390 (celular deitado), mas a conferência visual é do autor: não abrir navegador nem tirar
  screenshot sem ele pedir.

## Decisões de design (do autor)
- Combate automático + ordens do jogador; pixel art no futuro (Fase 2 adiada até haver arte);
  sandbox com marcos; missões no próprio mapa; mapa da vila 112×112 (era 72×48) com território que cresce por nível.
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
