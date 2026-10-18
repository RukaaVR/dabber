#!/usr/bin/env bash
# Builds the logo and every app icon from public/brand/mascot-source.webp
# (the mascot art on a flat #0a0c10 background). Needs ImageMagick.
# Usage: scripts/build-icons.sh
set -euo pipefail
cd "$(dirname "$0")/../public"
SRC=brand/mascot-source.webp
BG="#0a0c10"
TMP="$(mktemp -d)"

# transparent cut-out: key out the flat background, trim, pad to a square
convert "$SRC" -fuzz 9% -transparent "$BG" -trim +repage "$TMP/trim.png"
SIDE=$(identify -format '%[fx:int(max(w,h)*1.06)]' "$TMP/trim.png")
convert "$TMP/trim.png" -background none -gravity center -extent "${SIDE}x${SIDE}" "$TMP/cut.png"
convert "$TMP/cut.png" -resize 512x512 brand/mascot.png
convert "$TMP/cut.png" -resize 256x256 brand/logo-mark.png

# app icon: the art on its own dark background, mascot filling ~84% of the tile
tile() { # size scale radius out
  local inner; inner=$(awk "BEGIN{print int($1*$2)}")
  convert -size "$1x$1" "xc:$BG" \( "$TMP/cut.png" -resize "${inner}x${inner}" \) -gravity center -composite "$TMP/sq.png"
  if [ "$3" -gt 0 ]; then
    convert -size "$1x$1" xc:black -fill white -draw "roundrectangle 0,0,$(( $1-1 )),$(( $1-1 )),$3,$3" "$TMP/mask.png"
    convert "$TMP/sq.png" "$TMP/mask.png" -alpha off -compose CopyOpacity -composite "$4"
  else
    cp "$TMP/sq.png" "$4"
  fi
}
tile 512 0.84 112 icons/icon-512.png
tile 192 0.84 42 icons/icon-192.png
tile 180 0.84 0 icons/apple-touch-icon.png
tile 512 0.66 0 icons/icon-maskable-512.png   # inside the 80% safe zone
for s in 16 32 48; do tile "$s" 0.96 "$(( s / 5 ))" "$TMP/f$s.png"; done
convert "$TMP/f16.png" "$TMP/f32.png" "$TMP/f48.png" favicon.ico
rm -f icons/icon.svg
rm -rf "$TMP"
echo "icons built"
