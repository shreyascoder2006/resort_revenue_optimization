import { NextResponse } from "next/server";
import { buildPricingRecommendations } from "@/lib/engines/pricing";

export async function GET() {
  return NextResponse.json(buildPricingRecommendations());
}
