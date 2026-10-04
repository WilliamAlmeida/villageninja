# 🍃 Vila Ninja — protótipo

Jogo de construção de vila ninja (inspirado em Naruto), visão top-down, **mobile-first em paisagem**.
Moradores trabalham sozinhos, ninjas defendem a vila de animais e renegados, e você expande a vila,
recruta ninjas, ensina jutsus e os promove.

## Rodando

Requer [Bun](https://bun.sh) ≥ 1.2.

```bash
bun install        # só dev-deps (TypeScript + tipos do Bun)
bun run dev        # http://localhost:3000 (com HMR) — também mostra o IP para abrir no celular
bun run build      # gera dist/ (≈100 KB de JS, zero dependências em runtime)
bun run preview    # build + serve dist/ em http://localhost:4173
bun run check      # typecheck + testes
```

No celular: abra o IP mostrado pelo `bun run dev` (mesma Wi-Fi), gire para paisagem e use
**☰ → Tela cheia**. No console do navegador, `vila.game.state` expõe o estado para depuração.

## Como jogar

- **Arrastar** move a câmera, **pinça** dá zoom, **toque** seleciona unidade/prédio.
- **🔨 Construir**: escolha o prédio, toque no mapa para posicionar e confirme.
  Moradores sem emprego vão até a obra e constroem.
- **Lenhador** perto de árvores, **Pedreira** perto de rochas, **Fazenda** para comida, **Mercado** para ryo.
- **Academia Ninja**: recrute moradores como Genin. Alguns nascem com 0, 1 ou 2 jutsus.
  Selecione um ninja → **Ensinar jutsu** (ele vai até a Academia estudar).
- **Campo de Treino**: ninjas ganham atributos e XP. Com nível suficiente, promova a Chunin → Jounin → Kage.
- **Equipes** (🥷 Ninjas → aba Equipes, ou no painel do ninja): até 3 membros + 1 sensei Chunin+.
  Membros seguem o líder, focam o mesmo alvo, ganham +10% de dano lutando juntos e treinam 50% mais rápido com o sensei.
- **Ordens**: selecione um ninja ou equipe → 📍 Ordem → toque no chão (mover e defender o ponto por 90 s)
  ou num inimigo (atacar). 🏃 Recuar leva ao hospital/residência até curar. Fora isso, a IA age sozinha.
- Animais surgem nas florestas; a partir do dia 3, ninjas renegados invadem e tentam roubar ryo.
- À noite, todos vão para casa (as janelas acendem). Em perigo, os moradores correm para se abrigar.
- O jogo salva sozinho a cada 20 s (localStorage).

### Ninjas

| Conceito | Detalhe |
| --- | --- |
| Atributos | Ninjutsu, Taijutsu, Genjutsu, Inteligência, Força, Velocidade, Stamina, Selos (0–10, teto por rank) |
| Jutsus | 2 slots por ninja. Só aprende jutsus da sua natureza ou neutros, respeitando rank e atributos |
| Natureza | 火 Fogo › 風 Vento › 雷 Raio › 土 Terra › 水 Água › 火 Fogo (1,5× de dano; 0,75× ao contrário) |
| Ataques básicos | Taijutsu corpo a corpo + kunai à distância |
| Efeitos de jutsu | projétil, leque, área com empurrão, investida, golpe, paralisia (genjutsu), clones, cura, escudo |

## Arquitetura

```
src/
  config.ts            constantes de balanceamento
  core/                infraestrutura sem regra de jogo (eventos, câmera, input, rng)
  data/                conteúdo declarativo: jutsus, prédios, animais, naturezas, ranks
  game/                simulação pura — sem DOM, roda nos testes
    types.ts           estado = dados JSON serializáveis
    game.ts            fachada: estado + índices + consultas
    systems/           um arquivo por mecânica, executados em ordem a cada tick
    commands.ts        ações do jogador (a UI só mexe no jogo por aqui)
    combat.ts, movement.ts, pathfinding.ts, entities.ts, progression.ts, world.ts
  render/              Canvas 2D procedural (terreno pré-renderizado, sprites, efeitos)
  ui/                  HUD/painéis em DOM sobre o canvas
tests/                 testes headless da simulação (bun test)
```

Princípios:
- **Estado é dado puro** (`GameState`): salvar/carregar é `JSON.stringify`, e no futuro dá para
  sincronizar em rede ou rodar a simulação num Worker/servidor.
- **Sistemas são funções** `(game, dt) => void` registradas em `game/systems/index.ts`.
  Nova mecânica = novo arquivo + uma linha na lista.
- **Conteúdo é dado**: novo jutsu/prédio/animal = um objeto em `data/`.
- **Render só lê o estado**. Trocar os desenhos procedurais por spritesheets é reimplementar
  `render/sprites.ts` mantendo as assinaturas.
- Simulação em **passo fixo (60 Hz)** com velocidades 1×/2×/3× e pausa.

### Por que não Phaser?

O jogo é quase todo simulação (IA, economia, combate). Render top-down com câmera,
pinça e ordenação por profundidade cabe em poucas centenas de linhas de Canvas 2D.
Sem engine, o bundle fica em ~100 KB, não há API de engine misturada à regra de jogo, e a lógica
roda nos testes sem browser. Se no futuro precisar de tilemaps do Tiled, partículas pesadas ou WebGL,
o Phaser pode entrar só na camada `render/`, sem tocar em `game/`.

## Próximos passos

Veja o plano completo em [docs/ROADMAP.md](docs/ROADMAP.md). Resumo:

- Missões (enviar ninjas para fora do mapa e voltar com recompensas)
- Equipes de 3 + sensei, afinidade entre ninjas
- Clãs com kekkei genkai (natureza dupla)
- Spritesheets / animações reais e sons
- Mais recursos (ervas medicinais, ferro) e cadeias de produção
- Eventos (exame Chunin, festival), clima
