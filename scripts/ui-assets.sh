#!/usr/bin/env bash
# Gera (pelo Codex) os assets de interface em pixel art usados pelas telas: ícones, selos de rank, ilustrações e
# texturas. Saída em docs/arte/ui/<grupo>/<nome>.png (fundo removido). Os ícones usam a moeda de ryo como referência
# de estilo (gere-a primeiro). Uso: bash scripts/ui-assets.sh [icons|seals|art|all] [--only nome,nome]
cd "$(dirname "$0")/.." || exit 1
GROUP=${1:-all}
ONLY=""
[ "$2" = "--only" ] && ONLY=",$3,"
OUT=docs/arte/ui
PAR=6

ICON_STYLE="Pixel art game UI ICON in EXACTLY the same style as the attached reference icon (16-bit look, crisp 1px dark brown outline, 3-4 flat shades per color with one bright highlight, slight bevel, flat front view, centered, filling about 80% of the canvas). Pure white background, no shadow, no text."
SEAL_STYLE="Pixel art game UI element matching the attached mockup's style. Pure white background, no shadow, no other text."
ART_STYLE="Pixel art illustration (16-bit, warm palette, crisp pixels) in the visual style of the attached game mockup. Pure white background around the subject, no text."

declare -A ICONS=(
  [wood]="a short stack of 3 cut wooden logs, warm brown bark with lighter cut ends"
  [stone]="a gray stone block / rough rock chunk with a few facets"
  [food]="a bowl of white rice with two chopsticks resting on the rim"
  [iron]="an iron ingot (metal bar), cool gray-blue steel"
  [herbs]="a bundle of green medicinal herb leaves tied with a string"
  [paper]="a rolled talisman paper strip (ofuda) with a small red mark"
  [crystal]="a glowing blue chakra crystal, faceted gem"
  [gold]="a gold nugget / gold bar, bright yellow gold"
  [darksteel]="a dark steel ingot, almost black metal with purple-ish highlights"
  [users]="two simple people silhouettes side by side (a group), warm beige"
  [ninja]="a ninja head with a headband and a metal forehead plate, dark mask"
  [star]="a five-pointed gold star (XP / reputation)"
  [swords]="two crossed steel swords (katana), silver blades, dark handles"
  [shield]="a round wooden shield with a metal rim and a small orange emblem"
  [skull]="a white skull, menacing"
  [hourglass]="a wooden hourglass with golden sand"
  [crown]="a gold crown with small red gems (the Kage)"
  [scroll]="a rolled parchment scroll with wooden ends and a red ribbon"
  [clipboard]="a clipboard / mission board with a paper sheet and a check mark"
  [map]="a folded treasure map with a red X"
  [anvil]="a black iron anvil"
  [hammer]="a wooden handled construction hammer"
  [castle]="a small pagoda-style village hall with a red roof"
  [flag]="a red war banner flag on a wooden pole"
  [medal]="a bronze medal on a red ribbon"
  [leaf]="a green leaf (hidden leaf village symbol style)"
  [check]="a bold green check mark"
  [paw]="a brown dog paw print"
  [books]="a stack of two books, red and blue covers"
  [cart]="a wooden merchant hand cart with goods"
  [target]="a round archery target with a red center"
  [run]="a running figure (motion), simple silhouette with speed lines"
  [kunai]="a kunai throwing knife, dark steel with a ring on the handle"
  [vest]="a green ninja flak vest (jacket) with pockets"
  [pill]="a red and white capsule pill"
  [up]="an upward chevron arrow with a small sparkle (upgrade), gold"
  [trophy]="a gold trophy cup"
  [party]="a festival paper lantern, red with gold trim"
  [smile]="a happy face, warm yellow"
  [eye]="an open eye (sharingan-like red iris), stylized"
  [refresh]="two curved arrows forming a circle (automatic), teal"
  [gear]="a steel cog gear"
  [dummy]="a wooden training dummy post with straw"
  [info]="a round blue badge with a white letter i"
  [medic]="a white medical cross on a red round badge"
  [luggage]="a loot bag / brown leather sack tied at the top with coins peeking"
  [pickaxe]="a mining pickaxe, wooden handle and steel head"
  [ship]="a small wooden sailing boat with a white sail"
  [houses]="two small village houses with blue tiled roofs"
  [beast]="a wild beast head (tiger-like), orange with stripes"
  [alert]="a yellow warning triangle with a dark exclamation mark"
  [lock]="a gold padlock"
  [todo]="an empty check box, parchment colored"
  [fail]="a bold red X mark"
  [pin]="a red map pin marker"
  [drop]="a blue water drop (chakra)"
  [plus]="a bold green plus sign"
  [monument]="a stone mountain face carved with faces (like Mount Rushmore)"
  [sun]="a warm yellow sun with rays"
  [moon]="a crescent moon, pale blue"
  [trash]="a gray trash bin"
  [dna]="a purple DNA double helix (bloodline)"
  [snow]="a light blue snowflake"
  [rain]="a rain cloud with drops"
  [storm]="a dark cloud with a yellow lightning bolt"
  [wheat]="three golden wheat stalks"
  [axe]="a woodcutter's axe"
  [tower]="a wooden watchtower"
  [flask]="a glass potion flask with green liquid"
  [hut]="a small wooden outpost hut with a flag"
  [lantern]="a stone japanese lantern"
  [bomb]="a round black bomb with a lit fuse"
  [baby]="a baby face wrapped in a cloth"
  [candle]="a lit candle"
  [frown]="a sad face, pale blue"
  [megaphone]="a red megaphone"
  [arena]="a stone arena with a torii gate"
  [house]="a small house with a blue tiled roof"
  [bell]="a gold bell"
  [text]="a sheet of paper with lines of text"
  [phone]="a smartphone"
  [select]="a dashed selection rectangle, white"
  [save]="a floppy disk, blue"
  [fullscreen]="four corner arrows pointing outwards"
  [play]="a triangular play button, green"
  [pause]="two vertical bars (pause), white"
  [minus]="a bold red minus sign"
  [menu]="three horizontal lines (hamburger menu), white"
  [back]="an arrow pointing left, white"
  [x]="a bold white X (close)"
)

declare -A SEALS=(
  [seal-D]="a round red wax seal stamp with the bold letter D embossed in the center, pressed on nothing (just the seal), green-tinted wax (#7ddc6b), with a bright highlight and dark outline"
  [seal-C]="a round wax seal stamp with the bold letter C embossed in the center, blue wax (#4da6ff), bright highlight, dark outline"
  [seal-B]="a round wax seal stamp with the bold letter B embossed in the center, purple wax (#b36bff), bright highlight, dark outline"
  [seal-A]="a round wax seal stamp with the bold letter A embossed in the center, orange wax (#ff8a2b), bright highlight, dark outline"
  [seal-S]="a round wax seal stamp with the bold letter S embossed in the center, red wax (#ff4d4d), bright highlight, dark outline"
)

declare -A ART=(
  [kunai-hiraishin]="a special three-pronged kunai knife with a paper seal tag tied to the handle, glowing with yellow lightning energy around it (Flying Thunder God technique), dramatic, centered"
  [beast-toad]="a big wise toad sage with orange skin, a small pipe, sitting, surrounded by faint orange natural energy sparkles, portrait"
  [beast-snake]="a huge purple serpent with yellow eyes coiled, fangs showing, faint purple aura, portrait"
  [beast-slug]="a large white and blue slug with a kind face, faint green healing glow, portrait"
  [scene-spring]="a small isometric vignette of a ninja village corner in SPRING: a house with blue tiled roof, cherry blossom tree with pink petals falling, soft light"
  [scene-summer]="a small isometric vignette of a ninja village corner in SUMMER: a house with blue tiled roof, bright green trees, strong sunlight"
  [scene-autumn]="a small isometric vignette of a ninja village corner in AUTUMN: a house with blue tiled roof, orange and red trees, falling leaves"
  [scene-winter]="a small isometric vignette of a ninja village corner in WINTER: a house with snow-covered blue tiled roof, bare trees, snow falling"
  [scene-festival]="a small isometric vignette of a village festival at night: wooden stalls, red paper lanterns strung on ropes, villagers celebrating, warm glow"
  [scene-village]="a small isometric vignette of a lively ninja village square: villagers and ninjas gathered near a torii gate and a red-roofed hall, daytime"
)

gen() {
  local group=$1 name=$2 prompt=$3 ref=$4 size=${5:-1024x1024}
  local out="$OUT/$group/$name.png"
  mkdir -p "$OUT/$group"
  if [ -n "$ONLY" ] && [[ "$ONLY" != *",$name,"* ]]; then return; fi
  [ -f "$out" ] && { echo "já existe $out"; return; }
  node scripts/codex-image.mjs "$out" "$prompt" --ref "$ref" --size "$size" 2>&1 | tail -1
}
export -f gen
export OUT ONLY

jobs=()
if [ "$GROUP" = icons ] || [ "$GROUP" = all ]; then
  for k in "${!ICONS[@]}"; do jobs+=("icons|$k|$ICON_STYLE Subject: ${ICONS[$k]}.|docs/arte/ui/icons/ryo.png|1024x1024"); done
fi
if [ "$GROUP" = seals ] || [ "$GROUP" = all ]; then
  for k in "${!SEALS[@]}"; do jobs+=("seals|$k|$SEAL_STYLE Subject: ${SEALS[$k]}.|docs/arte/mockups/missoes-mockup.png|1024x1024"); done
fi
if [ "$GROUP" = art ] || [ "$GROUP" = all ]; then
  for k in "${!ART[@]}"; do
    size=1024x1024; [[ $k == scene-* ]] && size=1536x1024
    jobs+=("art|$k|$ART_STYLE Subject: ${ART[$k]}.|docs/arte/mockups/vila.png|$size")
  done
fi
# -d '\n': uma tarefa por linha, sem o xargs interpretar aspas/apóstrofos dos prompts
printf '%s\n' "${jobs[@]}" | xargs -d '\n' -P $PAR -I{} bash -c 'IFS="|" read -r g n p r s <<< "$1"; gen "$g" "$n" "$p" "$r" "$s"' _ {}
