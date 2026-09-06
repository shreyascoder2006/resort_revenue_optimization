"use client";

import { useResortStore } from "@/lib/store/resortStore";
import {
  Zap,
  Wrench,
  TrendingDown,
  RotateCcw,
  CheckCircle2,
  Flame,
  Sparkles,
  CloudRain,
  AlertTriangle,
} from "lucide-react";
import clsx from "clsx";

interface ScenarioPill {
  id: string;
  label: string;
  icon: typeof Zap;
  colorType: "amber" | "gold" | "indigo" | "rose" | "red" | "orange";
}

const SCENARIOS: ScenarioPill[] = [
  { id: "festival", label: "Festival Surge (+120%)", icon: Flame, colorType: "amber" },
  { id: "wedding-buyout", label: "VIP Wedding Buyout", icon: Sparkles, colorType: "gold" },
  { id: "monsoon-slump", label: "Monsoon Slump (-70%)", icon: CloudRain, colorType: "indigo" },
  { id: "equipment-failure", label: "Chiller Failure (-15 rms)", icon: Wrench, colorType: "rose" },
  { id: "wing-blackout", label: "Wing Blackout (-40 rms)", icon: AlertTriangle, colorType: "red" },
  { id: "guest-complaint", label: "Guest Complaint", icon: TrendingDown, colorType: "orange" },
];

function getActiveScenarioId(activeEvents: { type: string; label?: string; details?: any }[]): string | null {
  const surge = activeEvents.find((e) => e.type === "DEMAND_SURGE");
  if (surge) {
    const label = (surge.label ?? "").toLowerCase();
    const reason = (surge.details?.reason ?? "").toLowerCase();
    if (label.includes("wedding") || reason.includes("wedding") || label.includes("buyout") || reason.includes("buyout")) {
      return "wedding-buyout";
    }
    if ((surge.details?.demandBoost ?? 0) < 0 || label.includes("monsoon") || reason.includes("monsoon")) {
      return "monsoon-slump";
    }
    return "festival";
  }
  const eq = activeEvents.find((e) => e.type === "EQUIPMENT_FAILURE");
  if (eq) {
    if (eq.details?.equipmentId === "eq-11" || (eq.details?.affectedRoomCount ?? 0) > 20) {
      return "wing-blackout";
    }
    return "equipment-failure";
  }
  if (activeEvents.some((e) => e.type === "GUEST_COMPLAINT")) return "guest-complaint";
  return null;
}

export default function ScenarioSwitcher() {
  const { state, dispatch } = useResortStore();
  const activeId = getActiveScenarioId(state.activeEvents);
  const isNormalState = activeId === null;

  function applyScenario(id: string) {
    if (activeId === id) {
      dispatch({ type: "RESET_STATE" });
      return;
    }

    dispatch({ type: "RESET_STATE" });

    setTimeout(() => {
      if (id === "festival") {
        dispatch({
          type: "DEMAND_SURGE",
          demandBoost: 1.2, // Extreme surge boost (+120%)
          reason: "Surprise Mega Festival",
          durationDays: 3,
          startDateOffset: 1,
        });
      } else if (id === "wedding-buyout") {
        dispatch({
          type: "DEMAND_SURGE",
          demandBoost: 1.5, // Ultra-luxury VIP buyout
          reason: "VIP Royal Wedding Buyout",
          durationDays: 3,
          startDateOffset: 1,
        });
      } else if (id === "monsoon-slump") {
        dispatch({
          type: "DEMAND_SURGE",
          demandBoost: -0.70, // Severe demand collapse (-70%)
          reason: "Monsoon Cyclonic Alert",
          durationDays: 4,
          startDateOffset: 1,
        });
      } else if (id === "equipment-failure") {
        dispatch({
          type: "EQUIPMENT_FAILURE",
          equipmentId: "eq-2",
          reason: "Chiller Unit 2 failure: loss of cooling to Deluxe Ocean wing",
        });
      } else if (id === "wing-blackout") {
        dispatch({
          type: "EQUIPMENT_FAILURE",
          equipmentId: "eq-11",
          reason: "Main Substation & Generator failure: 40 rooms offline across Deluxe Ocean & Lagoon wings",
        });
      } else if (id === "guest-complaint") {
        dispatch({
          type: "GUEST_COMPLAINT",
          complaintId: "cmp-spa-101",
          aspect: "spa",
          guestName: "Elena Rostova",
          roomNumber: "209",
          facilityArea: "Spa Hydrotherapy Wing",
          complaintText:
            "The Spa Jacuzzi water was lukewarm, jet pressure cut out completely mid-session, and there was a distinct electrical burning odor from the pump room. Completely ruined our booked private couples session!",
          targetEquipmentId: "eq-6",
          targetEquipmentName: "Spa Jacuzzi Heater",
          severity: "critical",
        });
      }
    }, 0);
  }

  function handleReset() {
    dispatch({ type: "RESET_STATE" });
  }

  return (
    <div
      className={clsx(
        "mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-all duration-300",
        isNormalState
          ? "border-emerald-500/30 bg-emerald-500/5 shadow-[0_0_15px_rgba(16,185,129,0.08)]"
          : activeId === "festival"
          ? "border-orange-500/50 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-rose-500/10 shadow-[0_0_25px_rgba(245,158,11,0.2)]"
          : activeId === "wedding-buyout"
          ? "border-amber-400/50 bg-gradient-to-r from-yellow-500/15 via-amber-500/10 to-emerald-500/10 shadow-[0_0_25px_rgba(234,179,8,0.2)]"
          : activeId === "monsoon-slump"
          ? "border-indigo-500/50 bg-gradient-to-r from-indigo-500/15 via-blue-500/10 to-slate-500/10 shadow-[0_0_25px_rgba(99,102,241,0.2)]"
          : activeId === "wing-blackout"
          ? "border-rose-500/50 bg-gradient-to-r from-rose-500/20 via-red-500/15 to-transparent shadow-[0_0_25px_rgba(244,63,94,0.25)] ring-1 ring-rose-500/40"
          : "border-border-strong bg-surface"
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-bold uppercase tracking-wider text-ink-muted">
          Scenarios:
        </span>

        {/* Normal Stage Button */}
        <button
          onClick={handleReset}
          className={clsx(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all border",
            isNormalState
              ? "border-emerald-500/60 bg-emerald-600 text-white shadow-[0_0_12px_rgba(16,185,129,0.4)] ring-1 ring-emerald-400"
              : "border-border-strong bg-page text-ink-secondary hover:text-ink hover:bg-surface-raised"
          )}
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-200" />
          Normal Stage
        </button>

        {SCENARIOS.map((s) => {
          const Icon = s.icon;
          const isActive = activeId === s.id;

          // Dynamic active styling per scenario
          const activeClass =
            s.id === "festival"
              ? "border-amber-400 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 text-white shadow-[0_0_20px_rgba(245,158,11,0.6)] ring-2 ring-amber-400/60 animate-pulse font-bold"
              : s.id === "wedding-buyout"
              ? "border-yellow-300 bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-600 text-white shadow-[0_0_20px_rgba(234,179,8,0.6)] ring-2 ring-yellow-400/60 font-bold"
              : s.id === "monsoon-slump"
              ? "border-indigo-400 bg-gradient-to-r from-indigo-600 to-blue-700 text-white shadow-[0_0_18px_rgba(99,102,241,0.5)] ring-2 ring-indigo-400/50 font-bold"
              : s.id === "wing-blackout"
              ? "border-rose-400 bg-gradient-to-r from-red-600 to-rose-700 text-white shadow-[0_0_20px_rgba(225,29,72,0.6)] ring-2 ring-rose-400/60 font-bold"
              : "border-series-1 bg-series-1 text-white shadow-sm ring-1 ring-series-1/50 font-semibold";

          return (
            <button
              key={s.id}
              onClick={() => applyScenario(s.id)}
              className={clsx(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-all border",
                isActive
                  ? activeClass
                  : "border-border-strong bg-page text-ink-secondary hover:text-ink hover:bg-surface-raised font-medium"
              )}
            >
              <Icon className={clsx("h-3.5 w-3.5", isActive && "animate-bounce")} />
              {s.label}
            </button>
          );
        })}

        {activeId && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        )}
      </div>

      {/* Live State Mode Badge */}
      <div className="flex items-center gap-2">
        {isNormalState ? (
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-400 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>NORMAL STAGE · Calm Baseline (~34% Occ)</span>
          </div>
        ) : activeId === "festival" ? (
          <div className="flex items-center gap-2 rounded-full border border-amber-400 bg-gradient-to-r from-amber-500/25 to-orange-500/25 px-3 py-1 text-xs font-extrabold text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.3)] animate-pulse">
            <Flame className="h-3.5 w-3.5 text-amber-400" />
            <span>EXTREME FESTIVAL SURGE ACTIVE (+120% Demand · 96% Peak)</span>
          </div>
        ) : activeId === "wedding-buyout" ? (
          <div className="flex items-center gap-2 rounded-full border border-yellow-400 bg-gradient-to-r from-yellow-500/25 to-amber-500/25 px-3 py-1 text-xs font-extrabold text-yellow-300 shadow-[0_0_15px_rgba(234,179,8,0.3)] animate-pulse">
            <Sparkles className="h-3.5 w-3.5 text-yellow-300" />
            <span>VIP ROYAL WEDDING BUYOUT (₹26,400+ ADR · ₹1.44 Cr Rev)</span>
          </div>
        ) : activeId === "monsoon-slump" ? (
          <div className="flex items-center gap-2 rounded-full border border-indigo-400 bg-gradient-to-r from-indigo-500/25 to-blue-500/25 px-3 py-1 text-xs font-extrabold text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.3)]">
            <CloudRain className="h-3.5 w-3.5 text-indigo-400" />
            <span>MONSOON STORM SLUMP (-70% Demand · 12% Occ)</span>
          </div>
        ) : activeId === "wing-blackout" ? (
          <div className="flex items-center gap-2 rounded-full border border-red-500 bg-gradient-to-r from-red-500/30 to-rose-500/30 px-3 py-1 text-xs font-extrabold text-red-300 shadow-[0_0_20px_rgba(239,68,68,0.4)] animate-pulse">
            <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
            <span>MAJOR WING BLACKOUT (40 Rms Offline · Emergency Relocation)</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-300">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            <span>EQUIPMENT / GUEST INCIDENT ACTIVE</span>
          </div>
        )}
      </div>
    </div>
  );
}
