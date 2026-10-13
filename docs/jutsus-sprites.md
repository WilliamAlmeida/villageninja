# Jutsus: inventário e plano de sprites

Levantamento de 2026-10-13. Catálogo confirmado em `src/data/jutsus.ts`: 56 jutsus.
Configuração visual: `src/data/jutsu-fx.json`. Pendências acompanhadas em `docs/PENDENCIAS.md`.

## Catálogo atual

| Grupo | Jutsus |
|---|---|
| Katon | Housenka; Goukakyuu |
| Suiton | Mizurappa; Suiryuudan |
| Fuuton | Daitoppa; Shinkuu Ha; Rasenshuriken |
| Doton e areia | Doryuuheki; Doryuudan; Suna no Tate; Sabaku Kyū |
| Raiton | Raikyuu; Chidori; Chidori Nagashi; Kirin; Lariat; Raiton no Yoroi |
| Rasengan | Rasengan; Ōdama Rasengan |
| Naturezas combinadas | Sensatsu Suishō; Jukai Kōtan; Yōkai; Reiza Sākasu; Kajōsatsu |
| Sharingan | Kanashibari; Amaterasu; Susano'o |
| Técnicas de clã | Kage Mane; Shintenshin |
| Genjutsu | Narakumi; Lua Negra |
| Clones, cura e ressurreição | Kage Bunshin; Shousen; Edo Tensei |
| Golpes de Konoha | Senpuu; Reppuu; Shōfū; Daisenpuu |
| Combos e investidas | Dynamic Entry; Shishi Rendan; Ōkashō; Tsūtenkyaku; Omote Renge; Ura Renge; Passo de Sangue; Gatsūga; Nikudan Sensha |
| Taijutsu com efeitos à distância | Asa Kujaku; Hirudora; Sekizō |
| Byakugan | Hakke Kūshō; 64 Palmas; Kaiten; Sōshiken |
| Outros proibidos | Mil Agulhas; Hachimon Tonkō |

Fora desses 56: Shunshin, Kawarimi e Hiraishin; técnicas especiais da Ordem e do Som:
Prisão de Água, Inferno, Corpo de Ferro, Trovão Veloz, Miragem, Mortos-vivos, Ninho, Repulsão,
Cúpula de Terra, Flecha Dourada, Melodia Demoníaca, Separação e Sawarabi no Mai.

## Artes já configuradas

- Housenka e Goukakyuu: projéteis de fogo.
- Mizurappa: jato de água.
- Suiryuudan: cabeça, corpo e fonte separados, montados sobre uma curva.
- Hirudora: tigre de ar.
- Prisão de Água: esfera animada sobre o preso.
- Yōkai: reaproveita a arte do Housenka; ainda merece projétil e impacto próprios de lava.

## Prioridades sugeridas

| Prioridade | Jutsus | Entregáveis visuais |
|---|---|---|
| Concluído; aprovado pelo autor | Rasengan e Ōdama Rasengan | Esfera compartilhada ligada à mão, formação por escala, impacto e cratera temporária; Ōdama usa tudo em 2× (73c11ca). |
| Concluído; aprovado pelo autor | Rasenshuriken | Formação na mão, quatro lâminas giratórias, voo, domo expansivo e cratera ampliada. |
| Muito alta | Chidori | Chakra elétrico na mão, descarga durante a investida e impacto. |
| Muito alta | Doryuuheki | Muralha surgindo, permanecendo e desmoronando. |
| Muito alta | Kirin | Formação no céu, dragão elétrico e queda; avaliar peças separadas. |
| Alta | Amaterasu e Susano'o | Chamas negras presas ao alvo; armadura de chakra em camadas ao redor do ninja. |
| Alta | Jukai Kōtan e Sabaku Kyū | Raízes crescendo e envolvendo; areia fechando sobre o alvo. |
| Alta | Raikyuu e Chidori Nagashi | Esfera elétrica pulsante; descarga em volta do corpo. |
| Alta | Yōkai | Massa de lava e explosão viscosa próprias. |
| Média | Daitoppa, Shinkuu Ha e Sekizō | Rajadas, lâminas e colunas de ar. |
| Média | Kaiten, Sōshiken, Gatsūga e Nikudan Sensha | Domo giratório, leões de chakra, tornado e corpo rolando. |
| Média | Sensatsu, Reiza e Kajōsatsu | Agulhas de gelo, feixes elétricos e esferas de calor. |
| Complementar | Kage Bunshin, Edo Tensei e Shousen | Fumaça de criação, surgimento da invocação e aura de cura. |

Golpes físicos aproveitam as coreografias atuais do ninja em camadas, com sprites de impacto, poeira,
cortes e chakra. Sombras e feixes podem combinar comprimento/trajetória controlados por código com
sprites animadas nas pontas. Dragões e outros corpos extensos podem usar peças ligadas por curvas.

## Primeiro lote: Rasengan e Ōdama

- Escopo pedido: gerar as sprites para o autor avaliar visualmente.
- Primeira entrega: uma folha compartilhada de esfera em loop, oito quadros, grade 4×2, PNG com transparência.
- Chakra azul/ciano, correntes curvas claras; centro e raio constantes para evitar tremor na mão.
- Decisão do autor: Ōdama usa exatamente os mesmos quadros, com diâmetro 2×; não gerar uma segunda folha para essa variação.
- Fontes, prompts e prévia: `docs/arte/jutsus/rasengan/`.
- PNG preparado: `src/art/effects/effect-rasengan-v1.png`, compartilhado pelos dois jutsus.
- Impacto: `effect-rasengan-impact-v1.png`, oito fases de descarga giratória, terra e poeira, sem loop.
- Cratera: `effect-rasengan-crater-v1.png`, decalque de chão 2:1, duração de 12 s no Rasengan e 18 s no Ōdama, com desaparecimento gradual.
- Estado: integrado no jogo e aprovado visualmente pelo autor em 2026-10-13 (73c11ca). Prévia das três peças: `docs/arte/jutsus/rasengan/preview-impacto.html`.

A esfera acompanha o ponto da mão da pose em `render/sprites.ts`, com crescimento curto no início da investida.
`handOrb` continua como fallback se a imagem não carregar. O impacto só nasce no contato; cancelamentos não deixam cratera.
A marca fica abaixo dos personagens, não aparece sobre água e tem limite de 24 crateras simultâneas.
Este lote usa uma descarga curta; o domo expansivo fica no planejamento do Rasenshuriken como decisão visual.

## Segundo lote: Rasenshuriken

- `projectile-rasenshuriken-v1.png`: esfera azul e quatro lâminas de vento, oito quadros em loop a 24 qps.
- `effect-rasenshuriken-impact-v1.png`: domo que cresce e se desfaz, oito fases a 10 qps (0,8 s), com transparência.
- Reaproveita `effect-rasengan-crater-v1.png`, largura 164 px, duração 20 s. Não muda o terreno.
- Forma na mão nos últimos 0,3 s dos selos; a mesma folha passa a desenhar o projétil lançado.
- Mantém velocidade, dano, alcance, colisão e raio de área do catálogo. A explosão visual não causa dano adicional.
- Fontes, prompts do ImageGen integrado e prévia: `docs/arte/jutsus/rasenshuriken/`.
- Aprovado visualmente pelo autor em 2026-10-13; integrado no jogo e pronto para commit.
