"use client";

import { useEffect, useRef, useState } from "react";
import {
  Zap,
  Wrench,
  TrendingDown,
  TrendingUp,
  Users,
  Package,
  MessageSquareHeart,
  CheckCircle2,
  Play,
  RotateCcw,
} from "lucide-react";
import clsx from "clsx";
import { Card, StatusBadge } from "@/components/ui";
import type { ScenarioDefinition, ScenarioOutcome, ScenarioIcon, StepIcon, AlertVariant } from "@/lib/engines/scenarios";
import { useResortStore } from "@/lib/store/resortStore";

const SCENARIO_ICONS: Record<ScenarioIcon, typeof Zap> = {
  zap: Zap,
  wrench: Wrench,
  "trending-down": TrendingDown,
};

const STEP_ICONS: Record<StepIcon, typeof Zap> = {
  zap: Zap,
  pricing: TrendingUp,
  staffing: Users,
  inventory: Package,
  maintenance: Wrench,
  sentiment: MessageSquareHeart,
  check: CheckCircle2,
};

const ALERT_VARIANT: Record<AlertVariant, "good" | "warning" | "serious" | "critical"> = {
  good: "good",
  warning: "warning",
  serious: "serious",
  critical: "critical",
};

const STEP_DELAY_MS = 550;

export default function ScenarioSimulator() {
  const { state, dispatch } = useResortStore();
  const [scenarios, setScenarios] = useState<ScenarioDefinition[]>([]);
  const [selectedId, setSelectedId] = useState<string>("festival");
  const [demandBoost, setDemandBoost] = useState<number>(0.2);
  const [outcome, setOutcome] = useState<ScenarioOutcome | null>(null);
  const [running, setRunning] = useState(false);
  const [revealedCount, setRevealedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  const isLiveActive = state.activeEvents.length > 0;
  const isSurgeActive = state.activeEvents.some((e) => e.type === "DEMAND_SURGE");
  const isFailureActive = state.activeEvents.some((e) => e.type === "EQUIPMENT_FAILURE");
  const isComplaintActive = state.activeEvents.some((e) => e.type === "GUEST_COMPLAINT");
  const activeSurgeEvent = state.activeEvents.find((e) => e.type === "DEMAND_SURGE");
  const activeFailureEvent = state.activeEvents.find((e) => e.type === "EQUIPMENT_FAILURE");

  useEffect(() => {
    fetch("/api/simulate")
      .then((r) => r.json())
      .then((data) => {
        setScenarios(data.scenarios);
        if (data.scenarios[0]) setSelectedId(data.scenarios[0].id);
      })
      .catch(() => setError("Could not load scenarios."));
  }, []);

  useEffect(() => {
    return () => {
      timeouts.current.forEach(clearTimeout);
    };
  }, []);

  function pickScenario(id: string) {
    if (running) return;
    setSelectedId(id);
    setOutcome(null);
    setRevealedCount(0);
    setError(null);
  }

  const [justApplied, setJustApplied] = useState(false);

  function handleBoostChange(newBoost: number) {
    setDemandBoost(newBoost);
    if (isSurgeActive && selectedId === "festival") {
      dispatch({
        type: "DEMAND_SURGE",
        demandBoost: newBoost,
        reason: "Surprise Festival",
        durationDays: 2,
        startDateOffset: 2,
      });
      setJustApplied(true);
    }
  }

  async function runSimulation(applyLive: boolean = true) {
    if (!selectedId || running) return;
    timeouts.current.forEach(clearTimeout);
    timeouts.current = [];
    setRunning(true);
    setOutcome(null);
    setRevealedCount(0);
    setError(null);
    setJustApplied(false);

    if (applyLive) {
      if (selectedId === "festival") {
        dispatch({
          type: "DEMAND_SURGE",
          demandBoost,
          reason: "Surprise Festival",
          durationDays: 2,
          startDateOffset: 2,
        });
        setJustApplied(true);
      } else if (selectedId === "equipment-failure" || selectedId === "chiller") {
        dispatch({
          type: "EQUIPMENT_FAILURE",
          equipmentId: "eq-2",
          reason: "Chiller Unit 2 failure: loss of cooling to Deluxe Ocean wing",
        });
        setJustApplied(true);
      } else if (selectedId === "guest-complaint") {
        dispatch({
          type: "GUEST_COMPLAINT",
          complaintId: "cmp-spa-101",
          aspect: "spa",
          guestName: "Elena Rostova",
          roomNumber: "209",
          facilityArea: "Spa Hydrotherapy Wing",
          complaintText: "The Spa Jacuzzi water was lukewarm, jet pressure cut out completely mid-session, and there was a distinct electrical burning odor from the pump room. Completely ruined our booked private couples session!",
          targetEquipmentId: "eq-6",
          targetEquipmentName: "Spa Jacuzzi Heater",
          severity: "critical",
        });
        setJustApplied(true);
      }
    }

    try {
      const url =
        selectedId === "festival"
          ? `/api/simulate?scenario=${encodeURIComponent(selectedId)}&boost=${demandBoost}`
          : `/api/simulate?scenario=${encodeURIComponent(selectedId)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Simulation failed");
      setOutcome(data);
      data.steps.forEach((_: unknown, i: number) => {
        const t = setTimeout(() => setRevealedCount(i + 1), (i + 1) * STEP_DELAY_MS);
        timeouts.current.push(t);
      });
    } catch {
      setError("Could not run that scenario. Try again.");
    } finally {
      setRunning(false);
    }
  }

  function handleReset() {
    dispatch({ type: "RESET_STATE" });
    setOutcome(null);
    setRevealedCount(0);
    setJustApplied(false);
  }

  const allRevealed = outcome !== null && revealedCount >= outcome.steps.length;

  return (
    <div className="flex flex-col gap-4">
      {/* Live Status Indicator if active */}
      {isLiveActive && (
        <div className="flex flex-col gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-ink backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-3 w-3 rounded-full bg-emerald-400 animate-ping" />
              <div>
                <strong className="text-emerald-400 font-semibold">Live Resort State Active:</strong>{" "}
                <span className="text-ink-secondary">
                  {state.activeEvents.map((e) => e.label).join(" + ")}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isFailureActive && (
                <button
                  onClick={() =>
                    dispatch({
                      type: "EQUIPMENT_RECOVERY",
                      equipmentId: "eq-2",
                    })
                  }
                  className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/30 transition-colors"
                >
                  <Wrench className="h-3.5 w-3.5" /> Recover Chiller Unit 2
                </button>
              )}
              {isComplaintActive && (
                <button
                  onClick={() =>
                    dispatch({
                      type: "COMPLAINT_RESOLVED",
                      complaintId: "cmp-spa-101",
                    })
                  }
                  className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/30 transition-colors"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Resolve Spa Incident
                </button>
              )}
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/30 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset All to Baseline
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-emerald-500/20 text-xs">
            <span className="text-emerald-300 font-medium">Jump directly to affected modules:</span>
            <a
              href="/dashboard/revenue"
              className="rounded bg-emerald-500/20 px-2.5 py-1 font-medium text-emerald-200 hover:bg-emerald-500/30 transition-colors underline decoration-dotted"
            >
              📈 Revenue &amp; Pricing (Rates surged) &rarr;
            </a>
            <a
              href="/dashboard/operations"
              className="rounded bg-emerald-500/20 px-2.5 py-1 font-medium text-emerald-200 hover:bg-emerald-500/30 transition-colors underline decoration-dotted"
            >
              👥 Operations (Staffing deficits) &rarr;
            </a>
            <a
              href="/dashboard/guest-experience"
              className="rounded bg-emerald-500/20 px-2.5 py-1 font-medium text-emerald-200 hover:bg-emerald-500/30 transition-colors underline decoration-dotted"
            >
              ⭐ Guest Experience (Queue risk) &rarr;
            </a>
            <a
              href="/dashboard"
              className="rounded bg-emerald-500/20 px-2.5 py-1 font-medium text-emerald-200 hover:bg-emerald-500/30 transition-colors underline decoration-dotted"
            >
              📊 Executive Overview &rarr;
            </a>
          </div>
        </div>
      )}

      {justApplied && !isLiveActive && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-300">
          Simulation applied to live state.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {scenarios.map((s) => {
          const Icon = SCENARIO_ICONS[s.icon];
          const active = s.id === selectedId;
          return (
            <button
              key={s.id}
              onClick={() => pickScenario(s.id)}
              className={clsx(
                "flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors",
                active ? "border-series-1 bg-series-1/5" : "border-border-strong bg-surface hover:bg-page"
              )}
            >
              <Icon className={clsx("h-5 w-5", active ? "text-series-1" : "text-ink-muted")} strokeWidth={2} />
              <p className="text-sm font-semibold text-ink">{s.label}</p>
              <p className="text-xs text-ink-muted">{s.description}</p>
            </button>
          );
        })}
      </div>

      {/* Demand Increase options for Festival */}
      {selectedId === "festival" && (
        <div className="rounded-xl border border-border-strong bg-surface-raised p-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink">
              Demand Increase
            </label>
            <p className="text-xs text-ink-muted">
              Select the surge magnitude applied to room demand during the 2-day festival window:
            </p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { label: "+10% (Moderate)", value: 0.1 },
              { label: "+20% (Default - High)", value: 0.2 },
              { label: "+30% (Surge - Severe)", value: 0.3 },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleBoostChange(opt.value)}
                className={clsx(
                  "rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all border",
                  demandBoost === opt.value
                    ? "border-series-1 bg-series-1 text-white shadow-sm ring-1 ring-series-1"
                    : "border-border-strong bg-surface text-ink-secondary hover:text-ink hover:bg-page"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => runSimulation(true)}
          disabled={!selectedId || running}
          className="flex items-center gap-2 rounded-full bg-series-1 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:opacity-90 disabled:opacity-50"
        >
          <Zap className="h-4 w-4" strokeWidth={2} />
          {running
            ? "Simulating & Applying..."
            : isLiveActive
            ? `Update Live State (+${Math.round(demandBoost * 100)}%)`
            : "Apply to Live Resort State & Run"}
        </button>

        <button
          onClick={() => runSimulation(false)}
          disabled={!selectedId || running}
          className="flex items-center gap-2 rounded-full border border-border-strong bg-surface-raised px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-page disabled:opacity-50"
        >
          <Play className="h-4 w-4" strokeWidth={2} />
          Preview Steps Only
        </button>

        {isLiveActive && (
          <button
            onClick={handleReset}
            disabled={running}
            className="flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm font-medium text-amber-300 hover:bg-amber-500/20 transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            Reset State
          </button>
        )}
      </div>

      {error && <p className="text-sm text-status-critical">{error}</p>}

      {outcome && (
        <Card className="mt-1">
          <div className="flex flex-col gap-3">
            {outcome.steps.map((step, i) => {
              const Icon = STEP_ICONS[step.icon];
              const visible = i < revealedCount;
              return (
                <div
                  key={step.key}
                  className={clsx(
                    "flex items-start gap-3 transition-all duration-300",
                    visible ? "opacity-100 translate-y-0" : "pointer-events-none -translate-y-1 opacity-0"
                  )}
                >
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-series-1/10 text-series-1">
                    <Icon className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink">{step.title}</p>
                    <p className="text-sm text-ink-secondary">{step.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div
            className={clsx(
              "mt-5 grid grid-cols-1 gap-3 border-t border-border-strong pt-5 transition-opacity duration-500 sm:grid-cols-2 md:grid-cols-3",
              allRevealed ? "opacity-100" : "pointer-events-none opacity-0"
            )}
          >
            {outcome.kpis.map((kpi) => (
              <div key={kpi.label} className="rounded-lg border border-border-strong bg-page px-3 py-2.5">
                <p className="text-xs text-ink-muted">{kpi.label}</p>
                <p className="mt-1 flex items-baseline gap-2 text-sm">
                  <span className="text-ink-muted line-through">{kpi.before}</span>
                  <span className={clsx("font-semibold", kpi.good ? "text-status-good" : "text-status-critical")}>
                    {kpi.after}
                  </span>
                </p>
              </div>
            ))}
          </div>

          <div
            className={clsx(
              "mt-4 flex flex-col divide-y divide-border-strong transition-opacity duration-500",
              allRevealed ? "opacity-100" : "pointer-events-none opacity-0"
            )}
          >
            {outcome.alerts.map((alert, i) => (
              <div key={i} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <p className="text-sm text-ink">{alert.text}</p>
                <StatusBadge label={alert.engine} variant={ALERT_VARIANT[alert.variant]} />
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
