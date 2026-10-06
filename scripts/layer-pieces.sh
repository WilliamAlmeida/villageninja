#!/bin/bash
# Gera peças do ninja em camadas pelo Codex: cada peça num pedido separado, desenhada por cima do MOLDE dela (o corpo
# já montado com as peças de baixo: python scripts/prepare-layers.py tpl <peça>) numa cor-chave, em folha inteira +
# vista de lado 2×2. Depois: python scripts/prepare-layers.py <peça>
# Cores-chave: magenta = cor principal (recolorida), amarelo = segunda cor, ciano = metal, verde = cabelo.
# Uso: bash scripts/layer-pieces.sh <peça> [peça ...]
cd "$(dirname "$0")/.."
D=docs/arte/layers
FULL="Image 1 is a pixel art sprite sheet: 4 columns x 3 rows, the same chibi ninja in 12 walking poses (row 1 side view facing right, row 2 front view, row 3 back view). Redraw Image 1 EXACTLY: same 12 characters, same positions in the image, same sizes, same poses, same body, face, hair and clothes with the same colors, same pixel art style, white background. Change NOTHING except adding the item below on every one of the 12 characters, fitted to each pose and view (side, front, back)."
SIDE="Image 1 shows 4 pixel art sprites (2 x 2 grid) of the same chibi ninja in SIDE VIEW facing RIGHT, walking. Redraw Image 1 EXACTLY: same 4 characters, same positions, same sizes, same poses, same body, face, hair and clothes with the same colors, same pixel art style, white background. Change NOTHING except adding the item below on all 4 characters, seen from the side."
MAG="pure magenta key color (#ff00ff, darker shading #a0009f, highlight #ff8cff)"
YEL="pure yellow key color (#ffee00, darker shading #b0a000, highlight #fff799)"
CYA="pure cyan key color (#00e5ff, darker shading #0090a0, highlight #9ff6ff)"
END="Dark pixel outline. The key colors are used ONLY on this item, nowhere else."
declare -A ITEM
ITEM[headband]="ADD: a ninja forehead protector headband tied around the forehead, sitting ON the hair (the hair spikes stay visible above and behind it), with the knot and two cloth tails hanging at the back of the head. The cloth band and tails are ONLY $MAG; the metal plate on the forehead is ONLY $CYA. In the back view only the band, knot and tails show. $END"
ITEM[vest-jounin]="ADD: a jounin tactical flak vest worn over the torso, with a thick rolled high collar, two rows of scroll pouches on the chest and metal shoulder guards. The vest is ONLY $MAG; the shoulder guards and buckles are ONLY $CYA. The sleeves and pants underneath stay visible. It is a vest worn on the body, NOT a backpack. $END"
ITEM[coat-sannin]="ADD: a legendary sannin long overcoat: an open sleeveless haori coat over the clothes, reaching below the knees, with a broad trim along its front edges and hem and a big round emblem on the back. The coat is ONLY $MAG; the trim and the emblem are ONLY $YEL. The clothes underneath show at the front opening and the arms. $END"
ITEM[cloak-kage]="ADD: a Kage ceremonial cloak: a long flowing haori cloak over the shoulders reaching the ankles, with wide sleeves, open at the front. The cloak is ONLY $MAG; a flame pattern along the bottom hem and a big fire kanji on the back are ONLY $YEL. The clothes underneath show at the front opening. $END"
ITEM[hat-kage]="ADD: a Kage hat: a wide shallow conical kasa hat on the bald head, wider than the shoulders, with a diamond panel on the front showing a fire kanji, and a long cloth veil hanging from the back of the hat down to the shoulders. The hat and the veil are ONLY $MAG; the front diamond panel with the kanji and the trim of the brim are ONLY $YEL. The face stays visible under the brim. $END"
ITEM[sword-zabuza]="ADD: a giant executioner cleaver sword carried diagonally on the back (like Zabuza's Kubikiribocho): a huge flat rectangular blade almost as tall as the character, with a round hole near the tip and a half-moon notch on the back edge, and a long wrapped handle sticking up over the right shoulder. The blade is ONLY $CYA; the handle wrapping is ONLY $MAG. Front view: only the handle over the shoulder and the blade edges behind the body; back view: the whole blade across the back; side view: the blade diagonally behind the back. $END"
gen() {
  local p=$1 view=$2
  if [ "$view" = side ]; then
    node scripts/codex-image.mjs "$D/$p-side.png" "$SIDE ${ITEM[$p]}" --ref "$D/tpl-$p-side.png" --size 1536x1024
  else
    node scripts/codex-image.mjs "$D/$p.png" "$FULL ${ITEM[$p]}" --ref "$D/tpl-$p.png" --size 1536x1024
  fi
}
[ $# -eq 0 ] && { echo "uso: bash scripts/layer-pieces.sh <peça> [peça ...]   (peças: ${!ITEM[*]})"; exit 1; }
# 2 peças por vez (4 gerações em paralelo)
while [ $# -gt 0 ]; do
  gen "$1" full & gen "$1" side &
  [ -n "$2" ] && { gen "$2" full & gen "$2" side & }
  wait
  shift; [ $# -gt 0 ] && shift
done
