import { NextResponse } from "next/server";
import { runScenario, SCENARIOS } from "@/lib/engines/scenarios";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const scenarioId = searchParams.get("scenario");

  if (!scenarioId) {
    return NextResponse.json({ scenarios: SCENARIOS });
  }

  if (!SCENARIOS.some((s) => s.id === scenarioId)) {
    return NextResponse.json({ error: `Unknown scenario '${scenarioId}'` }, { status: 400 });
  }

  return NextResponse.json(runScenario(scenarioId));
}
