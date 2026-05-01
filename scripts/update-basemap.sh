#!/usr/bin/env bash
set -euo pipefail

# Downloads the pmtiles CLI (if needed) and extracts the SF Bay Area region
# from the latest Protomaps daily build.
#
# Usage: ./scripts/update-basemap.sh
# CI-friendly: no host dependencies beyond curl/tar.

PMTILES_VERSION="v1.30.2"
BIN_DIR="$(cd "$(dirname "$0")/.." && pwd)/.bin"
OUTPUT_DIR="$(cd "$(dirname "$0")/.." && pwd)/public/tiles"
OUTPUT_FILE="$OUTPUT_DIR/sf-bay-area.pmtiles"

# SF Bay Area bounding box: west, south, east, north
BBOX="-122.6,37.2,-121.7,37.95"
MAX_ZOOM=14

# Detect platform
OS_RAW="$(uname -s)"
ARCH="$(uname -m)"

BINARY="$BIN_DIR/pmtiles"

# Download pmtiles binary if not present or wrong version
if [ ! -x "$BINARY" ] || ! "$BINARY" version 2>/dev/null | grep -q "${PMTILES_VERSION#v}"; then
  echo "Downloading pmtiles $PMTILES_VERSION for $OS_RAW/$ARCH..."
  mkdir -p "$BIN_DIR"

  case "$OS_RAW" in
    Darwin)
      # Darwin releases use zip: go-pmtiles-VERSION_Darwin_ARCH.zip
      ARCHIVE_NAME="go-pmtiles-${PMTILES_VERSION#v}_Darwin_${ARCH}.zip"
      DOWNLOAD_URL="https://github.com/protomaps/go-pmtiles/releases/download/${PMTILES_VERSION}/${ARCHIVE_NAME}"
      curl -fSL "$DOWNLOAD_URL" -o "$BIN_DIR/pmtiles.zip"
      unzip -o "$BIN_DIR/pmtiles.zip" pmtiles -d "$BIN_DIR"
      rm "$BIN_DIR/pmtiles.zip"
      ;;
    Linux)
      # Linux releases use tar.gz: go-pmtiles_VERSION_Linux_ARCH.tar.gz
      case "$ARCH" in
        x86_64) LINUX_ARCH="x86_64" ;;
        aarch64|arm64) LINUX_ARCH="arm64" ;;
      esac
      ARCHIVE_NAME="go-pmtiles_${PMTILES_VERSION#v}_Linux_${LINUX_ARCH}.tar.gz"
      DOWNLOAD_URL="https://github.com/protomaps/go-pmtiles/releases/download/${PMTILES_VERSION}/${ARCHIVE_NAME}"
      curl -fSL "$DOWNLOAD_URL" -o "$BIN_DIR/pmtiles.tar.gz"
      tar -xzf "$BIN_DIR/pmtiles.tar.gz" -C "$BIN_DIR" pmtiles
      rm "$BIN_DIR/pmtiles.tar.gz"
      ;;
    *)
      echo "Unsupported OS: $OS_RAW" >&2
      exit 1
      ;;
  esac

  chmod +x "$BINARY"
  echo "pmtiles installed at $BINARY"
fi

# Get today's date for the build URL
BUILD_DATE="${BUILD_DATE:-$(date -u +%Y%m%d)}"
SOURCE_URL="https://build.protomaps.com/${BUILD_DATE}.pmtiles"

echo "Extracting SF Bay Area (bbox: $BBOX, maxzoom: $MAX_ZOOM)"
echo "Source: $SOURCE_URL"

mkdir -p "$OUTPUT_DIR"

"$BINARY" extract "$SOURCE_URL" "$OUTPUT_FILE" \
  --bbox="$BBOX" \
  --maxzoom="$MAX_ZOOM"

echo "Done! Output: $OUTPUT_FILE ($(du -h "$OUTPUT_FILE" | cut -f1))"
