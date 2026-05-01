#!/usr/bin/env bash
set -euo pipefail

# Downloads GTFS static feeds from 511 and processes them into GeoJSON route shapes.
#
# Usage: ./scripts/update-gtfs.sh
# Requires: TRANSIT_511_API_KEY in .env.local (or environment)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DATA_DIR="$PROJECT_DIR/public/data"
TEMP_DIR="$(mktemp -d)"

# Load API key from .env.local if not already set
if [ -z "${TRANSIT_511_API_KEY:-}" ]; then
  if [ -f "$PROJECT_DIR/.env.local" ]; then
    TRANSIT_511_API_KEY="$(grep TRANSIT_511_API_KEY "$PROJECT_DIR/.env.local" | cut -d= -f2)"
  else
    echo "ERROR: TRANSIT_511_API_KEY not set and .env.local not found" >&2
    exit 1
  fi
fi

AGENCIES="SF BA CT"
API_BASE="http://api.511.org/transit/datafeeds"

mkdir -p "$DATA_DIR"

echo "Downloading GTFS feeds..."
for agency in $AGENCIES; do
  echo "  Fetching $agency..."
  curl -sfL --compressed \
    "$API_BASE?api_key=${TRANSIT_511_API_KEY}&operator_id=${agency}" \
    -o "$TEMP_DIR/${agency}.zip"
  mkdir -p "$TEMP_DIR/${agency}"
  unzip -qo "$TEMP_DIR/${agency}.zip" shapes.txt routes.txt trips.txt stops.txt stop_times.txt -d "$TEMP_DIR/${agency}"
done

echo "Processing route shapes and stops..."
node "$SCRIPT_DIR/process-gtfs-shapes.mjs" "$TEMP_DIR" "$DATA_DIR/routes.json" "$DATA_DIR/route-stops.json"

rm -rf "$TEMP_DIR"
echo "Done! Output: $DATA_DIR/routes.json, $DATA_DIR/route-stops.json"
