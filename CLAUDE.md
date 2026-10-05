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
  Missões de caça das feras novas ficam no FIM de `MISSION_TEMPLATES` (o save guarda o índice); feras de missão usam o golpe
  especial em `guardHome`.
- Painel de inimigo/animal tem a seção "Atacar" (mais próximos / equipe / todos) — `availableFighters` em teams.ts.
- **Exploração** (`game/explore.ts`, `systems/explore.ts`): névoa em bitset (`state.explored`, 1 bit por tile);
  unidades/torres da vila revelam ao redor. Na névoa nada em pé é desenhado nem clicável (inimigos, recursos, locais).
  Locais especiais (`state.sites`, `data/sites.ts`): ruínas (guardiões que só lutam com ninjas → pergaminho proibido em
  `state.scrolls`, que libera jutsus `forbidden` com risco de sequela), baús e entradas de mina. Ordem `scout` (Explorar)
  e comando `investigate`.
- **Expedições às minas** (`game/expeditions.ts`, `data/expeditions.ts`, `systems/expeditions.ts`): a equipe sai do mapa
  (`Unit.away`, ignorada pelos sistemas), desce andares com eventos sorteados e o jogador decide descer ou voltar; o saque
  (recursos raros `crystal`, `gold`, `darksteel`) só entra na volta. Itens lendários na forja/farmácia; ouro vende no mercado.
  Janela "Mundo" (botão e tecla R).
- **Mapa da região** (`data/region.ts`, `game/region.ts`, `systems/region.ts`; janela Mundo → Região, fundo `src/art/region.jpg`):
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
- **Ninken** (`game/ninken.ts`, prédio Canil): cão adotado pelo painel do ninja; bicho `faction: 'village'` com `ownerId`
  (IA `ally`), fareja espiões invisíveis e acha ervas fora da vila. Raças em `data/breeds.ts` (`Unit.breed`: shiba, branco
  gigante, pug farejador, buldogue) com arte `dog` / `dog-<raça>` e multiplicadores de vida, mordida, faro e ervas; a raça
  se escolhe no Canil.
- **Recursos crescem de volta** (`data/regrow.ts`, `systems/nature.ts`): árvore/rocha/veio esgotado vira toco/rocha rachada
  (`ResourceNode.regrow`) em vez de sumir. Esgotado não bloqueia construção e é removido ao construir em cima. Alcance de
  coleta `searchTiles` (cresce com o nível; círculo tracejado no mapa ao selecionar lenhador/pedreira/mina).
- **Equipamento automático** (`autoEquipAll`/`setAutoGear` em gear.ts, `systems/gear.ts`, `state.flags.autoGear`): botões
  na lista de ninjas e nas oficinas. Promovido a Chunin numa equipe sem sensei vira o sensei (`promoteToSensei`).
- **Técnicas ninja** (`game/techniques.ts`, `systems/techniques.ts`, tudo automático): **Shunshin** (some num redemoinho e
  aparece adiante: chegar na luta, recuar quem luta de longe, fugir ferido; visual por vila/natureza em `flickerStyle`:
  folhas, névoa, água, areia, fumaça; deixa um vulto `afterimage`), **Kawarimi** (golpe forte/fatal vira tronco, chance por
  Velocidade+Inteligência). **Ritmo do combate** (`state.pace`, menu): rápido = jutsu na hora; tático = selos antes
  (`Unit.cast`, `sealTime`), golpe ≥ `SEAL_BREAK` da vida ou atordoamento interrompe (taijutsu e cura sem selos).
  Investidas (Chidori) correm até o alvo (`Unit.dash`, `dashTick`). **Artes do Kage** (`data/kageArts.ts`,
  `ninja.kageArt`): por enquanto só o Hiraishin (kunai marca o alvo → `Unit.mark`; aparece no clarão e golpeia; ferido
  volta para a Residência); a lista foi feita para crescer.
- Prédios podem ser movidos de graça (`canMove`/`moveBuilding` em commands.ts; o Hokage só se ninguém sair do território).
- `src/ui/` DOM sobre o canvas. `Panel` (`panel.ts`) tem dois modos: **drawer** (lateral, para o que foi tocado no mapa:
  ninja, prédio, grupo — compacto, com abas) e **window** (janela central com abas, para telas de gestão: Vila/Kage/
  Estatísticas, Ninjas/Equipes/Clãs, Missões; tela cheia no celular). Botões de baixo e atalhos (B, N, V, M, S, Esp,
  Esc) abrem a janela. Não criar outro tipo de painel: telas novas de gestão viram aba da janela.
  O painel recria HTML só quando a estrutura muda;
  valores dinâmicos usam `data-t` / `data-b`. Ações via `data-act` (delegação de eventos).

## Convenções
- **Save versionado**: ao adicionar campo no estado, suba `SAVE_VERSION` em `config.ts` e adicione a migração
  em `game/save.ts` (`MIGRATIONS[n]` transforma vN → vN+1) + teste de migração. Hoje: v15.
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
  Exame Chunin, clãs/kekkei genkai, Kage/ameaças chefes), mais exploração, minas, região, profissões, estações, ninken e técnicas ninja (Shunshin, Kawarimi, selos, Hiraishin). 123 testes.
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
