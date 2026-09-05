import { generateReviews, type Review, type Aspect, type InjectedReview } from "../data/reviews";

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
  "waited", "delay",
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

export function buildSentimentSummary(injectedReviews: InjectedReview[] = []): SentimentSummary {
  const reviews = generateReviews(7, 220, injectedReviews);
  const scored = reviews.map((r) => ({ ...r, score: scoreText(r.text) }));

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
    .sort((a, b) => a.score - b.score)
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
