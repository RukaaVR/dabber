#!/usr/bin/env bash
# Turns the raw ForgeGUI downloads (scripts/fetch-assets.sh) into the files the
# app serves from public/. Needs ImageMagick (convert) and ffmpeg.
# Usage: scripts/process-assets.sh <staging-dir>
set -euo pipefail
IN="${1:-./.asset-staging}"
OUT="$(cd "$(dirname "$0")/.." && pwd)/public"
I="$IN/img"; S="$IN/sfx"
mkdir -p "$OUT"/{brand,icons,avatars,illustrations,sounds}

pick() { for f in "$@"; do [ -s "$f" ] && { echo "$f"; return; }; done; echo "missing: $*" >&2; return 1; }
trim_fit() { # src dst size  -> transparent, trimmed, centered square
  convert "$1" -trim +repage -resize "$3x$3" -background none -gravity center -extent "$3x$3" "$2"
}

# brand logo + app icons are hand-drawn SVG: see public/brand/mascot.svg and scripts/render-icons.mjs

# default avatars
for i in 0 1 2 3 4 5; do
  convert "$(pick "$I/avatars-$i.png")" -resize 256x256^ -gravity center -extent 256x256 "$OUT/avatars/default-$i.png"
done

# empty-state illustrations
for n in friends mentions pins chat voice search lost error server; do
  trim_fit "$(pick "$I/nobg-$n-0.png" "$I/empty-$n-0.png")" "$OUT/illustrations/$n.png" 400
done
# landing feature icons
for n in free servers voice safety themes; do
  trim_fit "$(pick "$I/nobg-feature-$n-0.png")" "$OUT/illustrations/feature-$n.png" 160
done
trim_fit "$(pick "$I/nobg-feature-selfhost-0.png" "$I/feature-selfhost-0.png")" "$OUT/illustrations/feature-selfhost.png" 160

# wide art
convert "$(pick "$I/discover-hero-0.png")" -resize 1600x "$OUT/illustrations/discover-hero.png"
convert "$(pick "$I/og-0.png")" -resize 1200x630^ -gravity center -extent 1200x630 "$OUT/og.png"

# sounds: trim silence, normalize loudness to a gentle level, mono 44.1k mp3
for f in "$S"/*.mp3; do
  n="$(basename "$f")"
  ffmpeg -loglevel error -y -i "$f" -af "silenceremove=start_periods=1:start_threshold=-50dB,loudnorm=I=-20:TP=-2:LRA=7" -ac 1 -ar 44100 -b:a 96k "$OUT/sounds/$n"
done
echo "assets written to $OUT"
