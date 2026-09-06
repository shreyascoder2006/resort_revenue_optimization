"use client";

import { PageHeader, Card, KpiTile, StatusBadge } from "@/components/ui";
import { HorizontalBarChart } from "@/components/charts/HorizontalBarChart";
import { buildSentimentSummary } from "@/lib/engines/sentiment";
import { buildGuestImpactSummary } from "@/lib/engines/guestImpact";
import { buildComplaintDiagnosticSummary } from "@/lib/engines/complaintDiagnostics";
import { useResortStore } from "@/lib/store/resortStore";
import ConciergeChat from "@/components/ConciergeChat";
import { AlertTriangle, Users, BedDouble, ArrowRightLeft, ShieldAlert, Sparkles, Wrench, CheckCircle2 } from "lucide-react";

export default function GuestExperiencePage() {
  const { state } = useResortStore();
  const sentiment = buildSentimentSummary(state);
  const guestImpact = buildGuestImpactSummary(state);
  const diagnostics = buildComplaintDiagnosticSummary(state);

  const aspectData = sentiment.byAspect.map((a) => {
    const isComplaintAspect = diagnostics.hasActiveComplaint && a.aspect === diagnostics.complaint?.aspect;
    const value = isComplaintAspect ? diagnostics.sentimentPlunge.impactedScore : Math.round(a.avgScore * 100) / 100;
    return {
      label: a.aspect,
      value,
      color: value < 0 ? "var(--series-8)" : "var(--series-1)",
    };
  });

  const decliningAspects = sentiment.byAspect.filter((a) => a.trendDelta < -0.1);

  return (
    <div>
      <PageHeader
        title="Guest Experience"
        description="Sentiment analysis across reviews, live guest relocation tracking, and AI concierge service."
      />

      {guestImpact.serviceRiskDetail && (
        <div
          className={`mb-4 rounded-xl border p-4 text-sm backdrop-blur-sm ${
            guestImpact.hasEquipmentFailure
              ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
              : "border-amber-500/40 bg-amber-500/10 text-ink"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div
              className={`flex items-center gap-2 font-semibold ${
                guestImpact.hasEquipmentFailure ? "text-rose-300" : "text-amber-400"
              }`}
            >
              <AlertTriangle className="h-4 w-4" />
              <span>
                {guestImpact.hasEquipmentFailure
                  ? `Equipment Outage Disruption (${guestImpact.serviceRiskLevel} Risk)`
                  : `Service Capacity Alert (${guestImpact.serviceRiskLevel} Risk)`}
              </span>
            </div>
            {guestImpact.hasEquipmentFailure && (
              <span className="rounded bg-rose-500/20 px-2 py-0.5 text-xs font-semibold text-rose-300">
                Climate Control Outage
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-ink-secondary">{guestImpact.serviceRiskDetail}</p>
        </div>
      )}

      {/* EQUIPMENT IMPACT CARD */}
      {guestImpact.hasEquipmentFailure && (
        <Card
          title="EQUIPMENT IMPACT"
          subtitle="Real-time guest disruption and room relocation status derived from active equipment failure"
          className="mb-4 border-rose-500/40 bg-rose-500/5 shadow-md"
        >
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3">
                <p className="text-xs text-rose-300/80 font-medium">Failure Incident</p>
                <div className="mt-1 flex items-center gap-1.5 font-bold text-rose-200">
                  <span className="h-2 w-2 rounded-full bg-rose-400 animate-ping" />
                  <span>🔴 {guestImpact.equipmentName ?? "Chiller Unit 2"} Failure</span>
                </div>
                <p className="mt-0.5 text-xs text-rose-300/70 font-medium">{guestImpact.affectedRoomCount} rooms affected</p>
              </div>

              <div className="rounded-xl border border-border bg-surface-2 p-3">
                <p className="text-xs text-ink-muted font-medium">Affected Guests</p>
                <p className="mt-1 text-2xl font-bold text-ink">{guestImpact.totalAffectedGuests}</p>
                <p className="mt-0.5 text-xs text-ink-muted">{guestImpact.affectedCurrentCount} in-house · {guestImpact.affectedArrivingCount} arriving</p>
              </div>

              <div className="rounded-xl border border-border bg-surface-2 p-3">
                <p className="text-xs text-ink-muted font-medium">Arriving Guests</p>
                <p className="mt-1 text-2xl font-bold text-amber-400">{guestImpact.affectedArrivingCount}</p>
                <p className="mt-0.5 text-xs text-ink-muted">Pre-arrival reassignment</p>
              </div>

              <div className="rounded-xl border border-border bg-surface-2 p-3">
                <p className="text-xs text-ink-muted font-medium">Service Risk</p>
                <p className="mt-1 text-2xl font-bold text-rose-400">{guestImpact.serviceRiskLevel.toUpperCase()}</p>
                <p className="mt-0.5 text-xs text-ink-muted">Elevated guest impact</p>
              </div>

              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3">
                <p className="text-xs text-rose-300/80 font-medium">Relocation Required</p>
                <p className="mt-1 text-2xl font-bold text-rose-300">
                  {guestImpact.relocationRequired ? "YES" : "NO"}
                </p>
                <p className="mt-0.5 text-xs text-rose-300/70">
                  {guestImpact.affectedCurrentCount + guestImpact.affectedArrivingCount} transfers queued
                </p>
              </div>
            </div>

            {/* Detailed affected guest relocation table */}
            {guestImpact.affectedGuests.length > 0 && (
              <div className="mt-1 overflow-x-auto">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ArrowRightLeft className="h-4 w-4 text-rose-400" />
                    <span className="text-xs font-semibold text-rose-200">Active Guest Relocation Roster</span>
                  </div>
                  <span className="text-xs text-ink-muted">
                    {guestImpact.availableAlternativeRooms} alternative rooms available across resort
                  </span>
                </div>
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border-strong text-ink-muted font-medium">
                      <th className="pb-2 pr-3">Guest Name</th>
                      <th className="pb-2 pr-3">Disrupted Room</th>
                      <th className="pb-2 pr-3">Loyalty Tier</th>
                      <th className="pb-2 pr-3">Arrival Status</th>
                      <th className="pb-2 pr-3">Priority Urgency</th>
                      <th className="pb-2">Suggested Reassignment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {guestImpact.affectedGuests.map((ag) => (
                      <tr key={ag.guest.id} className="hover:bg-surface-2/60 transition-colors">
                        <td className="py-2.5 pr-3 font-semibold text-ink flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-ink-muted shrink-0" />
                          <span>{ag.guest.name}</span>
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className="inline-flex items-center gap-1 rounded bg-rose-500/20 px-1.5 py-0.5 font-mono font-medium text-rose-300">
                            <BedDouble className="h-3 w-3" />
                            {ag.roomNumber}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-300">
                            {ag.guest.loyaltyTier}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className="text-xs text-ink-secondary">
                            {ag.category === "IN_HOUSE"
                              ? "In-House (Now)"
                              : ag.category === "ARRIVING_TODAY"
                              ? "Arriving Today"
                              : "Upcoming"}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3">
                          <StatusBadge
                            label={ag.urgency}
                            variant={ag.category === "IN_HOUSE" ? "critical" : ag.category === "ARRIVING_TODAY" ? "serious" : "warning"}
                          />
                        </td>
                        <td className="py-2.5 text-xs text-emerald-400 font-medium">
                          {ag.suggestedAlternativeRoomType}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* GUEST COMPLAINT -> ROOT CAUSE CORRELATION CARD */}
      {diagnostics.hasActiveComplaint && (
        <Card
          title="GUEST COMPLAINT → ROOT CAUSE CORRELATION"
          subtitle="Real-time incident response: Guest feedback correlated to equipment telemetry, emergency work orders, and service recovery"
          className="mb-4 border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent shadow-md"
        >
          <div className="flex flex-col gap-4">
            {/* Top Incident Header */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex h-2.5 w-2.5 rounded-full bg-amber-400 animate-ping" />
                  <span className="font-bold text-amber-200">Incident Reported: {diagnostics.complaint?.facilityArea}</span>
                  <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-300 border border-amber-500/40">
                    {diagnostics.complaint?.aspect.toUpperCase()} ISSUE
                  </span>
                  <span className="rounded bg-rose-500/20 px-2 py-0.5 text-xs font-bold text-rose-300">
                    1-STAR RATING
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-secondary">
                  Reported by <strong className="text-ink">{diagnostics.complaint?.guestName}</strong> ({diagnostics.complaint?.roomNumber ? `Room ${diagnostics.complaint?.roomNumber}` : "In-House"} · {diagnostics.complaint?.vipTier} VIP) &bull; {diagnostics.complaint?.timestamp}
                </p>
                <div className="mt-2 text-xs italic text-amber-100 bg-black/30 p-2.5 rounded-lg border border-amber-500/20">
                  &ldquo;{diagnostics.complaint?.text}&rdquo;
                </div>
              </div>
            </div>

            {/* Ripple Correlation Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Step 1: Sentiment Plunge */}
              <div className="rounded-xl border border-border bg-surface-2 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-muted font-medium">1. Sentiment Plunge</span>
                  <span className="text-xs font-bold text-rose-400">{diagnostics.sentimentPlunge.delta} pts</span>
                </div>
                <p className="mt-2 text-2xl font-bold text-rose-300">{diagnostics.sentimentPlunge.impactedScore.toFixed(2)}</p>
                <p className="mt-1 text-xs text-ink-muted">
                  Plunged from +{diagnostics.sentimentPlunge.baselineScore} on {diagnostics.sentimentPlunge.aspect}
                </p>
              </div>

              {/* Step 2: Root Cause Correlated */}
              <div className="rounded-xl border border-border bg-surface-2 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-muted font-medium">2. Root Cause Traced</span>
                  <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300 border border-emerald-500/30">
                    {diagnostics.rootCause.confidence}% Match
                  </span>
                </div>
                <p className="mt-2 text-sm font-bold text-ink">{diagnostics.rootCause.equipmentName}</p>
                <p className="mt-1 text-xs text-ink-secondary line-clamp-2">{diagnostics.rootCause.finding}</p>
              </div>

              {/* Step 3: Maintenance Alert & Area Status */}
              <div className="rounded-xl border border-border bg-surface-2 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-muted font-medium">3. Ops Action & Area</span>
                  <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-300 border border-rose-500/30">
                    {diagnostics.affectedArea.status}
                  </span>
                </div>
                <p className="mt-2 text-sm font-bold text-amber-300">{diagnostics.maintenanceAlert.workOrderNumber}</p>
                <p className="mt-1 text-xs text-ink-muted">
                  ETA: {diagnostics.maintenanceAlert.etaHours}h &bull; {diagnostics.affectedArea.impactedBookingsCount} bookings impacted
                </p>
              </div>

              {/* Step 4: Service Recovery & Revenue */}
              <div className="rounded-xl border border-border bg-surface-2 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-muted font-medium">4. Service Recovery</span>
                  <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300 border border-emerald-500/30">
                    {diagnostics.serviceRecovery.recoveryStatus}
                  </span>
                </div>
                <p className="mt-2 text-sm font-bold text-emerald-400">
                  +${diagnostics.serviceRecovery.creditAmount} Credit + 5k pts
                </p>
                <p className="mt-1 text-xs text-rose-300/80 font-medium">
                  Yield loss: -${diagnostics.revenueImpact.dailyAncillaryLoss.toLocaleString()}/day
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile
          label="Service Disruption Risk"
          value={guestImpact.serviceRiskLevel}
          delta={guestImpact.hasEquipmentFailure ? "Climate control outage" : guestImpact.serviceRiskLevel !== "Normal" ? "Surge capacity alert" : "Normal operating level"}
          deltaGood={guestImpact.serviceRiskLevel === "Normal"}
        />
        <KpiTile
          label="Affected Guests"
          value={guestImpact.hasEquipmentFailure ? `${guestImpact.totalAffectedGuests}` : "0"}
          delta={guestImpact.hasEquipmentFailure ? `${guestImpact.affectedCurrentCount} in-house · ${guestImpact.affectedArrivingCount} arriving` : "Standard operations"}
          deltaGood={guestImpact.totalAffectedGuests === 0}
        />
        <KpiTile
          label="Relocation Required"
          value={guestImpact.hasEquipmentFailure ? (guestImpact.relocationRequired ? "YES" : "NO") : "NO"}
          delta={guestImpact.hasEquipmentFailure ? `${guestImpact.affectedCurrentCount + guestImpact.affectedArrivingCount} transfers needed` : "Zero reassignments"}
          deltaGood={!guestImpact.relocationRequired}
        />
        <KpiTile
          label="Reviews Analyzed"
          value={`${sentiment.totalReviews}`}
          delta="Trailing 90 days"
        />
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
            {diagnostics.hasActiveComplaint && diagnostics.complaint && (
              <div className="py-2.5 first:pt-0 bg-amber-500/10 border border-amber-500/30 px-3 py-2 rounded-lg mb-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <StatusBadge label={diagnostics.complaint.aspect} variant="critical" />
                    <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                      ⚡ Active VIP Incident
                    </span>
                  </div>
                  <span className="text-xs text-amber-300/80 font-medium">
                    {diagnostics.complaint.guestName} ({diagnostics.complaint.vipTier}) &bull; {diagnostics.complaint.timestamp}
                  </span>
                </div>
                <p className="mt-1 text-sm text-ink">&ldquo;{diagnostics.complaint.text}&rdquo;</p>
              </div>
            )}
            {sentiment.topIssues.map((issue, i) => {
              const isEquipmentIssue =
                issue.quote.toLowerCase().includes("chiller") ||
                issue.quote.toLowerCase().includes("ac ") ||
                issue.quote.toLowerCase().includes("hvac") ||
                issue.quote.toLowerCase().includes("broken");

              return (
                <div key={i} className={`py-2.5 first:pt-0 last:pb-0 ${isEquipmentIssue ? "bg-rose-500/5 px-2 rounded-lg" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <StatusBadge label={issue.aspect} variant="serious" />
                      {isEquipmentIssue && (
                        <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300">
                          ⚡ Equipment Outage
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-ink-muted">
                      {issue.source} · {issue.date}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-ink-secondary">&ldquo;{issue.quote}&rdquo;</p>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card title="AI Concierge" subtitle="Handles guest requests and recommends services based on preferences" className="mt-4">
        <ConciergeChat />
      </Card>
    </div>
  );
}
