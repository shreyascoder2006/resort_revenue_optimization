"use client";

import { PageHeader, Card, KpiTile, StatusBadge } from "@/components/ui";
import { HorizontalBarChart } from "@/components/charts/HorizontalBarChart";
import { buildSentimentSummary } from "@/lib/engines/sentiment";
import { buildGuestImpactSummary } from "@/lib/engines/guestImpact";
import { buildComplaintDiagnosticSummary } from "@/lib/engines/complaintDiagnostics";
import { useResortStore } from "@/lib/store/resortStore";
import ConciergeChat from "@/components/ConciergeChat";
import ScenarioSwitcher from "@/components/ScenarioSwitcher";
import { AlertTriangle, Users, BedDouble, ArrowRightLeft, ShieldAlert, Sparkles, Wrench, CheckCircle2 } from "lucide-react";

export default function GuestExperiencePage() {
  const { state } = useResortStore();
  const sentiment = buildSentimentSummary(state);
  const guestImpact = buildGuestImpactSummary(state);
  const diagnostics = buildComplaintDiagnosticSummary(state);

  const activeDemandEvent = state.activeEvents.find((e) => e.type === "DEMAND_SURGE");
  const demandReason = ((activeDemandEvent?.label ?? "") + " " + (activeDemandEvent?.details?.reason ?? "")).toLowerCase();
  const isWedding = Boolean(activeDemandEvent && (demandReason.includes("wedding") || demandReason.includes("buyout")));
  const isSlump = Boolean(activeDemandEvent && (((activeDemandEvent.details?.demandBoost as number | undefined) ?? 0) < 0 || demandReason.includes("monsoon") || demandReason.includes("storm")));
  const isFestivalSurge = Boolean(activeDemandEvent && !isWedding && !isSlump);

  const activeEqEvent = state.activeEvents.find((e) => e.type === "EQUIPMENT_FAILURE");
  const isWingBlackout = Boolean(activeEqEvent && (activeEqEvent.details?.equipmentId === "eq-11" || guestImpact.affectedRoomCount > 20));
  const isChillerFailure = Boolean(activeEqEvent && !isWingBlackout);
  const isNormal = state.activeEvents.length === 0;

  const aspectData = sentiment.byAspect.map((a) => {
    const isComplaintAspect = diagnostics.hasActiveComplaint && a.aspect === diagnostics.complaint?.aspect;
    const value = isComplaintAspect ? diagnostics.sentimentPlunge.impactedScore : Math.round(a.avgScore * 100) / 100;
    
    // Dynamic color coding based on scenario sentiment values
    const color =
      value >= 0.8
        ? "#eab308" // Royal gold for elite buyout
        : value >= 0.4
        ? "#10b981" // Healthy emerald
        : value >= 0.1
        ? "#06b6d4" // Calm cyan
        : value >= -0.2
        ? "#f59e0b" // Warning amber
        : "#ef4444"; // Critical red for breakdowns/queues

    return {
      label: a.aspect,
      value,
      color,
    };
  });

  const decliningAspects = sentiment.byAspect.filter((a) => a.trendDelta < -0.1 || a.avgScore < 0);

  return (
    <div>
      <PageHeader
        title="Guest Experience & Sentiment"
        description="Live sentiment tracking across reviews, real-time guest relocation roster, and AI concierge service."
      />

      <ScenarioSwitcher />

      {/* Scenario State Indicator Banner */}
      {isNormal ? (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent px-4 py-3 text-xs text-emerald-300 shadow-sm">
          <div className="flex items-center gap-2 font-medium">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
            <span className="font-semibold tracking-wide uppercase text-emerald-400">Normal Stage Active:</span>
            <span>Balanced guest satisfaction (4.4★ avg) · Zero room disruptions · Tranquil off-peak service delivery</span>
          </div>
          <span className="hidden sm:inline-block rounded bg-emerald-500/20 px-2.5 py-0.5 font-bold text-emerald-300 border border-emerald-500/30">
            OPTIMAL CALM
          </span>
        </div>
      ) : isFestivalSurge ? (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-orange-500/60 bg-gradient-to-r from-amber-500/25 via-orange-500/20 to-rose-500/20 px-4 py-3 text-xs text-amber-200 shadow-[0_0_30px_rgba(245,158,11,0.25)] ring-1 ring-orange-500/40 animate-pulse">
          <div className="flex items-center gap-2 font-medium">
            <span className="text-base">🔥</span>
            <span className="font-extrabold tracking-wide uppercase text-amber-300">CROWD CAPACITY STRAIN (FESTIVAL):</span>
            <span>95% occupancy wave causing severe check-in queues (-0.58) and overwhelmed staff (-0.42) ratings. Front desk reinforcements needed!</span>
          </div>
          <span className="hidden sm:inline-block rounded bg-gradient-to-r from-amber-500 to-orange-600 px-2.5 py-1 font-extrabold text-white shadow-md">
            HIGH QUEUE RISK
          </span>
        </div>
      ) : isWedding ? (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-yellow-400/60 bg-gradient-to-r from-yellow-500/25 via-amber-500/20 to-yellow-600/20 px-4 py-3 text-xs text-yellow-200 shadow-[0_0_30px_rgba(234,179,8,0.25)] ring-1 ring-yellow-400/40 animate-pulse">
          <div className="flex items-center gap-2 font-medium">
            <span className="text-base">👑</span>
            <span className="font-extrabold tracking-wide uppercase text-yellow-300">ROYAL WEDDING VIP SATISFACTION:</span>
            <span>All-time record guest sentiment (+0.92 overall · 4.95★)! Five-star reviews for private banquets, butlers, and bespoke spa.</span>
          </div>
          <span className="hidden sm:inline-block rounded bg-gradient-to-r from-yellow-500 to-amber-600 px-2.5 py-1 font-extrabold text-white shadow-md">
            FIVE-STAR RECORD
          </span>
        </div>
      ) : isSlump ? (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-indigo-500/60 bg-gradient-to-r from-indigo-600/25 via-blue-600/20 to-slate-700/20 px-4 py-3 text-xs text-indigo-200 shadow-[0_0_30px_rgba(99,102,241,0.25)] ring-1 ring-indigo-500/40">
          <div className="flex items-center gap-2 font-medium">
            <span className="text-base">🌧️</span>
            <span className="font-extrabold tracking-wide uppercase text-indigo-300">MONSOON SERENITY (OFF-SEASON):</span>
            <span>Outdoor pool closed due to cyclone, but indoor amenities, quiet room comfort (+0.78), and personalized staff service praised!</span>
          </div>
          <span className="hidden sm:inline-block rounded bg-indigo-500/30 px-2.5 py-1 font-extrabold text-indigo-200 border border-indigo-400 shadow-sm">
            PEACEFUL HAVEN
          </span>
        </div>
      ) : isWingBlackout ? (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-red-500 bg-gradient-to-r from-red-600/30 via-rose-600/25 to-red-900/30 px-4 py-3 text-xs text-red-200 shadow-[0_0_35px_rgba(239,68,68,0.35)] ring-1 ring-red-500/50 animate-pulse">
          <div className="flex items-center gap-2 font-medium">
            <span className="text-base">🚨</span>
            <span className="font-extrabold tracking-wide uppercase text-red-300">CRITICAL POWER OUTAGE DISRUPTION:</span>
            <span>40 rooms without power/cooling · 35+ guests requiring immediate relocation · Room comfort collapsed to -0.88!</span>
          </div>
          <span className="hidden sm:inline-block rounded bg-red-600 px-2.5 py-1 font-extrabold text-white shadow-md">
            MASS RELOCATION
          </span>
        </div>
      ) : null}

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

      {!guestImpact.hasEquipmentFailure && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-xs text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>
              <strong>Room Integrity Verified:</strong> All 150 resort rooms have 100% climate control, power, and operational stability. Zero guest room transfers required.
            </span>
          </div>
          <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-bold text-emerald-300 border border-emerald-500/30">
            100% OPERATIONAL
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile
          label="Overall Sentiment Score"
          value={`${sentiment.overallScore >= 0 ? "+" : ""}${sentiment.overallScore.toFixed(2)}`}
          delta={
            isWingBlackout
              ? "🚨 Blackout sentiment collapse"
              : isFestivalSurge
              ? "⚡ Front desk queue erosion"
              : isWedding
              ? "👑 All-time record high"
              : isSlump
              ? "🌧️ Tranquil off-season vibe"
              : "Historical baseline (+0.44)"
          }
          deltaGood={sentiment.overallScore >= 0.3}
          className={
            isWingBlackout
              ? "border-red-500/60 bg-red-500/15"
              : isWedding
              ? "border-yellow-400/60 bg-yellow-500/10 shadow-[0_0_20px_rgba(234,179,8,0.2)]"
              : isFestivalSurge
              ? "border-orange-500/50 bg-orange-500/10"
              : isSlump
              ? "border-indigo-500/50 bg-indigo-500/10"
              : "border-emerald-500/30 bg-emerald-500/[0.02]"
          }
          valueClassName={
            isWingBlackout
              ? "text-red-400 font-extrabold text-3xl"
              : isWedding
              ? "text-yellow-300 font-extrabold text-3xl"
              : isFestivalSurge
              ? "text-orange-400 font-extrabold text-3xl"
              : isSlump
              ? "text-indigo-300 font-extrabold text-3xl"
              : "text-emerald-400 font-semibold text-3xl"
          }
        />
        <KpiTile
          label="Average Star Rating"
          value={`${sentiment.overallStars.toFixed(1)} ★`}
          delta={
            isWingBlackout
              ? "🚨 1-star negative wave"
              : isFestivalSurge
              ? "⚡ Dips on wait times"
              : isWedding
              ? "👑 5-star royal banquet rating"
              : isSlump
              ? "🌧️ Relaxed personalized rating"
              : "Steady 4.4★ target"
          }
          deltaGood={sentiment.overallStars >= 4.0}
          className={
            isWingBlackout
              ? "border-red-500/60 bg-red-500/15"
              : isWedding
              ? "border-yellow-400/60 bg-yellow-500/10 shadow-[0_0_20px_rgba(234,179,8,0.2)]"
              : isFestivalSurge
              ? "border-orange-500/50 bg-orange-500/10"
              : isSlump
              ? "border-indigo-500/50 bg-indigo-500/10"
              : "border-emerald-500/30 bg-emerald-500/[0.02]"
          }
          valueClassName={
            isWingBlackout
              ? "text-red-400 font-extrabold text-3xl"
              : isWedding
              ? "text-yellow-300 font-extrabold text-3xl"
              : isFestivalSurge
              ? "text-orange-400 font-extrabold text-3xl"
              : isSlump
              ? "text-indigo-300 font-extrabold text-3xl"
              : "text-emerald-400 font-semibold text-3xl"
          }
        />
        <KpiTile
          label="Relocations Queued"
          value={
            isWingBlackout
              ? "35 Guests"
              : guestImpact.hasEquipmentFailure
              ? `${guestImpact.affectedCurrentCount + guestImpact.affectedArrivingCount} Guests`
              : "0 Guests"
          }
          delta={
            isWingBlackout
              ? "🚨 40 rooms dark (Ocean/Lagoon)"
              : guestImpact.hasEquipmentFailure
              ? `${guestImpact.affectedRoomCount} rooms offline`
              : "Zero room reassignments"
          }
          deltaGood={!guestImpact.hasEquipmentFailure}
          className={
            isWingBlackout
              ? "border-red-500/60 bg-red-500/20 shadow-[0_0_25px_rgba(239,68,68,0.3)] ring-1 ring-red-500/50"
              : guestImpact.hasEquipmentFailure
              ? "border-amber-500/50 bg-amber-500/10"
              : "border-emerald-500/30 bg-emerald-500/[0.02]"
          }
          valueClassName={
            isWingBlackout
              ? "text-red-400 font-extrabold text-3xl"
              : guestImpact.hasEquipmentFailure
              ? "text-amber-400 font-extrabold text-3xl"
              : "text-emerald-400 font-semibold text-3xl"
          }
        />
        <KpiTile
          label="Service Risk Level"
          value={
            isWingBlackout
              ? "CATASTROPHIC"
              : isFestivalSurge
              ? "CRITICAL SURGE"
              : isWedding
              ? "VIP ELITE"
              : isSlump
              ? "TRANQUIL"
              : guestImpact.serviceRiskLevel.toUpperCase()
          }
          delta={
            isWingBlackout
              ? "🚨 Relocation crisis"
              : isFestivalSurge
              ? "⚡ Staff & check-in strain"
              : isWedding
              ? "👑 1-on-1 butler coverage"
              : isSlump
              ? "🌧️ Unhurried service"
              : "Optimal operating pace"
          }
          deltaGood={isNormal || isWedding || isSlump}
          className={
            isWingBlackout
              ? "border-red-500/60 bg-red-500/15"
              : isFestivalSurge
              ? "border-rose-500/60 bg-rose-500/10"
              : isWedding
              ? "border-yellow-400/50 bg-yellow-500/10"
              : isSlump
              ? "border-indigo-500/50 bg-indigo-500/10"
              : "border-emerald-500/30 bg-emerald-500/[0.02]"
          }
          valueClassName={
            isWingBlackout
              ? "text-red-400 font-extrabold text-2xl"
              : isFestivalSurge
              ? "text-rose-400 font-extrabold text-2xl"
              : isWedding
              ? "text-yellow-300 font-extrabold text-2xl"
              : isSlump
              ? "text-indigo-300 font-extrabold text-2xl"
              : "text-emerald-400 font-semibold text-2xl"
          }
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
