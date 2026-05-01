import { NextRequest, NextResponse } from "next/server";
import { getStopPredictions } from "@/lib/transit-cache";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const agency = searchParams.get("agency");
  const stopCode = searchParams.get("stopCode");

  if (!agency || !stopCode) {
    return NextResponse.json(
      { error: "Missing required parameters: agency, stopCode" },
      { status: 400 }
    );
  }

  try {
    const predictions = await getStopPredictions(agency, stopCode);
    return NextResponse.json(predictions);
  } catch (error) {
    console.error("Error fetching stop predictions:", error);
    return NextResponse.json(
      { error: "Failed to fetch stop predictions" },
      { status: 500 }
    );
  }
}
