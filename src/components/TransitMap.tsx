"use client";

import { useEffect, useRef, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Protocol } from "pmtiles";
import { layers } from "@protomaps/basemaps";
import { oceanFlavor } from "@/lib/map-theme";
import type { VehiclePosition } from "@/types/transit";

const SF_CENTER: [number, number] = [-122.4194, 37.7749];
const DEFAULT_ZOOM = 11;
const VEHICLE_POLL_INTERVAL = 15_000;
const LONG_PRESS_DURATION = 500;

let protocolAdded = false;

interface RouteStopMap {
  [key: string]: Array<{
    stopId: string;
    stopName: string;
    lat: number;
    lng: number;
  }>;
}

export default function TransitMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const routeStops = useRef<RouteStopMap>({});
  const activePopups = useRef<maplibregl.Popup[]>([]);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPredictions = useCallback(() => {
    const m = map.current;
    if (!m) return;

    // Remove popups
    for (const popup of activePopups.current) {
      popup.remove();
    }
    activePopups.current = [];

    // Reset route highlight
    if (m.getLayer("route-lines")) {
      m.setPaintProperty("route-lines", "line-width", 2.5);
      m.setPaintProperty("route-lines", "line-opacity", 0.8);
    }
    if (m.getLayer("route-lines-highlight")) {
      m.removeLayer("route-lines-highlight");
    }

    // Remove stops layer
    if (m.getLayer("route-stops")) {
      m.removeLayer("route-stops");
    }
    if (m.getSource("route-stops")) {
      m.removeSource("route-stops");
    }
  }, []);

  const showRoutePredictions = useCallback(
    async (agency: string, routeId: string, color: string) => {
      const m = map.current;
      if (!m) return;

      clearPredictions();

      // Highlight the selected route
      m.addLayer(
        {
          id: "route-lines-highlight",
          type: "line",
          source: "routes",
          filter: [
            "all",
            ["==", ["get", "agency"], agency],
            ["==", ["get", "routeId"], routeId],
          ],
          paint: {
            "line-color": color,
            "line-width": 6,
            "line-opacity": 1,
          },
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
        },
        "vehicle-markers"
      );

      // Dim other routes
      m.setPaintProperty("route-lines", "line-opacity", 0.15);

      // Show stops for this route
      const key = `${agency}:${routeId}`;
      const stops = routeStops.current[key];
      if (!stops || stops.length === 0) return;

      // Add stops as a source/layer
      const stopsGeojson: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: stops.map((s) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [s.lng, s.lat] },
          properties: { stopId: s.stopId, stopName: s.stopName },
        })),
      };

      m.addSource("route-stops", { type: "geojson", data: stopsGeojson });
      m.addLayer(
        {
          id: "route-stops",
          type: "circle",
          source: "route-stops",
          paint: {
            "circle-radius": 4,
            "circle-color": color,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 1,
            "circle-opacity": 0.8,
          },
        },
        "vehicle-markers"
      );

      // Fetch predictions for a subset of stops (spread along route)
      const step = Math.max(1, Math.floor(stops.length / 5));
      const sampleStops = stops.filter((_, i) => i % step === 0).slice(0, 5);

      for (const stop of sampleStops) {
        try {
          const res = await fetch(
            `/api/stops?agency=${agency}&stopCode=${stop.stopId}`
          );
          if (!res.ok) continue;
          const predictions = await res.json();
          if (predictions.length === 0) continue;

          const lines = predictions.slice(0, 3).map((p: any) => {
            const time = p.expectedArrival
              ? new Date(p.expectedArrival).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })
              : "—";
            return `<div class="text-xs">${time} → ${p.destinationName || "End"}</div>`;
          });

          const popup = new maplibregl.Popup({
            closeButton: false,
            closeOnClick: false,
            offset: 10,
            className: "prediction-popup",
          })
            .setLngLat([stop.lng, stop.lat])
            .setHTML(
              `<div class="font-semibold text-xs mb-1">${stop.stopName}</div>${lines.join("")}`
            )
            .addTo(m);

          activePopups.current.push(popup);
        } catch {
          // Skip failed predictions
        }
      }
    },
    [clearPredictions]
  );

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
          "https://protomaps.github.io/basemaps-assets/sprites/v4/dark",
        sources: {
          protomaps: {
            type: "vector",
            url: "pmtiles:///tiles/sf-bay-area.pmtiles",
            attribution:
              '<a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org">OpenStreetMap</a>',
          },
        },
        layers: layers("protomaps", oceanFlavor, { lang: "en" }),
      },
    });

    map.current = m;
    m.addControl(new maplibregl.NavigationControl(), "top-right");

    m.on("load", async () => {
      // Add a subtle gradient overlay on water to create depth
      m.addSource("water-gradient", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: [-122.38, 37.78], // Center of SF Bay
              },
              properties: {},
            },
          ],
        },
      });

      m.addLayer(
        {
          id: "water-glow",
          type: "circle",
          source: "water-gradient",
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              8, 200,
              12, 800,
              14, 1500,
            ],
            "circle-color": "#0f2a4a",
            "circle-blur": 1,
            "circle-opacity": 0.3,
          },
        },
        // Insert below land layers — find first land-related layer
        m.getStyle().layers.find((l) => l.id.includes("earth"))?.id
      );

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
            "line-width": 2.5,
            "line-opacity": 0.8,
          },
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
        });
      } catch (e) {
        console.error("Failed to load routes:", e);
      }

      // Load route stops mapping
      try {
        const res = await fetch("/data/route-stops.json");
        routeStops.current = await res.json();
      } catch (e) {
        console.error("Failed to load route stops:", e);
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
            "SF", "#ff6b4a",
            "BA", "#4dc9f6",
            "CT", "#ff4466",
            "#aaaaaa",
          ],
          "circle-stroke-color": "#0a1628",
          "circle-stroke-width": 1,
        },
      });

      // --- Route interaction ---

      // Desktop: hover on route line
      m.on("mouseenter", "route-lines", () => {
        m.getCanvas().style.cursor = "pointer";
      });
      m.on("mouseleave", "route-lines", () => {
        m.getCanvas().style.cursor = "";
      });

      m.on("click", "route-lines", (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const { agency, routeId, color } = feature.properties as any;
        showRoutePredictions(agency, routeId, color);
      });

      // Mobile: long press on route line
      m.on("touchstart", "route-lines", (e) => {
        const feature = e.features?.[0];
        if (!feature) return;

        longPressTimer.current = setTimeout(() => {
          const { agency, routeId, color } = feature.properties as any;
          showRoutePredictions(agency, routeId, color);
        }, LONG_PRESS_DURATION);
      });

      m.on("touchend", () => {
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
      });

      m.on("touchmove", () => {
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
      });

      // Click on empty area to dismiss
      m.on("click", (e) => {
        const features = m.queryRenderedFeatures(e.point, {
          layers: ["route-lines"],
        });
        if (features.length === 0) {
          clearPredictions();
        }
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
  }, [updateVehicles, showRoutePredictions, clearPredictions]);

  return <div ref={mapContainer} className="w-full h-full" />;
}
