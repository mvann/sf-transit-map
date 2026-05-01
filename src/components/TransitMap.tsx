"use client";

import { useEffect, useRef, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Protocol } from "pmtiles";
import { layers, namedFlavor } from "@protomaps/basemaps";
import type { VehiclePosition } from "@/types/transit";

const SF_CENTER: [number, number] = [-122.4194, 37.7749];
const DEFAULT_ZOOM = 11;
const VEHICLE_POLL_INTERVAL = 15_000;

let protocolAdded = false;

export default function TransitMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const updateVehicles = useCallback(async () => {
    const m = map.current;
    if (!m || !m.getSource("vehicles")) return;

    try {
      const res = await fetch("/api/vehicles");
      if (!res.ok) return;
      const vehicles: VehiclePosition[] = await res.json();

      const geojson: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: vehicles.map((v) => ({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [v.longitude, v.latitude],
          },
          properties: {
            vehicleId: v.vehicleId,
            lineRef: v.lineRef,
            lineName: v.lineName,
            agency: v.agency,
            bearing: v.bearing ?? 0,
          },
        })),
      };

      (m.getSource("vehicles") as maplibregl.GeoJSONSource).setData(geojson);
    } catch (e) {
      console.error("Failed to update vehicles:", e);
    }
  }, []);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    if (!protocolAdded) {
      const protocol = new Protocol();
      maplibregl.addProtocol("pmtiles", protocol.tile);
      protocolAdded = true;
    }

    const m = new maplibregl.Map({
      container: mapContainer.current,
      center: SF_CENTER,
      zoom: DEFAULT_ZOOM,
      style: {
        version: 8,
        glyphs:
          "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
        sprite:
          "https://protomaps.github.io/basemaps-assets/sprites/v4/light",
        sources: {
          protomaps: {
            type: "vector",
            url: "pmtiles:///tiles/sf-bay-area.pmtiles",
            attribution:
              '<a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org">OpenStreetMap</a>',
          },
        },
        layers: layers("protomaps", namedFlavor("light"), { lang: "en" }),
      },
    });

    map.current = m;
    m.addControl(new maplibregl.NavigationControl(), "top-right");

    m.on("load", async () => {
      // Load route shapes
      try {
        const res = await fetch("/data/routes.json");
        const routesGeojson = await res.json();

        m.addSource("routes", {
          type: "geojson",
          data: routesGeojson,
        });

        m.addLayer({
          id: "route-lines",
          type: "line",
          source: "routes",
          paint: {
            "line-color": ["get", "color"],
            "line-width": 3,
            "line-opacity": 0.7,
          },
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
        });
      } catch (e) {
        console.error("Failed to load routes:", e);
      }

      // Set up vehicles source and layer
      m.addSource("vehicles", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      m.addLayer({
        id: "vehicle-markers",
        type: "circle",
        source: "vehicles",
        paint: {
          "circle-radius": 5,
          "circle-color": [
            "match",
            ["get", "agency"],
            "SF", "#c23b22",
            "BA", "#009bda",
            "CT", "#e31837",
            "#888888",
          ],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.5,
        },
      });

      // Fetch initial vehicles and start polling
      await updateVehicles();
      pollTimer.current = setInterval(updateVehicles, VEHICLE_POLL_INTERVAL);
    });

    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
      m.remove();
      map.current = null;
    };
  }, [updateVehicles]);

  return <div ref={mapContainer} className="w-full h-full" />;
}
