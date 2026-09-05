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
} from "lucide-react";
import clsx from "clsx";
import { Card, StatusBadge } from "@/components/ui";
import type { ScenarioDefinition, ScenarioOutcome, ScenarioIcon, StepIcon, AlertVariant } from "@/lib/engines/scenarios";

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
  const [scenarios, setScenarios] = useState<ScenarioDefinition[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [outcome, setOutcome] = useState<ScenarioOutcome | null>(null);
  const [running, setRunning] = useState(false);
  const [revealedCount, setRevealedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

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

  async function runSimulation() {
    if (!selectedId || running) return;
    timeouts.current.forEach(clearTimeout);
    timeouts.current = [];
    setRunning(true);
    setOutcome(null);
    setRevealedCount(0);
    setError(null);

    try {
      const res = await fetch(`/api/simulate?scenario=${encodeURIComponent(selectedId)}`);
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

  const allRevealed = outcome !== null && revealedCount >= outcome.steps.length;

  return (
    <div className="flex flex-col gap-4">
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

      <div>
        <button
          onClick={runSimulation}
          disabled={!selectedId || running}
          className="flex items-center gap-2 rounded-full bg-series-1 px-5 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
        >
          <Play className="h-4 w-4" strokeWidth={2} />
          {running ? "Running..." : "Run simulation"}
        </button>
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
