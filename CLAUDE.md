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
  A câmera trabalha na cena projetada; fora do render use `camera.focus/jump/screenToWorld/worldToScreen` (mundo).
  Cliques no mapa comparam em coordenadas de tela (`ui/index.ts`).
- Arte em pixel art: PNGs em `src/art` (registro em `render/art.ts`), preparados com `scripts/prepare-art.py`
  (originais em `docs/arte`). **Gerar pelo Codex CLI** (`scripts/codex-image.mjs`, incluso no plano ChatGPT do autor;
  usa `-m gpt-5.5` e tira o fundo localmente com `scripts/remove-bg.py`). A Runware (`scripts/runware.mjs`,
  `scripts/sprite.mjs`, paga por imagem) é só alternativa quando o Codex não estiver disponível. Sem imagem (ou com "Arte: Antiga" no menu) vale o desenho
  procedural de `sprites.ts`.
- **Folhas de sprite (personagens e bichos) têm um padrão fixo** — nunca gere "um sprite sheet" solto:
  `node scripts/codex-image.mjs docs/arte/sprites/<nome>.png "<descrição>" --sheet biped|quadruped [--ref visual.png]`
  manda o gabarito de poses (`docs/arte/gabarito-*.png`, criado por `scripts/sprite-template.py`) como 1ª referência.
  Grade 4×3: linha 1 de lado olhando para a DIREITA, linha 2 de frente, linha 3 de costas; colunas = ciclo
  contato · passagem · contato · passagem (parado = coluna 2). `prepare-art.py` fatia pela grade e valida
  (quadro vazio, altura, direção pelo rosto/gabarito, ordem do ciclo), corrigindo o que dá e listando o resto.
  Para incluir um novo: gere, adicione em `SHEETS` do `prepare-art.py` e no `URLS`/`SHEETS` de `render/art.ts`.
- **Ninjas "paper doll"**: bases `ninja-hair-<penteado>` desenhadas em cores-chave (cabelo verde puro, roupa azul pura);
  `tintedArt` (render/art.ts) recolore pelo `look` da unidade (cabelo/roupa/pele) e o penteado sai do id. Há 6 penteados (inclui careca, com olhos escuros para não pegar a cor da roupa). Penteado novo =
  gerar com as mesmas cores-chave e incluir em `NINJA_HAIRSTYLES`.
- Campos andáveis com arte (fazenda, treino, horta) são decalques no chão, desenhados antes das unidades.
- Moradores trabalhando usam folhas de ação (`villager-chop|mine|farm`, gabarito `action`: levanta · balança · impacto ·
  recupera); árvore vira toco e rocha racha conforme se esgotam; colheita deixa um canteiro (`fx 'harvest'`) que rebrota.
- Efeitos visuais extras ficam em `render/particles.ts` (só visual, fora do estado): rastro de projétil e explosão por natureza.
- **Upgrade de prédios** (nível 1–3; `data/upgrades.ts` + `game/upgrade.ts`): casa, fazenda, lenhador, pedreira, mercado,
  torre, hospital, campo de treino e academia (estudo mais rápido, recruta já sai com nível). A Residência do Hokage
  não tem upgrade: a arte segue o nível da vila (`hokage-2..4`). A obra é feita pelos construtores (`needsBuilders`) com o prédio funcionando.
  Efeitos por nível via helpers (`housingOf`, `workersOf`, `farmYield`…) — use-os em vez de `BUILDINGS[t].housing`.
  Arte por nível: `<tipo>-2` / `<tipo>-3` em src/art (gerada pelo Codex com o nível 1 como referência).
- Torre: guarda (`tower-guard`, folha de ação) aparece na plataforma arremessando e fica uns segundos de vigia.
  `remove-bg.py --vaos` limpa vãos brancos fechados (torres, escadas, cercas).
- Inimigos especiais: animais ladrões (`thief` em `data/animals.ts`: corvo bica a fazenda, macaco rouba ryo/ervas e foge;
  o saque fica em `Unit.loot` e volta ao abater) e renegados com função (`Unit.role`, `data/enemies.ts`: bombardeiro
  derruba prédios pela metade, médico cura os aliados), que entram nas invasões por `raidRoles` (spawner.ts). Animais com golpe (`ability`): aranha (teia que prende,
  projétil com stun), tigre das sombras (`night`: só à noite, bote) e rinoceronte (investida que atropela e danifica prédio).
  Folha cuja silhueta engana a detecção de direção do prepare-art vai em `TRUST_FACING`.
  Renegados da 2ª leva: espião (`cloak`: `canHit` o ignora até torre/ninja com Inteligência alta o revelar; sabota e foge),
  marionetista (cria `role: 'puppet'` que desmontam se ele cair) e invocador (lobos com `ownerId` e `life`, sem recompensa).
  Chefes novos: Hidra (`heads`: ao zerar a vida perde uma e volta inteira) e Golem de Barro (`tier`: ao cair se divide em 2,
  até 7 pedaços; conta como chefe derrotado uma vez só), ambos em `killUnit` (combat.ts).
- Painel de inimigo/animal tem a seção "Atacar" (mais próximos / equipe / todos) — `availableFighters` em teams.ts.
- Prédios podem ser movidos de graça (`canMove`/`moveBuilding` em commands.ts; o Hokage só se ninguém sair do território).
- `src/ui/` DOM sobre o canvas. `Panel` (`panel.ts`) tem dois modos: **drawer** (lateral, para o que foi tocado no mapa:
  ninja, prédio, grupo — compacto, com abas) e **window** (janela central com abas, para telas de gestão: Vila/Kage/
  Estatísticas, Ninjas/Equipes/Clãs, Missões; tela cheia no celular). Botões de baixo e atalhos (B, N, V, M, S, Esp,
  Esc) abrem a janela. Não criar outro tipo de painel: telas novas de gestão viram aba da janela.
  O painel recria HTML só quando a estrutura muda;
  valores dinâmicos usam `data-t` / `data-b`. Ações via `data-act` (delegação de eventos).

## Convenções
- **Save versionado**: ao adicionar campo no estado, suba `SAVE_VERSION` em `config.ts` e adicione a migração
  em `game/save.ts` (`MIGRATIONS[n]` transforma vN → vN+1) + teste de migração. Hoje: v9.
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
  `disabled`: `blocked(g, [motivos], custo)` deixa clicável e o toque abre o aviso com o que falta (calculado na hora).
- Validar visualmente com Playwright em 844×390 (celular deitado) quando mexer na UI.

## Decisões de design (do autor)
- Combate automático + ordens do jogador; pixel art no futuro (Fase 2 adiada até haver arte);
  sandbox com marcos; missões no próprio mapa; mapa 72×48 com território que cresce por nível.
- Se o jogo for publicado: trocar nomes do anime (Chidori, Kage Bunshin, Hyōton…) por nomes originais.

## Estado atual
- Fases 1 e 3–8 do roadmap prontas (equipes/ordens, níveis da vila, missões, economia/equipamento,
  Exame Chunin, clãs/kekkei genkai, Kage/ameaças chefes). 59 testes.
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
