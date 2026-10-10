#!/usr/bin/env bash
# Lote 2 do kit limpo (Codex): barras do alto e de baixo, cartão, linha de missão, rótulo e separador. Pixel art pronta
# para 9-slice; referência = recorte do mockup. Uso: bash scripts/kit2-codex-2.sh (depois python scripts/prepare-kit2.py)
cd "$(dirname "$0")/.." || exit 1
K=src/art/ui/kit
O=docs/arte/ui/kit2
mkdir -p "$O"
STYLE="Pixel art game UI asset (16-bit look): crisp hard pixel edges, 1px dark outline, 3-4 FLAT shades per color, NO gradients, NO soft shading, NO anti-aliasing, NO text, NO icons, NO letters, NO numbers. Same shapes, palette and feel as the reference image but redrawn as clean pixel art. Designed for 9-SLICE scaling: corners/ends may be ornate, the straight edges between them must be plain and uniform along their length, and the interior one flat uniform color. Front view, centered, large. Pure white background, no shadow."
gen() { node scripts/codex-image.mjs "$O/$1.png" "$2 $STYLE" --ref "$3" > "$O/$1.log" 2>&1; echo "fim $1"; }
gen hudbar "Two stacked pieces with white space between them: TOP = a long thin horizontal top HUD bar (very dark brown wood with a thin gold trim line along the bottom edge), plain. BOTTOM = one small empty resource slot box (dark brown rounded rectangle, inset look, thin bronze border)." $K/hud-recursos.png &
gen dock "A long horizontal bottom menu bar: dark wooden beam with gold trim; on the LEFT end and on the RIGHT end a small red Japanese roof corner with a hanging red paper lantern (mirror images). The middle of the bar is plain and uniform. NO buttons on it." $K/dock-menu.png &
gen slots "Two square menu button slots side by side with white space between them: LEFT = normal slot (dark brown square with rounded corners and a bronze rim), RIGHT = the same slot ACTIVE (warm orange-gold glowing rim, slightly lighter inside). Both empty, no icon." $K/dock-menu.png &
gen card "Two pieces side by side with white space between them: LEFT = a vertical character card frame: dark brown flat interior, thick border in NEUTRAL GRAY (no hue, it will be recolored by code) with small gold corner studs. RIGHT = a small square portrait frame (empty dark inside, bronze border)." $K/cartao-ninja-genin.png &
wait
gen row "A wide horizontal parchment strip used as a mission/task row: cream parchment interior, thin brown wooden border, a small red cloth tab on the top-left corner. Plain, empty, no icon, no progress bar." $K/linha-tarefa-1.png &
gen ribbon "Two pieces stacked with white space between them: TOP = a small horizontal dark brown cloth label ribbon with a short rolled scroll end on the left, empty. BOTTOM = an ornamental horizontal divider: a thin bronze line with small swirly cloud ornaments at both ends and a small round red emblem medallion in the middle." $K/rotulo-6.png &
wait
