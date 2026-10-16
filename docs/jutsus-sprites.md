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
- Yōkai: projétil de lava e impacto próprios.
- Daitoppa: rajada em leque na origem.
- Shinkuu Ha: lâmina curva de ar em voo.
- Sekizō: cinco socos sucessivos, com canhões longos de ar comprimido e deslocamentos ao redor do alvo.

## Prioridades sugeridas

| Prioridade | Jutsus | Entregáveis visuais |
|---|---|---|
| Concluído; aprovado pelo autor | Rasengan e Ōdama Rasengan | Esfera compartilhada ligada à mão, formação por escala, impacto e cratera temporária; Ōdama usa tudo em 2× (73c11ca). |
| Concluído; aprovado pelo autor | Rasenshuriken | Formação na mão, quatro lâminas giratórias, voo, domo expansivo e cratera ampliada. |
| Concluído; aprovado pelo autor em 2026-10-15 | Chidori | Folhas próprias na mão e no impacto, formação baixa de 0.65s, corrida com mão baixa e extensão no contato, sem empurrão; contato aproximado para 14px. Plano em `arte/jutsus/chidori/README.md`. |
| Aprovado pelo autor em 2026-10-15 | Doryuuheki; Doryuudan; Suna no Tate; Sabaku Kyū | Muralha, cabeça de terra e projétil de lama separados, barreira curva de areia e casulo com compressão. |
| Aprovado pelo autor (3de1e8b) | Kirin | Formação no céu, dragão elétrico e queda. |
| Adiados pelo autor em 2026-10-14 | Amaterasu e Susano'o | Chamas negras presas ao alvo; armadura de chakra em camadas ao redor do ninja. |
| Aprovado pelo autor (3de1e8b) | Jukai Kōtan | Raízes crescendo e envolvendo. |
| Concluído; aprovado pelo autor em 2026-10-15 | Raikyuu e Chidori Nagashi | Esfera elétrica pulsante; descarga em volta do corpo, quadros alinhados pela abertura central e deslocamento Y +9 px no laboratório, sincronizado com o preparo e a prévia. |
| Concluído; aprovado pelo autor em 2026-10-15 | Yōkai | Massa de lava e explosão viscosa próprias. |
| Concluído; aprovado pelo autor em 2026-10-15 | Daitoppa e Shinkuu Ha | Rajada e lâmina de ar com ajustes no painel. |
| Concluído; aprovado pelo autor em 2026-10-15 | Sekizō | Cinco socos sucessivos com canhões longos de pressão, de direções diferentes. |
| Concluído; arte aprovada pelo autor em 2026-10-15 | Kaiten | Domo com formação, rotação e dissipação; folha própria 4x2. |
| Concluído; implementação e visual aprovados pelo autor em 2026-10-15 | Sōshiken, Gatsūga e Nikudan Sensha | Leões acompanhando os punhos; uma broca por participante do Gatsūga (ninja e ninken próximo); bola com costuras e cor da roupa externa. |
| Concluídos; integração e visual aprovados pelo autor em 2026-10-15 | Sensatsu, Reiza e Kajōsatsu | Agulhas de água convergentes, halo e feixes azul-brancos guiados, três sóis orbitais com vapor. Contato sincronizado e controles no laboratório. Referências e integração em `arte/jutsus/hyoton-ranton-shakuton/README.md`. |
| Concluídos; integração e visual aprovados pelo autor em 2026-10-16 | Kage Bunshin, Edo Tensei e Shousen | Fumaça compartilhada, caixão com revelação/saída do ninja real e cura próxima/gradual com chakra na mão. Clones mantêm transparência e não usam jutsus. Integração em `arte/jutsus/clones-edo-cura/README.md`. |

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

## Terceiro lote: Doton e areia

Cinco folhas RGBA, oito quadros cada, grade 4x2, geradas pelo ImageGen integrado em 2026-10-13:

| Jutsu | Folhas em `src/art/effects/` | Uso previsto |
|---|---|---|
| Doryuuheki | `effect-doryuuheki-v1.png` | Subir (0–2), permanecer (3–4), desmoronar (5–7). |
| Doryuudan | `effect-doryuudan-origin-v1.png`; `projectile-doryuudan-v1.png` | Cabeça fixa cuspindo lama e projétil em loop, separados. |
| Suna no Tate | `effect-sunanotate-v1.png` | Fluxo de areia em barreira curva com abertura transparente, loop. |
| Sabaku Kyū | `effect-sabakukyu-v1.png` | Envolver (0–2), fechar (3), comprimir (4–5), desmanchar (6–7). |

Preparo em `scripts/prepare-doton-suna.ps1`: escala comum por folha, alpha limpo, nearest-neighbor,
alinhamento da base e conferência de margens. Prévia autocontida: `bun scripts/preview-doton-suna.ts`.
Fontes, prompts, metadados e prévia em `docs/arte/jutsus/doton-suna/`. Integrado no jogo (3a50dcf); quatro jutsus aprovados pelo autor em 2026-10-15. Cabeça do Doryuudan afastada mais 12 px de cena na direção do disparo, por pedido do autor.
Doryuudan mantém um projétil de dano e acrescenta a origem visual fixa; muralha e casulo usam fases pela duração,
e o escudo acompanha o ninja. Dados em `jutsu-fx.json`; configuração reproduzível em `scripts/configure-doton-suna.ts`.

## Quarto lote: Kirin, Jukai Kōtan, Raikyuu e Chidori Nagashi

Iniciado em 2026-10-14 após os commits `3a50dcf` e `0d0e25b` do lote Doton/areia. Amaterasu e Susano'o adiados
por pedido explícito do autor. Quatro folhas em grade 4x2 com oito quadros e transparência:

- `effect-kirin-v1.png`: formação da cabeça de dragão elétrico, descida e descarga, sequência única.
- `effect-jukai-v1.png`: raízes crescendo e envolvendo, permanência e retração.
- `projectile-raikyuu-v1.png`: esfera de raios pulsante, loop.
- `effect-chidorinagashi-v1.png`: descarga radial de raios com centro aberto para o ninja, sequência única.

Fontes, prompts ImageGen integrado, metadados e prévia em `docs/arte/jutsus/raiton-mokuton/`.
Preparo em `scripts/prepare-raiton-mokuton.ps1`; prévia com `bun scripts/preview-raiton-mokuton.ts`.
Integrado no jogo em 2026-10-15. Configuração reproduzível: `scripts/configure-raiton-mokuton.ts`.
Kirin e Nagashi usam impacto único de 0,8 s; raízes seguem o tempo de prisão, Raikyuu anima no voo.
Commit 3de1e8b. Kirin, Jukai e Raikyuu aprovados. Em 2026-10-15, o autor apontou variação Y entre os quadros do Nagashi: preparo corrigido para registrar o fundo da abertura do ninja, em vez da borda externa da descarga; dy final ajustado no laboratório para −9 px para alinhar essa referência aos pés. Conferência dos oito quadros em `docs/arte/jutsus/raiton-mokuton/nagashi-alinhamento.png`; correção aprovada pelo autor em 2026-10-15, incluída no commit de alinhamento.

## Quinto lote: Yōkai, Daitoppa, Shinkuu Ha e Sekizō

Autorizado pelo autor em 2026-10-15. Cinco folhas RGBA, grade 4x2 e oito quadros, geradas pelo ImageGen integrado:

- Yōkai: `projectile-yokai-v1.png` (256x128) e `effect-yokai-impact-v1.png` (512x256); lava viscosa com crosta escura e explosão própria de 0,8 s.
- Daitoppa: `effect-daitoppa-v1.png` (512x256), rajada em leque de 0,5 s ancorada no lançador e orientada ao alvo.
- Shinkuu Ha: `projectile-shinkuuha-v1.png` (256x128), lâmina curva em loop; mantém os três projéteis.
- Sekizō: a coluna `effect-sekizo-impact-v1.png` (512x256) fica disponível para reaproveitamento. Após correção do autor em 2026-10-15, o jutsu usa cinco socos sucessivos com canhões direcionais longos e deslocamentos ao redor do alvo; a antiga coluna e o leque deixaram de ser o visual padrão.

Fontes, prompts e prévia em `docs/arte/jutsus/lava-vento/`. Preparo: `scripts/prepare-lava-vento.ps1`; configuração: `scripts/configure-lava-vento.ts`; prévia: `scripts/preview-lava-vento.ts`. Artes inicialmente aprovadas em 2026-10-15; após a referência do autor, o Sekizō foi refeito e aprovado em 2026-10-15. Origem do Daitoppa e contato/impacto do Yōkai também receberam ajuste, aprovado pelo autor em 2026-10-15. Escala comum por folha e âncoras fixas; lava e lâmina têm frente estável, rajada nasce à esquerda e impactos usam base no chão.
