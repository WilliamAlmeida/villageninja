# Chidori — análise e plano visual

Status atual: integrado e aprovado pelo autor em 2026-10-15, após revisão das poses e remoção das partículas de água. As seções iniciais registram a análise e o plano original; a revisão final está ao fim deste documento.

## Funcionamento da técnica

Concentra chakra de raio em uma mão, avança rapidamente e perfura o alvo com essa mão. O núcleo é branco, cercado por descargas azuladas irregulares; o som característico lembra muitos pássaros. A eletricidade acompanha a mão. O Sharingan ajuda a superar a visão de túnel e a antecipar contra-ataques na investida.

Referência consultada: [Narutopedia — Chidori](https://naruto.fandom.com/wiki/Chidori), descrição acessível pelo resultado da pesquisa. As etapas visuais abaixo são uma proposta de adaptação para o jogo; tempos e folhas não são dados canônicos.

## O que existe no jogo

- `src/data/jutsus.ts`: ninjutsu Raiton, rank4, chakra32, recarga12s, alcance150, poder-base70, requisitos ninjutsu6 e velocidade6. Não exige Sharingan atualmente.
- `src/game/combat.ts`: selos genéricos no ritmo tático; no ritmo rápido a liberação é imediata. Investida compartilhada a480px/s, duração máxima1s, acompanha a posição atual do alvo e para em obstáculos. Contato até20px entre centros aplica um golpe, com empurrão26.
- Rastro procedural `bolt` a cada0.05s, ligando posições anteriores do ninja. Impacto genérico `burst` + `hit`.
- Coreografia de chegada: pose `strike` quadro2 por0.3s, depois quadro3 por0.15s. A corrida também utiliza o primeiro quadro dessa sequência, sem uma pose própria de Chidori.
- `src/render/sprites.ts`: já calcula o ponto da mão por pose e direção para Rasengan e outras técnicas. Chidori não possui `handOrb`, nem configuração própria em `jutsu-fx.json`, nem folha própria em `src/art`.
- A chegada é calculada por distância entre centros; o ponto visual da mão ainda não participa da decisão de contato. Precisa ser avaliado nos quatro sentidos, especialmente diagonais.

## Etapas propostas

1. Selos e formação: concluir selos, baixar/preparar uma mão e acender descargas pequenas que crescem até o núcleo branco. Evitar sobrepor formação completa aos quadros em que as duas mãos ainda fazem selos.
2. Investida: manter eletricidade ligada à mão, braço preparado e corpo inclinado; descargas curtas ficam atrás da mão. O núcleo continua legível durante o deslocamento.
3. Contato: braço perfura à frente, flash concentrado no ponto de contato e raios curtos ao redor. Aplicar dano uma vez, sincronizado à chegada.
4. Recuperação: reduzir as descargas na mão e dissipar o flash enquanto o braço volta à postura normal. Interrupção deve apagar o efeito.

## Arte prevista no plano inicial

- `effect-chidori-hand-v1.png`: folha transparente4x2/8quadros com centro branco compacto, ramificações azul-ciano e pulsação irregular. Separar formação, ciclo ativo e dissipação na reprodução. O ponto de ancoragem é a palma, estável entre quadros.
- `effect-chidori-impact-v1.png`: folha transparente4x2/8quadros, flash perfurante curto e direcional, com núcleo branco e raios que se abrem e somem. Orientar conforme a investida e posicionar na altura do contato, sem cratera automática.
- Rastro: inicialmente reutilizar raios curtos existentes, corrigindo origem para a mão e reduzindo persistência. Criar terceira folha apenas se a avaliação visual mostrar necessidade.
- Poses: revisar as poses existentes de preparação, corrida e extensão da mão nas vistas frontal, traseira e lateral. Criar quadros próprios caso as poses atuais não representem o braço/corpo corretamente; os efeitos devem servir às roupas modulares do jogo.

## Integração necessária

Reaproveitar o cálculo do ponto da mão e `drawSpriteFx`, sem transformar Chidori em esfera giratória. Mostrar formação, ciclo ativo e dissipação pelo estado real da técnica. Manter controles de pontos, tamanho/aparência e grade para as folhas no laboratório. Acrescentar ajuste de origem do rastro/contato se necessário.

Revisar distância de chegada junto ao ponto da mão para impedir dano visualmente antecipado, sem alterar a distância compartilhada de todas as investidas. Prever encerramento ao morrer, ser interrompido ou perder o alvo. Conferir frente/costas/lados/diagonais, com e sem Sharingan, e nos ritmos tático e rápido.

Poder, custo, recarga e requisitos atuais são a base da integração. Exigir Sharingan, remover empurrão ou mudar a trajetória de perseguição para uma reta são decisões de gameplay separadas da proposta visual. O som de pássaros fica como etapa opcional de áudio.

Entrega prevista no plano original: prévia das duas folhas e da sequência montada. Etapa concluída; a integração revisada foi aprovada conforme o registro final.

## Prévia criada — 2026-10-15

Duas fontes geradas com imagegen integrado, preparadas como folhas RGBA 512x256 (4x2, células128). O preparo preserva alpha, escala e registro da grade; não recentraliza quadros individualmente. Fontes e prompts-v1.md retidos. Abra preview.html para formação, investida, contato e dissipação em velocidade normal/lenta e nas duas direções laterais. Figuras esquemáticas representam escala, sem substituir a revisão das poses reais na integração. Status: aguardando avaliação visual; arte ainda não integrada.


## Integração inicial — 2026-10-15

Solicitada pelo autor para avaliação no jogo. As duas folhas estão registradas em src/render/art.ts e copiadas em src/art/effects. scripts/configure-chidori.ts reproduz somente a configuração de Chidori, preservando os ajustes dos demais jutsus.

- Mão: tamanho32, âncora(.5,.54), ligada ao marcador da mão da pose/direção. Quadros0–2 formam por0.16s no início da investida; 2–5 repetem durante corrida e contato; 6–7 dissipam nos últimos0.14s da recuperação. Reutiliza poses strike0, strike1 e a coreografia existente de chegada. Ainda não há folha de corpo exclusiva.
- Durante a formação o ninja aguarda; depois corre a480px/s. O limite total de1s da investida permanece. Contato de Chidori a16.1px, chegada final a16px, sem mudar outras investidas. Não usa precisão por pixel da mão: é um ajuste aproximado que ainda precisa de avaliação visual em outras direções.
- Impacto: tamanho46, âncora(.5,.57), dy−13 em pixels de cena, orientado pelo ângulo projetado da investida, execução única a18fps. Nasce no alvo no instante do dano. Substitui o burst/hit genérico e não cria cratera.
- O rastro antigo de raios entre os pés foi retirado do Chidori; as ramificações da folha acompanham a mão. Sem terceira folha de rastro.
- Custo, poder, recarga, requisitos e empurrão preservados. Sem nova exigência de Sharingan. Interrupção da investida encerra o efeito ligado à mão.
- Laboratório: escolha Chidori, ajuste Principal/projétil (mão) ou Impacto. Ambas as peças oferecem pontos, tamanho/aparência e grade.

Typecheck e build do jogo/laboratório concluídos. Capturas em output/playwright/chidori-investida.png e chidori-impacto.png. Integração aguardando avaliação visual do autor.

Links reproduzíveis: http://localhost:3011/lab?jutsu=chidori&at=0.25 (investida) e http://localhost:3011/lab?jutsu=chidori&at=0.43 (impacto). Use Continuar ou Reiniciar para observar a sequência.

## Revisão pelas referências do autor — 2026-10-15

A versão anterior não representava a preparação baixa e a corrida mostradas nas referências. Esta revisão passa a ser a versão atual; os parâmetros da integração inicial acima são históricos.

- Formação0.65s, parada, com tronco abaixado, braço com a palma junto ao chão e segunda mão junto ao antebraço. Fios elétricos finos ligam a palma ao entorno no chão durante a concentração.
- Corrida: tronco inclinado, duas posições de pernas alternadas e braço da técnica mantido baixo. No contato, muda para braço estendido. Poses montadas em cache a partir dos recortes das próprias roupas/cabelo do ninja em src/render/chidoriPose.ts. Não há folha de personagem fixa de Kakashi/Sasuke; os ninjas continuam usando suas peças. As peças em camadas com grade63x80 recebem a pose; folhas antigas sem essas camadas conservam a pose disponível.
- Arte da mão v2, núcleo mais branco e tamanho24. v3 foi uma alternativa descartada, não registrada no jogo. Fontes e prompts conservados. Impacto permanece v1.
- Simulação: formação0.65s + até1s de investida, contato14.1px entre centros e parada14px. Sem empurrão (knock0). Dano e custo atuais preservados; teste verifica alvo sem deslocamento e golpe único.
- Aprovação visual ainda pendente. Capturas: output/playwright/chidori-formacao-v2.png, chidori-corrida-v2.png e chidori-contato-v2.png.

Prévia real no laboratório: http://localhost:3011/lab?jutsu=chidori&at=0.40 (formação), at=0.73 (corrida), at=0.91 (contato). Use Continuar para observar a sequência completa. A preview.html original é apenas o estudo v1; o laboratório representa a integração atual.

Nagashi: configuração do jogo estava em dy−9, divergindo do script/prévia em+9. Agora dy+9 nos dados; o configurador preserva o dy existente em futuros usos, e a prévia de alinhamento lê tamanho/âncora/dy diretamente do JSON. Captura: output/playwright/nagashi-altura-corrigida.png. Folha e alinhamento interno dos oito quadros preservados.

Correção do impacto: vfx explicitamente lightning e burst de partículas vazio, mantendo somente a folha de descarga. A cor azul não aciona mais o fallback de água nem a reação de Suiton. Teste do impacto real verifica ausência de partículas adicionais; typecheck, 13 testes focados e build passaram. Captura: output/playwright/chidori-impacto-sem-gotas.png.


Aprovação do autor em 2026-10-15: após corrigir o impacto sem gotas, confirmou que ficou melhor e solicitou o commit. Chidori marcado como concluído nos documentos principais. Inventário das imagens candidatas à limpeza em docs/jutsus-imagens-sem-uso.md; nenhuma exclusão feita nesta etapa.
