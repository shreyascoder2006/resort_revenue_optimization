import { generateReviews, type Review, type Aspect, type InjectedReview } from "../data/reviews";
import type { ResortState } from "../store/resortStore";

const POSITIVE_WORDS = [
  "amazing", "outstanding", "excellent", "wonderful", "fantastic", "great", "fresh", "flavorful",
  "spotless", "clean", "beautiful", "beautifully", "helpful", "professional", "warm", "attentive",
  "fast", "reliable", "smooth", "relaxing", "comfortable", "spacious", "worth", "best", "welcoming",
  "quiet", "incredible", "incredibly", "love", "loved", "stunning", "care",
];

const NEGATIVE_WORDS = [
  "overwhelmed", "slow", "rude", "dismissive", "overpriced", "mediocre", "cold", "underseasoned",
  "limited", "loud", "thin", "ruined", "dropping", "unusable", "painfully", "long", "wasn't",
  "hadn't", "musty", "stains", "dust", "mess", "rushed", "overbooked", "understaffed", "crowded",
  "questionable", "lumpy", "uncomfortable", "cramped", "outdated", "issue", "issues", "poor",
  "waited", "delay", "broken", "breakdown", "failed", "failure", "terrible", "unbearably",
];

export interface AspectSentiment {
  aspect: Aspect;
  avgScore: number; // -1..1
  reviewCount: number;
  trendDelta: number; // recent 14d avg minus prior 14d avg
}

export interface WeeklySentimentPoint {
  weekStart: string;
  avgScore: number;
  reviewCount: number;
}

export interface SentimentIssue {
  aspect: Aspect;
  quote: string;
  score: number;
  date: string;
  source: Review["source"];
}

export interface SentimentSummary {
  overallScore: number;
  overallStars: number;
  totalReviews: number;
  weekly: WeeklySentimentPoint[];
  byAspect: AspectSentiment[];
  topIssues: SentimentIssue[];
  serviceRiskLevel: "Normal" | "Elevated" | "High";
  serviceRiskDetail?: string;
  hasEquipmentFailure?: boolean;
  activeEquipmentFailureName?: string;
  activeOutOfOrderCount?: number;
  recoveryRecommendation?: string;
  affectedGuestCompCount?: number;
}

function scoreText(text: string): number {
  const words = text.toLowerCase().replace(/[^a-z\s']/g, "").split(/\s+/).filter(Boolean);
  let hits = 0;
  let score = 0;
  for (const w of words) {
    if (POSITIVE_WORDS.includes(w)) {
      score += 1;
      hits += 1;
    } else if (NEGATIVE_WORDS.includes(w)) {
      score -= 1;
      hits += 1;
    }
  }
  if (hits === 0) return 0;
  return Math.max(-1, Math.min(1, score / Math.max(3, hits)));
}

function weekStartOf(dateIso: string): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  const day = d.getUTCDay();
  const diff = (day + 6) % 7; // Monday-start week
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

export function buildSentimentSummary(stateOrInjected?: ResortState | InjectedReview[]): SentimentSummary {
  const isState = stateOrInjected && !Array.isArray(stateOrInjected) && "reviews" in stateOrInjected;
  const reviews = isState ? stateOrInjected.reviews : generateReviews(7, 220, Array.isArray(stateOrInjected) ? stateOrInjected : []);
  const scored = reviews.map((r) => ({ ...r, score: scoreText(r.text) }));

  // Check if there is an active demand surge or equipment failure straining service
  let serviceRiskLevel: "Normal" | "Elevated" | "High" = "Normal";
  let serviceRiskDetail: string | undefined;
  let hasEquipmentFailure = false;
  let activeEquipmentFailureName: string | undefined;
  let activeOutOfOrderCount = 0;
  let recoveryRecommendation: string | undefined;
  let affectedGuestCompCount = 0;

  if (isState) {
    const surgeEvent = stateOrInjected.activeEvents.find((e) => e.type === "DEMAND_SURGE");
    const failureEvent = stateOrInjected.activeEvents.find((e) => e.type === "EQUIPMENT_FAILURE");

    if (failureEvent) {
      hasEquipmentFailure = true;
      activeEquipmentFailureName = (failureEvent.details?.equipmentName as string) ?? "Equipment";
      activeOutOfOrderCount = (failureEvent.details?.affectedRoomCount as number) ?? 15;
      affectedGuestCompCount = activeOutOfOrderCount;
      serviceRiskLevel = "High";

      recoveryRecommendation = `Deploy automated service recovery for ${activeOutOfOrderCount} affected Deluxe Ocean guests: $75 resort credit + complimentary spa day pass per room ($${(activeOutOfOrderCount * 75).toLocaleString()} total recovery budget).`;

      if (surgeEvent) {
        serviceRiskDetail = `CRITICAL COMPOUND RISK: ${activeEquipmentFailureName} failure offline during ${surgeEvent.label}. Climate control lost in ${activeOutOfOrderCount} rooms while front desk and dining queues peak. Proactive compensation required.`;
      } else {
        serviceRiskDetail = `ACTIVE CLIMATE DISRUPTION: ${activeEquipmentFailureName} failure disabled cooling across ${activeOutOfOrderCount} rooms. Room comfort sentiment sharply degraded; proactive service recovery ($75 credit + spa pass) recommended.`;
      }
    } else if (surgeEvent) {
      const boost = (surgeEvent.details?.demandBoost as number) ?? 0.2;
      serviceRiskLevel = boost >= 0.25 ? "High" : "Elevated";
      serviceRiskDetail = `Upcoming ${surgeEvent.label} is forecasted to exceed standard staffing thresholds, creating high risk for check-in delays, dining queues, and housekeeping backlogs.`;
    }
  }

  const overallScore = avg(scored.map((r) => r.score));
  const overallStars = avg(scored.map((r) => r.starRating));

  // Weekly trend, oldest to newest.
  const weekMap = new Map<string, number[]>();
  for (const r of scored) {
    const wk = weekStartOf(r.date);
    if (!weekMap.has(wk)) weekMap.set(wk, []);
    weekMap.get(wk)!.push(r.score);
  }
  const weekly: WeeklySentimentPoint[] = Array.from(weekMap.entries())
    .map(([weekStart, scores]) => ({ weekStart, avgScore: avg(scores), reviewCount: scores.length }))
    .sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1));

  // Per-aspect with recency trend (last 14 days vs prior 14 days).
  const aspects = Array.from(new Set(scored.map((r) => r.aspect)));
  const mostRecent = scored.reduce((max, r) => (r.date > max ? r.date : max), scored[0].date);
  const recentCutoff = shiftDate(mostRecent, -14);
  const priorCutoff = shiftDate(mostRecent, -28);

  const byAspect: AspectSentiment[] = aspects.map((aspect) => {
    const rows = scored.filter((r) => r.aspect === aspect);
    const recent = rows.filter((r) => r.date > recentCutoff);
    const prior = rows.filter((r) => r.date <= recentCutoff && r.date > priorCutoff);
    return {
      aspect,
      avgScore: avg(rows.map((r) => r.score)),
      reviewCount: rows.length,
      trendDelta: recent.length && prior.length ? avg(recent.map((r) => r.score)) - avg(prior.map((r) => r.score)) : 0,
    };
  });

  const seenQuotes = new Set<string>();
  const topIssues: SentimentIssue[] = scored
    .filter((r) => r.score < 0)
    .sort((a, b) => (a.score === b.score ? (a.date < b.date ? 1 : -1) : a.score - b.score))
    .filter((r) => {
      if (seenQuotes.has(r.text)) return false;
      seenQuotes.add(r.text);
      return true;
    })
    .slice(0, 8)
    .map((r) => ({ aspect: r.aspect, quote: r.text, score: r.score, date: r.date, source: r.source }));

  return {
    overallScore: round2(overallScore),
    overallStars: round2(overallStars),
    totalReviews: reviews.length,
    weekly,
    byAspect: byAspect.sort((a, b) => a.avgScore - b.avgScore),
    topIssues,
    serviceRiskLevel,
    serviceRiskDetail,
    hasEquipmentFailure,
    activeEquipmentFailureName,
    activeOutOfOrderCount,
    recoveryRecommendation,
    affectedGuestCompCount,
  };
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function shiftDate(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
