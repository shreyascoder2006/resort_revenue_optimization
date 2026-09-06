"use client";

import { PageHeader, Card, KpiTile, StatusBadge, riskVariant } from "@/components/ui";
import { LineTrendChart } from "@/components/charts/LineTrendChart";
import { buildPricingRecommendations } from "@/lib/engines/pricing";
import { buildSentimentSummary } from "@/lib/engines/sentiment";
import { buildMaintenanceRisks } from "@/lib/engines/maintenance";
import { buildStaffingPlan } from "@/lib/engines/staffing";
import { buildInventoryStatus } from "@/lib/engines/inventory";
import { type DailyOccupancy, type DemandForecastDay } from "@/lib/data/bookings";
import { buildGuestImpactSummary } from "@/lib/engines/guestImpact";
import { buildComplaintDiagnosticSummary } from "@/lib/engines/complaintDiagnostics";
import { useResortStore } from "@/lib/store/resortStore";
import { formatCurrency } from "@/lib/utils/currency";
import { AlertTriangle, MessageSquareWarning, PackageX, Users, Zap } from "lucide-react";
import ScenarioSwitcher from "@/components/ScenarioSwitcher";

function buildOccupancyTrend(history: DailyOccupancy[]) {
  const byDate = new Map<string, { occupied: number; total: number }>();
  for (const h of history) {
    const entry = byDate.get(h.date) ?? { occupied: 0, total: 0 };
    entry.occupied += h.occupiedRooms;
    entry.total += h.occupiedRooms + h.availableRooms;
    byDate.set(h.date, entry);
  }
  return Array.from(byDate.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(-30)
    .map(([date, v]) => ({ x: date.slice(5), occupancy: Math.round((v.occupied / v.total) * 1000) / 10 }));
}

function buildForecastOverlay(forecast: DemandForecastDay[], totalRooms: number) {
  const byDate = new Map<string, { booked: number; count: number }>();
  for (const f of forecast) {
    if (f.leadDays > 7) continue;
    const entry = byDate.get(f.date) ?? { booked: 0, count: 0 };
    entry.booked += f.bookedRooms;
    entry.count++;
    byDate.set(f.date, entry);
  }
  return Array.from(byDate.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, v]) => ({ x: date.slice(5), forecast: Math.round((v.booked / totalRooms) * 1000) / 10 }));
}

export default function OverviewPage() {
  const { state } = useResortStore();

  const pricing = buildPricingRecommendations(state);
  const sentiment = buildSentimentSummary(state);
  const guestImpact = buildGuestImpactSummary(state);
  const diagnostics = buildComplaintDiagnosticSummary(state);
  const maintenance = buildMaintenanceRisks(state);
  const staffing = buildStaffingPlan(state);
  const inventory = buildInventoryStatus(state);
  const occupancyTrend = buildOccupancyTrend(state.occupancyHistory);
  const totalRooms = state.rooms.reduce((s, r) => s + r.count, 0);
  const forecastOverlay = buildForecastOverlay(state.demandForecast, totalRooms);

  // Merge historical + forecast into one dataset for the chart
  const mergedOccupancyData = (() => {
    const map = new Map<string, { occupancy?: number; forecast?: number }>();
    for (const h of occupancyTrend) {
      map.set(h.x, { ...map.get(h.x), occupancy: h.occupancy });
    }
    // Bridge: set the forecast start point equal to the last historical value for continuity
    const lastHistorical = occupancyTrend[occupancyTrend.length - 1];
    for (const f of forecastOverlay) {
      const existing = map.get(f.x);
      if (existing?.occupancy !== undefined) {
        // This date has both historical and forecast — set forecast to match for a smooth join
        map.set(f.x, { ...existing, forecast: f.forecast });
      } else {
        map.set(f.x, { ...existing, forecast: f.forecast });
      }
    }
    // If the first forecast day isn't the last historical day, bridge them
    if (lastHistorical && forecastOverlay.length > 0 && !map.get(lastHistorical.x)?.forecast) {
      map.set(lastHistorical.x, { ...map.get(lastHistorical.x), forecast: lastHistorical.occupancy });
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([x, v]) => ({ x, occupancy: v.occupancy, forecast: v.forecast }));
  })();

  const criticalMaintenance = maintenance.filter((m) => m.riskLevel === "Critical" || m.riskLevel === "High");
  const understaffedDays = staffing.filter((s) => s.status === "Understaffed");
  const reorderAlerts = inventory.filter((i) => i.reorderNeeded);

  const sentimentTrendData = sentiment.weekly.map((w) => ({ x: w.weekStart.slice(5), score: w.avgScore }));

  const alerts = [
    ...(pricing.hasPricingOverride
      ? [
          {
            icon: <Zap className="h-4 w-4" />,
            category: "Pricing Strategy",
            variant: "neutral" as const,
            text: `Manager Price Override Active: Yield adjusted (e.g. Deluxe Ocean @ ${formatCurrency(pricing.activePricingOverrides["deluxe-ocean"] ?? 10000, pricing.currency)}). Target ADR updated to ${formatCurrency(pricing.forecastAdr, pricing.currency)} with RevPAR @ ${formatCurrency(pricing.forecastRevPar, pricing.currency)}.`,
          },
        ]
      : []),
    ...(diagnostics.hasActiveComplaint && diagnostics.overviewAlert
      ? [
          {
            icon: <MessageSquareWarning className="h-4 w-4" />,
            category: diagnostics.overviewAlert.category,
            variant: diagnostics.overviewAlert.variant,
            text: diagnostics.overviewAlert.text,
          },
        ]
      : []),
    ...(guestImpact.hasEquipmentFailure && guestImpact.relocationRequired
      ? [
          {
            icon: <Users className="h-4 w-4" />,
            category: "Critical Guest Impact",
            variant: "critical" as const,
            text: `${guestImpact.activeEquipmentName} failure: ${guestImpact.totalAffectedGuests} guests potentially affected (${guestImpact.affectedCurrentCount} in-house, ${guestImpact.affectedArrivingCount} arriving today) across ${guestImpact.affectedRoomCount} rooms. Relocation required.`,
          },
        ]
      : []),
    ...(pricing.hasEquipmentFailure
      ? [
          {
            icon: <AlertTriangle className="h-4 w-4" />,
            category: "Equipment Failure",
            variant: "critical" as const,
            text: `${pricing.activeEquipmentFailureName} failure: ${pricing.activeOutOfOrderCount} rooms offline (${pricing.totalAvailableRooms}/${pricing.totalPhysicalRooms} operational). 7-day net revenue impact: ${pricing.revenueImpact >= 0 ? "+" : ""}${formatCurrency(pricing.revenueImpact, pricing.currency)}.`,
          },
        ]
      : []),
    ...(sentiment.serviceRiskDetail
      ? [
          {
            icon: <MessageSquareWarning className="h-4 w-4" />,
            category: "Guest Experience",
            variant: sentiment.serviceRiskLevel === "High" ? ("critical" as const) : ("serious" as const),
            text: sentiment.serviceRiskDetail,
          },
        ]
      : []),
    ...maintenance.slice(0, 2).map((m) => ({
      icon: <AlertTriangle className="h-4 w-4" />,
      category: "Maintenance",
      variant: riskVariant(m.riskLevel),
      text: `${m.equipment.name}: ${m.recommendation}`,
    })),
    ...understaffedDays.slice(0, 2).map((s) => ({
      icon: <Users className="h-4 w-4" />,
      category: "Staffing",
      variant: "warning" as const,
      text: `${s.departmentName} understaffed on ${s.date} - ${s.scheduledStaff} scheduled vs ${s.requiredStaff} needed.`,
    })),
    ...reorderAlerts
      .sort((a, b) => (b.isEmergencyPart ? 1 : 0) - (a.isEmergencyPart ? 1 : 0))
      .slice(0, 2)
      .map((i) => ({
        icon: <PackageX className="h-4 w-4" />,
        category: i.isEmergencyPart ? "Emergency Inventory" : "Inventory",
        variant: i.urgency === "Critical" ? ("critical" as const) : ("warning" as const),
        text: `${i.item.name}: ${Math.round(i.daysOfStockLeft * 10) / 10} days of stock left - reorder ${i.recommendedOrderQty} ${i.item.unit}.${i.emergencyReason ? ` (${i.emergencyReason})` : ""}`,
      })),
    ...sentiment.topIssues.slice(0, 2).map((s) => ({
      icon: <MessageSquareWarning className="h-4 w-4" />,
      category: "Guest Experience",
      variant: "serious" as const,
      text: `Recurring "${s.aspect}" complaints: "${s.quote}"`,
    })),
  ];

  const activeDemandEvent = state.activeEvents.find((e) => e.type === "DEMAND_SURGE");
  const demandReason = ((activeDemandEvent?.label ?? "") + " " + (activeDemandEvent?.details?.reason ?? "")).toLowerCase();
  const isWedding = Boolean(activeDemandEvent && (demandReason.includes("wedding") || demandReason.includes("buyout")));
  const isSlump = Boolean(activeDemandEvent && (((activeDemandEvent.details?.demandBoost as number | undefined) ?? 0) < 0 || demandReason.includes("monsoon") || demandReason.includes("storm")));
  const isFestivalSurge = Boolean(activeDemandEvent && !isWedding && !isSlump);

  const activeEqEvent = state.activeEvents.find((e) => e.type === "EQUIPMENT_FAILURE");
  const isWingBlackout = Boolean(activeEqEvent && (activeEqEvent.details?.equipmentId === "eq-11" || pricing.totalOutOfOrderRooms > 20));
  const isChillerFailure = Boolean(activeEqEvent && !isWingBlackout);

  const isNormal = state.activeEvents.length === 0;
  const peakForecastOccupancy = forecastOverlay.reduce((max, f) => (f.forecast > max ? f.forecast : max), 0);
  const minForecastOccupancy = forecastOverlay.reduce((min, f) => (f.forecast < min ? f.forecast : min), 100);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Resort Overview"
        description="Real-time snapshot across occupancy, revenue, guest sentiment, and operations."
      />

      <ScenarioSwitcher />

      {/* State Indicator Banner */}
      {isNormal ? (
        <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent px-4 py-3 text-xs text-emerald-300 shadow-sm">
          <div className="flex items-center gap-2 font-medium">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
            <span className="font-semibold tracking-wide uppercase text-emerald-400">Normal Stage Active:</span>
            <span>Standard off-peak baseline operations · Calm ~30% occupancy · ₹7,456 ADR · Stable standard yield</span>
          </div>
          <span className="hidden sm:inline-block rounded bg-emerald-500/20 px-2.5 py-0.5 font-bold text-emerald-300 border border-emerald-500/30">
            OFF-PEAK CALM
          </span>
        </div>
      ) : isFestivalSurge ? (
        <div className="flex items-center justify-between rounded-xl border border-orange-500/60 bg-gradient-to-r from-amber-500/25 via-orange-500/20 to-rose-500/20 px-4 py-3 text-xs text-amber-200 shadow-[0_0_30px_rgba(245,158,11,0.25)] ring-1 ring-orange-500/40 animate-pulse">
          <div className="flex items-center gap-2 font-medium">
            <span className="text-base">🔥</span>
            <span className="font-extrabold tracking-wide uppercase text-amber-300">EXTREME FESTIVAL SURGE ACTIVE:</span>
            <span>Massive demand shockwave (+120%) · 95% peak occupancy · Dynamic rate surges to {formatCurrency(pricing.forecastAdr, pricing.currency)} ADR!</span>
          </div>
          <span className="hidden sm:inline-block rounded bg-gradient-to-r from-amber-500 to-orange-600 px-2.5 py-1 font-extrabold text-white shadow-md">
            PEAK SURGE YIELD
          </span>
        </div>
      ) : isWedding ? (
        <div className="flex items-center justify-between rounded-xl border border-yellow-400/60 bg-gradient-to-r from-yellow-500/25 via-amber-500/20 to-yellow-600/20 px-4 py-3 text-xs text-yellow-200 shadow-[0_0_30px_rgba(234,179,8,0.25)] ring-1 ring-yellow-400/40 animate-pulse">
          <div className="flex items-center gap-2 font-medium">
            <span className="text-base">✨</span>
            <span className="font-extrabold tracking-wide uppercase text-yellow-300">VIP ROYAL WEDDING BUYOUT ACTIVE:</span>
            <span>Multi-wing private buyout (90% Occ) · Luxury package rate at {formatCurrency(pricing.forecastAdr, pricing.currency)} ADR · {formatCurrency(pricing.next7ProjectedRevenue, pricing.currency)} Projected 7d Rev!</span>
          </div>
          <span className="hidden sm:inline-block rounded bg-gradient-to-r from-yellow-500 to-amber-600 px-2.5 py-1 font-extrabold text-white shadow-md">
            👑 ULTRA-LUXURY YIELD
          </span>
        </div>
      ) : isSlump ? (
        <div className="flex items-center justify-between rounded-xl border border-indigo-500/60 bg-gradient-to-r from-indigo-600/25 via-blue-600/20 to-slate-700/20 px-4 py-3 text-xs text-indigo-200 shadow-[0_0_30px_rgba(99,102,241,0.25)] ring-1 ring-indigo-500/40">
          <div className="flex items-center gap-2 font-medium">
            <span className="text-base">🌧️</span>
            <span className="font-extrabold tracking-wide uppercase text-indigo-300">MONSOON STORM SLUMP ACTIVE:</span>
            <span>Severe cyclonic weather warning (-70% Demand) · Occupancy plunges to 12% · Distress stimulus discount to {formatCurrency(pricing.forecastAdr, pricing.currency)} ADR active!</span>
          </div>
          <span className="hidden sm:inline-block rounded bg-indigo-500/30 px-2.5 py-1 font-extrabold text-indigo-200 border border-indigo-400 shadow-sm">
            🌧️ DISTRESS SLUMP
          </span>
        </div>
      ) : isWingBlackout ? (
        <div className="flex items-center justify-between rounded-xl border border-red-500 bg-gradient-to-r from-red-600/30 via-rose-600/25 to-red-900/30 px-4 py-3 text-xs text-red-200 shadow-[0_0_35px_rgba(239,68,68,0.35)] ring-1 ring-red-500/50 animate-pulse">
          <div className="flex items-center gap-2 font-medium">
            <span className="text-base">🚨</span>
            <span className="font-extrabold tracking-wide uppercase text-red-300">MAJOR ELECTRICAL SUBSTATION BLACKOUT:</span>
            <span>40 rooms knocked offline across Deluxe Ocean & Lagoon wings · 35+ emergency guest relocations required!</span>
          </div>
          <span className="hidden sm:inline-block rounded bg-red-600 px-2.5 py-1 font-extrabold text-white shadow-md">
            🚨 CATASTROPHIC DISASTER
          </span>
        </div>
      ) : isChillerFailure ? (
        <div className="flex items-center justify-between rounded-xl border border-amber-500/60 bg-gradient-to-r from-amber-500/20 to-surface px-4 py-3 text-xs text-amber-200 shadow-sm">
          <div className="flex items-center gap-2 font-medium">
            <span className="text-base">⚠️</span>
            <span className="font-extrabold tracking-wide uppercase text-amber-300">CHILLER UNIT 2 FAILURE ACTIVE:</span>
            <span>15 Deluxe Ocean rooms offline · Automated scarcity yield adjustments active on remaining inventory.</span>
          </div>
          <span className="hidden sm:inline-block rounded bg-amber-500/20 px-2 py-0.5 font-bold text-amber-300 border border-amber-500/30">
            EQUIPMENT OUTAGE
          </span>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <KpiTile
          label="Available Capacity"
          value={`${pricing.totalAvailableRooms} / ${pricing.totalPhysicalRooms}`}
          delta={
            pricing.totalOutOfOrderRooms > 0
              ? isWingBlackout
                ? "🚨 -40 rms (27% offline)"
                : `-${pricing.totalOutOfOrderRooms} out of order`
              : isFestivalSurge
              ? "🔥 95% peak booked"
              : isWedding
              ? "✨ 90% buyout booked"
              : isSlump
              ? "🌧️ 12% booked (88% vacant)"
              : "100% operational"
          }
          deltaGood={pricing.totalOutOfOrderRooms === 0}
          className={
            isNormal
              ? "border-emerald-500/30 bg-emerald-500/[0.03]"
              : isFestivalSurge
              ? "border-orange-500/50 bg-gradient-to-b from-orange-500/10 to-surface shadow-[0_0_15px_rgba(249,115,22,0.1)]"
              : isWedding
              ? "border-yellow-400/50 bg-gradient-to-b from-yellow-500/10 to-surface shadow-[0_0_15px_rgba(234,179,8,0.1)]"
              : isSlump
              ? "border-indigo-500/40 bg-indigo-500/5"
              : isWingBlackout
              ? "border-red-500/60 bg-gradient-to-b from-red-500/20 to-surface ring-1 ring-red-500/40"
              : undefined
          }
          valueClassName={
            isWingBlackout
              ? "text-red-400 font-extrabold"
              : isFestivalSurge
              ? "text-orange-400 font-bold"
              : isWedding
              ? "text-yellow-300 font-bold"
              : undefined
          }
        />
        <KpiTile
          label="Forecast Occupancy"
          value={
            isFestivalSurge
              ? `${Math.round(peakForecastOccupancy)}%`
              : isWedding
              ? "90%"
              : isSlump
              ? `${Math.round(minForecastOccupancy)}%`
              : `${Math.round(pricing.forecastOccupancy * 100)}%`
          }
          delta={
            pricing.totalOutOfOrderRooms > 0
              ? "Capacity constrained"
              : isFestivalSurge
              ? `🔥 +65% Surge Spike (95% Peak)`
              : isWedding
              ? `✨ +60% Buyout Spike (90% Peak)`
              : isSlump
              ? `🌧️ -18% Cyclone Drop (12% Low)`
              : `Current: ${Math.round(pricing.currentOccupancy * 100)}% (Calm)`
          }
          deltaGood={!isSlump}
          className={
            isNormal
              ? "border-emerald-500/30 bg-emerald-500/[0.04]"
              : isFestivalSurge
              ? "border-orange-500/60 bg-gradient-to-b from-orange-500/20 via-surface to-surface shadow-[0_0_20px_rgba(249,115,22,0.25)] ring-1 ring-orange-500/40"
              : isWedding
              ? "border-yellow-400/60 bg-gradient-to-b from-yellow-500/20 via-surface to-surface shadow-[0_0_20px_rgba(234,179,8,0.25)] ring-1 ring-yellow-400/40"
              : isSlump
              ? "border-indigo-500/50 bg-gradient-to-b from-indigo-500/20 via-surface to-surface"
              : undefined
          }
          valueClassName={
            isNormal
              ? "text-emerald-400 font-semibold"
              : isFestivalSurge
              ? "text-orange-400 font-extrabold text-3xl"
              : isWedding
              ? "text-yellow-300 font-extrabold text-3xl"
              : isSlump
              ? "text-indigo-400 font-extrabold text-3xl"
              : undefined
          }
        />
        <KpiTile
          label="Target ADR (7d)"
          value={formatCurrency(pricing.forecastAdr, pricing.currency)}
          delta={
            pricing.hasPricingOverride
              ? "Manager override active"
              : isWingBlackout
              ? "🚨 Scarcity surcharge"
              : isFestivalSurge
              ? "🔥 +164% Dynamic Surge Rate"
              : isWedding
              ? "✨ +254% Luxury Buyout Rate"
              : isSlump
              ? "🌧️ -43% Distress Clearance Rate"
              : `Trailing: ${formatCurrency(pricing.trailingAdr, pricing.currency)}`
          }
          deltaGood={!isSlump}
          className={
            isNormal
              ? "border-emerald-500/30 bg-emerald-500/[0.04]"
              : isFestivalSurge
              ? "border-amber-500/60 bg-gradient-to-b from-amber-500/20 via-surface to-surface shadow-[0_0_20px_rgba(245,158,11,0.25)] ring-1 ring-amber-500/40"
              : isWedding
              ? "border-yellow-400/60 bg-gradient-to-b from-yellow-500/25 via-surface to-surface shadow-[0_0_20px_rgba(234,179,8,0.3)] ring-1 ring-yellow-400/50"
              : isSlump
              ? "border-indigo-500/50 bg-gradient-to-b from-indigo-500/15 via-surface to-surface"
              : undefined
          }
          valueClassName={
            isNormal
              ? "text-emerald-400 font-semibold"
              : isFestivalSurge
              ? "text-amber-300 font-extrabold text-3xl"
              : isWedding
              ? "text-yellow-300 font-extrabold text-3xl"
              : isSlump
              ? "text-indigo-300 font-extrabold text-3xl"
              : undefined
          }
        />
        <KpiTile
          label="Projected 7d Revenue"
          value={formatCurrency(pricing.next7ProjectedRevenue, pricing.currency)}
          delta={
            pricing.revenueImpact !== 0
              ? isFestivalSurge
                ? `🔥 +${formatCurrency(pricing.revenueImpact, pricing.currency)} Surge Windfall`
                : isWedding
                ? `✨ +${formatCurrency(pricing.revenueImpact, pricing.currency)} Buyout Windfall`
                : isSlump
                ? `🌧️ ${formatCurrency(pricing.revenueImpact, pricing.currency)} Weather Collapse`
                : isWingBlackout
                ? `🚨 ${formatCurrency(pricing.revenueImpact, pricing.currency)} Outage Loss`
                : `${pricing.revenueImpact >= 0 ? "+" : ""}${formatCurrency(pricing.revenueImpact, pricing.currency)} impact`
              : "Baseline on-pace (₹0 variance)"
          }
          deltaGood={pricing.revenueImpact >= 0}
          className={
            isNormal
              ? "border-emerald-500/30 bg-emerald-500/[0.04]"
              : isFestivalSurge
              ? "border-emerald-500/60 bg-gradient-to-b from-emerald-500/20 via-surface to-surface shadow-[0_0_20px_rgba(16,185,129,0.25)] ring-1 ring-emerald-500/40"
              : isWedding
              ? "border-emerald-500/60 bg-gradient-to-b from-emerald-500/25 via-surface to-surface shadow-[0_0_25px_rgba(16,185,129,0.3)] ring-1 ring-emerald-400/50"
              : isSlump
              ? "border-rose-500/50 bg-gradient-to-b from-rose-500/15 via-surface to-surface"
              : isWingBlackout
              ? "border-rose-500/60 bg-gradient-to-b from-rose-500/20 via-surface to-surface"
              : undefined
          }
          valueClassName={
            isNormal
              ? "text-emerald-400 font-semibold"
              : isFestivalSurge
              ? "text-emerald-300 font-extrabold text-3xl"
              : isWedding
              ? "text-emerald-300 font-extrabold text-3xl"
              : isSlump
              ? "text-rose-400 font-extrabold text-3xl"
              : isWingBlackout
              ? "text-rose-400 font-extrabold text-3xl"
              : undefined
          }
        />
        <KpiTile
          label="Service Risk"
          value={
            isWingBlackout
              ? "CATASTROPHIC"
              : isFestivalSurge
              ? "CRITICAL SURGE"
              : isWedding
              ? "VIP ELITE"
              : isSlump
              ? "LABOR SURPLUS"
              : guestImpact.serviceRiskLevel === "Normal"
              ? "Optimal"
              : guestImpact.serviceRiskLevel
          }
          delta={
            isWingBlackout
              ? "🚨 35+ Emergency Relocations"
              : guestImpact.relocationRequired
              ? `${guestImpact.totalAffectedGuests} relocations needed`
              : isFestivalSurge
              ? "⚡ 10+ Shifts Understaffed"
              : isWedding
              ? "👑 Banquet & Butler Draw"
              : isSlump
              ? "🌧️ 15+ Idle Staff Shifts"
              : sentiment.serviceRiskLevel !== "Normal"
              ? "High queue risk"
              : "Calm operations"
          }
          deltaGood={isNormal || isWedding}
          className={
            isNormal
              ? "border-emerald-500/30 bg-emerald-500/[0.04]"
              : isWingBlackout
              ? "border-red-500/60 bg-gradient-to-b from-red-500/25 via-surface to-surface shadow-[0_0_25px_rgba(239,68,68,0.3)] ring-1 ring-red-500/50"
              : isFestivalSurge
              ? "border-rose-500/60 bg-gradient-to-b from-rose-500/20 via-surface to-surface shadow-[0_0_20px_rgba(244,63,94,0.25)] ring-1 ring-rose-500/40"
              : isWedding
              ? "border-yellow-400/50 bg-gradient-to-b from-yellow-500/15 via-surface to-surface"
              : isSlump
              ? "border-indigo-500/40 bg-indigo-500/10"
              : undefined
          }
          valueClassName={
            isNormal
              ? "text-emerald-400 font-semibold"
              : isWingBlackout
              ? "text-red-400 font-extrabold text-xl"
              : isFestivalSurge
              ? "text-rose-400 font-extrabold text-xl"
              : isWedding
              ? "text-yellow-300 font-extrabold text-xl"
              : isSlump
              ? "text-indigo-300 font-extrabold text-xl"
              : undefined
          }
        />
        <KpiTile
          label="Open Ops Alerts"
          value={`${criticalMaintenance.length + understaffedDays.length + reorderAlerts.length}`}
          delta={
            isWingBlackout
              ? "🚨 Critical substation fire"
              : pricing.hasEquipmentFailure
              ? "Critical failure"
              : isFestivalSurge
              ? "⚡ Peak crowd staffing shortage"
              : isWedding
              ? "👑 VIP event staffing gaps"
              : isSlump
              ? "🌧️ Idle staff surplus"
              : reorderAlerts.length > 0
              ? `${reorderAlerts.length} reorders`
              : "Standard operations"
          }
          deltaGood={isNormal}
          className={
            isNormal
              ? "border-emerald-500/30 bg-emerald-500/[0.04]"
              : isWingBlackout
              ? "border-red-500/60 bg-gradient-to-b from-red-500/20 via-surface to-surface"
              : isFestivalSurge
              ? "border-amber-500/60 bg-gradient-to-b from-amber-500/20 via-surface to-surface shadow-[0_0_20px_rgba(245,158,11,0.2)]"
              : isWedding
              ? "border-yellow-400/50 bg-gradient-to-b from-yellow-500/15 via-surface to-surface"
              : undefined
          }
          valueClassName={
            isNormal
              ? "text-emerald-400 font-semibold"
              : isWingBlackout
              ? "text-red-400 font-extrabold"
              : isFestivalSurge
              ? "text-amber-400 font-extrabold"
              : isWedding
              ? "text-yellow-300 font-extrabold"
              : undefined
          }
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card
          title="Occupancy Trend"
          subtitle={
            isFestivalSurge
              ? "🔥 SURGE ACTIVE: 7-day forecast skyrockets from 34% to 95% peak capacity!"
              : isWedding
              ? "✨ VIP BUYOUT: 90% capacity booked at ₹26,400+ ADR luxury packages"
              : isSlump
              ? "🌧️ CYCLONE SLUMP: Cancellations drop demand to 12% off-peak floor"
              : "Last 30 days + 7-day forecast (Calm baseline ~30%)"
          }
          className={
            isFestivalSurge
              ? "border-orange-500/50 shadow-[0_0_25px_rgba(249,115,22,0.15)]"
              : isWedding
              ? "border-yellow-400/50 shadow-[0_0_25px_rgba(234,179,8,0.15)]"
              : isSlump
              ? "border-indigo-500/50 shadow-[0_0_25px_rgba(99,102,241,0.15)]"
              : isNormal
              ? "border-emerald-500/30"
              : undefined
          }
        >
          <LineTrendChart
            data={mergedOccupancyData}
            series={[
              { key: "occupancy", label: "Historical %", color: "#3b82f6" },
              {
                key: "forecast",
                label: isFestivalSurge
                  ? "🔥 Festival Surge Forecast %"
                  : isWedding
                  ? "✨ VIP Buyout Forecast % (90%)"
                  : isSlump
                  ? "🌧️ Monsoon Slump Forecast % (12%)"
                  : "Forecast (Calm Baseline %)",
                color: isFestivalSurge
                  ? "#ff4500"
                  : isWedding
                  ? "#eab308"
                  : isSlump
                  ? "#6366f1"
                  : "#06b6d4",
                strokeDasharray: isFestivalSurge || isWedding || isSlump ? "6 2" : "5 4",
                connectNulls: true,
              },
            ]}
            format="percent"
          />
        </Card>
        <Card
          title="Guest Sentiment Trend"
          subtitle={
            isFestivalSurge
              ? "Weekly average sentiment score (elevated queue risk during festival)"
              : isWedding
              ? "Weekly average sentiment score (ultra-high VIP satisfaction expectations)"
              : isSlump
              ? "Weekly average sentiment score (rain check inquiries & amenity delays)"
              : "Weekly average sentiment score across all reviews"
          }
          className={
            isFestivalSurge
              ? "border-amber-500/40"
              : isWedding
              ? "border-yellow-400/40"
              : isSlump
              ? "border-indigo-500/40"
              : isNormal
              ? "border-emerald-500/30"
              : undefined
          }
        >
          <LineTrendChart
            data={sentimentTrendData}
            series={[
              {
                key: "score",
                label: "Sentiment score",
                color: isFestivalSurge
                  ? "#f59e0b"
                  : isWedding
                  ? "#eab308"
                  : isSlump
                  ? "#6366f1"
                  : "var(--series-3)",
              },
            ]}
            format="score"
            zeroLine
          />
        </Card>
      </div>

      <Card title="Alerts & Recommendations" subtitle="Highest-priority items generated by the intelligence engines" className="mt-4">
        <div className="flex flex-col divide-y divide-border-strong">
          {alerts.map((a, i) => (
            <div key={i} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
              <span className="mt-0.5 text-ink-muted">{a.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-ink">{a.text}</p>
              </div>
              <StatusBadge label={a.category} variant={a.variant} />
            </div>
          ))}
          {alerts.length === 0 && <p className="text-sm text-ink-muted py-2">No active alerts right now.</p>}
        </div>
      </Card>
    </div>
  );
}
