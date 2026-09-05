import { PageHeader, Card, KpiTile, StatusBadge } from "@/components/ui";
import { HorizontalBarChart } from "@/components/charts/HorizontalBarChart";
import { buildSentimentSummary } from "@/lib/engines/sentiment";
import ConciergeChat from "@/components/ConciergeChat";

export default function GuestExperiencePage() {
  const sentiment = buildSentimentSummary();

  const aspectData = sentiment.byAspect.map((a) => ({
    label: a.aspect,
    value: Math.round(a.avgScore * 100) / 100,
    color: a.avgScore < 0 ? "var(--series-8)" : "var(--series-1)",
  }));

  const decliningAspects = sentiment.byAspect.filter((a) => a.trendDelta < -0.1);

  return (
    <div>
      <PageHeader
        title="Guest Experience"
        description="Sentiment analysis across reviews plus a live AI concierge for handling guest requests."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile label="Overall Sentiment" value={sentiment.overallScore.toFixed(2)} deltaLabel="score, -1 to +1" />
        <KpiTile label="Avg Star Rating" value={`${sentiment.overallStars.toFixed(1)} / 5`} />
        <KpiTile label="Reviews Analyzed" value={`${sentiment.totalReviews}`} />
        <KpiTile label="Declining Aspects" value={`${decliningAspects.length}`} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Sentiment by Aspect" subtitle="Average score per topic, mined from guest reviews">
          <HorizontalBarChart data={aspectData} format="score" zeroLine />
          {decliningAspects.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {decliningAspects.map((a) => (
                <StatusBadge key={a.aspect} label={`${a.aspect} trending down`} variant="serious" />
              ))}
            </div>
          )}
        </Card>

        <Card title="Top Issues to Address" subtitle="Most negative recent guest comments, by aspect">
          <div className="flex flex-col divide-y divide-border-strong">
            {sentiment.topIssues.map((issue, i) => (
              <div key={i} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-2">
                  <StatusBadge label={issue.aspect} variant="serious" />
                  <span className="text-xs text-ink-muted">
                    {issue.source} · {issue.date}
                  </span>
                </div>
                <p className="mt-1 text-sm text-ink-secondary">&ldquo;{issue.quote}&rdquo;</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="AI Concierge" subtitle="Handles guest requests and recommends services based on preferences" className="mt-4">
        <ConciergeChat />
      </Card>
    </div>
  );
}
