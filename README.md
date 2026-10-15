# Vila Ninja

Jogo de construção de vila ninja (inspirado em Naruto), em vista isométrica e pixel art, **mobile-first em paisagem**.
Os moradores trabalham sozinhos e os ninjas defendem a vila de animais, renegados e organizações. Você expande a vila,
recruta e treina ninjas, monta equipes, manda missões e expedições e sobe a vila de Aldeia a Grande Vila Oculta.

TypeScript + Bun + Canvas 2D, **sem engine e sem dependências em runtime**. Jogo e textos em português (BR).

## Rodando

Requer [Bun](https://bun.sh) 1.2 ou mais novo.

```bash
bun install        # só dev-deps (TypeScript, tipos do Bun, ícones Phosphor para gerar os glifos)
bun run dev        # http://localhost:3010 com HMR; mostra o IP para abrir no celular (mesma Wi-Fi)
bun run build      # gera dist/ (e copia public/: manifesto do PWA, ícones, service worker)
bun run preview    # build + serve dist/ em http://localhost:4173
bun run editor     # ferramentas em http://localhost:3011 (editor de sprites, laboratório de jutsus, editor de cenário)
bun run check      # typecheck + testes (rode antes de commitar)
```

Os testes de simulação usam aleatoriedade: ao mexer em combate ou IA, rode a suíte algumas vezes.

### Em segundo plano (PM2)

```bash
pm2 start ecosystem.local.config.cjs                              # jogo na porta 3010 + ferramentas na 3011
pm2 start ecosystem.local.config.cjs --only villageninja-editor   # só as ferramentas
```

O processo `villageninja` roda `scripts/live.ts`: o build de produção em `dist/`, refeito sozinho a cada mudança no
código (`index.html` sem cache, arquivos com hash em cache longo). É ele que deve ficar exposto para acesso externo.
Não exponha o `bun run dev`: o HMR mantém os nomes do CSS/JS e um proxy com cache entrega a versão velha.
As ferramentas só escutam em 127.0.0.1.

### No celular

Abra o IP mostrado pelo `bun run dev`, gire para paisagem e use o botão de tela cheia da barra de cima, ou
**Menu → Instalar como app** (PWA em tela cheia; no iPhone, "Adicionar à Tela de Início").

### Depuração

- `?demo` na URL (ex.: http://localhost:3010/?demo) abre a **vitrine**: uma vila de fim de jogo gerada na hora, que
  não lê nem grava o save. O botão "Vitrine" abre qualquer janela, prédio, ninja, equipe ou local, e
  `?demo&tela=<chave>` abre direto (`crafts`, `b-forge`, `n-kage`, `group`, `cena-mina`…).
- No console do navegador: `vila` (o `App`: `vila.game.state` é o estado), `renderer` e `bench()` (quanto custa
  desenhar, um passo da simulação e a interface).
- **Configurações → Qualidade**: Alta, Equilibrada (padrão no celular) ou Leve.

## Como jogar

**Controles.** Arrastar move a câmera, pinça ou roda do mouse dá zoom, toque seleciona ninja, prédio ou local. No
desktop: Shift+arrastar marca vários ninjas, botão direito dá ordem e as teclas abrem as telas: **B** Construir,
**N** Ninjas, **V** Vila, **M** Missões, **R** Mundo, **F** Oficinas, **S** Selecionar, **Espaço** pausa, **Esc** fecha.
O jogo salva sozinho a cada 20 s.

- **Construir**: escolha o prédio, posicione no mapa (Girar espelha) e confirme; moradores sem emprego vão até a obra.
  Prédios sobem até o nível 3 pelo painel deles e dá para mudar um prédio de lugar. Na seção Decoração: enfeites que
  dão felicidade, **rua calçada** (pintada arrastando, só vale no "Pronto"), **limpar área** (árvores, tocos e pedras),
  **aterrar** e **cavar** (o terreno muda tile a tile pelo trabalho dos moradores).
- **Recursos**: Lenhador, Pedreira e Mina perto das árvores, rochas e veios; Fazenda, Horta, Mercado. Árvores e
  rochas esgotadas viram toco e voltam com o tempo.
- **Ninjas**: a Academia recruta moradores como Genin; a Biblioteca ensina jutsus; o Campo de Treino dá atributos e
  XP. Promoção Genin → Chunin → Jounin, com ANBU, Sannin e Kage mais adiante. Cada ninja tem arma, colete e um
  consumível, que usa sozinho e repõe ao voltar à vila. Cuidado: ninjas se cansam, se ferem e precisam descansar.
- **Equipes e ordens**: até 3 membros e um sensei. Selecione um ninja ou equipe e dê a ordem no chão (mover e
  defender) ou num inimigo (atacar); fora isso, a IA luta sozinha, com táticas da equipe, Shunshin, Kawarimi, selos e
  Hiraishin.
- **Vila**: cumpra os requisitos para evoluir (Aldeia, Vila, Vila Oculta, Grande Vila Oculta). Cada nível amplia o
  território, o mapa e o teto de população, libera prédios e atrai ameaças maiores.
- **Missões**: o quadro da Mesa de Missões renova todo dia; envie uma equipe comparando a força dela com a dificuldade.
  Algumas viram mapas jogáveis (invasão de vilarejo, mina, ilhas, provas, covil).
- **Mundo**: com o Porto, expedições às minas, exploração com névoa e o mapa da região com vilarejos e locais.
- **Oficinas**: Forja, Farmácia e Oficina de Selos, com fila de produção e "Manter" estoque.
- **Exame Chunin**: na Arena, genins lutam 1×1 contra colegas e convidados de outras vilas (ninguém morre).
- **Clãs e kekkei genkai**: casais têm filhos que herdam talentos; um Chunin+ funda um clã, e naturezas compatíveis
  despertam kekkei genkai (Gelo, Madeira, Lava, Tempestade, Calor). Também há Dōjutsu, Bijuu e lâminas lendárias.
- **Ameaças**: animais nas florestas (alguns roubam, outros só saem à noite), invasões de renegados e chefes com
  aviso prévio. As organizações (Espadachins da Névoa, Quinteto do Som, Ordem do Eclipse) entram ao longo da história.
- **Vida na vila**: estações com clima e neve, felicidade, profissões, invocações, cães ninja (Canil) e automação.
  À noite todos vão para casa; em perigo, os moradores se abrigam.

### Combate em números

| Conceito | Detalhe |
| --- | --- |
| Atributos | Ninjutsu, Taijutsu, Genjutsu, Inteligência, Força, Velocidade, Stamina, Selos (0–10, teto por patente) |
| Jutsus | 2 slots por ninja; aprende os da sua natureza ou neutros, respeitando patente e atributos |
| Natureza | Fogo › Vento › Raio › Terra › Água › Fogo (1,5× de dano; 0,75× ao contrário) |
| Ataques básicos | golpe corpo a corpo (arma e lâmina) + kunai à distância |
| Ameaças | crescem com a força militar da vila (vida ×k e dano ×√k a partir de 1.500, até 3×) |

## Arquitetura

```
src/
  config.ts       constantes (passo da simulação, versão do save, autosave…)
  core/           infraestrutura sem regra de jogo: eventos, câmera, input, projeção isométrica (iso.ts), rng, tokens
  data/           conteúdo declarativo: jutsus, prédios, animais, missões, itens, níveis, kekkei, chefes, layout das artes
  game/           simulação pura, sem DOM (roda nos testes); estado = GameState JSON serializável
    systems/      uma função (game, dt) por mecânica, registradas em ordem em systems/index.ts
    commands.ts…  ações do jogador (commands, teams, missions, gear, exam, clans, kage, village) → { ok } | { ok: false, error }
    save.ts       save versionado com migrações (MIGRATIONS[n]: vN → vN+1)
  render/         Canvas 2D em vista isométrica: chão em blocos, depois o que fica em pé ordenado por profundidade
  ui/             HUD em DOM sobre o canvas: drawer lateral (o que foi tocado) e janela central com abas (gestão)
  art/            PNGs em pixel art, cada um na pasta do seu tipo
tools/            editor de sprites, laboratório de jutsus e editor de cenário (localhost:3011)
scripts/          servidores (dev, live, editor), geração e preparo das artes
public/           PWA: manifesto, ícones, service worker
tests/            testes headless da simulação (bun test)
docs/             roadmap, pendências, requisitos, guia de design e um arquivo por sistema (docs/sistemas/)
```

Princípios:
- **Estado é dado puro** (`GameState`): salvar é `JSON.stringify` no localStorage. Campo novo no estado = subir
  `SAVE_VERSION` e escrever a migração com teste.
- **Sistemas são funções** `(game, dt) => void`; nova mecânica = arquivo em `game/systems/` + uma linha no índice + testes.
- **Conteúdo é dado**: novo jutsu, prédio ou animal = um objeto em `data/`.
- **A simulação é ortogonal** (px de mundo); só o render projeta em isométrico. Fora do render, use
  `camera.focus/jump/screenToWorld/worldToScreen`.
- **Arte gerada pelo Codex CLI** (`scripts/codex-image.mjs`) e ajustada nas ferramentas; personagens e bichos sempre
  como folha 4×3 (`--sheet biped|quadruped`). Ver `docs/sistemas/arte.md`.
- **Desempenho**: passo fixo de 60 Hz com orçamento de 8 ms por quadro (o jogo fica mais lento em vez de o FPS
  despencar); nada de varrer todas as unidades por unidade a cada passo.

### Por que sem engine?

O jogo é quase todo simulação (IA, economia, combate). Render isométrico com câmera, pinça e ordenação por
profundidade cabe em Canvas 2D, sem API de engine misturada à regra de jogo, e a lógica roda nos testes sem
navegador. Se um dia precisar de WebGL, a troca fica só na camada `render/`.

## Documentação

- [CLAUDE.md](CLAUDE.md): guia de trabalho no código (convenções, desempenho, balanceamento) e índice dos sistemas.
- [docs/sistemas/](docs/sistemas/): detalhe de cada sistema (render, arte, combate, interface, prédios e mapa,
  mundo, organizações, vila e ninjas, ferramentas, ninja em camadas).
- [docs/ROADMAP.md](docs/ROADMAP.md), [docs/PENDENCIAS.md](docs/PENDENCIAS.md) (lista viva do que falta),
  [docs/REQUISITOS.md](docs/REQUISITOS.md) (aparelhos medidos), [docs/design-ui.md](docs/design-ui.md),
  [docs/gdd-escala-ilhas-pvp.md](docs/gdd-escala-ilhas-pvp.md) (tetos de prédios, colônias nas ilhas e PvP: proposta).

## Estado

As fases 1 e 3–8 do [roadmap](docs/ROADMAP.md) estão prontas, e a arte em pixel art já substituiu os desenhos
procedurais na maior parte do jogo (prédios, cenário, ninjas em camadas, bichos, jutsus e interface). Próximos passos
possíveis: sons e música, playtest e balanceamento, e trocar os nomes do anime (Chidori, Kage Bunshin, Hyōton…) por
nomes originais caso o jogo seja publicado.
