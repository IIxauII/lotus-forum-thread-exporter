#!/bin/bash
# build.sh
VERSION=$(grep '"version"' manifest.json | cut -d'"' -f4)
OUTPUT="lotus-forum-thread-exporter-v${VERSION}.zip"

# Create zip excluding unnecessary files
zip -r "$OUTPUT" . \
  -x "*.git*" \
  -x "*.DS_Store" \
  -x "README.md" \
  -x "store_listing/*" \
  -x "privacy-policy.html" \
  -x "build.sh"

echo "Created: $OUTPUT"