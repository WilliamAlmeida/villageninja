# Kirin, Jukai Kōtan, Raikyuu e Chidori Nagashi — arte v1

Novo lote iniciado em 2026-10-14, após os commits `3a50dcf` e `0d0e25b` de Doton/areia.
Amaterasu e Susano’o foram adiados a pedido do autor. As quatro artes foram integradas no jogo em 2026-10-15 e aguardam avaliação visual do autor.

| Jutsu | PNG final em `src/art/effects/` | Uso |
|---|---|---|
| Kirin | `effect-kirin-v1.png` | Carga, cabeça de dragão elétrico descendente, contato e dissipação. |
| Jukai Kōtan | `effect-jukai-v1.png` | Raízes gigantes brotando, envolvendo, permanecendo e recuando. |
| Raikyuu | `projectile-raikyuu-v1.png` | Esfera de raios em loop, distinta da espiral do Rasengan. |
| Chidori Nagashi | `effect-chidorinagashi-v1.png` | Descarga elétrica radial com centro aberto para o ninja. |

Todas as folhas são PNG RGBA, grade 4x2, oito quadros. Kirin e Nagashi: células128x128 (512x256);
Jukai: células96x96 (384x192); Raikyuu: células64x64 (256x128).
Base das peças de chão: (0,5;0,78); projétil: (0,5;0,5). Tamanhos de prévia: 180/76/30/142 px.

Geradas e ajustadas com ImageGen integrado; prompts de geração e edição completos em `prompts.json`.
Fontes selecionadas: `kirin-source.png`, `jukai-source.png`, `raikyuu-source.png`, `chidorinagashi-source.png`.
As primeiras tentativas com cortes estão preservadas em `*-first-source.png`.
Preparo: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/prepare-raiton-mokuton.ps1`.
Limpa alpha residual <32, remove ruído solto e reduz por nearest-neighbor com escala comum entre quadros.
O Kirin registra a ponta da cabeça em alturas progressivamente menores nos primeiros quatro quadros, preservando a descida; o impacto usa a referência fixa do chão.
Cada folha foi conferida quanto a oito quadros preenchidos e margens transparentes.

Prévia autocontida: `preview.html`. Regenerar com `bun scripts/preview-raiton-mokuton.ts`.
Inclui pausa, reinício e seleção de quadro, sem abrir navegador ou mexer no save.
Kirin e Nagashi são sequências de execução única; a prisão do Jukai deve manter os quadros de raízes fechadas
pelo tempo de atordoamento, e o Raikyuu pode repetir seus oito quadros durante o voo.

## Integração no jogo — 2026-10-15

- `scripts/configure-raiton-mokuton.ts` atualiza as quatro entradas de `src/data/jutsu-fx.json`.
- Kirin: efeito `thunder` com oito fases a 10 qps (0,8 s), tamanho180; mantém a força reduzida sem tempestade.
- Jukai: raiz ancorada nos pés, tamanho76; formação, gaiola, folhas e recuo pelo tempo restante de prisão.
- Raikyuu: esfera tamanho30, loop16 qps, gira com o voo; impacto com pequenas faíscas azul-brancas.
- Chidori Nagashi: descarga tamanho142, opacidade0,95, duração0,8 s; acompanha o corpo pelo `uid` e termina se o lançador morrer ou ficar oculto.
- Dano, recargas, velocidade, raio de área e duração dos estados mantidos; animação não repete dano.
- Testes direcionados: 17 passaram; TypeScript e build passaram. Sem navegador ou screenshot; avaliação no jogo pelo autor.
Commit de implementação: `3de1e8b`. Kirin, Jukai e Raikyuu aprovados pelo autor.
Nagashi corrigido com `dy:18`; avaliação visual desse ajuste ainda pendente. Verificação completa: 364 testes passaram.
