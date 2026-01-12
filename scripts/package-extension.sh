#!/bin/bash

# Script to package extension for store submission without macOS hidden files

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if browser argument is provided
if [ -z "$1" ]; then
  echo -e "${RED}Error: Please specify browser (chrome or firefox)${NC}"
  echo "Usage: ./scripts/package-extension.sh [chrome|firefox]"
  exit 1
fi

BROWSER=$1
DIST_DIR="dist-${BROWSER}"
OUTPUT_FILE="aetron-wallet-${BROWSER}.zip"

# Validate browser
if [ "$BROWSER" != "chrome" ] && [ "$BROWSER" != "firefox" ]; then
  echo -e "${RED}Error: Browser must be 'chrome' or 'firefox'${NC}"
  exit 1
fi

# Check if dist directory exists
if [ ! -d "$DIST_DIR" ]; then
  echo -e "${RED}Error: $DIST_DIR does not exist. Run 'npm run build:${BROWSER}' first${NC}"
  exit 1
fi

echo -e "${YELLOW}Packaging ${BROWSER} extension...${NC}"

# Remove old zip if exists
if [ -f "$OUTPUT_FILE" ]; then
  echo "Removing old $OUTPUT_FILE"
  rm "$OUTPUT_FILE"
fi

# Create zip without macOS metadata files
# The -X flag excludes extended attributes (._* files)
# The -r flag recurses into directories
# The -9 flag uses maximum compression
cd "$DIST_DIR"
zip -r -9 -X "../$OUTPUT_FILE" . \
  -x "*.DS_Store" \
  -x "__MACOSX/*" \
  -x "*.git*"
cd ..

echo -e "${GREEN}✓ Successfully created ${OUTPUT_FILE}${NC}"
echo "File size: $(du -h "$OUTPUT_FILE" | cut -f1)"
echo ""
echo "You can now upload this file to the ${BROWSER} web store."
