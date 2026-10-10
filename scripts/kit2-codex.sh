#!/usr/bin/env bash
# Lote 1 do kit limpo (Codex): uma peça-base de cada tipo, pixel art, pronta para 9-slice. Referência = recorte do mockup.
# Uso: bash scripts/kit2-codex.sh  (grava em docs/arte/ui/kit2; depois python scripts/prepare-kit2.py)
cd "$(dirname "$0")/.." || exit 1
K=src/art/ui/kit
O=docs/arte/ui/kit2
STYLE="Pixel art game UI asset (16-bit look): crisp hard pixel edges, 1px dark outline, 3-4 FLAT shades per color, NO gradients, NO soft shading, NO anti-aliasing, NO text, NO icons, NO letters. Keep the same shapes, palette and feel as the reference image but redrawn as clean pixel art. Designed for 9-SLICE scaling: the 4 corners may be ornate, but the straight edges between corners must be plain and uniform (identical along their length) and the interior must be one flat uniform color. Front view, centered, large (the element fills about 80% of the canvas). Pure white background, no shadow."
gen() { node scripts/codex-image.mjs "$O/$1.png" "$2 $STYLE" --ref "$3" > "$O/$1.log" 2>&1; echo "fim $1"; }
gen dialog "A rectangular dialog window: warm cream parchment interior inside a dark brown wooden frame with small rolled-scroll knobs on the four corners. NO title ribbon, NO close button." $K/janela-confirmar.png &
gen title "A single empty horizontal title ribbon/scroll banner: cream parchment band with a rolled red-capped scroll end on the left and on the right. The middle of the band is plain (it will be stretched). Wide and short." $K/janela-confirmar.png &
gen panel "A tall dark wooden UI panel: very dark brown flat interior, dark wood border with a thin gold trim line and small gold corner pieces. NO roof, NO portrait, NO buttons, NO tabs inside." $K/painel-predio.png &
gen crest "Only the small red Japanese pagoda roof crest that sits on top of a UI panel (red roof tiles, dark wood, little gold details), isolated, wide and short." $K/painel-predio.png &
wait
gen button "One wide rectangular game button with rounded corners: body in NEUTRAL MEDIUM GRAY (no hue, it will be recolored by code), a light top highlight band and darker bottom band as flat pixel shades, a dark outline and a thin dark bronze rim. Empty, no label." $K/janela-missao.png &
gen round "One round game button: empty dark brown circular face with a bronze/gold ring rim and dark outline. Empty face, no symbol inside." $K/botao-mais.png &
gen bar "Two stacked pieces with white space between them: TOP = an empty horizontal progress bar trough (dark brown inside, bronze/gold rim, rounded ends). BOTTOM = the bar fill alone, a rounded horizontal capsule in NEUTRAL LIGHT GRAY with a lighter top stripe and a darker bottom stripe (flat pixel shades, it will be recolored by code)." $K/barra-laranja.png &
gen pill "Two pieces with white space between them: TOP = one small rounded status tag/pill in NEUTRAL GRAY with a darker gray border (it will be recolored by code), empty. BOTTOM = an empty dark tooltip box (very dark brown interior, thin gold border, small gold corners) with a small triangle pointer on the bottom center." $K/selo-funcionando.png &
wait
