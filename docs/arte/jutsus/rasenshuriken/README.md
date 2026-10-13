# Rasenshuriken — arte v1

Implementado no jogo, aguardando avaliação visual do autor.

## Imagens finais

- `src/art/effects/projectile-rasenshuriken-v1.png`: RGBA 384x192, 4x2, oito células 96x96, loop de 24 qps, largura no jogo 56 px.
- `src/art/effects/effect-rasenshuriken-impact-v1.png`: RGBA 512x256, 4x2, oito células 128x128; expansão e dissipação de 0,8 s, largura 208 px, opacidade 0,75, deslocamento vertical +8 px.
- Cratera compartilhada: `src/art/effects/effect-rasengan-crater-v1.png`, desenhada com largura 164 px e duração 20 s.

Fontes ImageGen integrado: `flight-source.png`, `flight-padded-source.png`, `impact-source.png`, `impact-padded-source.png`.
Prompts de geração e edição: `prompts.json`. O preparo técnico mantém uma escala comum entre os quadros,
remove ruído solto/alpha residual <32 e reduz por nearest-neighbor; o domo cresce sem normalizar cada fase para o mesmo tamanho.

## Reproduzir

- Preparar imagens: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/prepare-rasenshuriken.ps1`.
- Configurar lote: `bun scripts/configure-rasenshuriken.ts` (substitui apenas a entrada Rasenshuriken do JSON).
- Gerar prévia: `bun scripts/preview-rasenshuriken.ts`; abrir `preview.html`.

## Integração

Forma na mão nos últimos 0,3 s dos selos. Quatro lâminas giram durante o voo.
No contato/terminação normal do projétil, domo expande e desaparece; cratera fica abaixo dos personagens.
Mantém dano, alcance, velocidade e raio originais, sem dano extra por quadro de animação.
Muralha bloqueia o golpe com o efeito de terra existente. Não deixa cratera na água.
A marca é cosmética, não altera terreno ou colisão e compartilha o limite de 24 crateras.
Sem novo estado persistente ou migração de save. Aprovação e commit em `docs/PENDENCIAS.md`.
