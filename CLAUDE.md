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
- `src/render/` desenho procedural (trocar por spritesheets = reimplementar `sprites.ts`).
- `src/ui/` DOM sobre o canvas. Painel lateral (`panel.ts`) recria HTML só quando a estrutura muda;
  valores dinâmicos usam `data-t` / `data-b`. Ações via `data-act` (delegação de eventos).

## Convenções
- **Save versionado**: ao adicionar campo no estado, suba `SAVE_VERSION` em `config.ts` e adicione a migração
  em `game/save.ts` (`MIGRATIONS[n]` transforma vN → vN+1) + teste de migração. Hoje: v8.
- Novas mecânicas: arquivo em `systems/` + registrar no índice + testes em `tests/`.
- Comentários e textos de UI em português; nomes de código em inglês.
- **Sem emoji**: ícones são SVG (`src/ui/icons.ts`). Textos (dados, toasts, `costLabel`) marcam o ícone com token
  `{nome}`; a UI passa por `rich()`, o canvas e `title` por `plainTokens()` (`core/tokens.ts`). Ícone novo = entrada
  em `icons.ts` (o teste `ui-text` confere que todo ícone dos dados existe).
- CSS em `rem`: o tamanho de texto (P/M/G no menu, `ui/settings.ts`) escala a interface inteira. Nada de `<select>`
  (lista nativa fica ilegível no desktop) — usar `.seg` ou `.chips`.
- Estado só de interface (grupo selecionado, hover, caixa de seleção) fica em `App`, não no `GameState`.
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
- Roda local via PM2 (`ecosystem.local.config.cjs`, porta 3010).
- Próximos passos possíveis: sprites (Fase 2), playtest/balanceamento, sons, PWA instalável.
