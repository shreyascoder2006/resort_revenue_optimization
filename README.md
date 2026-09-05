# Smart Resort 360

AI-powered resort operations, guest experience, and revenue intelligence platform — a hackathon prototype for **PS 5: Smart Resort 360**.

Modern resorts split occupancy, staffing, maintenance, inventory, guest feedback, and pricing data across disconnected systems, making it hard to see what's happening in real time or act before small problems become guest-facing ones. This prototype pulls that data into one decision-support platform and turns it into concrete recommendations, alerts, and an interactive concierge — not just dashboards.

## What it does

| Area | Engine | What it produces |
|---|---|---|
| Revenue | `lib/engines/pricing.ts` | Per-room-type nightly rate recommendations for the next 21 days, driven by occupancy forecast, day-of-week, lead time, and local demand events (festivals, holidays). Reports ADR, RevPAR, and projected revenue lift vs. flat pricing. |
| Guest experience | `lib/engines/sentiment.ts` | Lexicon-based sentiment scoring of guest reviews, aggregated by aspect (cleanliness, staff, food, noise, spa, etc.), with week-over-week trend detection and a ranked list of the most negative recent issues. |
| Guest experience | `lib/engines/concierge.ts` | Rule-based intent classification over free-text guest requests (dining, spa, activities, transport, housekeeping, tech support, checkout, complaints), personalized using each guest's profile and preferences, plus proactive per-guest recommendations. |
| Operations | `lib/engines/maintenance.ts` | Predictive failure-risk scoring for resort equipment from age, service overdue ratio, and simulated sensor anomaly readings, with a recommended action and urgency window. |
| Operations | `lib/engines/staffing.ts` | Compares forecasted occupancy-driven staffing need against the drafted schedule per department, flagging under/overstaffed shifts. |
| Operations | `lib/engines/inventory.ts` | Projects days-of-stock-remaining per inventory item against lead time and forecasted demand, flagging reorder points and recommended order quantities. |

All six engines are exposed as JSON APIs under `src/app/api/*` and rendered across four dashboard pages (Overview, Revenue & Pricing, Guest Experience, Operations).

## Why rule/heuristic-based "AI" instead of an LLM

Every engine here is deterministic, explainable data science (weighted scoring, lexicon matching, intent keyword matching) rather than a call to an external LLM API — so the prototype runs fully offline with no API keys or network dependency, and every recommendation comes with a visible rationale. The concierge's intent classifier is structured so a real LLM (e.g. the Claude API) could be dropped in behind the same `handleConciergeMessage` interface for production use, without changing the rest of the app.

## Data

All data is synthetic, generated deterministically (seeded RNG) in `src/lib/data/`, so every reload shows the same numbers — no database or external service required. Generators intentionally bake in realistic scenarios for the engines to catch: a construction-noise dip in reviews, a declining spa satisfaction trend, overdue equipment maintenance, short-notice demand spikes that a schedule drafted two weeks out under-staffs for, and inventory items already running low.

## Tech stack

Next.js 16 (App Router, TypeScript), Tailwind CSS v4, Recharts for charts, lucide-react for icons. No database — all computation happens server-side per request against the synthetic dataset.

## Running locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

```bash
npm run build   # production build
npm run lint    # eslint
```

## Project structure

```
src/
  lib/
    data/        # synthetic data generators (rooms, bookings, reviews, staff, equipment, inventory, guests)
    engines/      # the six intelligence engines described above
  app/
    api/          # REST endpoints wrapping each engine
    page.tsx              # Overview
    revenue/              # Revenue & Dynamic Pricing
    guest-experience/     # Sentiment analysis + AI concierge
    operations/           # Predictive maintenance, staffing, inventory
  components/     # shared UI (KPI tiles, cards, charts, concierge chat)
```

## Possible next steps

- Swap the concierge's rule-based responder for an LLM-backed one for open-ended requests.
- Persist bookings/reviews/inventory in a real database and accept live PMS/POS feeds.
- Add a staffing/pricing "apply" action that writes back to a scheduling or channel-manager system.
