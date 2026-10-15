# GDD — Escala da vila, ilhas e PvP

> Documento de design (2026-10-15). Pergunta do autor: precisamos deixar a vila construir X casas nível 3, X lenhadores
> nível 3 etc. sem limite? Se não, acabamos com uma vila de 20–30 casas, que pesa no desenho e na simulação e fica feia.
> O que fazer, pensando também nas ilhas novas e no PvP que vêm aí. Números aqui são propostas: ajustar nas réguas de
> `.perf/` antes de fechar.

## 1. Diagnóstico: de onde vem a vila gigante

Hoje nada limita a quantidade de prédios por tipo (`BuildingDef.unique` só nos de gestão). O que empurra o jogador a
construir casa atrás de casa é o teto de população:

| Nível da vila | `popLimit` | Casas nv 3 (8 cada) para encher | Território (tiles) |
|---|---|---|---|
| 0 Aldeia | 60 | 8 | 19 |
| 1 Vila | 100 | 13 | 26 |
| 2 Vila Oculta | 150 | 19 | 36 |
| 3 Grande Vila Oculta | 200 | 25 | 130 (mapa inteiro) |

Isto é, o próprio jogo pede 25 casas iguais no nível 3 (mais a Residência). Somando produção (fazenda, lenhador,
pedreira, mina, horta: o jogador repete até sobrar recurso), os ~15 prédios únicos, torres e decorações, uma vila
"terminada" passa de 60 prédios e 200 pessoas.

Onde isso custa (medido no save do autor, `docs/REQUISITOS.md` e `docs/sistemas/render.md`):

- **Unidades são o custo principal**, não os prédios: simulação ~0,9 ms por passo com ~190 unidades (já com as listas
  por passo `foesOf`/`engagedOn`); desenho de cada pessoa em pé (camadas do ninja, profundidade, oclusão, silhueta).
  Casa = gente: 25 casas são 200 unidades andando.
- Prédios custam na **profundidade** (`depthCols`), na oclusão (esmaecer/furo/silhueta de quem passa atrás), luzes e
  fumaça à noite, interior ao tocar. 60 prédios ainda cabem; 60 prédios com 200 pessoas circulando entre eles, não no
  celular mínimo (Cortex-A75, qualidade Leve).
- **Legibilidade**: 25 casas com a mesma arte viram um tabuleiro; o jogador não acha nada, a câmera que segue perde
  sentido, e o mapa 112×112 fica cheio sem ficar interessante.
- **PvP**: uma vila sem teto não cabe num mapa de luta (72×48) nem num retrato (snapshot) de tamanho previsível, e
  quem jogou mais dias vence por volume, não por decisão.

Conclusão: a resposta é **não** ao sem-limite. O jogo precisa de um teto por tipo de prédio, de casas que valham mais,
e de um jeito de a vila "crescer" sem crescer na tela: ilhas (colônias) e disputa (PvP).

## 2. Princípios

1. **Crescer para cima, não para os lados.** Subir de nível um prédio tem que ser sempre melhor do que construir outro
   igual. Os upgrades já existem (`data/upgrades.ts`); falta o teto que torne a cópia impossível.
2. **A vila cheia tem tamanho conhecido.** O "estado final" de uma vila cabe num envelope de desempenho medido: ~45
   prédios e ~170 pessoas na vila principal (abaixo dos 190 já medidos a 0,9 ms). É também o tamanho máximo de um
   retrato de PvP.
3. **Poucos e distintos.** Com poucos prédios de cada tipo, cada um pode ter papel próprio (já existe:
   `game/specialize.ts`) e arte variada, em vez de 25 cópias.
4. **Expansão fora da tela.** O que passar do envelope vai para outro mapa (ilha), simulado em resumo quando não está
   na tela, no mesmo molde dos postos avançados e das expedições de hoje.
5. **Teto igual para todos** é o que faz o PvP justo: a disputa fica na disposição da vila, nas torres e muralhas, na
   composição das equipes e nos jutsus, não no número de dias jogados.

## 3. Tetos por tipo de prédio (`maxCount` por nível da vila)

Campo novo em `BuildingDef`: `maxCount?: [n0, n1, n2, n3]` (por nível da vila; `unique` continua valendo 1). Os
helpers `housingOf`/`workersOf` continuam a fonte do efeito por nível. Números propostos:

| Prédio | Nível 0 | 1 | 2 | 3 | Por que |
|---|---|---|---|---|---|
| Casa | 5 | 8 | 11 | 14 | Com casa de 4/8/12 moradores (abaixo), enche o `popLimit` novo |
| Fazenda | 2 | 3 | 4 | 5 | Colheita 2/3/4 por nível já escala |
| Lenhador, Pedreira | 2 | 3 | 4 | 5 | Trabalhadores 2/3/4 por nível; alcance `searchTiles` cresce com a vila |
| Mina de ferro, Horta | — | 2 | 3 | 4 | |
| Mercado | 1 | 2 | 2 | 3 | Nível 3 vende 3× o lote |
| Torre de vigia | 3 | 5 | 8 | 12 | Defesa é a parte "livre"; o PvP depende dela |
| Campo de treino | 1 | 2 | 3 | 4 | Papel próprio por campo (`specialize`) |
| Decorações e ruas | sem teto | | | | Já têm retorno decrescente pela felicidade; são baratas de desenhar (sem gente) |

**Casa vale mais**: `housingOf` passa a 4 / 8 / 12 (era 4 / 6 / 8). Casa nível 3 ocupa 3×3 (save v34), então 12 é
proporcional ao terreno. Com os tetos acima:

| Nível | Casas × moradores | `popLimit` novo (era) |
|---|---|---|
| 0 | 5 × 8 (casa nv 2 liberada no nível 0) = 40 | 40 (60) |
| 1 | 8 × 12 = 96 | 90 (100) |
| 2 | 11 × 12 = 132 | 130 (150) |
| 3 | 14 × 12 = 168 | 170 (200) |

Os requisitos de nível (`VILLAGE_LEVELS[n].req.population`: 14 / 24 / 36) continuam alcançáveis dentro do teto do
nível anterior. Imposto por morador (`tax`) sobe um pouco (3 / 4 / 4 / 5) para a renda de uma vila cheia não cair com
a população menor; conferir com `.perf/econ.ts`.

**Ninjas têm teto próprio** (`ninjaLimit`: 10 / 20 / 32 / 45), dentro da população. Hoje o save do autor tem 77
ninjas: mais do que o jogo consegue usar (equipes de 3–4, missões, expedições, guarda). Com o teto, recrutar mais
exige aposentar/dispensar, e cada ninja importa. Save antigo acima do teto: nada é removido; só não entra ninguém
novo até cair abaixo (mesma regra dos prédios, abaixo).

**O que muda na interface**
- Menu de construção: contador `3/8` ao lado do prédio; no teto, o botão fica clicável com `blocked(...)` dizendo
  "Limite de 8 casas no nível Vila: suba a vila de nível ou melhore as casas que tem" (regra do CLAUDE.md: nada de
  `disabled`).
- Drawer do prédio: a aba de upgrade ganha a frase "No teto de casas: a próxima vaga vem do upgrade".
- Janela Vila: linha "Casas 8/8 · Moradores 84/90 · Ninjas 17/20".

**Save**: sem campo novo no estado, sem migração. Vila antiga acima do teto fica como está (não demolimos nada do
jogador): `canBuild` recusa o próximo até o número cair. Mover prédio continua permitido.

**Testes**: `tests/limits.test.ts` — construir até o teto e receber `{ ok: false, error }`; teto sobe com o nível;
`housingOf` 4/8/12; save acima do teto não demole; `demo.ts` (vitrine) respeita os tetos.

## 4. Menos cópias, mais diferença (visual)

- **Variantes de arte** por prédio repetido: `house`, `house-b`, `house-c` (e por nível), escolhidas por
  `b.id % 3` no desenho (só render, nada no save). Geradas pelo Codex com a arte atual como referência
  (`docs/sistemas/arte.md`). Idem lenhador/pedreira (uma variante basta).
- **Bairro** (opcional, nível 3): no lugar de mais casas, um prédio 4×4 `district` com 24 moradores, arte de várias
  casas juntas, teto 2. Uma entrada na profundidade em vez de quatro, e dá o ar de "vila grande" sem quatro cópias.
  Só vale a pena se os 14 × 12 ainda parecerem muitos na prática.
- **Moradores em resumo** (se o celular mínimo ainda sofrer): acima de N moradores na tela, os que não têm trabalho
  nem ordem ficam "dentro" (`hidden`) por turnos mais longos; a vila parece viva com 40–60 pessoas circulando, não
  170. Puro ajuste de IA (`systems/villagers.ts`), sem mudar o estado.

## 5. Ilhas como colônias (a expansão fora da tela)

Hoje uma ilha é uma cena de visita (`createIslandScene`) e, explorada, vira um posto avançado abstrato
(`st.outpost`: recursos por dia, `data/region.ts`). A proposta é o meio-termo: a **colônia**, um mapa próprio e pequeno
onde o jogador constrói, mas que só é simulado em detalhe enquanto está na tela.

- **Estado**: `state.colonies[id]` = um `GameState` de 48×48 (molde das cenas: `SCENE_W/H`), com `sceneInfo.theme`
  da ilha (pesca, deserto, vulcão, neve, pântano: cada tema já troca arte e enfeites, `render/themeProps.ts`).
  Guardado no save da vila (`app.home`); a vila continua sendo `home`, a colônia entra em `app.game` ao visitar.
- **Tetos próprios e pequenos**: 4 casas, 3 de produção, 1 mercado, 4 torres, 1 porto. Sem Academia, Hospital,
  Biblioteca: tudo isso fica na vila. A colônia é um lugar de recurso e de fronteira, não uma segunda vila.
- **Pessoas**: moradores e ninjas são **transferidos** pelo Porto (expedição `kind: 'colony'`, viagem de 14 h de jogo
  como o posto). Quem está na colônia sai da lista da vila (`away`) e entra na da colônia: a soma respeita o
  `popLimit` da vila, mas o custo de desenho/simulação é de um mapa por vez.
- **Fora da tela, resumo por dia** (`systems/colonies.ts`, na virada do dia como `region.ts` faz hoje): produção =
  soma do que os prédios produziriam (fórmula fechada por trabalhador), comida consumida, uma rolagem de ameaça
  (bichos da ilha, piratas) resolvida como as expedições (`expeditions.ts`: perdas em fração, sem simular luta). Ao
  abrir a colônia, o estado detalhado "alcança" o resumo (recursos já creditados; prédios em obra avançam pelo tempo
  passado).
- **Especialização por ilha**: cada tema tem um recurso que só existe lá (ferro escuro, cristal, papel de cana,
  ervas raras: os `outpost` de hoje), fazendo cada colônia valer por um motivo diferente.
- **Risco**: colônia pode ser atacada (IA ou PvP, abaixo); perder a colônia devolve os sobreviventes à vila. A vila
  principal nunca é perdida.
- **Limite**: 3 colônias (uma por tema disponível no nível 3). Mantém o save e o tempo de resumo previsíveis.

Com isso o "crescer" de fim de jogo vira: vila cheia (envelope fixo) + até 3 ilhas pequenas, cada uma com um visual
e um recurso. O jogador tem mais para fazer sem o mapa principal passar do envelope.

## 6. PvP

O jogo é local, sem servidor (`scripts/live.ts` serve estático; túnel Cloudflare). Qualquer PvP precisa de um serviço
mínimo que guarde **retratos** (snapshots) e **resultados**: um `scripts/arena-server.ts` em Bun com duas rotas
(`PUT /village/:id`, `GET /village/random?power=…`, `POST /result`) e um JSON por jogador já basta para começar.

### 6.1 Formato: assíncrono (retrato), nunca em tempo real

Como Clash of Clans: o atacante luta contra o **retrato** da vila do outro, defendida pela IA do jogo. Nada de
sincronizar duas simulações em tempo real (o passo usa `Math.random`, o jogo roda no celular, e a simulação de 112×112
não cabe em dois aparelhos ao mesmo tempo).

- **Retrato** (`game/snapshot.ts`): prédios (tipo, nível, posição, `flip`), muralhas, torres com nível, até 12
  ninjas de guarda escolhidos pelo jogador (atributos, jutsus, equipamento, lâmina, clã/kekkei), Kage e cães. Nada de
  moradores. **É aqui que os tetos da seção 3 pagam**: o retrato tem tamanho máximo conhecido e vira um mapa de luta
  sem corte.
- **Mapa da luta**: gerado do retrato num mapa 72×48 (`createScene` já faz isso para o saque da Vila dos Pescadores,
  inclusive torres atirando pelo outro lado: `state.towersFaction`). A vila do defensor é recortada ao redor da
  Residência quando não cabe (mais um motivo para o território não ser o mapa inteiro no PvP).
- **Atacante**: uma equipe de até 8 ninjas (como expedição), com as ordens de sempre. Objetivo: Residência do Kage
  (vitória) ou tempo (3 min de jogo); vitória parcial por prédios derrubados, como nas invasões de hoje.
- **Resultado**: resolvido no aparelho do atacante e enviado ao serviço (`POST /result`): o defensor recebe o relato
  ao abrir o jogo ("Vila do Fulano atacou; 2 torres caíram; perdeu 120 madeira"). Confiança: no começo, aceitar o
  relato (é um jogo entre amigos); depois, limitar o saque pelo que o retrato permite (teto por recurso) e registrar
  a semente, para um replay no aparelho do defensor conferir (exige RNG com semente na simulação: `core/rng.ts`
  no lugar de `Math.random` nos sistemas, mudança grande mas boa também para os testes instáveis).
- **Proteção**: escudo de 1 dia de jogo depois de ser atacado; só ataca quem publica o próprio retrato; alvos de força
  parecida (`threatScale` já mede a força militar: ±30%).
- **O que se ganha**: saque limitado (10% do estoque do defensor, teto por recurso), honra (`state.honor`, já existe
  para a região), ranking. Perder não destrói prédios do defensor de verdade: só o saque e a honra.

### 6.2 Duelos na arena (o PvP barato)

A arena do Exame Chunin já luta ninja contra ninja com `canHit` e convidados neutros (`guest`). Duelo PvP = retrato de
um ninja (ou trio) do outro jogador lutando como convidado na sua arena. Sem mapa novo, sem muralha, 2–6 unidades:
roda em qualquer celular. É o primeiro PvP a fazer: prova o serviço de retratos e o formato de ninja serializado antes
de encarar o ataque à vila.

### 6.3 Colônias no PvP

Colônia também publica retrato (menor: 48×48, 4 torres, 6 ninjas). É o alvo "leve" para quem não quer atacar a vila
inteira, e o que dá sentido a defender uma ilha. Perder a colônia num ataque: o saque sai dela, nunca da vila.

### 6.4 O que fica fora (por enquanto)

Tempo real, clãs entre jogadores, chat, temporadas. Tudo precisa de servidor de verdade e contas; não cabe antes do
jogo ter o serviço de retratos funcionando com amigos.

## 7. Orçamento de desempenho por mapa (meta)

| Mapa | Unidades no máximo | Prédios no máximo | Tamanho |
|---|---|---|---|
| Vila nível 3 | ~170 pessoas + animais | ~45 + decorações | 112×112 |
| Colônia | ~40 | ~15 | 48×48 |
| Ataque PvP | 8 + 12 + cães e clones | retrato recortado | 72×48 |
| Duelo | 2–6 | arena | arena atual |

Só um mapa é simulado em detalhe por vez (como hoje com as cenas). Medir cada um com `bench()` no celular mínimo
(K12) antes de fechar os números; o teto de prédios é o que garante que o pior caso é conhecido.

## 8. Ordem de trabalho

1. [x] **Tetos e casa de 4/8/12** (seção 3; feito em 2026-10-15, ver "Medições da Fase 1" no fim): `maxCount` em `data/buildings.ts`, checagem em `canBuild`
   (`game/commands.ts`), `popLimit`/`tax`/`ninjaLimit` em `villageLevels.ts`, contadores no menu de construção e na
   janela Vila, `blocked` com o motivo, testes, réguas `.perf/econ.ts` e `bal-threats.ts` antes e depois, `demo.ts`.
   Sem migração de save. É o passo que resolve o problema de hoje e não depende dos outros.
2. **Variantes de arte** das casas e da produção (seção 4), pelo Codex.
3. [x] parte offline (2026-10-15): `game/snapshot.ts` (retrato "VN1." copiado/colado, conferido e preso aos tetos) e
   `game/duel.ts` (duelo na arena pela máquina do Exame, `Exam.duel`; XP e placar `stats.duelsWon/duelsLost`, save v47).
   Falta `scripts/arena-server.ts` (troca automática de retratos) — hoje o retrato vai por mensagem entre amigos.
   **Duelo PvP na arena** (6.2) + `game/snapshot.ts` + `scripts/arena-server.ts`: o serviço mínimo e o ninja
   serializado.
4. **Colônias** (seção 5): estado, Porto, transferência, resumo por dia, 1 tema primeiro (pesca, que já tem mapa).
5. **Ataque à vila** (6.1) e às colônias (6.3), com RNG com semente se o replay for querido.
6. Bairro e moradores em resumo (seção 4), só se a medição no celular pedir.

## 9. Decisões em aberto (para o autor)

- Os tetos da seção 3 são a proposta inicial; o autor decide se 14 casas no nível 3 ainda é muito (alternativa: 10
  casas × 16 moradores, casa nível 3 em 3×3 "sobrado", `popLimit` 160).
- Teto de ninjas: 45 no nível 3 corta o save atual (77). Aplicar só a saves novos, ou aceitar que o antigo não
  recruta até cair?
- PvP com confiança no relato (amigos) ou com replay conferido (RNG com semente)? O segundo muda a simulação inteira.
- Colônia com `GameState` completo (reaproveita tudo) ou um estado mais simples (só prédios e números)? O primeiro
  custa menos código e permite visitar; o segundo é mais leve no save.

## 10. Medições da Fase 1 (2026-10-15)

Réguas de `.perf/` com o save do autor (dia 385, nível 3, 148 pessoas, 69 ninjas, 20 casas, 5 fazendas, 4 lenhadores,
3 pedreiras, 5 campos de treino, 9 torres), antes e depois dos tetos, casa de 4/8/12, `popLimit` 170, imposto 5 e
`ninjaLimit` 45. A simulação usa aleatoriedade: diferenças pequenas são ruído.

| `econ.ts 2` (saldo por dia) | Antes | Depois |
|---|---|---|
| madeira / pedra | 113 / 156 | 119 / 150 |
| comida | -162 | -142 |
| ryo | 6.650 | 6.822 |
| ferro / ervas / papel | 19 / 17 / 14 | 30 / 18 / 13 |

O ryo sobe pouco (imposto 4 → 5 por morador, mas a população do save já está perto do teto). Comida continua negativa
nos dois casos: é o save, não a mudança.

`bal-threats.ts 90`: as 8 ameaças deram o mesmo quadro (invasões limpas em 24–40 s com 0–2 perdas, Espadachins em
40–67 s, Ordem do Eclipse e Fera Colossal não caem em 90 s nos dois casos). Nenhuma mudança de força: os tetos não
mexem em combate.

**Onde o save do autor fica acima dos tetos novos**: 20 casas (teto 14), 69 ninjas (teto 45), 5 campos de treino
(teto 4). Nada foi removido: o jogo só recusa construir casa, campo e recrutar ninja até os números caírem (as casas
viraram 4/8/12, então o `popLimit` 170 continua coberto pelas que existem). Dentro do teto: fazendas 5/5, lenhadores
4/5, pedreiras 3/5, torres 9/12, mercados 2/3, minas 2/4, horta 1/4.
