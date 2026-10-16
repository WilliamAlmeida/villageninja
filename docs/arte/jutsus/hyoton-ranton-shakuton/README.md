# Sensatsu, Reiza e Kajōsatsu — elaboração v1

Iniciado em 2026-10-15. Estado: sprites, integração e resultado visual no jogo aprovados pelo autor em 2026-10-15. Geração pelo ImageGen integrado. Originais `*-source-v1.png` preservados nesta pasta; folhas derivadas preparadas por `scripts/prepare-hyoton-ranton-shakuton.ps1`. Prompts em `prompts.json`.

## Referências e etapas

### Sensatsu Suishō — Haku

Água do ambiente é suspensa e moldada em numerosas agulhas finas; elas cercam o oponente e convergem. A referência consultada classifica a técnica como água, embora o jogo atualmente a coloque no Hyōton. Evitar confundir com estacas grandes de gelo ou os espelhos do Haku.

- Fonte: [Mil Agulhas Voadoras de Água da Morte](https://naruto.fandom.com/pt-br/wiki/Mil_Agulhas_Voadoras_de_%C3%81gua_da_Morte); [descrição em espanhol](https://naruto.fandom.com/es/wiki/Mil_Agujas_de_Agua_Voladoras_de_la_Muerte).
- Cena de referência: Naruto, episódio 13 / mangá capítulo 24.
- Imagem salva em `referencias/sensatsu.png`, encontrada em [Haku](https://narutothegames.forumeiros.com/t39536-haku). Imagem do anime para consulta, não para uso como sprite.
- Etapas propostas: gotas suspensas → formação de senbon → breve suspensão ao redor do alvo → convergência → gotas dispersas.
- Folha: cinco agulhas por quadro, eixo horizontal apontando à direita; instanciar conjuntos em posições distintas ao redor do alvo. Quantidade desenhada não equivale a quantidade de acertos.

### Reiza Sākasu — Darui

Um halo luminoso se forma nas mãos e emite vários feixes azul-brancos. O usuário controla a direção durante o trajeto; linhas curvas contínuas e precisão são a identidade do efeito.

- Fonte: [Storm Release: Laser Circus](https://naruto.fandom.com/wiki/Storm_Release:_Laser_Circus).
- Cenas para conferir: Shippūden episódios 203 e 269; mangá capítulos 464, 527 e 528. A fonte registra versões do anime em que o feixe se separa da origem; a proposta usa ligação contínua durante a emissão.
- Imagem salva em `referencias/reiza.png`, encontrada em [Darui](https://narutothegames.forumeiros.com/t26889-darui).
- Etapas propostas: halo nas mãos → emissão de quatro feixes → trajetórias curvas para o alvo → clarão curto no contato → halo desfaz.
- Folha: halo animado. Curvas devem ser montadas por código para acomodar distância e direção reais; não esticar uma folha de raios inteiros. Pontas e contato podem reutilizar o brilho central em escala menor.

### Kajōsatsu — Pakura

Pequenos sóis de calor orbitam o usuário e podem ser conduzidos contra inimigos. O contato evapora a água do corpo; a cena mostra vapor. O visual escolhido é núcleo branco com borda coral/vermelha, presente nas referências do anime. Há variações amarelo-laranja e magatama em outras aparições.

- Fonte: [Scorch Release: Extremely Steaming Murder](https://naruto.fandom.com/wiki/Scorch_Release:_Extremely_Steaming_Murder).
- Cenas para conferir: Shippūden episódios 265 e 285; mangá capítulo 522.
- Imagem salva em `referencias/kajosatsu.jpg`, [página onde foi encontrada](https://wegotthiscovered.com/anime/the-most-powerful-kekkei-genkai-from-naruto-ranked/).
- Etapas propostas: formação de três esferas → órbita breve ao redor do lançador → avanço para o alvo → contato com vapor claro → dissipação.
- Folha: um sol animado, instanciado três vezes. Vapor pode ser desenhado como partículas claras controladas por código. O estudo não propõe morte instantânea nem alteração de balanceamento.

## Mecânica anterior à integração

Confirmado em `src/data/jutsus.ts` e `src/game/combat.ts` em 2026-10-15:

| Jutsu | Mecânica atual | Diferença que precisa ser tratada na integração |
|---|---|---|
| Sensatsu | `multi`, seis projéteis em leque, dano 11 por projétil, stun 0.5s, velocidade 320, alcance 150; Hyōton e VFX `ice` | Formar agulhas ao redor do alvo exige coordenar origem, preparação e colisão; decidir a classificação separadamente. |
| Reiza | `multi`, quatro projéteis retos, dano 15 por projétil, stun 0.35s, velocidade 380, alcance 170; VFX `storm` violeta | Halo ligado às mãos, trajetórias curvas e orientação das pontas; não desenhar feixe chegando antes da colisão. |
| Kajōsatsu | `aoe` instantâneo no alvo, raio 70, dano 30, alcance 130; VFX `heat`, knockback genérico 45 | Órbita e viagem não existem. Sincronizar contato e dano; manter orçamento de dano/área, sem aplicar dano integral por esfera. |

O levantamento acima registra a implementação anterior. `preview.html` continua como estudo visual isolado; o laboratório mostra a implementação real descrita abaixo.

## Entrega visual e ajustes

- `preview.html`: referências, folhas, reprodução das etapas e controles de tamanho/altura/velocidade. Pode abrir diretamente no navegador.
- Folhas preparadas: PNG RGBA, grade 4×2, oito quadros de 128×128; escala uniforme por célula, sem recentralização independente.
- Integração: regulagens de pontos, tamanho/aparência e grade da folha disponíveis no laboratório; Fonte do Reiza tem controles próprios de posição, boca e duração.
- Fontes originais e versões anteriores devem ser preservadas, inclusive quando um derivado for substituído.
- Critérios de aprovação: leitura em escala de jogo, margem transparente, alinhamento entre quadros, efeito ligado ao ninja na formação, contato sincronizado e coerência com as referências.
## Integração — 2026-10-15 (`e70ca36`)

Runtime: `src/game/natureProjectiles.ts`, sistema de projéteis, `src/render/jutsuSprites.ts` e registro de arte. Dados reproduzíveis: `bun scripts/configure-hyoton-ranton-shakuton.ts`; valores já regulados no painel são preservados. Não é necessário migrar saves: o save já descarta efeitos/projéteis transitórios.

- Sensatsu: seis conjuntos formam em 0.6s em volta do ponto do alvo, depois convergem; uma colisão por conjunto, não por agulha desenhada. Mantidos dano por projétil, custo, recarga e stun. A distribuição converge no alvo, portanto pode acertar mais conjuntos que o antigo leque: requer observar o balanceamento durante a avaliação. Classificação Hyōton mantida por compatibilidade.
- Reiza: halo forma nas mãos por 0.35s; quatro pontas percorrem curvas e acompanham o alvo durante a emissão, dentro de 1.4× o alcance. Linha renderizada só até a ponta simulada. No contato, cada projétil é consumido; curva residual de 0.16s é exclusivamente visual. A fonte acompanha posição/direção do ninja. Morte, ocultação ou stun do lançador cancelam a emissão.
- Kajōsatsu: três sóis formam e orbitam por cerca de 1.05s; saem em intervalos de 0.08s para o ponto escolhido. O dano/área é dividido entre os três, mantendo o orçamento total, com queda pela distância da área. Dano só no contato/chegada, sem empurrão genérico. Vapor claro no impacto. Se outro inimigo interceptar uma esfera, sua área nasce naquele contato.
- Enquanto formam, nenhum desses projéteis colide ou aplica dano. Formação cancela se o lançador morrer, ocultar ou sofrer stun, ou se o alvo morrer/ocultar. Depois de lançados, Sensatsu e Kajōsatsu continuam independentes do lançador. Paredes bloqueiam os projéteis em voo.
- Os ajustes de contato da folha são usados pelo mesmo sistema de colisão dos outros projéteis. Alterações de escala/altura/âncora/contato ficam em `jutsu-fx.json`.
- Typecheck e build do jogo/laboratório concluídos; capturas inspecionadas em `output/playwright/{sensatsu,reiza,kajosatsu}-integrado.png`. Sem execução de testes automatizados nesta entrega.

Links do laboratório: [Sensatsu formando](http://localhost:3011/lab?jutsu=sensatsu&at=0.5), [Reiza em voo](http://localhost:3011/lab?jutsu=reiza&at=0.55), [Kajōsatsu em órbita](http://localhost:3011/lab?jutsu=kajosatsu&at=0.8). Clique em Continuar para reproduzir.