# Design das telas e do visual do Vila Ninja

Guia vivo dos padrões que o autor estabeleceu nas janelas, drawers e efeitos, e do gosto dele (o que aprovou e o que
corrigiu). **Ler antes de mexer em tela, janela, drawer ou efeito visual.** Quando ele aprovar ou corrigir algo novo,
acrescentar aqui com o porquê. Detalhes de implementação (nomes de funções, arquivos) ficam no CLAUDE.md; aqui fica o
padrão e o gosto, com o nome do componente para achar no código (`src/ui/panel.ts`, `src/ui/styles.css`).

## 1. Princípios

- **Menos poluição.** Tela mostra números, estados e botões; explicação vai na dica (o "i" ao lado do título da seção,
  `infoTip`) ou numa legenda discreta. Nunca um parágrafo explicativo nem uma coluna de dicas ao lado do conteúdo.
- **Tirar o que não ajuda a decidir** (ex.: barra de chakra na lista de ninjas saiu; fica na ficha).
- **Mostrar a exceção, não a rotina.** Selo de estado só quando importa (ferido, em missão, fora, estudando, raptado);
  o que muda o tempo todo (patrulhando, treinando, lutando) não vai no cartão. Também poupa o morph.
- **Uma tela só quando cabe.** Abas só quando o conteúdo não cabe junto (Quadro de missões: disponíveis e, embaixo, as
  recentes, sem aba para cada).
- **Nada duplicado entre abas.** Se algo já tem aba própria, não repetir numa faixa em outra: repensar (expedições ativas
  viraram a equipe andando no mapa da Região).
- **O que pede ação vem primeiro e em destaque** (borda/brilho laranja); o que terminou fica compacto embaixo, uma linha
  por item.
- **O conteúdo principal ocupa o espaço.** Nada de quadro pequeno com sobra vazia; painéis que preenchem a janela
  esticam (`.kfill`, `.vfill`, `#win .body:has(> …)` em coluna flex).
- **Consistência entre componentes**: o que aparece igual em dois lugares (drawer, painel por cima) tem a mesma
  animação, o mesmo fechar, o mesmo cabeçalho.
- A tela tem que funcionar no **desktop e no celular deitado (844×390)**. Quem confere no jogo é o autor: não abrir
  navegador nem tirar print por conta própria, só quando ele pedir; ao entregar, dizer onde olhar.

## 2. Os dois tipos de tela (não criar um terceiro)

| | **Janela** (`Panel` modo window, `#win`) | **Drawer** (`Panel` modo drawer, `#panel`) |
|---|---|---|
| Para | Gestão: Vila/Kage/Bingo/Estatísticas, Ninjas/Equipes/Clãs, Missões, Mundo, Oficinas | O que foi tocado no mapa: ninja, prédio, local, grupo |
| Abre por | Botões de baixo e atalhos (B, N, V, M, R, F, S) | Toque/clique no mapa |
| Celular | Tela cheia | Lateral, compacto |
| Desktop largo | Encolhe para a esquerda quando o drawer abre (os dois visíveis) | Ao lado da janela |

- Tela nova de gestão = **aba** de uma janela existente (grupo em `WINDOW_TABS`), não outro painel.
- Ninja aberto a partir de uma lista da janela mostra **"Voltar para …"** no topo do drawer.
- **Painel por cima de um conteúdo** (ex.: o lugar escolhido no mapa da Região, `.rsheet`) segue o drawer: mesma
  animação de entrada (`pin`, desliza da direita com fade), mesmo fundo/sombra e o **mesmo fechar** (quadrado arredondado
  no canto, como `#panel .close`). Ao abrir, o conteúdo de baixo se ajusta para o item não ficar escondido.

## 3. Anatomia da janela

- **Cabeçalho numa linha** (`winTop`): título com ícone · abas em botões (`.wtabs`) · à direita as etiquetas
  (`.mchip`) e a ação principal (`.wright`). Título e botões **nunca quebram linha**; no celular as etiquetas somem.
- Mexer no cabeçalho com cuidado: o autor já recusou uma reorganização ("solução ruim, volto ao que era, depois eu
  arrumo"). Mostrar/propor antes de mudar muito.
- Etiquetas do cabeçalho são **números de contexto** do grupo (Honra, Infâmia, Expedições; Reputação, Dia…), não ações.
- Corpo: seções com `h4` (caixa alta pequena, com linha) e o "i" quando precisa explicar.
- Layout por largura: duas colunas na larga (lista + detalhe, contratos ativos ao lado: `WIDE_BOARD`), uma coluna na
  estreita (o que fica ao lado sobe para o topo).

## 4. Anatomia do drawer

1. **Cabeçalho**: arte/retrato grande à esquerda + nome + selos (patente, natureza, papel, linhagem / nível com estrelas
   e o estado do prédio). Sem ícone repetido (se o quadrado grande já tem o ícone, a etiqueta do tipo é só texto).
2. **Números rápidos** em blocos (`.fquick`: Nível, Abates, Poder, Clã) e barras lado a lado (`.vit`: vida, chakra, XP)
   para economizar altura.
3. **Sub-abas** (`.mtabs.subtabs`) quando há muitos assuntos: um assunto por vez (Ficha / Ordens / Inventário) em vez de
   uma lista comprida.
4. **Seções em cartões** (`.bsec`) com `h4` e "i"; melhoria do prédio no cartão `.bup`.
5. **Ações** no fim; em painel estreito, **uma embaixo da outra**.
6. Listas longas **rolam por dentro** (`.scrollist`), nunca esticam o drawer.

## 5. Componentes (qual usar para quê)

| Componente | Uso | Regras |
|---|---|---|
| `.mchip` | Número de contexto (cabeçalho, chips de resumo) | `gold` para reputação/honra, `bad` para o que é ruim |
| `.mpill` | **Estado** de algo | `safe` (verde) · `good` (dourado) · `risky` (laranja) · `danger` (vermelho) · `info`; risco em palavras (Seguro, Favorável, Arriscado, Perigoso) |
| `.badge` / `.rbadge` | Atributos do ninja (patente, natureza, papel) | Patente com ícone próprio |
| `.lchip` | **Recurso: ícone + quantia** | Etiqueta compacta escura, texto em negrito; uma por recurso. Rótulo pequeno antes ("Tributo por dia"); nunca a frase "Tributo: 30 4 /dia" |
| `.btn primary` | A ação principal do grupo | Uma por grupo; laranja com relevo |
| `togBtn` (`.btn.tog`) | Liga/desliga | Rótulo curto + chave ("Auto", "Auto-ensino"); nunca "ligado/desligado" escrito |
| Ação em lote | Verbo curto + contagem | "Ensinar (4)", "Montar (3)"; explicação na dica |
| `costTag` | Custo dentro do botão | À direita, sem parênteses |
| `blocked(g, motivos, custo)` | Botão que não pode agir | **Nunca `disabled`**: clicável, o toque abre o aviso com o que falta |
| `.seg` | Escolha exclusiva curta (rotina, tática, vagas, filtro de 2 estados) | **Nunca `<select>`**; grade 2×2 quando são 4 |
| `.fchips` | Filtros e ordenação de listas | Com contagem; filtros de status só aparecem com alguém |
| `tipAttr` / `infoTip` | Dicas | **Nunca `title`/`alert` nativo**; `tap` = um toque mostra (para o que não tem ação) |
| `.warnbox` | Aviso importante (falta algo, perigo) | Curto |
| `.bnote` | Próximo passo sugerido | Uma frase: ícone ao lado e o texto num bloco só (nunca partido em colunas) |
| `.hint` | Texto pequeno de apoio / lista vazia | Pouco |
| `.wpips` | Vagas, usos, trabalhadores | Uma marca por vaga: cheia = em uso, contorno = pedida |
| `.nc-bar` | Barra (vida, XP, progresso) | Valores vivos por `data-b`/`data-t` |
| `pimg` | Retrato/ilustração | Esqueleto animado enquanto gera/carrega; blob URL, nada de data URL |
| Cartões (`.ncard`, `.tcard`, `.xlcard`, `.mcontract`…) | Itens de lista | Borda esquerda na cor da equipe (`--c`); tudo cabe no cartão (sem texto vazando) |

## 6. Listas, grades e cartões

- Grade **ocupa a largura toda** (2 colunas = cada uma metade).
- Lista longa (ex.: 21 equipes) vira **caixa rolável**, com os **livres/disponíveis primeiro**.
- Cartão com o essencial; o resto na dica ou ao abrir. Status só de exceção (ver Princípios).
- Formação de equipe numa linha (sensei com borda dourada + membros dividindo a largura); o X de tirar dentro do canto.
- Concluídos/recentes em **linhas compactas** (quem, onde, resultado, ganho).

## 7. Ícones

- **Padrão ícone-quantidade**: em pares de recurso e valor, o ícone vem primeiro e a quantia depois (ex.: `{ryo} 30`). Use uma `.lchip` quando couber uma etiqueta compacta por recurso, com fonte pequena e em negrito; em texto corrido, mantenha a ordem sem criar cartão. `costLabel` segue esse formato. Em texto puro (tooltip/título), `plainTokens` continua convertendo para "30 ryo". Não escrever a quantia antes do token (ex.: `30{ryo}`).
- **Interface = SVG liso do Phosphor** com cor por tipo (`.ic-<nome>`): títulos, abas, etiquetas, botões, selos.
- **Pixel art só para** recursos, itens, retratos, bustos, animais, cenas e selos de rank; no máximo 64 px e no atlas.
- **Item é sempre pixel art** (nunca o glifo, mesmo com o mesmo nome) e **cada item tem o seu ícone**: nada de o mesmo
  ícone para coisas diferentes (o cristal não pode servir de recurso, colete e cristal de chakra). Item novo derivado de
  outro (colete de cristal) nasce do ícone do original como referência.
- Arquivos organizados: o que sai do jogo vai para `docs/arte/_backup/<data>/` com LEIAME, nunca apagado direto; nomes
  dizem o que são (`badge-ranks.png`, não `cards.png`).
- Listas que precisam de visual uniforme (números das Estatísticas, marcos e requisitos da Vila) usam só glifos, todos
  na mesma cor bege. O que o Phosphor não tem é desenhado à mão no mesmo estilo (`kage`, `shinobi`, `grave`).
- Barra de atalhos de baixo usa as sprites do atlas.
- **Sem emoji**; texto marca ícone com token `{nome}`. Ícone colado no texto tem margem (`.ic`).

## 8. Tema, tamanho e texto

- Tema dos mockups do Codex (`docs/arte/mockups/`): fundo marrom quente com gradiente, bordas âmbar, cartões com
  profundidade, botões laranja com relevo, selos fortes. **Usar os tokens** (`--bg`, `--card`, `--line`, `--accent`,
  `--good`, `--bad`, `--warn`, `--muted`…), não cores soltas.
- **CSS em `rem`** (o tamanho de texto P/M/G escala tudo).
- Textos em português, curtos; números e selos em vez de frases.
- Responsivo: cartões que mudam com a própria largura usam container query (ex.: expedição em duas colunas quando larga).

## 8b. Ferramentas de desenvolvimento (editores)

- Seguem os tons do jogo (marrom, âmbar, laranja com relevo), mas como ferramenta: barra no alto (nome · modos · estado
  · ações), painéis laterais em cartões, trilho de ferramentas com ícone e a tecla de atalho visível, chaves liga/desliga
  em pílula, dica instantânea ao passar o mouse (sem o atraso do `title`), e um diálogo de atalhos no "?" em vez de um
  parágrafo comprido de dicas. O botão Salvar mostra um ponto quando há mudança não salva.

## 9. Efeitos visuais e arte

- **Fiel ao anime/à técnica**: Doryuuheki é uma muralha que brota do chão e fica parada (não um escudo que anda junto);
  Sawarabi no Mai são ossos brotando do chão; Shunshin tem o jeito da natureza (fogo = brasas, raio = faíscas, vento =
  riscos), não folhas para todos.
- **Nada de contorno geométrico "de arame"** (aura do Modo Sábio como elipse ficou feia): usar a silhueta do próprio
  sprite e partículas saindo pelas bordas, sem cobrir o rosto.
- Pedra (domo, muro): textura com tons variados e entulho, não linhas regulares que parecem cesto.
- Partículas que parecem sujeira (quadradinhos marrons no chão) estragam: sumiço = puf de fumaça clara + faíscas.
- Anéis/brilhos no chão **centrados onde a arte toca o chão**, não no meio do quadrado da imagem.
- Sprite nunca fica deformado depois de um efeito (conferir se o efeito acaba).
- Folha de personagem/bicho tem folga em volta do desenho (nada encostado na borda do quadro) e origem/sombra ajustáveis
  no editor de sprites: o autor quer poder corrigir à mão o que a geração cortou ou posicionou mal.
  A origem pode ser por quadro (bicho que muda de forma conforme a pose, como a cobra gigante).
- Prédio que fica na água (Porto) não se ajusta à mão com deslocamento e bloqueios avulsos: o terreno cobre o desenho,
  com células de água, e o jogo acha a beira e o lado (espelhando) sozinho. Chão e sombra seguem as células, não o retângulo.
- Estágios de recurso visíveis: rocha racha, some com fumaça e deixa pedrinhas; veio perde os cristais; toco de cada árvore.
- Arte nova: **Codex com a arte atual como referência**, no mesmo estilo; conferir a cor (o veio saiu escuro e foi
  refeito claro). Não regenerar por defeito pequeno.

## 10. Comportamento que aparece na tela

- Ninja abre o baú **de perto, na frente, olhando para ele** (de costas para a câmera).
- Baú aberto some depois de uns segundos (como a ruína).
- Baú, ruína e mina **nunca colados num prédio** (nem na arte que passa do terreno, como o muro da arena).
- Equipamento se gasta e se conserta (aprovado): peça gasta fica quebrada até consertar, nunca some; lâmina lendária só
  fica cega. Na tela, barra fina de durabilidade e selo só quando gasta/quebrada/cega; números de consumo por **semana**,
  não por dia.
- Invasão não pode virar "enxurrada": poucos defensores por inimigo, o resto segue a rotina.
- Mapa com zoom e arrastar: marcadores mantêm o tamanho; um toque rápido continua abrindo o item. **Com zoom tudo
  continua nítido** (mapa e rótulos borrados ao aproximar foi reclamação): o zoom redimensiona, não amplia uma imagem
  pronta, e a arte ampliada fica em pixels duros, como pixel art.
