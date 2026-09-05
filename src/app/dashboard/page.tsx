import { PageHeader, Card, KpiTile, StatusBadge, riskVariant } from "@/components/ui";
import { LineTrendChart } from "@/components/charts/LineTrendChart";
import { buildPricingRecommendations } from "@/lib/engines/pricing";
import { buildSentimentSummary } from "@/lib/engines/sentiment";
import { buildMaintenanceRisks } from "@/lib/engines/maintenance";
import { buildStaffingPlan } from "@/lib/engines/staffing";
import { buildInventoryStatus } from "@/lib/engines/inventory";
import { generateOccupancyHistory } from "@/lib/data/bookings";
import { AlertTriangle, MessageSquareWarning, PackageX, Users, Zap, ArrowRight } from "lucide-react";
import Link from "next/link";

function buildOccupancyTrend() {
  const history = generateOccupancyHistory();
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

export default function OverviewPage() {
  const pricing = buildPricingRecommendations();
  const sentiment = buildSentimentSummary();
  const maintenance = buildMaintenanceRisks();
  const staffing = buildStaffingPlan();
  const inventory = buildInventoryStatus();
  const occupancyTrend = buildOccupancyTrend();

  const criticalMaintenance = maintenance.filter((m) => m.riskLevel === "Critical" || m.riskLevel === "High");
  const understaffedDays = staffing.filter((s) => s.status === "Understaffed");
  const reorderAlerts = inventory.filter((i) => i.reorderNeeded);

  const sentimentTrendData = sentiment.weekly.map((w) => ({ x: w.weekStart.slice(5), score: w.avgScore }));

  const alerts = [
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
    ...reorderAlerts.slice(0, 2).map((i) => ({
      icon: <PackageX className="h-4 w-4" />,
      category: "Inventory",
      variant: i.urgency === "Critical" ? ("critical" as const) : ("warning" as const),
      text: `${i.item.name}: ${Math.round(i.daysOfStockLeft)} days of stock left - reorder ${i.recommendedOrderQty} ${i.item.unit}.`,
    })),
    ...sentiment.topIssues.slice(0, 2).map((s) => ({
      icon: <MessageSquareWarning className="h-4 w-4" />,
      category: "Guest Experience",
      variant: "serious" as const,
      text: `Recurring "${s.aspect}" complaints: "${s.quote}"`,
    })),
  ];

  return (
    <div>
      <PageHeader
        title="Resort Overview"
        description="Real-time snapshot across occupancy, revenue, guest sentiment, and operations."
      />

      <Link
        href="/dashboard/simulator"
        className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-series-1/30 bg-series-1/5 px-4 py-3 transition-colors hover:bg-series-1/10"
      >
        <span className="flex items-center gap-2.5 text-sm">
          <Zap className="h-4 w-4 shrink-0 text-series-1" strokeWidth={2} />
          <span>
            <span className="font-semibold text-ink">Try the Scenario Simulator</span>
            <span className="text-ink-secondary"> - trigger a disruption and watch every engine react live.</span>
          </span>
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-series-1" strokeWidth={2} />
      </Link>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <KpiTile label="Current Occupancy" value={`${Math.round(pricing.currentOccupancy * 100)}%`} />
        <KpiTile label="Trailing ADR" value={`$${pricing.trailingAdr}`} />
        <KpiTile label="Trailing RevPAR" value={`$${pricing.trailingRevPar}`} />
        <KpiTile
          label="Projected Revenue Lift"
          value={`${pricing.projectedRevenueLift > 0 ? "+" : ""}${pricing.projectedRevenueLift}%`}
          delta={pricing.projectedRevenueLift >= 0 ? "vs flat pricing" : undefined}
          deltaGood={pricing.projectedRevenueLift >= 0}
        />
        <KpiTile label="Guest Sentiment" value={`${sentiment.overallStars.toFixed(1)} / 5`} />
        <KpiTile
          label="Open Ops Alerts"
          value={`${criticalMaintenance.length + understaffedDays.length + reorderAlerts.length}`}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Occupancy Trend" subtitle="Resort-wide occupancy, last 30 days">
          <LineTrendChart
            data={occupancyTrend}
            series={[{ key: "occupancy", label: "Occupancy %", color: "var(--series-1)" }]}
            format="percent"
          />
        </Card>
        <Card title="Guest Sentiment Trend" subtitle="Weekly average sentiment score across all reviews">
          <LineTrendChart
            data={sentimentTrendData}
            series={[{ key: "score", label: "Sentiment score", color: "var(--series-3)" }]}
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
