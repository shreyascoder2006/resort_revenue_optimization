import { NextResponse } from "next/server";
import { buildInventoryStatus } from "@/lib/engines/inventory";

export async function GET() {
  return NextResponse.json(buildInventoryStatus());
}
