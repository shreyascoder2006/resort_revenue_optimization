"use client";

import { useState, useMemo } from "react";
import { PageHeader, Card, KpiTile, StatusBadge } from "@/components/ui";
import { LineTrendChart } from "@/components/charts/LineTrendChart";
import { buildPricingRecommendations } from "@/lib/engines/pricing";
import { type DemandForecastDay } from "@/lib/data/bookings";
import { type RoomType } from "@/lib/data/rooms";
import { useResortStore } from "@/lib/store/resortStore";
import { formatCurrency, type Currency } from "@/lib/utils/currency";
import {
  AlertTriangle,
  RotateCcw,
  SlidersHorizontal,
  TrendingUp,
  Zap,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

function buildDemandTrend(forecast: DemandForecastDay[], rooms: RoomType[]) {
  const totalAvailable = rooms.reduce(
    (s, r) => s + Math.max(0, r.availableCount ?? (r.count - (r.outOfOrderCount ?? 0))),
    0
  );
  const byDate = new Map<string, number>();
  for (const f of forecast) {
    byDate.set(f.date, (byDate.get(f.date) ?? 0) + f.bookedRooms);
  }
  return Array.from(byDate.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, booked]) => ({
      x: date.slice(5),
      occupancy: Math.round((booked / (totalAvailable || 1)) * 1000) / 10,
    }));
}

export default function RevenuePage() {
  const { state, dispatch } = useResortStore();
  const pricing = buildPricingRecommendations(state);
  const demandTrend = buildDemandTrend(state.demandForecast, state.rooms);

  const activeCurrency: Currency = state.currency ?? "INR";

  // Manager Override state
  const [selectedRoomId, setSelectedRoomId] = useState<string>("deluxe-ocean");
  const [overrideInput, setOverrideInput] = useState<string>(activeCurrency === "INR" ? "10000" : "310");

  // Keep override input in sync if currency changes and not actively dirty
  const handleCurrencyChange = (newCurrency: Currency) => {
    dispatch({ type: "SET_CURRENCY", currency: newCurrency });
    if (newCurrency === "INR") {
      setOverrideInput("10000");
    } else {
      setOverrideInput("310");
    }
  };

  const selectedRoom = state.rooms.find((r) => r.id === selectedRoomId) ?? state.rooms[0];
  const selectedRecs = pricing.recommendations.filter((r) => r.roomTypeId === selectedRoomId);
  const defaultRecommendedRate = selectedRecs.length > 0 ? selectedRecs[0].calculatedRate : 9200;
  const currentActiveRate = selectedRecs.length > 0 ? selectedRecs[0].recommendedRate : 9200;
  const isRoomOverridden = selectedRecs.some((r) => r.isOverridden);
  const activeDemandLevel = selectedRecs.length > 0 ? selectedRecs[0].demandLevel : "High";

  const parsedOverride = parseFloat(overrideInput) || defaultRecommendedRate;
  const rateDiff = parsedOverride - defaultRecommendedRate;
  const rateDiffPct = defaultRecommendedRate > 0 ? (rateDiff / defaultRecommendedRate) * 100 : 0;

  const handleApplyOverride = () => {
    const rate = parseFloat(overrideInput);
    if (!isNaN(rate) && rate > 0) {
      dispatch({
        type: "PRICING_OVERRIDE",
        roomTypeId: selectedRoomId,
        overrideRate: rate,
        originalRate: defaultRecommendedRate,
        reason: `Manager manual ADR adjustment to ${formatCurrency(rate, activeCurrency)}`,
      });
    }
  };

  const handleClearOverride = () => {
    dispatch({
      type: "CLEAR_PRICING_OVERRIDE",
      roomTypeId: selectedRoomId,
    });
    setOverrideInput(activeCurrency === "INR" ? "10000" : "310");
  };

  const roomSummaries = state.rooms.map((room) => {
    const next7 = pricing.recommendations.filter((r) => r.roomTypeId === room.id && r.leadDays < 7);
    const avgRecommended = Math.round(next7.reduce((s, r) => s + r.recommendedRate, 0) / (next7.length || 1));
    const avgChange = next7.reduce((s, r) => s + r.changePercent, 0) / (next7.length || 1);
    const outOfOrder = room.outOfOrderCount ?? 0;
    const available = room.availableCount ?? (room.count - outOfOrder);
    const isOverridden = next7.some((r) => r.isOverridden);
    const roomBaseRate = next7[0]?.baseRate ?? room.baseRate;
    return { room, roomBaseRate, avgRecommended, avgChange, outOfOrder, available, isOverridden };
  });

  const tableRows = pricing.recommendations
    .filter((r) => r.leadDays < 7)
    .sort((a, b) => (a.date === b.date ? a.roomTypeName.localeCompare(b.roomTypeName) : a.date < b.date ? -1 : 1));

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-2">
        <PageHeader
          title="Revenue & Dynamic Pricing"
          description="Demand-driven rate recommendations by room type, updated live for occupancy, seasonality, lead time, and managerial overrides."
        />

        {/* Currency Switcher */}
        <div className="flex items-center self-start sm:self-auto gap-1.5 rounded-lg border border-border bg-surface-2 p-1 text-xs">
          <span className="px-2 font-medium text-ink-muted">Currency:</span>
          <button
            onClick={() => handleCurrencyChange("INR")}
            className={`rounded-md px-3 py-1 font-semibold transition-colors ${
              activeCurrency === "INR"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                : "text-ink-secondary hover:text-ink hover:bg-surface-3"
            }`}
          >
            ₹ INR (Rupee)
          </button>
          <button
            onClick={() => handleCurrencyChange("USD")}
            className={`rounded-md px-3 py-1 font-semibold transition-colors ${
              activeCurrency === "USD"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                : "text-ink-secondary hover:text-ink hover:bg-surface-3"
            }`}
          >
            $ USD (Dollar)
          </button>
        </div>
      </div>

      {/* MANAGER PRICING OVERRIDE CONTROLLER CARD */}
      <div className="mb-5 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-surface-2 via-surface-1 to-surface-2 p-5 shadow-lg backdrop-blur-md">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between pb-4 border-b border-border-strong">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              <SlidersHorizontal className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-ink">Manager Dynamic Rate Override</h3>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-300 border border-emerald-500/30">
                  Live Resort Loop
                </span>
                {pricing.hasPricingOverride && (
                  <span className="flex items-center gap-1 rounded-full bg-cyan-500/20 px-2.5 py-0.5 text-[11px] font-bold text-cyan-300 border border-cyan-500/40 animate-pulse">
                    <Zap className="h-3 w-3" /> Override Active
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-secondary mt-0.5">
                Adjust ADR in real-time. Overrides instantly cascade through Overview, Forecast, RevPAR, and 7-day Revenue models.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-ink-muted">Quick Presets:</span>
            <button
              onClick={() => {
                setSelectedRoomId("deluxe-ocean");
                setOverrideInput(activeCurrency === "INR" ? "10000" : "310");
              }}
              className="rounded-md border border-border-strong bg-surface-3 px-2.5 py-1 text-ink hover:border-emerald-500/40 hover:text-emerald-300 transition-colors"
            >
              Deluxe Ocean → {activeCurrency === "INR" ? "₹10,000" : "$310"}
            </button>
            <button
              onClick={() => {
                setSelectedRoomId("deluxe-ocean");
                setOverrideInput(activeCurrency === "INR" ? "10500" : "325");
              }}
              className="rounded-md border border-border-strong bg-surface-3 px-2.5 py-1 text-ink hover:border-emerald-500/40 hover:text-emerald-300 transition-colors"
            >
              Peak Yield → {activeCurrency === "INR" ? "₹10,500" : "$325"}
            </button>
          </div>
        </div>

        {/* Override Control Row */}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 items-end">
          {/* Room Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1.5">
              Room Type
            </label>
            <select
              value={selectedRoomId}
              onChange={(e) => {
                setSelectedRoomId(e.target.value);
                const recs = pricing.recommendations.filter((r) => r.roomTypeId === e.target.value);
                if (recs.length > 0) {
                  setOverrideInput(recs[0].recommendedRate.toString());
                }
              }}
              className="w-full rounded-xl border border-border-strong bg-surface-3 px-3 py-2 text-sm font-semibold text-ink focus:border-emerald-500 focus:outline-none"
            >
              {state.rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Demand Level Indicator */}
          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1.5">
              Demand Level
            </label>
            <div className="flex items-center justify-between rounded-xl border border-border-strong bg-surface-3 px-3 py-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-amber-400" />
                <span className="text-sm font-bold text-amber-300">{activeDemandLevel}</span>
              </div>
              <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-200">
                1.12x Multiplier
              </span>
            </div>
          </div>

          {/* Recommended ADR */}
          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1.5">
              Algorithm ADR
            </label>
            <div className="flex items-center justify-between rounded-xl border border-border-strong bg-surface-3 px-3 py-2">
              <span className="text-sm font-bold text-emerald-400 tabular-nums">
                {formatCurrency(defaultRecommendedRate, activeCurrency)}
              </span>
              <span className="text-[10px] text-ink-muted">AI Yield Target</span>
            </div>
          </div>

          {/* Manager Input */}
          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1.5 flex items-center justify-between">
              <span>Manager Override</span>
              <span className="text-[10px] text-emerald-400 font-semibold">
                {rateDiff >= 0 ? "+" : ""}{formatCurrency(rateDiff, activeCurrency)} ({rateDiffPct >= 0 ? "+" : ""}{rateDiffPct.toFixed(1)}%)
              </span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-sm font-bold text-ink-muted">
                {pricing.currencySymbol}
              </span>
              <input
                type="number"
                value={overrideInput}
                onChange={(e) => setOverrideInput(e.target.value)}
                className="w-full rounded-xl border border-emerald-500/50 bg-surface-3 pl-8 pr-3 py-2 text-sm font-bold text-emerald-300 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                placeholder={defaultRecommendedRate.toString()}
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleApplyOverride}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-sm font-bold text-white shadow-md hover:from-emerald-500 hover:to-teal-500 transition-all active:scale-95"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Apply Override</span>
            </button>
            {isRoomOverridden && (
              <button
                onClick={handleClearOverride}
                title="Revert to algorithm price"
                className="flex items-center justify-center rounded-xl border border-border-strong bg-surface-3 p-2 text-ink-secondary hover:text-rose-400 hover:border-rose-500/40 transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Live Override Summary Banner */}
        {isRoomOverridden && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs text-cyan-200">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cyan-400" />
              <span>
                <strong>{selectedRoom.name}</strong> rate locked at{" "}
                <span className="font-bold text-white underline decoration-cyan-400">
                  {formatCurrency(currentActiveRate, activeCurrency)}
                </span>{" "}
                (was recommended {formatCurrency(defaultRecommendedRate, activeCurrency)}).
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span>
                ADR Lift:{" "}
                <strong className="text-emerald-300">
                  +{formatCurrency(currentActiveRate - defaultRecommendedRate, activeCurrency)}/night
                </strong>
              </span>
              <span>
                RevPAR: <strong className="text-emerald-300">{formatCurrency(pricing.forecastRevPar, activeCurrency)}</strong>
              </span>
              <button
                onClick={handleClearOverride}
                className="underline font-semibold hover:text-white transition-colors"
              >
                Reset to Algorithm
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Contextual Equipment Failure Indicator */}
      {pricing.hasEquipmentFailure && (
        <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-ink backdrop-blur-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-400">
                <AlertTriangle className="h-4 w-4" />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-amber-300">⚠ Equipment Failure Impact</span>
                  <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-200 border border-amber-500/30">
                    {pricing.activeEquipmentFailureName}
                  </span>
                  <span className="rounded bg-rose-500/20 px-2 py-0.5 text-xs font-semibold text-rose-300 border border-rose-500/30">
                    {pricing.activeOutOfOrderCount} rooms offline
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-secondary">
                  Reduced operational capacity ({pricing.totalAvailableRooms}/{pricing.totalPhysicalRooms} operational). Pricing engine is applying inventory scarcity logic to protect revenue yield on remaining operable rooms.
                </p>
                <div className="mt-2.5 flex flex-wrap gap-4 text-xs">
                  <div>
                    <span className="text-ink-muted">Baseline Available:</span>{" "}
                    <span className="font-medium text-ink">{pricing.totalPhysicalRooms} rms</span>
                  </div>
                  <div>
                    <span className="text-ink-muted">Current Available:</span>{" "}
                    <span className="font-medium text-ink">{pricing.totalAvailableRooms} rms</span>
                  </div>
                  <div>
                    <span className="text-ink-muted">Out of Order:</span>{" "}
                    <span className="font-medium text-rose-300">{pricing.activeOutOfOrderCount} rms</span>
                  </div>
                  <div>
                    <span className="text-ink-muted">Baseline 7d Rev:</span>{" "}
                    <span className="font-medium text-ink">{formatCurrency(pricing.baselineProjectedRevenue, activeCurrency)}</span>
                  </div>
                  <div>
                    <span className="text-ink-muted">Current 7d Rev:</span>{" "}
                    <span className="font-medium text-ink">{formatCurrency(pricing.next7ProjectedRevenue, activeCurrency)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="shrink-0 self-end sm:self-auto rounded-lg border border-amber-500/30 bg-amber-500/15 px-3.5 py-2 text-right">
              <p className="text-[11px] font-medium text-amber-300/80">Revenue Impact (7d)</p>
              <p className={`text-base font-bold tabular-nums ${pricing.revenueImpact >= 0 ? "text-status-good" : "text-status-critical"}`}>
                {pricing.revenueImpact >= 0 ? "+" : ""}{formatCurrency(pricing.revenueImpact, activeCurrency)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Primary KPI Tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiTile
          label="Available Rooms"
          value={`${pricing.totalAvailableRooms} / ${pricing.totalPhysicalRooms}`}
          delta={pricing.totalOutOfOrderRooms > 0 ? `-${pricing.totalOutOfOrderRooms} out of order` : "100% operational"}
          deltaGood={pricing.totalOutOfOrderRooms === 0}
        />
        <KpiTile
          label="Forecast Occupancy (7d)"
          value={`${Math.round(pricing.forecastOccupancy * 100)}%`}
          delta={pricing.totalOutOfOrderRooms > 0 ? "Capacity constrained" : (pricing.hasSurge ? "+12% surge" : `Trailing: ${Math.round(pricing.currentOccupancy * 100)}%`)}
          deltaGood={true}
        />
        <KpiTile
          label="Recommended ADR (7d)"
          value={formatCurrency(pricing.forecastAdr, activeCurrency)}
          delta={
            pricing.hasPricingOverride
              ? "Manager Override Active"
              : pricing.totalOutOfOrderRooms > 0
                ? "Scarcity yield"
                : pricing.hasSurge
                  ? "+Surge yield"
                  : `Trailing: ${formatCurrency(pricing.trailingAdr, activeCurrency)}`
          }
          deltaGood={true}
        />
        <KpiTile
          label="Forecast RevPAR (7d)"
          value={formatCurrency(pricing.forecastRevPar, activeCurrency)}
          delta={
            pricing.hasPricingOverride
              ? "Yield boosted"
              : pricing.totalOutOfOrderRooms > 0
                ? "On operable rms"
                : pricing.hasSurge
                  ? "+Yield boost"
                  : `Trailing: ${formatCurrency(pricing.trailingRevPar, activeCurrency)}`
          }
          deltaGood={true}
        />
        <KpiTile
          label="Projected 7d Revenue"
          value={formatCurrency(pricing.next7ProjectedRevenue, activeCurrency)}
          delta={`Base: ${formatCurrency(pricing.baselineProjectedRevenue, activeCurrency)}`}
          deltaGood={pricing.next7ProjectedRevenue >= pricing.baselineProjectedRevenue}
        />
        <KpiTile
          label="Revenue Impact (7d)"
          value={`${pricing.revenueImpact >= 0 ? "+" : ""}${formatCurrency(pricing.revenueImpact, activeCurrency)}`}
          delta={pricing.revenueImpact !== 0 ? "vs baseline forecast" : "Baseline on-pace"}
          deltaGood={pricing.revenueImpact >= 0}
        />
      </div>

      <Card title="Forecasted Demand (Next 21 Days)" subtitle="Resort-wide booked occupancy against operational capacity" className="mt-4">
        <LineTrendChart
          data={demandTrend}
          series={[{ key: "occupancy", label: "Booked occupancy %", color: "var(--series-1)" }]}
          format="percent"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {state.demandEvents.map((e) => (
            <StatusBadge
              key={e.date + e.label}
              label={`${e.date.slice(5)} · ${e.label} (+${Math.round(e.demandBoost * 100)}%)`}
              variant={e.label.includes("Festival") || e.label.includes("Surprise") ? "serious" : "neutral"}
            />
          ))}
        </div>
      </Card>

      {/* Room Category Cards */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {roomSummaries.map(({ room, roomBaseRate, avgRecommended, avgChange, outOfOrder, available, isOverridden }) => (
          <Card key={room.id} className={isOverridden ? "border-cyan-500/50 bg-cyan-500/5" : undefined}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-ink-muted">{room.name}</p>
              <div className="flex items-center gap-1">
                {isOverridden && (
                  <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-bold text-cyan-300 border border-cyan-500/40">
                    ⚡ Override
                  </span>
                )}
                {outOfOrder > 0 && (
                  <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300 border border-rose-500/30">
                    {outOfOrder} OOO
                  </span>
                )}
                {pricing.hasSurge && (
                  <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                    Surge
                  </span>
                )}
              </div>
            </div>
            <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-400">
              {formatCurrency(avgRecommended, activeCurrency)}
            </p>
            <div className="flex items-center justify-between text-xs text-ink-muted">
              <span>base {formatCurrency(roomBaseRate, activeCurrency)}</span>
              <span>{available}/{room.count} avail</span>
            </div>
            <p className={`mt-1 text-xs font-medium ${avgChange >= 0 ? "text-status-good" : "text-status-critical"}`}>
              {avgChange >= 0 ? "+" : ""}
              {avgChange.toFixed(1)}% avg (next 7d)
            </p>
          </Card>
        ))}
      </div>

      {/* Detailed Recommendations Table */}
      <Card title="Pricing Recommendations - Next 7 Days" subtitle="Per room type, per night" className="mt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-strong text-left text-xs text-ink-muted">
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 pr-3 font-medium">Room Type</th>
                <th className="py-2 pr-3 font-medium">Demand</th>
                <th className="py-2 pr-3 font-medium">Forecast Occ.</th>
                <th className="py-2 pr-3 font-medium">Base Rate</th>
                <th className="py-2 pr-3 font-medium">Recommended Rate</th>
                <th className="py-2 pr-3 font-medium">Yield Change</th>
                <th className="py-2 font-medium">Pricing Rationale</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r) => (
                <tr
                  key={`${r.date}-${r.roomTypeId}`}
                  className={`border-b border-border-strong/60 last:border-0 ${
                    r.isOverridden
                      ? "bg-cyan-500/10 font-medium"
                      : r.isEvent && (r.eventDemandBoost ?? 0) > 0
                        ? "bg-amber-500/5 font-medium"
                        : ""
                  }`}
                >
                  <td className="py-2 pr-3 tabular-nums text-ink-secondary">
                    <div className="flex items-center gap-1.5">
                      <span>{r.date}</span>
                      {r.isEvent && (
                        <span className="rounded bg-amber-500/20 px-1.5 py-0.2 text-[10px] text-amber-300">
                          {r.eventLabel}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 pr-3 font-medium text-ink">
                    <div className="flex items-center gap-2">
                      <span>{r.roomTypeName}</span>
                      {r.isOverridden && (
                        <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-bold text-cyan-300 border border-cyan-500/40">
                          ⚡ Override
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        r.demandLevel === "Peak"
                          ? "bg-rose-500/20 text-rose-300"
                          : r.demandLevel === "High"
                            ? "bg-amber-500/20 text-amber-300"
                            : r.demandLevel === "Low"
                              ? "bg-blue-500/20 text-blue-300"
                              : "bg-surface-3 text-ink-secondary"
                      }`}
                    >
                      {r.demandLevel}
                    </span>
                  </td>
                  <td className="py-2 pr-3 tabular-nums">{Math.round(r.forecastOccupancyRate * 100)}%</td>
                  <td className="py-2 pr-3 tabular-nums text-ink-muted">
                    {formatCurrency(r.baseRate, activeCurrency)}
                  </td>
                  <td className="py-2 pr-3 tabular-nums font-semibold text-emerald-400">
                    <div className="flex items-center gap-1.5">
                      <span>{formatCurrency(r.recommendedRate, activeCurrency)}</span>
                      {r.isOverridden && (
                        <span className="text-[11px] font-normal text-ink-muted line-through">
                          {formatCurrency(r.calculatedRate, activeCurrency)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={`py-2 pr-3 tabular-nums font-semibold ${r.changePercent >= 0 ? "text-status-good" : "text-status-critical"}`}>
                    {r.changePercent >= 0 ? "+" : ""}
                    {r.changePercent.toFixed(0)}%
                  </td>
                  <td className="py-2 text-xs text-ink-secondary">
                    {r.isOverridden ? (
                      <span className="text-cyan-300 font-medium">
                        Manager override applied (+{formatCurrency(r.recommendedRate - r.calculatedRate, activeCurrency)} above algorithm)
                      </span>
                    ) : (
                      r.rationale.join("; ")
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
