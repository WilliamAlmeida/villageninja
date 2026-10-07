#!/bin/bash
# Folhas de sprite do Quinteto do Som (data/sound.ts): gabarito biped padrão, 5 gerações em paralelo.
# Depois: python scripts/prepare-art.py (SHEETS) e registro em render/art.ts.
cd "$(dirname "$0")/.."
OUTFIT="wearing the Sound village uniform: a light beige wrap tunic and baggy beige pants, a thick purple rope belt tied in a big bow at the back, a forehead protector with a music note symbol, dark sandals"
gen() { node scripts/codex-image.mjs "docs/arte/sprites/sound-$1.png" "rogue ninja of the Sound five: $2, $OUTFIT." --sheet biped; }
gen iwao "a huge heavyset bulky man with a short orange mohawk and small eyes" &
gen kumomaru "a lanky man with SIX arms (three pairs of arms) and dark brown hair tied in a short ponytail, a sly grin" &
gen kanade "a young woman with long dark pink hair under a black cap, holding a bamboo flute" &
gen sokon "a pale young man with lavender-gray hair over one eye and dark lipstick, with his twin brother's second head growing from the back of his neck" &
gen hakkotsu "the leader: a pale slender young man with long white hair, two small red dots on his forehead and a sharp white bone blade growing from his forearm, wearing an open white robe instead of the tunic" &
wait
