"use client";

import { PageHeader, Card, KpiTile, StatusBadge, riskVariant } from "@/components/ui";
import { HorizontalBarChart } from "@/components/charts/HorizontalBarChart";
import { GroupedBarChart } from "@/components/charts/GroupedBarChart";
import { buildMaintenanceRisks } from "@/lib/engines/maintenance";
import { buildStaffingPlan } from "@/lib/engines/staffing";
import { buildInventoryStatus } from "@/lib/engines/inventory";
import { buildComplaintDiagnosticSummary } from "@/lib/engines/complaintDiagnostics";
import { useResortStore } from "@/lib/store/resortStore";
import ScenarioSwitcher from "@/components/ScenarioSwitcher";

const RISK_COLOR: Record<string, string> = {
  Critical: "var(--status-critical)",
  High: "var(--status-serious)",
  Medium: "var(--status-warning)",
  Low: "var(--status-good)",
};

const URGENCY_COLOR: Record<string, string> = {
  Critical: "var(--status-critical)",
  "Reorder Soon": "var(--status-warning)",
  Healthy: "var(--status-good)",
};

export default function OperationsPage() {
  const { state } = useResortStore();

  const maintenance = buildMaintenanceRisks(state);
  const staffing = buildStaffingPlan(state);
  const inventory = buildInventoryStatus(state);
  const diagnostics = buildComplaintDiagnosticSummary(state);

  const activeDemandEvent = state.activeEvents.find((e) => e.type === "DEMAND_SURGE");
  const demandReason = ((activeDemandEvent?.label ?? "") + " " + (activeDemandEvent?.details?.reason ?? "")).toLowerCase();
  const isWedding = Boolean(activeDemandEvent && (demandReason.includes("wedding") || demandReason.includes("buyout")));
  const isSlump = Boolean(activeDemandEvent && (((activeDemandEvent.details?.demandBoost as number | undefined) ?? 0) < 0 || demandReason.includes("monsoon") || demandReason.includes("storm")));
  const isFestivalSurge = Boolean(activeDemandEvent && !isWedding && !isSlump);

  const activeEquipmentFailure = state.activeEvents.find((e) => e.type === "EQUIPMENT_FAILURE");
  const isWingBlackout = Boolean(activeEquipmentFailure && (activeEquipmentFailure.details?.equipmentId === "eq-11" || Number(activeEquipmentFailure.details?.affectedRoomCount ?? 0) > 20));
  const isNormal = state.activeEvents.length === 0;
  const isLiveActive = isFestivalSurge || isWedding;

  const maintenanceChartData = maintenance.slice(0, 8).map((m) => ({
    label: m.equipment.name,
    value: m.riskScore,
    color: m.riskScore >= 75 ? "#ef4444" : m.riskScore >= 55 ? "#f97316" : m.riskScore >= 35 ? "#06b6d4" : "#10b981",
  }));

  const staffingByDept = state.departments.map((dept) => {
    const rows = staffing.filter((s) => s.departmentId === dept.id);
    const requiredAvg = Math.round(rows.reduce((s, r) => s + r.requiredStaff, 0) / (rows.length || 1));
    const scheduledAvg = Math.round(rows.reduce((s, r) => s + r.scheduledStaff, 0) / (rows.length || 1));
    return { x: dept.name, required: requiredAvg, scheduled: scheduledAvg };
  });

  const inventoryChartData = inventory.slice(0, 8).map((i) => ({
    label: i.item.name,
    value: Math.round(i.daysOfStockLeft * 10) / 10,
    color: i.daysOfStockLeft < 3 ? "#ef4444" : i.daysOfStockLeft < 8 ? "#f59e0b" : "#10b981",
  }));

  const hasEmergencyParts = inventory.some((i) => i.isEmergencyPart);
  const peakDeficit = Math.min(0, ...staffing.map((s) => s.gap));

  const criticalCount = maintenance.filter((m) => m.riskLevel === "Critical").length;
  const understaffedCount = staffing.filter((s) => s.status === "Understaffed").length;
  const reorderCount = inventory.filter((i) => i.reorderNeeded).length;

  const understaffedRows = staffing
    .filter((s) => s.status === "Understaffed")
    .sort((a, b) => a.gap - b.gap)
    .slice(0, 10);

  return (
    <div>
      <PageHeader
        title="Operations & Maintenance"
        description="Predictive maintenance telemetry, shift staffing coverage, and real-time inventory burn rate across the resort."
      />

      <ScenarioSwitcher />

      {/* Scenario State Indicator Banner */}
      {isNormal ? (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent px-4 py-3 text-xs text-emerald-300 shadow-sm">
          <div className="flex items-center gap-2 font-medium">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
            <span className="font-semibold tracking-wide uppercase text-emerald-400">Normal Stage Active:</span>
            <span>Balanced staffing schedule (0 deficit shifts) · Routine maintenance within limits · Standard inventory stock buffer</span>
          </div>
          <span className="hidden sm:inline-block rounded bg-emerald-500/20 px-2.5 py-0.5 font-bold text-emerald-300 border border-emerald-500/30">
            OPTIMAL SCHEDULE
          </span>
        </div>
      ) : isFestivalSurge ? (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-orange-500/60 bg-gradient-to-r from-amber-500/25 via-orange-500/20 to-rose-500/20 px-4 py-3 text-xs text-amber-200 shadow-[0_0_30px_rgba(245,158,11,0.25)] ring-1 ring-orange-500/40 animate-pulse">
          <div className="flex items-center gap-2 font-medium">
            <span className="text-base">🔥</span>
            <span className="font-extrabold tracking-wide uppercase text-amber-300">EXTREME LABOR STRAIN (FESTIVAL):</span>
            <span>Housekeeping & F&B running at severe capacity deficit ({understaffedCount} shifts understaffed · Peak deficit: {peakDeficit} staff). Perishables burn accelerated!</span>
          </div>
          <span className="hidden sm:inline-block rounded bg-gradient-to-r from-amber-500 to-orange-600 px-2.5 py-1 font-extrabold text-white shadow-md">
            CRITICAL SHORTAGE
          </span>
        </div>
      ) : isWedding ? (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-yellow-400/60 bg-gradient-to-r from-yellow-500/25 via-amber-500/20 to-yellow-600/20 px-4 py-3 text-xs text-yellow-200 shadow-[0_0_30px_rgba(234,179,8,0.25)] ring-1 ring-yellow-400/40 animate-pulse">
          <div className="flex items-center gap-2 font-medium">
            <span className="text-base">👑</span>
            <span className="font-extrabold tracking-wide uppercase text-yellow-300">VIP BANQUET STAGING (WEDDING BUYOUT):</span>
            <span>Dedicated butler & banquet coverage mobilized (+8 staff required for F&B). Luxury amenity consumption active.</span>
          </div>
          <span className="hidden sm:inline-block rounded bg-gradient-to-r from-yellow-500 to-amber-600 px-2.5 py-1 font-extrabold text-white shadow-md">
            VIP MOBILIZATION
          </span>
        </div>
      ) : isSlump ? (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-indigo-500/60 bg-gradient-to-r from-indigo-600/25 via-blue-600/20 to-slate-700/20 px-4 py-3 text-xs text-indigo-200 shadow-[0_0_30px_rgba(99,102,241,0.25)] ring-1 ring-indigo-500/40">
          <div className="flex items-center gap-2 font-medium">
            <span className="text-base">🌧️</span>
            <span className="font-extrabold tracking-wide uppercase text-indigo-300">OFF-SEASON LABOR REASSIGNMENT (SLUMP):</span>
            <span>16+ surplus labor shifts identified. Operational recommendation: reassign idle housekeeping & F&B teams to deep property maintenance!</span>
          </div>
          <span className="hidden sm:inline-block rounded bg-indigo-500/30 px-2.5 py-1 font-extrabold text-indigo-200 border border-indigo-400 shadow-sm">
            LABOR SURPLUS
          </span>
        </div>
      ) : isWingBlackout ? (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-red-500 bg-gradient-to-r from-red-600/30 via-rose-600/25 to-red-900/30 px-4 py-3 text-xs text-red-200 shadow-[0_0_35px_rgba(239,68,68,0.35)] ring-1 ring-red-500/50 animate-pulse">
          <div className="flex items-center gap-2 font-medium">
            <span className="text-base">🚨</span>
            <span className="font-extrabold tracking-wide uppercase text-red-300">SUBSTATION POWER FAILURE DISASTER:</span>
            <span>Main electrical substation failure (Risk 98) &bull; 32 backup breaker sets depleted &bull; Emergency maintenance crew deployed on overtime!</span>
          </div>
          <span className="hidden sm:inline-block rounded bg-red-600 px-2.5 py-1 font-extrabold text-white shadow-md">
            EMERGENCY WORK ORDER
          </span>
        </div>
      ) : null}

      {activeEquipmentFailure && hasEmergencyParts && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          <div className="flex items-center gap-2.5">
            <span className="text-base">⚠️</span>
            <span>
              <strong className="font-semibold text-rose-200">Critical Maintenance Stock Alert:</strong>{" "}
              {((activeEquipmentFailure.details?.equipmentName as string) ?? "Equipment")} emergency repair depleted spare parts. Accelerated burn rate active; urgent replenishment required.
            </span>
          </div>
          <span className="rounded bg-rose-500/20 px-2 py-0.5 text-xs font-semibold text-rose-300">
            Urgent Reorder
          </span>
        </div>
      )}

      {diagnostics.hasActiveComplaint && (
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-ink backdrop-blur-sm shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="text-base">🚨</span>
            <div>
              <div className="flex items-center gap-2">
                <strong className="font-bold text-amber-300">AFFECTED AREA FLAGGED: {diagnostics.affectedArea.name}</strong>
                <span className="rounded bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300 border border-rose-500/30">
                  {diagnostics.affectedArea.status}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-ink-secondary">
                Correlated to guest complaint ({diagnostics.complaint?.guestName}): Emergency Work Order <strong className="text-ink">{diagnostics.maintenanceAlert.workOrderNumber}</strong> dispatched to {diagnostics.maintenanceAlert.assignedTeam} (ETA: {diagnostics.maintenanceAlert.etaHours}h).
              </p>
            </div>
          </div>
          <span className="rounded bg-amber-500/20 px-2.5 py-1 text-xs font-bold text-amber-300 border border-amber-500/30 shrink-0">
            {diagnostics.affectedArea.impactedBookingsCount} Sessions Paused
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile
          label="Understaffed Shifts"
          value={`${understaffedCount}`}
          delta={
            isFestivalSurge
              ? "🔥 Critical shift deficit"
              : isWedding
              ? "👑 Banquet shift draw"
              : isSlump
              ? "🌧️ 16 Overstaffed shifts"
              : "Balanced schedule"
          }
          deltaGood={understaffedCount === 0}
          className={
            isFestivalSurge
              ? "border-rose-500/60 bg-rose-500/15"
              : isWedding
              ? "border-yellow-400/50 bg-yellow-500/10"
              : isSlump
              ? "border-indigo-500/50 bg-indigo-500/10"
              : "border-emerald-500/30 bg-emerald-500/[0.02]"
          }
          valueClassName={
            isFestivalSurge
              ? "text-rose-400 font-extrabold text-3xl"
              : isWedding
              ? "text-yellow-300 font-extrabold text-3xl"
              : isSlump
              ? "text-indigo-300 font-extrabold text-3xl"
              : "text-emerald-400 font-semibold text-3xl"
          }
        />
        <KpiTile
          label="Peak Staff Deficit"
          value={`${peakDeficit} staff`}
          delta={
            isFestivalSurge
              ? "🔥 Severe F&B/HK deficit"
              : isWedding
              ? "👑 VIP catering gap"
              : isSlump
              ? "🌧️ +18 surplus labor"
              : "Coverage balanced"
          }
          deltaGood={peakDeficit >= 0}
          className={
            isFestivalSurge
              ? "border-rose-500/60 bg-rose-500/15"
              : isWedding
              ? "border-yellow-400/50 bg-yellow-500/10"
              : isSlump
              ? "border-indigo-500/50 bg-indigo-500/10"
              : "border-emerald-500/30 bg-emerald-500/[0.02]"
          }
          valueClassName={
            isFestivalSurge
              ? "text-rose-400 font-extrabold text-3xl"
              : isWedding
              ? "text-yellow-300 font-extrabold text-3xl"
              : isSlump
              ? "text-indigo-300 font-extrabold text-3xl"
              : "text-emerald-400 font-semibold text-3xl"
          }
        />
        <KpiTile
          label="Reorder Alerts"
          value={`${reorderCount} items`}
          delta={
            isWingBlackout
              ? "🚨 Breakers & fuel depleted"
              : hasEmergencyParts
              ? "Emergency parts depleted"
              : isFestivalSurge
              ? "🔥 Fast perishables burn"
              : isSlump
              ? "🌧️ Stable buffer"
              : "Standard burn rate"
          }
          deltaGood={reorderCount <= 2}
          className={
            isWingBlackout
              ? "border-red-500/60 bg-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.25)]"
              : isFestivalSurge
              ? "border-orange-500/50 bg-orange-500/10"
              : "border-emerald-500/30 bg-emerald-500/[0.02]"
          }
          valueClassName={
            isWingBlackout
              ? "text-red-400 font-extrabold text-3xl"
              : isFestivalSurge
              ? "text-orange-400 font-extrabold text-3xl"
              : "text-emerald-400 font-semibold text-3xl"
          }
        />
        <KpiTile
          label="Critical Maintenance"
          value={`${criticalCount}`}
          delta={
            isWingBlackout
              ? "🚨 Substation generator (Risk 98)"
              : activeEquipmentFailure
              ? "Critical breakdown"
              : diagnostics.hasActiveComplaint
              ? "1 Work Order active"
              : "0 critical risks"
          }
          deltaGood={criticalCount === 0 && !diagnostics.hasActiveComplaint}
          className={
            isWingBlackout || activeEquipmentFailure
              ? "border-red-500/60 bg-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.25)]"
              : "border-emerald-500/30 bg-emerald-500/[0.02]"
          }
          valueClassName={
            isWingBlackout || activeEquipmentFailure
              ? "text-red-400 font-extrabold text-3xl"
              : "text-emerald-400 font-semibold text-3xl"
          }
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card
          title="Predictive Maintenance Risk"
          subtitle={
            isWingBlackout
              ? "🚨 SUBSTATION EMERGENCY: Main Generator sensor anomaly spiked to Risk 98"
              : activeEquipmentFailure
              ? "⚠ CHILLER FAILURE: Chiller Unit 2 compressor anomaly score at Risk 95"
              : "Top equipment by failure risk score (0-100)"
          }
          className={isWingBlackout || activeEquipmentFailure ? "border-red-500/40" : undefined}
        >
          <HorizontalBarChart data={maintenanceChartData} />
        </Card>
        <Card
          title="Staffing: Required vs Scheduled"
          subtitle={
            isFestivalSurge
              ? "🔥 MASSIVE DEFICIT: Housekeeping & F&B required headcount far exceeds scheduled"
              : isWedding
              ? "👑 VIP BANQUET SURPLUS NEED: Food & Beverage requires additional shifts"
              : isSlump
              ? "🌧️ OVERSTAFFED: Scheduled staff exceeds requirements due to low occupancy"
              : "Average daily headcount over the next 10 days (Balanced schedule)"
          }
          className={
            isFestivalSurge
              ? "border-orange-500/40"
              : isWedding
              ? "border-yellow-400/40"
              : isSlump
              ? "border-indigo-500/40"
              : undefined
          }
        >
          <GroupedBarChart
            data={staffingByDept}
            series={[
              {
                key: "required",
                label: "Required Staff",
                color: isFestivalSurge
                  ? "#ea580c"
                  : isWedding
                  ? "#eab308"
                  : isSlump
                  ? "#6366f1"
                  : "#10b981",
              },
              { key: "scheduled", label: "Scheduled Staff", color: "#3b82f6" },
            ]}
          />
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Equipment Maintenance Detail" subtitle="Sorted by risk, highest first">
          <div className="flex flex-col divide-y divide-border-strong max-h-80 overflow-y-auto">
            {diagnostics.hasActiveComplaint && (
              <div className="py-2.5 first:pt-0 bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-lg mb-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-amber-200">{diagnostics.maintenanceAlert.title}</p>
                    <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-300">
                      ⚡ Root Cause Correlated
                    </span>
                  </div>
                  <StatusBadge label={diagnostics.maintenanceAlert.priority} variant="critical" />
                </div>
                <p className="mt-0.5 text-xs text-amber-300 font-medium">
                  {diagnostics.maintenanceAlert.workOrderNumber} &bull; {diagnostics.maintenanceAlert.assignedTeam} &bull; ETA {diagnostics.maintenanceAlert.etaHours} hours
                </p>
                <p className="mt-1 text-xs text-ink-secondary">{diagnostics.maintenanceAlert.actionPlan}</p>
              </div>
            )}
            {maintenance.map((m) => (
              <div key={m.equipment.id} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{m.equipment.name}</p>
                  <StatusBadge label={m.riskLevel} variant={riskVariant(m.riskLevel)} />
                </div>
                <p className="mt-0.5 text-xs text-ink-muted">{m.equipment.location} · {m.equipment.category}</p>
                <p className="mt-1 text-xs text-ink-secondary">{m.recommendation}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Staffing Gaps" subtitle="Days/departments where scheduled staff falls short of forecasted need">
          <div className="flex flex-col divide-y divide-border-strong max-h-80 overflow-y-auto">
            {understaffedRows.length === 0 && <p className="text-sm text-ink-muted py-2">No understaffed shifts detected.</p>}
            {understaffedRows.map((s, i) => {
              const isSurgeDate = s.date === "2026-09-07" || s.date === "2026-09-08";
              return (
                <div key={i} className={`flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0 ${isSurgeDate ? "bg-rose-500/5 px-2 rounded-lg" : ""}`}>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium">{s.departmentName}</p>
                      {isSurgeDate && isLiveActive && (
                        <span className="rounded bg-rose-500/20 px-1.5 py-0.2 text-[10px] font-semibold text-rose-300">
                          ⚡ Surge Shift
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ink-muted">{s.date} · needs {s.requiredStaff}, scheduled {s.scheduledStaff}</p>
                  </div>
                  <StatusBadge label={`${s.gap} gap`} variant="critical" />
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card title="Inventory Health" subtitle="Days of stock remaining vs lead time, sorted by urgency" className="mt-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <HorizontalBarChart data={inventoryChartData} format="days" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-strong text-left text-xs text-ink-muted">
                  <th className="py-2 pr-3 font-medium">Item</th>
                  <th className="py-2 pr-3 font-medium">Stock</th>
                  <th className="py-2 pr-3 font-medium">Days Left</th>
                  <th className="py-2 pr-3 font-medium">Reorder Qty</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map((i) => (
                  <tr key={i.item.id} className={`border-b border-border-strong/60 last:border-0 ${i.isEmergencyPart ? "bg-rose-500/5" : ""}`}>
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-1.5">
                        <span>{i.item.name}</span>
                        {i.isEmergencyPart && (
                          <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300">
                            ⚡ Emergency Repair
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-ink-secondary">
                      {i.item.currentStock} {i.item.unit}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">{i.daysOfStockLeft.toFixed(1)}</td>
                    <td className="py-2 pr-3 tabular-nums">{i.recommendedOrderQty > 0 ? `${i.recommendedOrderQty} ${i.item.unit}` : "-"}</td>
                    <td className="py-2">
                      <StatusBadge
                        label={i.urgency}
                        variant={i.urgency === "Critical" ? "critical" : i.urgency === "Reorder Soon" ? "warning" : "good"}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
}
