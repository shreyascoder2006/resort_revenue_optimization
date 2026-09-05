# Smart Resort 360

AI-powered resort operations, guest experience, and revenue intelligence platform — a hackathon prototype for **PS 5: Smart Resort 360**.

Modern resorts split occupancy, staffing, maintenance, inventory, guest feedback, and pricing data across disconnected systems, making it hard to see what's happening in real time or act before small problems become guest-facing ones. This prototype pulls that data into one decision-support platform and turns it into concrete recommendations, alerts, and an interactive concierge — not just dashboards.

## Scenario Simulator — see the engines think, live

The fastest way to see this is more than a set of dashboards: open **Scenario Simulator** in the app nav, pick a disruption, and watch it play out in real time across the *same* engines that power the rest of the dashboard.

- **Surprise Festival Announced** — an unplanned demand spike lands 2 days out. Watch the pricing engine raise rates, and the staffing engine catch that the schedule (drafted before the event existed) is now short.
- **Chiller Fails Overnight** — one piece of equipment's sensor readings spike. The maintenance engine's risk score jumps to Critical, and a batch of same-night guest reviews about the heat drags down "room comfort" sentiment — linking an equipment fault to a guest-experience risk before it ever hits a review site.
- **Group Cancels + Bad Reviews** — a family-suite booking cancels while negative "value" reviews start coming in. Pricing discounts to refill the gap while sentiment confirms *why* it happened.

Each run computes a real "before" and "after" from the actual engines (not canned animation): `src/lib/engines/scenarios.ts` calls the same `build*` functions used everywhere else, once with no changes and once with the scenario's perturbation, then diffs the two into the KPI deltas and alerts you see reveal on screen.

## What it does

| Area | Engine | What it produces |
|---|---|---|
| Revenue | `lib/engines/pricing.ts` | Per-room-type nightly rate recommendations for the next 21 days, driven by occupancy forecast, day-of-week, lead time, and local demand events (festivals, holidays, cancellations). Reports ADR, RevPAR, and projected revenue lift vs. flat pricing. |
| Guest experience | `lib/engines/sentiment.ts` | Lexicon-based sentiment scoring of guest reviews, aggregated by aspect (cleanliness, staff, food, noise, spa, etc.), with week-over-week trend detection and a ranked list of the most negative recent issues. |
| Guest experience | `lib/engines/concierge-gemini.ts` / `concierge-llm.ts` (+ `concierge.ts` fallback) | Conversational handling of free-text guest requests (dining, spa, activities, transport, housekeeping, tech support, checkout, complaints), grounded in the guest's profile, preferences, and the resort's real services/events data, plus proactive per-guest recommendations. |
| Operations | `lib/engines/maintenance.ts` | Predictive failure-risk scoring for resort equipment from age, service overdue ratio, and simulated sensor anomaly readings, with a recommended action and urgency window. |
| Operations | `lib/engines/staffing.ts` | Compares forecasted occupancy-driven staffing need against the drafted schedule per department, flagging under/overstaffed shifts. |
| Operations | `lib/engines/inventory.ts` | Projects days-of-stock-remaining per inventory item against lead time and forecasted demand, flagging reorder points and recommended order quantities. |

All six engines accept optional scenario overrides (an extra demand event, a forced equipment failure, injected reviews) and are exposed as JSON APIs under `src/app/api/*`. `src/lib/engines/scenarios.ts` composes them into the three Scenario Simulator presets above via `src/app/api/simulate`.

## AI concierge: real LLMs, with a deterministic fallback

The concierge is the one place in the app that calls a real LLM - and it can call either of two providers. `POST /api/concierge` tries them in order, first result wins:

1. **Gemini** (`src/lib/engines/concierge-gemini.ts`) - `gemini-3.6-flash` via `@google/genai`, JSON-schema structured output. Retries once on a transient 503/429 before giving up.
2. **Claude** (`src/lib/engines/concierge-llm.ts`) - `claude-opus-5` via `@anthropic-ai/sdk`, low effort, structured output via a Zod schema.
3. **Rule-based fallback** (`concierge.ts`) - deterministic keyword matching, same response shape.

Both LLM paths share one system prompt (`concierge-prompt.ts`) grounded in the guest's profile, preferences, and the resort's actual restaurants/spa/activities/transport/events data. If neither `GEMINI_API_KEY` nor `ANTHROPIC_API_KEY` is set, or a call fails for any reason (network, rate limit, invalid key), the chain falls through to the next provider and ultimately to the rule-based engine - same shape, same UI, no crash. The chat UI labels a reply "Offline demo mode" whenever the fallback served it, so it's always clear which path answered.

To enable it: copy `.env.example` to `.env.local` and set `GEMINI_API_KEY` and/or `ANTHROPIC_API_KEY` (locally), or add them as environment variables in your Vercel project settings (in production). No key is required to run or demo the app - every other engine is deterministic, explainable data science (weighted scoring, lexicon matching, intent keyword matching) with no external dependency, and the concierge itself degrades gracefully without either key.

## Data

All data is synthetic, generated deterministically (seeded RNG) in `src/lib/data/`, so every reload shows the same numbers — no database or external service required. Generators intentionally bake in realistic scenarios for the engines to catch: a construction-noise dip in reviews, a declining spa satisfaction trend, overdue equipment maintenance, short-notice demand spikes that a schedule drafted two weeks out under-staffs for, and inventory items already running low.

## Tech stack

Next.js 16 (App Router, TypeScript), Tailwind CSS v4, Recharts for charts, lucide-react for icons. No database — all computation happens server-side per request against the synthetic dataset.

## Running locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000` for the landing page, or go straight to `http://localhost:3000/dashboard`.

```bash
npm run build   # production build
npm run lint    # eslint
```

## Project structure

```
src/
  lib/
    data/            # synthetic data generators (rooms, bookings, reviews, staff, equipment, inventory, guests)
    engines/         # the six intelligence engines, plus scenarios.ts composing them for the simulator
  app/
    api/             # REST endpoints wrapping each engine, plus /api/simulate
    page.tsx                     # marketing landing page
    dashboard/
      page.tsx                   # Overview
      simulator/                 # Scenario Simulator
      revenue/                   # Revenue & Dynamic Pricing
      guest-experience/          # Sentiment analysis + AI concierge
      operations/                # Predictive maintenance, staffing, inventory
  components/        # shared UI (KPI tiles, cards, charts, concierge chat, scenario simulator)
```

## Possible next steps

- Persist bookings/reviews/inventory in a real database and accept live PMS/POS feeds.
- Add a staffing/pricing "apply" action that writes back to a scheduling or channel-manager system.
- Let users define custom scenarios (not just the 3 presets) from the simulator UI.
- Give the concierge tool access (e.g. actually check spa availability or hold a table) instead of just describing the action.
