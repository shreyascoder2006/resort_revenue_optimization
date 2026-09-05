import { NextResponse } from "next/server";
import { buildMaintenanceRisks } from "@/lib/engines/maintenance";

export async function GET() {
  return NextResponse.json(buildMaintenanceRisks());
}
