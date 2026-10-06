#!/usr/bin/env bash
# Retratos de busto e emblemas da aba Kage (fidelidade ao mockup kage.png), gerados pelo Codex.
#  - bustos dos 8 membros da Ordem do Eclipse, com o sprite de cada um como referência (docs/arte/ui/ref/org-*.png)
#  - emblema da Ordem, emblemas dos três caminhos Sannin (ícones do atlas) e o fundo do retrato do Kage
# Saída em docs/arte/ui/{busts,icons,art}; depois rode python scripts/prepare-ui.py.
cd "$(dirname "$0")/.." || exit 1
PAR=6
BUST="Pixel art BUST PORTRAIT (head and shoulders, facing the viewer, slightly turned), detailed 16-bit anime ninja RPG style like the attached mockup's Ordem do Eclipse portraits (kage.png). The character is the one in the attached sprite reference: keep the SAME hair style and colors, face features, clothing colors and accessories. Black cloak with a crimson eclipse emblem. Dramatic warm rim light. Square framing, the bust fills the frame from the chest up. Pure white background, no text, no border."
ICON="Pixel art game UI ICON in EXACTLY the same style as the attached reference icon (16-bit, crisp dark outline, 3-4 flat shades, centered, filling 80% of the canvas). Pure white background, no shadow, no text."

jobs=(
  "busts|org-goen|$BUST Gōen, the Arsonist: fire user, menacing grin.|docs/arte/ui/ref/org-goen.png,docs/arte/mockups/kage.png"
  "busts|org-tetsuo|$BUST Tetsuo, the Iron Body: huge, stern, scarred.|docs/arte/ui/ref/org-tetsuo.png,docs/arte/mockups/kage.png"
  "busts|org-mizuchi|$BUST Mizuchi, the Tide: water user, calm cold eyes.|docs/arte/ui/ref/org-mizuchi.png,docs/arte/mockups/kage.png"
  "busts|org-raiga|$BUST Raiga, the Lightning: wild, aggressive, small sparks.|docs/arte/ui/ref/org-raiga.png,docs/arte/mockups/kage.png"
  "busts|org-kagero|$BUST Kagero, the Mirage: illusionist, mysterious half-closed eyes.|docs/arte/ui/ref/org-kagero.png,docs/arte/mockups/kage.png"
  "busts|org-shiryo|$BUST Shiryo, the Necromancer: pale, eerie.|docs/arte/ui/ref/org-shiryo.png,docs/arte/mockups/kage.png"
  "busts|org-tsuchigumo|$BUST Tsuchigumo, the Earth Spider: hooded, cunning.|docs/arte/ui/ref/org-tsuchigumo.png,docs/arte/mockups/kage.png"
  "busts|org-yomi|$BUST Yomi, the Eclipse, leader of the Order: imposing, glowing eyes, most menacing of all.|docs/arte/ui/ref/org-yomi.png,docs/arte/mockups/kage.png"
  "icons|eclipse|$ICON Subject: the emblem of a criminal ninja organization: a crimson red spiky eclipse / broken sun symbol, sharp and menacing.|docs/arte/ui/icons/ryo.png"
  "icons|path-toad|$ICON Subject: a round orange medallion emblem with a stylized toad face in the center (Toad Sage path).|docs/arte/ui/icons/ryo.png"
  "icons|path-snake|$ICON Subject: a round purple medallion emblem with a coiled stylized serpent forming a spiral in the center (Snake path).|docs/arte/ui/icons/ryo.png"
  "icons|path-slug|$ICON Subject: a round green medallion emblem with a stylized slug in the center (Slug path).|docs/arte/ui/icons/ryo.png"
  "art|kage-bg|Pixel art illustration, 16-bit, warm palette, background for a character portrait frame: interior of the Kage office, warm wooden wall with two red hanging village banners with a white spiral leaf symbol, soft lantern light, slightly blurred, NO people, portrait orientation, fills the whole canvas edge to edge.|docs/arte/mockups/kage.png"
)

gen() {
  IFS='|' read -r g n p r <<< "$1"
  mkdir -p "docs/arte/ui/$g"
  [ -f "docs/arte/ui/$g/$n.png" ] && { echo "já existe $n"; return; }
  size=1024x1024; [ "$n" = kage-bg ] && size=1024x1536
  node scripts/codex-image.mjs "docs/arte/ui/$g/$n.png" "$p" --ref "$r" --size "$size" 2>&1 | tail -1
}
export -f gen
printf '%s\n' "${jobs[@]}" | xargs -d '\n' -P $PAR -I{} bash -c 'gen "$1"' _ {}
