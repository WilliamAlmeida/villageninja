#!/bin/bash
# Gera as peças do ninja em camadas pelo Codex: cada peça num pedido separado, desenhada por cima do corpo-base numa
# cor-chave (folha inteira + vista de lado 2×2). Depois: python scripts/prepare-layers.py
# Uso: bash scripts/layer-pieces.sh [peça ...]   (sem argumentos: todas)
cd "$(dirname "$0")/.."
D=docs/arte/layers
FULL="Image 1 is a pixel art sprite sheet: 4 columns x 3 rows, the same bald chibi ninja base body (dark gray undersuit) in 12 walking poses (row 1 side view facing right, row 2 front view, row 3 back view). Redraw Image 1 EXACTLY: same 12 characters, same positions in the image, same sizes, same poses, same body, same face, same pixel art style, white background. Change NOTHING except adding the item below on every one of the 12 characters, fitted to each pose and view (side, front, back)."
SIDE="Image 1 shows 4 pixel art sprites (2 x 2 grid) of the same bald chibi ninja base body (dark gray undersuit) in SIDE VIEW facing RIGHT, walking. Redraw Image 1 EXACTLY: same 4 characters, same positions, same sizes, same poses, same body, same face, same pixel art style, white background. Change NOTHING except adding the item below on all 4 characters, seen from the side."
MAG="drawn ONLY in pure magenta key color (#ff00ff, darker shading #a0009f, highlight #ff8cff) with a dark pixel outline"
declare -A ITEM
ITEM[outfit-genin]="ADD: a simple genin ninja outfit: long-sleeve wrap top with a crossed collar, loose pants tucked into ankle wraps, a sash belt, and a ninja headband tied around the forehead with two cloth tails hanging at the back of the head. ALL the cloth (top, pants, wraps, sash, headband cloth) is $MAG. The metal forehead plate of the headband is drawn ONLY in pure cyan key color (#00e5ff, darker shading #0090a0, highlight #9ff6ff). Face, hands and sandals unchanged. The head stays bald (no hair). No other magenta or cyan anywhere."
ITEM[hair-spiky]="ADD: big spiky anime hair drawn ONLY in pure green key color (#2ecc40, darker shading #1e8a2b, highlight #7dff8a) with a dark pixel outline. The hair covers the whole top and back of the skull (no bald skin visible on top), spikes point up and back; the face, eyes and ears stay visible (in the front view only short bangs on the forehead). No headband. No other green anywhere."
ITEM[vest-chunin]="ADD: a ninja tactical flak vest (chunin vest) worn over the torso, with a high collar and two scroll pouches on the chest, $MAG. It covers the torso from the collar to the waist; the gray undersuit sleeves and pants stay visible. It is a vest worn on the body, NOT a backpack. No other magenta anywhere."
gen() {
  local p=$1 view=$2
  if [ "$view" = side ]; then
    node scripts/codex-image.mjs "$D/$p-side.png" "$SIDE ${ITEM[$p]}" --ref "$D/base-side.png" --size 1536x1024
  else
    node scripts/codex-image.mjs "$D/$p.png" "$FULL ${ITEM[$p]}" --ref "$D/base-full.png" --size 1536x1024
  fi
}
export -f gen; export D FULL SIDE
PIECES=("$@"); [ ${#PIECES[@]} -eq 0 ] && PIECES=("${!ITEM[@]}")
for p in "${PIECES[@]}"; do gen "$p" full & gen "$p" side & wait; done
