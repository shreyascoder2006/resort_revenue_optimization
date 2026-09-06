"use client";

import { useResortStore } from "@/lib/store/resortStore";
import { Zap, RotateCcw, ArrowRight } from "lucide-react";
import Link from "next/link";
import clsx from "clsx";
import { formatCurrency } from "@/lib/utils/currency";

import { buildPricingRecommendations } from "@/lib/engines/pricing";
import { buildStaffingPlan } from "@/lib/engines/staffing";
import { buildSentimentSummary } from "@/lib/engines/sentiment";
import { buildGuestImpactSummary } from "@/lib/engines/guestImpact";
import { buildComplaintDiagnosticSummary } from "@/lib/engines/complaintDiagnostics";

export default function LiveEventBanner() {
  const { state, dispatch } = useResortStore();

  if (state.activeEvents.length === 0) return null;

  const active = state.activeEvents[state.activeEvents.length - 1];
  const pricing = buildPricingRecommendations(state);
  const staffing = buildStaffingPlan(state);
  const sentiment = buildSentimentSummary(state);
  const guestImpact = buildGuestImpactSummary(state);
  const diagnostics = buildComplaintDiagnosticSummary(state);
  const understaffed = staffing.filter((s) => s.status === "Understaffed").length;
  const isSurge = state.activeEvents.some((e) => e.type === "DEMAND_SURGE");

  return (
    <div
      className={clsx(
        "mb-6 rounded-xl border p-3.5 text-sm text-ink backdrop-blur-sm transition-all duration-300",
        isSurge
          ? "border-orange-500/60 bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-rose-500/15 shadow-[0_0_25px_rgba(245,158,11,0.25)] ring-1 ring-orange-500/40"
          : "border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent shadow-sm"
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          <span
            className={clsx(
              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
              isSurge ? "bg-orange-500/30 text-amber-300" : "bg-amber-500/20 text-amber-400"
            )}
          >
            <Zap className="h-3.5 w-3.5 animate-pulse" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={clsx("font-extrabold tracking-wide", isSurge ? "text-amber-300" : "text-amber-400")}>
                {isSurge ? "🔥 EXTREME FESTIVAL SURGE ACTIVE" : "LIVE RESORT STATE ACTIVE"}
              </span>
              {state.activeEvents.map((ev) => (
                <span
                  key={ev.id}
                  className={clsx(
                    "rounded-md px-2 py-0.5 text-xs font-extrabold border",
                    isSurge
                      ? "bg-gradient-to-r from-amber-500/40 to-orange-500/40 text-amber-200 border-amber-400 shadow-sm"
                      : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                  )}
                >
                  {ev.label}
                </span>
              ))}
            </div>
            <p className="mt-0.5 text-xs text-ink-secondary">
              All intelligence engines are actively recalculating from live shared state:
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="rounded bg-blue-500/20 px-2 py-0.5 font-medium text-blue-300 border border-blue-500/30">
                Available: {pricing.totalAvailableRooms}/{pricing.totalPhysicalRooms} rms
              </span>
              <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-medium text-emerald-300 border border-emerald-500/30">
                ADR: {formatCurrency(pricing.forecastAdr, pricing.currency)}
              </span>
              <span className="rounded bg-indigo-500/20 px-2 py-0.5 font-medium text-indigo-300 border border-indigo-500/30">
                RevPAR: {formatCurrency(pricing.forecastRevPar, pricing.currency)}
              </span>
              <span className="rounded bg-indigo-500/20 px-2 py-0.5 font-medium text-indigo-300 border border-indigo-500/30">
                Forecast Occ: {Math.round(pricing.forecastOccupancy * 100)}%
              </span>
              <span
                className={`rounded px-2 py-0.5 font-medium border ${
                  pricing.revenueImpact >= 0
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                    : "bg-rose-500/20 text-rose-300 border-rose-500/30"
                }`}
              >
                7d Rev Impact: {pricing.revenueImpact >= 0 ? "+" : ""}{formatCurrency(pricing.revenueImpact, pricing.currency)}
              </span>
              <span className="rounded bg-rose-500/20 px-2 py-0.5 font-medium text-rose-300 border border-rose-500/30">
                Understaffed: {understaffed} shifts
              </span>
              {guestImpact.hasEquipmentFailure && (
                <span className="rounded bg-rose-500/20 px-2 py-0.5 font-medium text-rose-300 border border-rose-500/30">
                  {guestImpact.affectedRoomCount} rms · {guestImpact.totalAffectedGuests} guests affected
                </span>
              )}
              {guestImpact.relocationRequired && (
                <span className="rounded bg-amber-500/20 px-2 py-0.5 font-semibold text-amber-300 border border-amber-500/30">
                  Relocation: Required
                </span>
              )}
              {diagnostics.hasActiveComplaint && (
                <span className="rounded bg-amber-500/20 px-2 py-0.5 font-medium text-amber-300 border border-amber-500/30">
                  Incident: {diagnostics.affectedArea.name} ({diagnostics.affectedArea.status})
                </span>
              )}
              <span className="rounded bg-amber-500/20 px-2 py-0.5 font-medium text-amber-300 border border-amber-500/30">
                Guest Risk: {guestImpact.serviceRiskLevel}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <Link
            href="/dashboard/simulator"
            className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-ink-secondary hover:text-ink transition-colors"
          >
            Simulator <ArrowRight className="h-3 w-3" />
          </Link>
          <button
            onClick={() => dispatch({ type: "RESET_STATE" })}
            className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-500/25"
          >
            <RotateCcw className="h-3 w-3" />
            Reset to Baseline
          </button>
        </div>
      </div>
    </div>
  );
}
