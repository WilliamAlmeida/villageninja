# Ninja montado em camadas, poses e retratos

> Detalhe movido do CLAUDE.md (o índice fica lá). Mantenha atualizado ao mexer no sistema.

- **Ninjas**: o penteado sai do id (`NINJA_HAIRSTYLES`, 6 com careca) e as cores do `look` (`tintedArt`/`dollArt` recolorem
  as cores-chave). As folhas antigas por penteado (`ninja-hair-*`, `ninja.png`) saíram: o ninja é sempre montado em camadas.
- **Peças extras do ninja**: capa do sensei na cor da equipe (`layer-cape`, `Unit.cape` posto por `markSenseis` na
  automação; Kage e Sannin não) e pergaminho grande nas costas de quem está estudando (`layer-scroll-back`).
  **Retratos**: busto por patente (`bust-<penteado>-vest` Chunin/Jounin, `-coat` Sannin; cor-chave magenta pintada por
  `tintedArt` com `vest`; `scripts/bust-ranks.py` usa os bustos editados como referência) e o dōjutsu pintado nos olhos
  (`paintEyes` em sprites.ts: a íris em volta da esclera).
- **Ninja em camadas**: corpo-base careca de malha cinza
  (`docs/arte/sprites/ninja-base.png` → `docs/arte/layers/ninja-base.png`, só entrada do prepare-layers, não vai para o jogo) + peças, cada uma num pedido separado ao Codex desenhada
  por cima de um MOLDE (o corpo já montado com as peças de baixo, `under` em `PIECES`, para a peça acompanhar os pixels
  do que fica embaixo) em cor-chave (roupa magenta, segunda cor amarelo, metal ciano, cabelo verde):
  `python scripts/prepare-layers.py tpl <peça>` grava o molde; `bash scripts/layer-pieces.sh <peça>` gera a folha inteira
  e a vista de lado (2×2, maior); `python scripts/prepare-layers.py` fica só com a cor-chave, encaixa cada quadro no molde
  (escala comum por vista + posição por quadro) e grava `src/art/layer-<peça>.png` + `ninja-body.png` (corpo com folga
  no quadro, `FRAME_PAD` em art.ts). Peças: roupa de Genin, cabelo espetado, bandana, coletes de Chunin e Jounin,
  sobretudo de Sannin (cor por caminho), manto e chapéu de Kage (Kage = base careca com chapéu), espadas do anime
  (`SWORDS`/`dollSword` em doll.ts: os Sete Espadachins da Névoa, Kusanagi, Sabre de Chakra, lâminas do Asuma, Raijin,
  sete espadas do Bee, tantō: o sprite mostra a lâmina lendária EQUIPADA, `bladeOf`) e ANBU (`outfit-anbu` + máscara
  `mask-<animal>` pelo melhor atributo, `data/anbu.ts`; veste quem foi nomeado, `NinjaInfo.anbu`). Máscaras só geram a
  folha inteira (sem a vista de lado). `dollArt` (art.ts) monta e recolore; `dollParts` (sprites.ts) escolhe pela patente.
  Os 5 penteados têm camada (espetado, rabo de cavalo, curto, longo, coques; feitos sobre a roupa) — `DOLL_HAIR`; penteado novo precisa da camada. Prévia: `python scripts/preview-layers.py`.
  Regras das peças e a recoloração ficam em `src/render/doll.ts` (puro, sem DOM), usado pelo jogo e pelo editor.
  **Poses além da caminhada** (mesma grade 4×3 e mesma célula 63×80): golpe de mão (`strike`: prepara · avança · impacto ·
  recupera), chute (`kick`: joelho erguido · chute alto · rasteira · guarda), selos (`cast`: três selos · solta o jutsu), no ar (`air`:
  agacha · encolhido · chute voador · aterrissa), atingido (`hurt`: recua · arremessado · caído · levantando; célula mais
  larga, centrada), sentado (`sit`: no degrau · pernas cruzadas · meditando · dormindo; a plateia do Exame no degrau, o
  treino de Nin/Gen meditando, de Int lendo sentado) e carregando (`carry`: caminhada com o saco no ombro, quem volta de
  expedição com espólio por `Unit.carrySack` s), gabaritos `docs/arte/gabarito-<pose>.png`. Passo = `[pose, quadro, s, altura?, 'spin'|'roll'?]`
  (`data/moves.ts`); a altura levanta o corpo e deixa a sombra no chão. Reação ao dano (`MOVE_SEQS`, `playHurt`). Golpe novo = coreografia em `JutsuDef.moves` (`[pose, quadro, s]`,
  tocada por `playMoves` em combat.ts e `poseOf` em sprites.ts), sem sprite nova; o mapa dos taijutsu do anime e de quais
  folhas faltam está em `docs/taijutsu.md`. Corpo-base da pose
  pelo Codex (`--sheet strike|cast`, fatiado pelo prepare-art centrando pelas pernas → `ninja-body-<pose>.png` pelo
  `prepare-layers.py --pose <pose>`); só as peças que mudam com o braço são geradas de novo (`POSE_PIECES`: roupas,
  coletes, sobretudo, manto; `POSE=<pose> bash scripts/layer-pieces.sh …`); cabelo, bandana, máscara, chapéu e espadas
  usam o quadro parado da caminhada deslocado com a cabeça (`src/data/doll-poses.json`). `dollArt(parts, skin, pose)`
  monta; `poseOf` (sprites.ts) escolhe pela `Unit.cast` e `Unit.animKind` (posto em combat.ts junto com o `anim`).
  Golpe com lâmina lendária segue a espada girando (sem pose).
