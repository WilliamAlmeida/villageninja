# Limpeza de imagens de jutsus — 2026-10-15

Limpeza autorizada pelo autor após o inventário inicial. Foram removidas oito imagens derivadas ou capturas obsoletas (1.525.354 bytes, aproximadamente1.45MiB). Nenhum arquivo source foi removido. Escopo restrito ao projeto; não inclui cópias externas no computador.

## Arquivos removidos

| Arquivo | Motivo |
|---|---|
| `src/art/effects/effect-chidori-hand-v1.png` | Folha substituída pela mão v2. |
| `src/art/effects/effect-sekizo-impact-v1.png` | Efeito substituído pelos canhões de pressão desenhados em pressureCannon.ts. |
| `docs/arte/jutsus/chidori/effect-chidori-hand-v1.png` | Cópia preparada da versão antiga. |
| `docs/arte/jutsus/chidori/preview-v1.png` | Captura do estudo inicial. |
| `docs/arte/jutsus/taijutsu/effect-nikudan-v1.png` | Folha multicolorida substituída pelo tecido neutro v2. |
| `docs/arte/jutsus/taijutsu/preview.png` | Captura anterior à revisão do tecido. |
| `output/playwright/chidori-investida.png` | Captura da primeira implementação. |
| `output/playwright/chidori-impacto.png` | Captura da implementação com partículas incorretas. |

## Fontes originais preservadas

Orientação do autor: a source é o original necessário para novos ajustes e regeneração. Foram preservadas todas as45 imagens com source no nome em docs/arte/jutsus, inclusive tentativas anteriores e fontes que deixaram de alimentar o jogo diretamente.

Isso inclui as fontes v1/v2/v3 da mão do Chidori, as fontes v1/v2 do Kaiten, primeiras fontes de Kirin/Nagashi, impacto sem padding do Rasengan, fontes antigas e modulares do Suiryuudan, fonte antiga e neutra do Nikudan e fonte antiga do Sekizō. As fontes atuais dos demais jutsus também permanecem.

As34 folhas restantes em src/art/effects têm referência no código/configuração atual. As folhas preparadas atuais usadas nas prévias, os prompts e as capturas da versão aprovada foram preservados.

## Referências atualizadas

- Retirados import/registro do impacto antigo do Sekizō em src/render/art.ts.
- Retirada a entrada antiga do Sekizō em scripts/prepare-lava-vento.ps1, evitando recriar a folha descartada; sua source permanece guardada.
- Prévia do Chidori atualizada para as folhas ativas e links da sequência real no laboratório.
- README do Chidori e da arte de taijutsu atualizados para não depender das folhas/capturas removidas.

Typecheck, testes focados de configuração dos efeitos e build do jogo/laboratório executados após a limpeza. A busca em src/scripts/tests/tools não encontrou referências às três folhas derivadas descartadas.
