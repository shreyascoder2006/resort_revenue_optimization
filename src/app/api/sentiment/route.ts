import { NextResponse } from "next/server";
import { buildSentimentSummary } from "@/lib/engines/sentiment";

export async function GET() {
  return NextResponse.json(buildSentimentSummary());
}
