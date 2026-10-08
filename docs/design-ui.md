# Design das telas e do visual: o que o autor gosta (e o que não)

Guia vivo, escrito a partir dos pedidos e correções do autor. **Ler antes de mexer em tela, janela, drawer ou efeito
visual.** Quando ele aprovar ou corrigir algo novo, acrescentar aqui (com o porquê). As regras técnicas da interface
(ícones, botões, `morph`, `winTop`, tokens do tema) estão no CLAUDE.md; aqui fica o gosto.

## Princípios

- **Menos poluição.** Tirar o que não ajuda a decidir nada (ex.: barra de chakra na lista de ninjas). Texto explicativo
  longo vira um "i" (`infoTip`) ou uma legenda discreta, nunca uma coluna de dicas ao lado do conteúdo.
- **Mostrar a exceção, não a rotina.** Selo de estado só quando importa (ferido, em missão, fora, estudando,
  raptado); o que muda o tempo todo (patrulhando, treinando, lutando) não vai no cartão.
- **Uma tela só quando cabe.** Abas só se o conteúdo não cabe junto (Quadro de missões: disponíveis e, embaixo,
  as recentes; nada de aba para cada).
- **Sem informação duplicada entre abas.** Se algo já tem aba própria, não repetir numa faixa em outra; repensar
  (expedições ativas viraram a equipe andando no mapa da Região).
- **O que pede ação vem primeiro e em destaque** (expedição esperando "descer ou voltar" no alto, com borda laranja);
  o que já terminou fica compacto embaixo (uma linha por item).
- **O conteúdo principal ocupa o espaço.** Mapa da Região na janela inteira, com zoom e arrastar; nada de quadro
  pequeno com sobra vazia.
- Sempre conferir **desktop e celular deitado (844×390)** no jogo com o save dele antes de entregar.

## Cabeçalhos, títulos e etiquetas

- Título da janela **numa linha só**, nunca quebrando (`.whead .mh-title` nowrap); botões de ação também.
- **Não repetir ícone**: se o título já tem o ícone grande, a etiqueta do tipo é só texto ("Ilha", "Covil").
- Mexer no cabeçalho com cuidado: uma vez ele recusou uma reorganização ("solução ruim, volto ao que era, depois eu
  arrumo"). Propor/mostrar antes de mudar muito.

## Números, ganhos e custos

- Recursos em **etiquetas separadas, ícone + quantia** (estilo `lchip`/chip do "60 ryo"), uma por recurso. Nada de
  frase "Tributo: 30 4 /dia". O rótulo vai antes, pequeno ("Tributo por dia", "Renderia por dia").
- Ganhos que dependem do lugar (1, 2 ou 3 recursos) ficam num cartão próprio, para não quebrar em colunas.
- Notas (a caixinha amarela) são uma frase normal: ícone ao lado e o texto num bloco só (nunca partido em colunas).

## Listas, grades e botões

- Grade tem que **ocupar a largura toda** (2 colunas = cada uma metade).
- Lista longa (ex.: 21 equipes) vira **caixa rolável**, com as **livres primeiro**.
- Num painel estreito (drawer, painel do lugar), **ações uma embaixo da outra**.
- Cartões de equipe/formação: tudo cabe no cartão (nível e papel sem vazar); o X de tirar fica dentro do canto.
- Formação da equipe numa linha (sensei com borda dourada + membros dividindo a largura).

## Drawers e painéis por cima

- Painel que surge por cima (ex.: lugar da Região) usa **a mesma animação do drawer** (`pin`) e **o mesmo fechar**
  (quadrado arredondado no canto, `#panel .close`). Consistência entre componentes importa.
- Ao abrir o painel de um ponto do mapa, o mapa se move para o ponto não ficar escondido atrás dele.

## Efeitos visuais e arte

- **Fiel ao anime/à técnica**: Doryuuheki é uma muralha que brota do chão e fica parada (não um escudo que anda junto);
  Sawarabi no Mai são ossos brotando do chão; Shunshin tem o jeito da natureza (fogo = brasas, raio = faíscas, vento =
  riscos), não folhas para todos.
- **Nada de contorno geométrico "de arame"** (aura do Modo Sábio como elipse ficou feia): usar a silhueta do próprio
  sprite (`solidArt`) e partículas saindo pelas bordas, sem cobrir o rosto.
- Domo, muro, blocos: com textura de pedra (tons variados, entulho), não linhas regulares que parecem cesto.
- Partículas que parecem sujeira no chão (quadradinhos marrons) estragam: sumiço = puf de fumaça clara + faíscas.
- Anéis/brilhos no chão **centrados onde a arte toca o chão** (`artFoot`), não no meio do quadrado da imagem.
- Sprite nunca "esticado"/deformado depois de um efeito (conferir se o efeito acaba).
- Recursos com estágios: rocha some com fumaça e deixa pedrinhas; veio sem os cristais; toco de cada árvore.
- Arte nova: **Codex com a arte atual como referência**, no mesmo estilo (conferir cor: o veio saiu escuro e foi
  refeito claro). Não regenerar por defeito pequeno.

## Comportamento que aparece na tela

- Ninja abre o baú **de perto, na frente, olhando para ele** (de costas para a câmera), não de longe.
- Baú aberto some depois de uns segundos (como a ruína).
- Invasão não pode virar "enxurrada": poucos defensores por inimigo, o resto segue a rotina.
