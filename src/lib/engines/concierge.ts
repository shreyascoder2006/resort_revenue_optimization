import { GUEST_PROFILES, RESORT_SERVICES, type GuestProfile } from "../data/guests";
import { DEMAND_EVENTS } from "../data/rooms";

export type Intent =
  | "housekeeping"
  | "dining"
  | "spa"
  | "activity"
  | "transport"
  | "complaint"
  | "tech-support"
  | "checkout"
  | "greeting"
  | "unknown";

const INTENT_KEYWORDS: Record<Intent, string[]> = {
  housekeeping: ["towel", "clean", "housekeeping", "sheets", "pillow", "room service", "amenities", "toiletries"],
  dining: ["restaurant", "dinner", "lunch", "breakfast", "table", "reservation", "food", "eat", "menu", "dining"],
  spa: ["spa", "massage", "treatment", "wellness", "sauna", "jacuzzi"],
  activity: ["activity", "activities", "tour", "excursion", "snorkel", "cruise", "yoga", "kids", "adventure", "things to do"],
  transport: ["shuttle", "taxi", "airport", "car rental", "transport", "transfer", "pickup"],
  complaint: ["broken", "noisy", "noise", "not working", "unhappy", "disappointed", "issue", "problem", "complain", "smell", "dirty"],
  "tech-support": ["wifi", "wi-fi", "internet", "tv", "remote", "charger", "outlet"],
  checkout: ["checkout", "check out", "late checkout", "bill", "invoice"],
  greeting: ["hello", "hi", "hey", "good morning", "good evening"],
  unknown: [],
};

export interface ConciergeResponse {
  intent: Intent;
  confidence: number;
  reply: string;
  suggestedActions: string[];
}

function classify(message: string): { intent: Intent; confidence: number } {
  const lower = message.toLowerCase();
  let best: Intent = "unknown";
  let bestHits = 0;
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS) as [Intent, string[]][]) {
    const hits = keywords.filter((k) => lower.includes(k)).length;
    if (hits > bestHits) {
      bestHits = hits;
      best = intent;
    }
  }
  const confidence = bestHits === 0 ? 0.2 : Math.min(0.95, 0.5 + bestHits * 0.2);
  return { intent: best, confidence };
}

function respondFor(intent: Intent, guest: GuestProfile | undefined): { reply: string; actions: string[] } {
  const name = guest?.name.split(" ")[0] ?? "there";
  switch (intent) {
    case "greeting":
      return {
        reply: `Hi ${name}! I'm your Smart Resort concierge. I can help with dining reservations, spa bookings, activities, transport, housekeeping requests, or any issue with your stay - what do you need?`,
        actions: [],
      };
    case "housekeeping":
      return {
        reply: `Got it - I've flagged a housekeeping request for ${guest ? `Room (${guest.roomTypeId})` : "your room"}. Expect someone within 20-30 minutes.`,
        actions: ["Dispatch housekeeping ticket", "Notify floor supervisor"],
      };
    case "dining": {
      const rec = guest?.dietary
        ? RESORT_SERVICES.restaurants.find((r) => r.cuisine.toLowerCase().includes("dining")) ?? RESORT_SERVICES.restaurants[0]
        : RESORT_SERVICES.restaurants[0];
      const dietaryNote = guest?.dietary ? ` I've noted your ${guest.dietary} preference for the kitchen.` : "";
      return {
        reply: `I'd recommend ${rec.name} (${rec.cuisine}, open ${rec.hours}).${dietaryNote} Want me to reserve a table?`,
        actions: [`Hold table at ${rec.name}`, "Send dietary note to kitchen"],
      };
    }
    case "spa": {
      const spa = RESORT_SERVICES.spa;
      return {
        reply: `${spa.name} is open ${spa.hours}. ${guest?.preferences.includes("spa") ? `I see spa is one of your preferences, so I'll prioritize a slot for you. ` : ""}Bookings typically need ${spa.bookingLeadTime} notice - shall I book a treatment?`,
        actions: ["Check spa availability", "Book treatment slot"],
      };
    }
    case "activity": {
      const suggestion = pickActivityFor(guest);
      return {
        reply: `Based on ${guest ? "your preferences" : "what's popular right now"}, I'd suggest: ${suggestion}. I can also share the full activities calendar.`,
        actions: ["Reserve activity slot", "Send activities calendar"],
      };
    }
    case "transport":
      return {
        reply: `Airport shuttles run ${RESORT_SERVICES.transport.airportShuttle}. For a private car, the front desk asks for ${RESORT_SERVICES.transport.carRental}. Want me to arrange one now?`,
        actions: ["Book shuttle slot", "Request car rental"],
      };
    case "tech-support":
      return {
        reply: `Sorry about the tech trouble. I'm dispatching IT/engineering to your room now, and in the meantime, try reconnecting to the "Resort-Guest" network.`,
        actions: ["Dispatch IT/engineering ticket"],
      };
    case "checkout":
      return {
        reply: guest
          ? `Your checkout date is ${guest.checkOut}. I can request a late checkout or have your final bill emailed ahead of time - which would you like?`
          : `I can help with checkout - would you like a late checkout request or an early copy of your bill?`,
        actions: ["Request late checkout", "Email itemized bill"],
      };
    case "complaint":
      return {
        reply: `I'm really sorry to hear that, ${name}. I've logged this as a priority service issue and alerted the duty manager - someone will follow up with you within 15 minutes.`,
        actions: ["Escalate to duty manager", "Log service recovery case"],
      };
    default:
      return {
        reply: `I want to make sure I get this right - could you tell me a bit more? I can help with dining, spa, activities, transport, housekeeping, tech issues, or checkout.`,
        actions: [],
      };
  }
}

function pickActivityFor(guest?: GuestProfile): string {
  if (guest?.preferences.includes("kids activities")) return "Kids' eco-adventure camp (great for the family, runs daily 10:00-13:00)";
  const upcoming = DEMAND_EVENTS[0];
  if (guest?.preferences.includes("quiet room") || guest?.preferences.includes("fine dining")) {
    return "Sunset catamaran cruise - relaxed pace, small group, pairs well with dinner after";
  }
  return `Guided reef snorkeling this week, or don't miss the ${upcoming.label} coming up on ${upcoming.date}`;
}

export function handleConciergeMessage(message: string, guestId?: string): ConciergeResponse {
  const guest = GUEST_PROFILES.find((g) => g.id === guestId);
  const { intent, confidence } = classify(message);
  const { reply, actions } = respondFor(intent, guest);
  return { intent, confidence, reply, suggestedActions: actions };
}

export interface ProactiveRecommendation {
  guestId: string;
  guestName: string;
  recommendation: string;
  reason: string;
}

export function buildProactiveRecommendations(): ProactiveRecommendation[] {
  return GUEST_PROFILES.map((guest) => {
    const activity = pickActivityFor(guest);
    const reason = guest.notes
      ? guest.notes
      : `Matches stated preferences: ${guest.preferences.join(", ")}`;
    return {
      guestId: guest.id,
      guestName: guest.name,
      recommendation: activity,
      reason,
    };
  });
}
