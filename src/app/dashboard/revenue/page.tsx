import { PageHeader, Card, KpiTile, StatusBadge } from "@/components/ui";
import { LineTrendChart } from "@/components/charts/LineTrendChart";
import { buildPricingRecommendations } from "@/lib/engines/pricing";
import { ROOM_TYPES, DEMAND_EVENTS } from "@/lib/data/rooms";
import { generateDemandForecast } from "@/lib/data/bookings";

function buildDemandTrend() {
  const forecast = generateDemandForecast();
  const totalRooms = ROOM_TYPES.reduce((s, r) => s + r.count, 0);
  const byDate = new Map<string, number>();
  for (const f of forecast) {
    byDate.set(f.date, (byDate.get(f.date) ?? 0) + f.bookedRooms);
  }
  return Array.from(byDate.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, booked]) => ({ x: date.slice(5), occupancy: Math.round((booked / totalRooms) * 1000) / 10 }));
}

export default function RevenuePage() {
  const pricing = buildPricingRecommendations();
  const demandTrend = buildDemandTrend();

  const roomSummaries = ROOM_TYPES.map((room) => {
    const next7 = pricing.recommendations.filter((r) => r.roomTypeId === room.id && r.leadDays < 7);
    const avgRecommended = Math.round(next7.reduce((s, r) => s + r.recommendedRate, 0) / next7.length);
    const avgChange = next7.reduce((s, r) => s + r.changePercent, 0) / next7.length;
    return { room, avgRecommended, avgChange };
  });

  const tableRows = pricing.recommendations
    .filter((r) => r.leadDays < 7)
    .sort((a, b) => (a.date === b.date ? a.roomTypeName.localeCompare(b.roomTypeName) : a.date < b.date ? -1 : 1));

  return (
    <div>
      <PageHeader
        title="Revenue & Dynamic Pricing"
        description="Demand-driven rate recommendations by room type, updated for occupancy, seasonality, lead time, and local events."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile label="Current Occupancy" value={`${Math.round(pricing.currentOccupancy * 100)}%`} />
        <KpiTile label="Trailing 30d ADR" value={`$${pricing.trailingAdr}`} />
        <KpiTile label="Trailing 30d RevPAR" value={`$${pricing.trailingRevPar}`} />
        <KpiTile
          label="Revenue Lift vs Flat Rate"
          value={`${pricing.projectedRevenueLift > 0 ? "+" : ""}${pricing.projectedRevenueLift}%`}
          deltaGood={pricing.projectedRevenueLift >= 0}
        />
      </div>

      <Card title="Forecasted Demand (Next 21 Days)" subtitle="Resort-wide booked occupancy, on-the-books pace" className="mt-4">
        <LineTrendChart
          data={demandTrend}
          series={[{ key: "occupancy", label: "Booked occupancy %", color: "var(--series-1)" }]}
          format="percent"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {DEMAND_EVENTS.map((e) => (
            <StatusBadge key={e.date + e.label} label={`${e.date.slice(5)} · ${e.label}`} variant="neutral" />
          ))}
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {roomSummaries.map(({ room, avgRecommended, avgChange }) => (
          <Card key={room.id}>
            <p className="text-xs font-medium text-ink-muted">{room.name}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">${avgRecommended}</p>
            <p className="text-xs text-ink-muted">base ${room.baseRate}</p>
            <p className={`mt-1 text-xs font-medium ${avgChange >= 0 ? "text-status-good" : "text-status-critical"}`}>
              {avgChange >= 0 ? "+" : ""}
              {avgChange.toFixed(1)}% avg (next 7d)
            </p>
          </Card>
        ))}
      </div>

      <Card title="Pricing Recommendations - Next 7 Days" subtitle="Per room type, per night" className="mt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-strong text-left text-xs text-ink-muted">
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 pr-3 font-medium">Room Type</th>
                <th className="py-2 pr-3 font-medium">Forecast Occ.</th>
                <th className="py-2 pr-3 font-medium">Base Rate</th>
                <th className="py-2 pr-3 font-medium">Recommended</th>
                <th className="py-2 pr-3 font-medium">Change</th>
                <th className="py-2 font-medium">Rationale</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r) => (
                <tr key={`${r.date}-${r.roomTypeId}`} className="border-b border-border-strong/60 last:border-0">
                  <td className="py-2 pr-3 tabular-nums text-ink-secondary">{r.date}</td>
                  <td className="py-2 pr-3">{r.roomTypeName}</td>
                  <td className="py-2 pr-3 tabular-nums">{Math.round(r.forecastOccupancyRate * 100)}%</td>
                  <td className="py-2 pr-3 tabular-nums text-ink-muted">${r.baseRate}</td>
                  <td className="py-2 pr-3 tabular-nums font-medium">${r.recommendedRate}</td>
                  <td className={`py-2 pr-3 tabular-nums font-medium ${r.changePercent >= 0 ? "text-status-good" : "text-status-critical"}`}>
                    {r.changePercent >= 0 ? "+" : ""}
                    {r.changePercent.toFixed(0)}%
                  </td>
                  <td className="py-2 text-xs text-ink-secondary">{r.rationale.join("; ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
