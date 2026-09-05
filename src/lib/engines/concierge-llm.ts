import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { GUEST_PROFILES, RESORT_SERVICES, type GuestProfile } from "../data/guests";
import { DEMAND_EVENTS, TODAY } from "../data/rooms";
import { isoDate } from "../data/random";
import type { ConciergeResponse, Intent } from "./concierge";

const MODEL = "claude-opus-5";

const INTENT_VALUES = [
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

const ConciergeReplySchema = z.object({
  intent: z.enum(INTENT_VALUES),
  reply: z.string().describe("A warm, concise reply to the guest - 2 to 4 sentences, no bullet lists."),
  suggestedActions: z
    .array(z.string())
    .max(3)
    .describe("Short imperative staff actions, e.g. 'Hold table at Azure'. Empty array if no action is needed."),
});

let cachedClient: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!cachedClient) cachedClient = new Anthropic();
  return cachedClient;
}

function buildSystemPrompt(guest?: GuestProfile): string {
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

/**
 * Calls the real Claude API for a grounded, conversational reply.
 * Returns null (never throws) when no API key is configured or the call fails,
 * so callers can fall back to the deterministic rule-based engine.
 */
export async function handleConciergeMessageLLM(message: string, guestId?: string): Promise<ConciergeResponse | null> {
  const anthropic = getClient();
  if (!anthropic) return null;

  const guest = GUEST_PROFILES.find((g) => g.id === guestId);

  try {
    const response = await anthropic.messages.parse({
      model: MODEL,
      max_tokens: 1024,
      output_config: {
        effort: "low",
        format: zodOutputFormat(ConciergeReplySchema),
      },
      system: buildSystemPrompt(guest),
      messages: [{ role: "user", content: message }],
    });

    if (!response.parsed_output) return null;

    return {
      intent: response.parsed_output.intent as Intent,
      confidence: 0.95,
      reply: response.parsed_output.reply,
      suggestedActions: response.parsed_output.suggestedActions,
      source: "llm",
    };
  } catch (error) {
    console.error("Concierge LLM call failed, falling back to rule-based engine:", error);
    return null;
  }
}
