import type { VehiclePosition, StopPrediction } from "@/types/transit";

const BASE_URL = "/api";

export async function fetchVehicles(): Promise<VehiclePosition[]> {
  const res = await fetch(`${BASE_URL}/vehicles`);
  if (!res.ok) throw new Error("Failed to fetch vehicles");
  return res.json();
}

export async function fetchStopPredictions(
  agency: string,
  stopCode: string
): Promise<StopPrediction[]> {
  const res = await fetch(
    `${BASE_URL}/stops?agency=${agency}&stopCode=${stopCode}`
  );
  if (!res.ok) throw new Error("Failed to fetch stop predictions");
  return res.json();
}
