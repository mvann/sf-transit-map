import type { VehiclePosition } from "@/types/transit";
import { AGENCIES } from "@/types/transit";

const API_BASE = "http://api.511.org/transit";
const API_KEY = process.env.TRANSIT_511_API_KEY!;
const VEHICLE_CACHE_TTL_MS = 300_000; // 5 minutes (3 agencies × 12/hr = 36 req/hr)
const STOP_CACHE_TTL_MS = 300_000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

let vehicleCache: CacheEntry<VehiclePosition[]> | null = null;
let fetchInProgress: Promise<VehiclePosition[]> | null = null;
const stopCache = new Map<string, CacheEntry<any[]>>();

function parseVehicleMonitoring(
  json: Record<string, unknown>,
  agency: string
): VehiclePosition[] {
  const delivery =
    (json as any)?.Siri?.ServiceDelivery?.VehicleMonitoringDelivery
      ?.VehicleActivity;
  if (!Array.isArray(delivery)) return [];

  return delivery
    .filter((activity: any) => {
      const journey = activity.MonitoredVehicleJourney;
      return journey?.LineRef && journey?.VehicleLocation;
    })
    .map((activity: any) => {
      const journey = activity.MonitoredVehicleJourney;
      const location = journey.VehicleLocation;
      return {
        vehicleId: journey.VehicleRef ?? "unknown",
        latitude: parseFloat(location.Latitude),
        longitude: parseFloat(location.Longitude),
        bearing: journey.Bearing ? parseFloat(journey.Bearing) : undefined,
        speed: journey.Speed ? parseFloat(journey.Speed) : undefined,
        lineRef: journey.LineRef,
        lineName: journey.PublishedLineName ?? journey.LineRef,
        agency,
        updatedAt: activity.RecordedAtTime ?? new Date().toISOString(),
      };
    });
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  // 511 API returns UTF-8 BOM which breaks JSON.parse — strip it
  const text = (await res.text()).replace(/^\uFEFF/, "");
  return JSON.parse(text);
}

async function fetchAgencyVehicles(
  agencyId: string
): Promise<VehiclePosition[]> {
  const url = `${API_BASE}/VehicleMonitoring?api_key=${API_KEY}&agency=${agencyId}&format=json`;
  try {
    const json = await fetchJson(url);
    return parseVehicleMonitoring(json, agencyId);
  } catch (e) {
    console.error(`511 VehicleMonitoring failed for ${agencyId}:`, e);
    return [];
  }
}

export async function getVehicles(): Promise<VehiclePosition[]> {
  const now = Date.now();

  if (vehicleCache && now - vehicleCache.fetchedAt < VEHICLE_CACHE_TTL_MS) {
    return vehicleCache.data;
  }

  // Prevent multiple simultaneous fetches
  if (fetchInProgress) {
    return fetchInProgress;
  }

  fetchInProgress = (async () => {
    try {
      const results = await Promise.all(
        AGENCIES.map((a) => fetchAgencyVehicles(a.id))
      );
      const vehicles = results.flat();
      vehicleCache = { data: vehicles, fetchedAt: Date.now() };
      return vehicles;
    } finally {
      fetchInProgress = null;
    }
  })();

  return fetchInProgress;
}

export async function getStopPredictions(
  agency: string,
  stopCode: string
): Promise<any[]> {
  const cacheKey = `${agency}:${stopCode}`;
  const cached = stopCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < STOP_CACHE_TTL_MS) {
    return cached.data;
  }

  const url = `${API_BASE}/StopMonitoring?api_key=${API_KEY}&agency=${agency}&stopCode=${stopCode}&format=json`;
  let json: any;
  try {
    json = await fetchJson(url);
  } catch (e) {
    console.error(`511 StopMonitoring failed for ${agency}/${stopCode}:`, e);
    return [];
  }
  const visits =
    json?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.MonitoredStopVisit;
  if (!Array.isArray(visits)) return [];

  const predictions = visits.slice(0, 5).map((visit: any) => {
    const journey = visit.MonitoredVehicleJourney;
    const call = journey.MonitoredCall;
    return {
      stopId: call?.StopPointRef ?? stopCode,
      stopName: call?.StopPointName ?? "",
      lineRef: journey.LineRef ?? "",
      lineName: journey.PublishedLineName ?? journey.LineRef ?? "",
      destinationName: journey.DestinationName ?? "",
      expectedArrival: call?.ExpectedArrivalTime ?? call?.AimedArrivalTime ?? "",
      expectedDeparture:
        call?.ExpectedDepartureTime ?? call?.AimedDepartureTime ?? "",
      agency,
    };
  });

  stopCache.set(cacheKey, { data: predictions, fetchedAt: Date.now() });
  return predictions;
}
