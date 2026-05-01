import { NextResponse } from "next/server";
import { getVehicles } from "@/lib/transit-cache";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const vehicles = await getVehicles();
    return NextResponse.json(vehicles);
  } catch (error) {
    console.error("Error fetching vehicles:", error);
    return NextResponse.json(
      { error: "Failed to fetch vehicle data" },
      { status: 500 }
    );
  }
}
