# Imagens de jutsus candidatas à limpeza

Inventário em 2026-10-15, solicitado pelo autor antes da exclusão. Nenhum arquivo foi apagado. Escopo: imagens do projeto em src/art/effects, docs/arte/jutsus e capturas desta integração; não inclui cópias externas no computador.

A identificação compara o registro em src/render/art.ts com as configurações em src/data/jutsu-fx.json e referências no restante de src, além dos scripts de preparo e prévias locais. Uma fonte não carregada pelo jogo pode continuar necessária para regenerar a arte ativa.

## Folhas sem uso no jogo

| Arquivo | Situação |
|---|---|
| `src/art/effects/effect-chidori-hand-v1.png` | Sem registro/referência atual; substituída por effect-chidori-hand-v2. Ainda não versionada. |
| `src/art/effects/effect-sekizo-impact-v1.png` | Registrada no catálogo/editor, mas sem peça configurada no Sekizō. O efeito atual usa canhões desenhados por pressureCannon.ts. A exclusão precisa retirar import/registro e revisar o preparo antigo. |

As outras 34 folhas presentes em src/art/effects têm referência no código/configuração atual.

## Fontes e versões anteriores

Caminhos relativos a `docs/arte/jutsus/`:

| Arquivo | Motivo / referência restante |
|---|---|
| `chidori/chidori-hand-source-v1.png` | Origem da primeira proposta, substituída pela fonte v2. |
| `chidori/chidori-hand-source-v3.png` | Alternativa descartada, nunca integrada. |
| `chidori/effect-chidori-hand-v1.png` | Folha da proposta v1; a prévia HTML antiga ainda aponta para ela. |
| `chidori/preview-v1.png` | Captura do estudo inicial com figuras esquemáticas. |
| `kaiten/kaiten-source-v1.png` | Primeira versão; preparo atual usa kaiten-source-v2.png. |
| `raiton-mokuton/chidorinagashi-first-source.png` | Tentativa anterior; preparo atual usa chidorinagashi-source.png. |
| `raiton-mokuton/kirin-first-source.png` | Tentativa anterior; preparo atual usa kirin-source.png. |
| `raiton-mokuton/kirin-padding-source.png` | Etapa anterior; preparo atual usa kirin-source.png. |
| `rasengan/impact-source.png` | Versão sem padding; preparo atual usa impact-padded-source.png. |
| `suiton/projectile-suiryuudan-source.png` | Origem do dragão monolítico abandonado; jogo usa as três peças em suiton/modular. |
| `suiton/projectile-suiryuudan-v2-source.png` | Segunda origem do dragão monolítico abandonado. |
| `taijutsu/nikudan-source.png` | Roupa multicolorida substituída pela fonte neutra nikudan-source-v2.png. |
| `taijutsu/effect-nikudan-v1.png` | Folha multicolorida substituída por effect-nikudan-v2. |
| `taijutsu/preview.png` | Captura da versão anterior ao tecido neutro. |
| `lava-vento/sekizo-source.png` | Fonte da proposta antiga, ainda citada pelo preparo legado; não alimenta o canhão atual. |

Alguns documentos/prompts mantêm referências históricas a essas versões. Antes de apagar, atualizar as prévias e os preparadores que ainda as consomem.

## Capturas antigas desta integração

- `output/playwright/chidori-investida.png`: primeira implementação.
- `output/playwright/chidori-impacto.png`: primeira implementação com partículas incorretas.

As capturas de formação/corrida/contato v2, impacto sem gotas e Nagashi corrigido registram a versão atual e foram preservadas para o commit.

## Fontes atuais a preservar

Preservar fontes v2 da mão do Chidori e do Kaiten, impacto v1 do Chidori, nikudan-source-v2, fontes principais de Raiton/Mokuton, imagens com padding do Rasengan/Rasenshuriken, as três fontes de Suiryuudan modular e as demais fontes consumidas pelos preparadores atuais. As cópias preparadas em docs usadas nas prévias também são úteis, embora o jogo carregue src/art.
