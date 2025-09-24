#!/usr/bin/env bash
set -euo pipefail

# Downloads Inter woff2 fonts for specified weights and generates a local CSS
# Usage: ./download_inter_fonts.sh

OUT_DIR="./public/fonts/Inter"
TMP_CSS="/tmp/inter_google.css"
WEIGHTS="300;400;600;700"

mkdir -p "$OUT_DIR"

echo "Fetching Google Fonts CSS for Inter weights: $WEIGHTS"
curl -s -A "Mozilla/5.0 (X11; Linux x86_64)" "https://fonts.googleapis.com/css2?family=Inter:wght@${WEIGHTS}&display=swap" -o "$TMP_CSS"

echo "Parsing woff2 URLs and downloading..."
URLS=$(sed -n "s/.*url(\([^)]*\)).*/\1/p" "$TMP_CSS" | tr -d '"' | tr -d "'" | grep 'fonts.gstatic.com' | uniq || true)

if [ -z "$URLS" ]; then
  echo "No font URLs found in fetched CSS. Exiting." >&2
  exit 1
fi

for url in $URLS; do
  fname=$(basename "$url")
  if [ ! -f "$OUT_DIR/$fname" ]; then
    echo "Downloading $fname"
    curl -sL "$url" -o "$OUT_DIR/$fname"
  else
    echo "Already have $fname"
  fi
done

echo "Generating local CSS at src/inter-local.css"
CSS_OUT="./frontend/src/inter-local.css"
cp "$TMP_CSS" "$CSS_OUT"

# Replace remote URLs with local paths
for url in $URLS; do
  fname=$(basename "$url")
  # Fonts will be served from /fonts/Inter/<file>
  sed -i "s|$url|/fonts/Inter/$fname|g" "$CSS_OUT"
done

echo "Done. Place-check:"
ls -la "$OUT_DIR"
echo "Local CSS at $CSS_OUT"
