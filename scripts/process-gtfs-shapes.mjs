/**
 * Processes GTFS shapes.txt, routes.txt, and trips.txt into a GeoJSON
 * FeatureCollection of route line geometries.
 *
 * Usage: node process-gtfs-shapes.mjs <tempDir> <outputPath>
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const AGENCIES = ["SF", "BA", "CT"];
const tempDir = process.argv[2];
const outputPath = process.argv[3];

if (!tempDir || !outputPath) {
  console.error("Usage: node process-gtfs-shapes.mjs <tempDir> <outputPath>");
  process.exit(1);
}

function parseCsv(text) {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim().replace(/"/g, ""));
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] ?? "";
    });
    return obj;
  });
}

function parseShapes(agencyDir) {
  const text = readFileSync(join(agencyDir, "shapes.txt"), "utf-8");
  const rows = parseCsv(text);

  // Group by shape_id, sorted by sequence
  const shapes = new Map();
  for (const row of rows) {
    const id = row.shape_id;
    if (!shapes.has(id)) shapes.set(id, []);
    shapes.get(id).push({
      lat: parseFloat(row.shape_pt_lat),
      lng: parseFloat(row.shape_pt_lon),
      seq: parseInt(row.shape_pt_sequence, 10),
    });
  }

  // Sort each shape's points by sequence
  for (const [, points] of shapes) {
    points.sort((a, b) => a.seq - b.seq);
  }

  return shapes;
}

function parseRoutes(agencyDir) {
  const text = readFileSync(join(agencyDir, "routes.txt"), "utf-8");
  const rows = parseCsv(text);
  const routes = new Map();
  for (const row of rows) {
    routes.set(row.route_id, {
      shortName: row.route_short_name || row.route_long_name,
      longName: row.route_long_name,
      color: row.route_color ? `#${row.route_color}` : "#888888",
      type: parseInt(row.route_type, 10),
    });
  }
  return routes;
}

function parseTrips(agencyDir) {
  const text = readFileSync(join(agencyDir, "trips.txt"), "utf-8");
  const rows = parseCsv(text);
  // Map route_id -> Set of shape_ids
  const routeShapes = new Map();
  for (const row of rows) {
    const routeId = row.route_id;
    const shapeId = row.shape_id;
    if (!shapeId) continue;
    if (!routeShapes.has(routeId)) routeShapes.set(routeId, new Set());
    routeShapes.get(routeId).add(shapeId);
  }
  return routeShapes;
}

const features = [];

for (const agency of AGENCIES) {
  const agencyDir = join(tempDir, agency);
  console.log(`  Processing ${agency}...`);

  const shapes = parseShapes(agencyDir);
  const routes = parseRoutes(agencyDir);
  const routeShapes = parseTrips(agencyDir);

  for (const [routeId, shapeIds] of routeShapes) {
    const routeInfo = routes.get(routeId);
    if (!routeInfo) continue;

    // Use the longest shape for each route (most representative)
    let longestShape = null;
    let maxLength = 0;
    for (const shapeId of shapeIds) {
      const points = shapes.get(shapeId);
      if (points && points.length > maxLength) {
        longestShape = points;
        maxLength = points.length;
      }
    }

    if (!longestShape) continue;

    features.push({
      type: "Feature",
      properties: {
        routeId,
        shortName: routeInfo.shortName,
        longName: routeInfo.longName,
        color: routeInfo.color,
        routeType: routeInfo.type,
        agency,
      },
      geometry: {
        type: "LineString",
        coordinates: longestShape.map((p) => [p.lng, p.lat]),
      },
    });
  }
}

const geojson = {
  type: "FeatureCollection",
  features,
};

writeFileSync(outputPath, JSON.stringify(geojson));
console.log(`  Wrote ${features.length} route features`);
