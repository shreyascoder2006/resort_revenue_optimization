export interface GuestProfile {
  id: string;
  name: string;
  loyaltyTier: "Silver" | "Gold" | "Platinum";
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  partySize: number;
  preferences: string[];
  dietary?: string;
  notes?: string;
}

export const GUEST_PROFILES: GuestProfile[] = [
  {
    id: "g-1",
    name: "Amara Chen",
    loyaltyTier: "Platinum",
    roomTypeId: "deluxe-ocean",
    checkIn: "2026-09-03",
    checkOut: "2026-09-09",
    partySize: 2,
    preferences: ["spa", "quiet room", "fine dining"],
    dietary: "vegetarian",
    notes: "Celebrating anniversary on Sep 7.",
  },
  {
    id: "g-2",
    name: "The Rodriguez Family",
    loyaltyTier: "Gold",
    roomTypeId: "family-suite",
    checkIn: "2026-09-04",
    checkOut: "2026-09-11",
    partySize: 5,
    preferences: ["kids activities", "pool", "casual dining"],
    notes: "Two children under 10.",
  },
  {
    id: "g-3",
    name: "Daniel Okafor",
    loyaltyTier: "Silver",
    roomTypeId: "standard",
    checkIn: "2026-09-05",
    checkOut: "2026-09-07",
    partySize: 1,
    preferences: ["business center", "early breakfast", "gym"],
  },
];

export const RESORT_SERVICES = {
  restaurants: [
    { name: "Azure", cuisine: "Fine dining seafood", hours: "18:00–22:30" },
    { name: "The Grove", cuisine: "Casual all-day dining", hours: "07:00–23:00" },
    { name: "Palm Bar & Grill", cuisine: "Poolside grill & cocktails", hours: "11:00–19:00" },
  ],
  spa: { name: "Serenity Spa", hours: "09:00–20:00", bookingLeadTime: "2 hours" },
  activities: [
    "Sunset catamaran cruise",
    "Guided reef snorkeling",
    "Kids' eco-adventure camp",
    "Sunrise yoga on the beach",
    "Local food & market walking tour",
  ],
  transport: { airportShuttle: "Every 2 hours, 05:00–23:00", carRental: "Front desk, 24hr notice preferred" },
};
