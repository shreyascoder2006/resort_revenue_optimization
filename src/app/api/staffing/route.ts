import { NextResponse } from "next/server";
import { buildStaffingPlan } from "@/lib/engines/staffing";

export async function GET() {
  return NextResponse.json(buildStaffingPlan());
}
