import { GUEST_PROFILES, RESORT_SERVICES, type GuestProfile } from "../data/guests";
import { DEMAND_EVENTS, TODAY } from "../data/rooms";
import { isoDate } from "../data/random";

export const INTENT_VALUES = [
  "housekeeping",
  "dining",
  "spa",
  "activity",
  "transport",
  "complaint",
  "tech-support",
  "checkout",
  "greeting",
  "unknown",
] as const;

export function findGuest(guestId?: string): GuestProfile | undefined {
  return GUEST_PROFILES.find((g) => g.id === guestId);
}

export function buildConciergeSystemPrompt(guest?: GuestProfile): string {
  const restaurantLines = RESORT_SERVICES.restaurants.map((r) => `- ${r.name} (${r.cuisine}), open ${r.hours}`).join("\n");
  const eventLines = DEMAND_EVENTS.map((e) => `- ${e.label} on ${e.date}`).join("\n");

  const guestBlock = guest
    ? [
        "",
        "The guest you're talking to:",
        `- Name: ${guest.name}`,
        `- Loyalty tier: ${guest.loyaltyTier}`,
        `- Room type: ${guest.roomTypeId}`,
        `- Stay: ${guest.checkIn} to ${guest.checkOut}, party of ${guest.partySize}`,
        `- Preferences: ${guest.preferences.join(", ") || "none on file"}`,
        guest.dietary ? `- Dietary: ${guest.dietary}` : null,
        guest.notes ? `- Notes: ${guest.notes}` : null,
      ]
        .filter(Boolean)
        .join("\n")
    : "\nNo guest profile is linked to this conversation - respond helpfully without assuming details you don't have.";

  return `You are the AI concierge for Smart Resort 360, a beachfront resort. You help guests with dining, spa, activities, transport, housekeeping, tech issues, checkout, and complaints.

Today's date: ${isoDate(TODAY)}.

Restaurants:
${restaurantLines}

Spa: ${RESORT_SERVICES.spa.name}, open ${RESORT_SERVICES.spa.hours}, bookings need ${RESORT_SERVICES.spa.bookingLeadTime} notice.

Activities: ${RESORT_SERVICES.activities.join(", ")}.

Transport: airport shuttle ${RESORT_SERVICES.transport.airportShuttle}; car rental via front desk, ${RESORT_SERVICES.transport.carRental}.

Upcoming local events:
${eventLines}
${guestBlock}

Reply warmly and concisely - 2 to 4 sentences, no bullet lists. Use the guest's preferences, dietary needs, or notes naturally when relevant, without just reciting them back at them. If they raise a complaint, be empathetic and confirm you're escalating it. Classify the message into exactly one intent, and suggest at most 3 short, concrete staff actions (imperative phrases like "Hold table at Azure", not full sentences) - an empty list is fine when no action is needed, such as a greeting.`;
}
