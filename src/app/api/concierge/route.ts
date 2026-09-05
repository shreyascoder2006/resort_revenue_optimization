import { NextResponse } from "next/server";
import { handleConciergeMessage, buildProactiveRecommendations } from "@/lib/engines/concierge";
import { GUEST_PROFILES } from "@/lib/data/guests";

export async function GET() {
  return NextResponse.json({
    guests: GUEST_PROFILES,
    proactiveRecommendations: buildProactiveRecommendations(),
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { message, guestId } = (body ?? {}) as { message?: unknown; guestId?: unknown };

  if (typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json({ error: "'message' is required" }, { status: 400 });
  }
  if (message.length > 1000) {
    return NextResponse.json({ error: "'message' is too long" }, { status: 400 });
  }

  const validGuestId = typeof guestId === "string" && GUEST_PROFILES.some((g) => g.id === guestId) ? guestId : undefined;

  const response = handleConciergeMessage(message, validGuestId);
  return NextResponse.json(response);
}
