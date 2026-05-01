export interface VehiclePosition {
  vehicleId: string;
  latitude: number;
  longitude: number;
  bearing?: number;
  speed?: number;
  lineRef: string;
  lineName: string;
  agency: string;
  updatedAt: string;
}

export interface StopPrediction {
  stopId: string;
  stopName: string;
  lineRef: string;
  lineName: string;
  destinationName: string;
  expectedArrival: string;
  expectedDeparture: string;
  agency: string;
}

export interface RouteShape {
  routeId: string;
  routeName: string;
  routeColor: string;
  agency: string;
  geometry: GeoJSON.LineString | GeoJSON.MultiLineString;
}

export interface TransitAgency {
  id: string;
  name: string;
}

export const AGENCIES: TransitAgency[] = [
  { id: "SF", name: "Muni" },
  { id: "BA", name: "BART" },
  { id: "CT", name: "Caltrain" },
];
