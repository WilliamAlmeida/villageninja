# Doton e areia — sprites v1

Cinco folhas criadas com ImageGen integrado para os quatro jutsus pedidos. Integradas no jogo, aguardando avaliação visual do autor.

| Jutsu | PNG final | Animação |
|---|---|---|
| Doryuuheki | `src/art/effects/effect-doryuuheki-v1.png` | Subida, parede completa e desmoronamento. |
| Doryuudan | `src/art/effects/effect-doryuudan-origin-v1.png` | Cabeça de dragão de terra abrindo a boca e cuspindo lama. |
| Doryuudan | `src/art/effects/projectile-doryuudan-v1.png` | Projétil de lama e fragmentos de rocha em loop. |
| Suna no Tate | `src/art/effects/effect-sunanotate-v1.png` | Barreira curva de areia em fluxo, com abertura para o personagem. |
| Sabaku Kyū | `src/art/effects/effect-sabakukyu-v1.png` | Areia envolvendo, casulo fechado, compressão e desmanche. |

Todas são PNG RGBA transparentes, grade 4x2, oito quadros. Quatro folhas têm células 96x96 (384x192);
a do projétil tem células 64x64 (256x128). Base das peças de chão em (0,5; 0,78); projétil em (0,5; 0,5).
Tamanhos de prévia, sugestões de fases, fps e âncoras estão em `sheets.json`.

`prompts.json` guarda os cinco prompts completos. Fontes geradas: arquivos `*-source.png` nesta pasta.
Preparo técnico: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/prepare-doton-suna.ps1`.
Remove alpha residual <32 e ruído pequeno, alinha as bases e reduz por nearest-neighbor com escala comum entre fases.
O preparo conferiu oito quadros preenchidos e margens transparentes nas cinco folhas; imagens finais inspecionadas offline.

Prévia animada autocontida: `preview.html`, com pausa, reinício e seleção de quadro. Regenerar com
`bun scripts/preview-doton-suna.ts`. Não abre navegador ou altera save.

Doryuuheki mantém a face vertical e adapta a linha da base ao ângulo da muralha.
Doryuudan usa cabeça fixa na origem e projétil separado. Sabaku Kyū mantém a fase fechada pelo tempo de prisão,
usando os quadros de compressão e soltura no fim. A folha inteira desses dois efeitos não fica em loop no jogo.
Configuração de runtime: `scripts/configure-doton-suna.ts`. Cabeça por 0,65 s com boca em (0,76; 0,52); fase estável da muralha sem loop. Estado em `docs/PENDENCIAS.md`: integrado, aguardando avaliação no jogo e commit.

## Perfil com espessura — 2026-10-14

- PNG: `src/art/effects/effect-doryuuheki-profile-v1.png`, RGBA 384x192, grade 4x2, oito quadros.
- Fonte: `doryuuhekiProfile-source.png`. Prompt completo e referência: `doryuuheki-profile-prompt.json`.
- ImageGen integrado; referência visual na folha original, material e paleta preservados.
- Integrado em `JutsuFx.profile`; selecionado quando `abs(dx) < 0,8 * abs(dy)` da base projetada.
- A folha de perfil usa tamanho 64 sem compressão horizontal; espelhamento pela direção projetada, mesmas fases da frontal.
- Preparo: `scripts/prepare-doton-suna.ps1 -Only doryuuhekiProfile`, base com inset 0,20 e margens conferidas.
- Galeria em oito direções: `preview-doryuuheki.html`; regenerar com `bun scripts/preview-doryuuheki.ts`.
- Avaliação visual no jogo pelo autor ainda pendente.

## Correção dos ângulos diagonais — 2026-10-14

A frontal comprimida/inclinada por código ainda parecia uma placa fina nos ângulos intermediários.
Foi adicionada `src/art/effects/effect-doryuuheki-oblique-v1.png`, 384x192, 4x2, oito quadros, com topo e lateral desenhados.
Fonte: `doryuuhekiOblique-source.png`; prompt ImageGen integrado: `doryuuheki-oblique-prompt.json`.
Preparo isolado: `scripts/prepare-doton-suna.ps1 -Only doryuuhekiOblique`.

A implementação atual escolhe frontal, diagonal ou perfil por `wallView`, sem compressão nem cisalhamento.
Tamanhos: 64 para frontal; 58 para diagonal e perfil. Espelhamento pelo sinal da inclinação da base, sem depender do lado do atacante.
O critério frontal é `abs(dy) <= 0,25 * abs(dx)`; perfil é `abs(dx) < 0,8 * abs(dy)`; demais são diagonais.
Galeria atual com 16 direções: `preview-doryuuheki.html` (`bun scripts/preview-doryuuheki.ts`).
Validação: TypeScript, testes de seleção das folhas, gravação do editor e proteção/colisão da muralha.
