"use client";

import { PageHeader, Card, KpiTile, StatusBadge, riskVariant } from "@/components/ui";
import { HorizontalBarChart } from "@/components/charts/HorizontalBarChart";
import { GroupedBarChart } from "@/components/charts/GroupedBarChart";
import { buildMaintenanceRisks } from "@/lib/engines/maintenance";
import { buildStaffingPlan } from "@/lib/engines/staffing";
import { buildInventoryStatus } from "@/lib/engines/inventory";
import { buildComplaintDiagnosticSummary } from "@/lib/engines/complaintDiagnostics";
import { useResortStore } from "@/lib/store/resortStore";

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

  const maintenanceChartData = maintenance.slice(0, 8).map((m) => ({
    label: m.equipment.name,
    value: m.riskScore,
    color: RISK_COLOR[m.riskLevel],
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
    color: URGENCY_COLOR[i.urgency],
  }));

  const isLiveActive = state.activeEvents.some((e) => e.type === "DEMAND_SURGE");
  const activeEquipmentFailure = state.activeEvents.find((e) => e.type === "EQUIPMENT_FAILURE");
  const hasEmergencyParts = inventory.some((i) => i.isEmergencyPart);
  const peakDeficit = Math.min(0, ...staffing.map((s) => s.gap));

  const criticalCount = maintenance.filter((m) => m.riskLevel === "Critical").length;
  const understaffedCount = staffing.filter((s) => s.status === "Understaffed").length;
  const reorderCount = inventory.filter((i) => i.reorderNeeded).length;

  const understaffedRows = staffing
    .filter((s) => s.status === "Understaffed")
    .sort((a, b) => a.gap - b.gap) // largest deficit first
    .slice(0, 10);

  return (
    <div>
      <PageHeader
        title="Operations"
        description="Predictive maintenance, staffing coverage, and inventory health across the resort."
      />

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
          delta={isLiveActive ? "Surge shift deficit" : "Standard schedule"}
          deltaGood={understaffedCount === 0}
        />
        <KpiTile
          label="Peak Staff Deficit"
          value={`${peakDeficit} staff`}
          delta={isLiveActive ? "Housekeeping / F&B strain" : "Coverage balanced"}
          deltaGood={peakDeficit >= 0}
        />
        <KpiTile
          label="Reorder Alerts"
          value={`${reorderCount} items`}
          delta={hasEmergencyParts ? "Emergency parts depleted" : isLiveActive ? "Accelerated consumption" : "Standard burn rate"}
          deltaGood={reorderCount === 0}
        />
        <KpiTile
          label="Critical Maintenance"
          value={`${criticalCount}`}
          delta={diagnostics.hasActiveComplaint ? "1 Work Order active" : undefined}
          deltaGood={criticalCount === 0 && !diagnostics.hasActiveComplaint}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Predictive Maintenance Risk" subtitle="Top equipment by failure risk score (0-100)">
          <HorizontalBarChart data={maintenanceChartData} />
        </Card>
        <Card title="Staffing: Required vs Scheduled" subtitle="Average daily headcount over the next 10 days">
          <GroupedBarChart
            data={staffingByDept}
            series={[
              { key: "required", label: "Required", color: "var(--series-1)" },
              { key: "scheduled", label: "Scheduled", color: "var(--series-4)" },
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
