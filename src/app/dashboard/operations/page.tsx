import { PageHeader, Card, KpiTile, StatusBadge, riskVariant } from "@/components/ui";
import { HorizontalBarChart } from "@/components/charts/HorizontalBarChart";
import { GroupedBarChart } from "@/components/charts/GroupedBarChart";
import { buildMaintenanceRisks } from "@/lib/engines/maintenance";
import { buildStaffingPlan } from "@/lib/engines/staffing";
import { buildInventoryStatus } from "@/lib/engines/inventory";
import { DEPARTMENTS } from "@/lib/data/staff";

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
  const maintenance = buildMaintenanceRisks();
  const staffing = buildStaffingPlan();
  const inventory = buildInventoryStatus();

  const maintenanceChartData = maintenance.slice(0, 8).map((m) => ({
    label: m.equipment.name,
    value: m.riskScore,
    color: RISK_COLOR[m.riskLevel],
  }));

  const staffingByDept = DEPARTMENTS.map((dept) => {
    const rows = staffing.filter((s) => s.departmentId === dept.id);
    const requiredAvg = Math.round(rows.reduce((s, r) => s + r.requiredStaff, 0) / rows.length);
    const scheduledAvg = Math.round(rows.reduce((s, r) => s + r.scheduledStaff, 0) / rows.length);
    return { x: dept.name, required: requiredAvg, scheduled: scheduledAvg };
  });

  const understaffedRows = staffing.filter((s) => s.status === "Understaffed").slice(0, 8);

  const inventoryChartData = inventory.slice(0, 8).map((i) => ({
    label: i.item.name,
    value: Math.round(i.daysOfStockLeft * 10) / 10,
    color: URGENCY_COLOR[i.urgency],
  }));

  const criticalCount = maintenance.filter((m) => m.riskLevel === "Critical").length;
  const understaffedCount = staffing.filter((s) => s.status === "Understaffed").length;
  const reorderCount = inventory.filter((i) => i.reorderNeeded).length;

  return (
    <div>
      <PageHeader
        title="Operations"
        description="Predictive maintenance, staffing coverage, and inventory health across the resort."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile label="Critical Maintenance" value={`${criticalCount}`} />
        <KpiTile label="Understaffed Shifts" value={`${understaffedCount}`} />
        <KpiTile label="Reorder Alerts" value={`${reorderCount}`} />
        <KpiTile label="Equipment Tracked" value={`${maintenance.length}`} />
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
            {understaffedRows.map((s, i) => (
              <div key={i} className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium">{s.departmentName}</p>
                  <p className="text-xs text-ink-muted">{s.date} · needs {s.requiredStaff}, scheduled {s.scheduledStaff}</p>
                </div>
                <StatusBadge label={`${s.gap} gap`} variant="warning" />
              </div>
            ))}
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
                  <tr key={i.item.id} className="border-b border-border-strong/60 last:border-0">
                    <td className="py-2 pr-3">{i.item.name}</td>
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
