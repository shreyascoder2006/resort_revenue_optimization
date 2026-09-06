import { makeRng, addDays, isoDate } from "./random";
import { TODAY } from "./rooms";

export type Aspect =
  | "cleanliness"
  | "staff"
  | "food"
  | "noise"
  | "wifi"
  | "check-in"
  | "value"
  | "spa"
  | "pool"
  | "room comfort";

export const ASPECTS: Aspect[] = [
  "cleanliness",
  "staff",
  "food",
  "noise",
  "wifi",
  "check-in",
  "value",
  "spa",
  "pool",
  "room comfort",
];

export interface Review {
  id: string;
  date: string;
  source: "Google" | "TripAdvisor" | "Booking.com" | "Direct Survey";
  aspect: Aspect;
  text: string;
  starRating: number; // 1-5, derived from underlying sentiment
  guestName: string;
}

const PHRASES: Record<Aspect, { positive: string[]; negative: string[]; neutral: string[] }> = {
  cleanliness: {
    positive: [
      "The room was spotless and beautifully maintained.",
      "Housekeeping did an amazing job every single day.",
      "Everything felt fresh, clean, and well cared for.",
    ],
    negative: [
      "The bathroom hadn't been cleaned properly before check-in.",
      "Found dust and stains that housekeeping clearly missed.",
      "The room smelled musty and the sheets weren't fresh.",
    ],
    neutral: ["The room was clean enough, nothing special.", "Cleanliness was about what I expected."],
  },
  staff: {
    positive: [
      "The staff went above and beyond to make our stay special.",
      "Every team member we met was warm, attentive, and professional.",
      "Front desk and housekeeping staff were incredibly helpful.",
    ],
    negative: [
      "Staff seemed overwhelmed and slow to respond to requests.",
      "We waited a long time for anyone to help us at the desk.",
      "Some staff members were rude and dismissive.",
    ],
    neutral: ["Staff were fine, did what was needed.", "Service was average, nothing memorable."],
  },
  food: {
    positive: [
      "The restaurant food was outstanding, fresh and flavorful.",
      "Breakfast buffet had a fantastic variety every morning.",
      "Chef clearly puts real care into every dish.",
    ],
    negative: [
      "The food was overpriced and mediocre at best.",
      "Several dishes arrived cold and underseasoned.",
      "Limited menu options and long waits at the restaurant.",
    ],
    neutral: ["Food was decent, about what you'd expect from a resort.", "The menu was okay, nothing stood out."],
  },
  noise: {
    positive: [
      "Rooms were wonderfully quiet, we slept great every night.",
      "No noise issues at all despite the resort being busy.",
    ],
    negative: [
      "Construction noise from early morning ruined our sleep.",
      "Extremely loud music from the pool area until late at night.",
      "Thin walls meant we heard every conversation next door.",
    ],
    neutral: ["A little noise here and there but manageable.", "Noise levels were acceptable overall."],
  },
  wifi: {
    positive: ["WiFi was fast and reliable throughout the property.", "Great connectivity even by the pool."],
    negative: [
      "WiFi kept dropping and was unusable in the room.",
      "Internet was painfully slow, couldn't get any work done.",
    ],
    neutral: ["WiFi worked most of the time.", "Connectivity was okay, a bit spotty in some areas."],
  },
  "check-in": {
    positive: ["Check-in was fast, smooth, and welcoming.", "We were checked in early with no hassle at all."],
    negative: [
      "Check-in took over 45 minutes with a long line.",
      "Our room wasn't ready and nobody communicated the delay.",
    ],
    neutral: ["Check-in was standard, took a little while.", "Nothing remarkable about the check-in process."],
  },
  value: {
    positive: [
      "Excellent value for the price we paid.",
      "Worth every penny given the quality of the experience.",
    ],
    negative: [
      "Way overpriced for what you actually get.",
      "Felt like a poor value compared to similar resorts nearby.",
    ],
    neutral: ["Reasonably priced, matched expectations.", "Price was fair, not a huge bargain though."],
  },
  spa: {
    positive: ["The spa treatments were incredibly relaxing and professional.", "Best spa experience we've had at a resort."],
    negative: ["Spa booking system was a mess and treatments felt rushed.", "Spa was overbooked and understaffed."],
    neutral: ["Spa was fine, fairly standard offerings.", "Decent spa, nothing extraordinary."],
  },
  pool: {
    positive: ["The pool area was stunning and always well maintained.", "Loved lounging by the pool all day."],
    negative: ["Pool area was overcrowded with not enough loungers.", "Pool water quality seemed questionable."],
    neutral: ["Pool was nice, got a bit crowded at times.", "Standard pool experience."],
  },
  "room comfort": {
    positive: ["The bed was incredibly comfortable, best sleep on vacation.", "Room was spacious and beautifully furnished."],
    negative: ["Mattress was lumpy and uncomfortable.", "Room felt cramped and outdated."],
    neutral: ["Room comfort was adequate.", "Comfortable enough for a short stay."],
  },
};

const FIRST_NAMES = [
  "Priya", "James", "Aiko", "Carlos", "Fatima", "Liam", "Sofia", "Noah", "Elena", "Ravi",
  "Grace", "Mateo", "Hana", "Oliver", "Zara", "Lucas", "Mei", "Ethan", "Amara", "Diego",
];

function ratingFromSentiment(score: number, rng: ReturnType<typeof makeRng>): number {
  // score in [-1, 1]
  const base = 3 + score * 2;
  const jitter = rng.range(-0.4, 0.4);
  return Math.min(5, Math.max(1, Math.round(base + jitter)));
}

const HISTORY_DAYS = 90;
// A deliberate service dip: noise complaints spike during a construction window,
// and spa satisfaction erodes as overbooking issues build up.
const NOISE_DIP_START = 18; // days ago
const NOISE_DIP_END = 4;
const SPA_DECLINE_START = 40;

function aspectSentimentBias(aspect: Aspect, daysAgo: number): number {
  if (aspect === "noise" && daysAgo <= NOISE_DIP_START && daysAgo >= NOISE_DIP_END) {
    return -0.6;
  }
  if (aspect === "spa" && daysAgo <= SPA_DECLINE_START) {
    // Gets worse as it approaches today (daysAgo -> 0)
    const progress = 1 - daysAgo / SPA_DECLINE_START;
    return -0.15 - progress * 0.55;
  }
  return 0.25; // gentle positive baseline for everything else
}

export interface InjectedReview {
  aspect: Aspect;
  text: string;
}

export function generateReviews(seed = 7, count = 220, injected: InjectedReview[] = []): Review[] {
  const rng = makeRng(seed);
  const sources: Review["source"][] = ["Google", "TripAdvisor", "Booking.com", "Direct Survey"];
  const reviews: Review[] = [];

  injected.forEach((inj, i) => {
    reviews.push({
      id: `rv-injected-${i + 1}`,
      date: isoDate(TODAY),
      source: rng.pick(sources),
      aspect: inj.aspect,
      text: inj.text,
      starRating: 1,
      guestName: rng.pick(FIRST_NAMES),
    });
  });

  for (let i = 0; i < count; i++) {
    const daysAgo = rng.int(0, HISTORY_DAYS);
    const date = isoDate(addDays(TODAY, -daysAgo));
    const aspect = rng.pick(ASPECTS);
    const bias = aspectSentimentBias(aspect, daysAgo);
    const noise = rng.gaussian(0, 0.35);
    const score = Math.max(-1, Math.min(1, bias + noise));

    const bank = PHRASES[aspect];
    const text = score > 0.25 ? rng.pick(bank.positive) : score < -0.25 ? rng.pick(bank.negative) : rng.pick(bank.neutral);

    reviews.push({
      id: `rv-${i + 1}`,
      date,
      source: rng.pick(sources),
      aspect,
      text,
      starRating: ratingFromSentiment(score, rng),
      guestName: rng.pick(FIRST_NAMES),
    });
  }

  return reviews.sort((a, b) => (a.date < b.date ? 1 : -1));
}

