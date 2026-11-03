#!/usr/bin/env bash
# Regenerate the AR assets (GLB for Android/WebXR, USDZ for iOS Quick Look) from the EXISTING ring model
# public/assets/3D/ring_webgi.glb. No new design is introduced; only material/pose/scale are normalised.
# Needs: node >= 18 with @gltf-transform/{core,extensions,functions} + draco3dgltf installed (npm i --no-save ...),
#        python3 with `usd-core` (pip install usd-core). Usage: scripts/ar/build-ar-assets.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
SRC=public/assets/3D/ring_webgi.glb
OUT=public/assets/ar
TMP=$(mktemp -d)
mkdir -p "$OUT"
GEM='#f4fbff'
# id:metal-hex (must match lib/ar-assets.ts AR_METALS)
for entry in yellow-gold:#d4af37 white-gold:#e8eef4 rose-gold:#c9a08a platinum:#c2ccd6; do
  id=${entry%%:*}; hex=${entry#*:}
  node scripts/ar/make_ar_glb.cjs "$SRC" "$OUT/ring-$id.glb" "$hex" "$GEM"
  node scripts/ar/dump_geo.cjs "$OUT/ring-$id.glb" "$TMP/$id.json"
  python3 scripts/ar/write_usd.py "$TMP/$id.json" "$OUT/ring-$id.usdz" "$hex" "$GEM"
done
echo "done -> $OUT (thumbnails ring-thumb-*.png are rendered separately and committed)"
