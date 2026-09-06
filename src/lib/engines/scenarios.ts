import { TODAY, type DemandEvent } from "../data/rooms";
import { addDays, isoDate } from "../data/random";
import type { InjectedReview } from "../data/reviews";
import { buildPricingRecommendations, type PriceRecommendation } from "./pricing";
import { buildStaffingPlan } from "./staffing";
import { buildInventoryStatus } from "./inventory";
import { buildMaintenanceRisks } from "./maintenance";
import { buildSentimentSummary } from "./sentiment";

export type ScenarioIcon = "zap" | "wrench" | "trending-down";
export type StepIcon = "zap" | "pricing" | "staffing" | "inventory" | "maintenance" | "sentiment" | "check";
export type AlertVariant = "good" | "warning" | "serious" | "critical";

export interface ScenarioDefinition {
  id: string;
  label: string;
  description: string;
  icon: ScenarioIcon;
}

export interface ScenarioStep {
  key: string;
  icon: StepIcon;
  title: string;
  detail: string;
}

export interface ScenarioKpi {
  label: string;
  before: string;
  after: string;
  good: boolean;
}

export interface ScenarioAlert {
  engine: string;
  variant: AlertVariant;
  text: string;
}

export interface ScenarioOutcome {
  id: string;
  label: string;
  description: string;
  steps: ScenarioStep[];
  kpis: ScenarioKpi[];
  alerts: ScenarioAlert[];
}

export const SCENARIOS: ScenarioDefinition[] = [
  {
    id: "festival",
    label: "Surprise Festival Announced",
    description: "A major festival gets announced for 2 days from now with almost no notice.",
    icon: "zap",
  },
  {
    id: "equipment-failure",
    label: "Chiller Fails Overnight",
    description: "A chiller unit's sensor readings spike overnight and rooms start running hot.",
    icon: "wrench",
  },
  {
    id: "guest-complaint",
    label: "Guest Complaint Traced to Root Cause",
    description: "A VIP guest complaint about lukewarm spa water triggers automated root-cause diagnostics, maintenance work orders, and service recovery.",
    icon: "trending-down",
  },
];

function avgOnDate(recs: PriceRecommendation[], date: string, key: "recommendedRate" | "changePercent"): number {
  const rows = recs.filter((r) => r.date === date);
  if (rows.length === 0) return 0;
  return rows.reduce((s, r) => s + r[key], 0) / rows.length;
}

function runFestivalScenario(customBoost?: number): ScenarioOutcome {
  const def = SCENARIOS[0];
  const eventDate = isoDate(addDays(TODAY, 2));
  const boost = customBoost ?? 0.20;
  const event: DemandEvent = { date: eventDate, label: def.label, demandBoost: boost };

  const pricingBefore = buildPricingRecommendations();
  const staffingBefore = buildStaffingPlan();
  const inventoryBefore = buildInventoryStatus();

  const pricingAfter = buildPricingRecommendations([event]);
  const staffingAfter = buildStaffingPlan([event]);
  const inventoryAfter = buildInventoryStatus([event]);

  const rateBefore = avgOnDate(pricingBefore.recommendations, eventDate, "recommendedRate");
  const rateAfter = avgOnDate(pricingAfter.recommendations, eventDate, "recommendedRate");

  const understaffedBeforeKeys = new Set(
    staffingBefore.filter((s) => s.status === "Understaffed").map((s) => `${s.date}|${s.departmentId}`)
  );
  const newUnderstaffed = staffingAfter.filter(
    (s) => s.status === "Understaffed" && !understaffedBeforeKeys.has(`${s.date}|${s.departmentId}`)
  );
  const understaffedAfterCount = staffingAfter.filter((s) => s.status === "Understaffed").length;

  const reorderBeforeIds = new Set(inventoryBefore.filter((i) => i.reorderNeeded).map((i) => i.item.id));
  const newReorders = inventoryAfter.filter((i) => i.reorderNeeded && !reorderBeforeIds.has(i.item.id));
  const reorderAfterCount = inventoryAfter.filter((i) => i.reorderNeeded).length;

  const steps: ScenarioStep[] = [
    {
      key: "trigger",
      icon: "zap",
      title: def.label,
      detail: `Local event detected for ${eventDate} - an unplanned demand surge across the resort.`,
    },
    {
      key: "pricing",
      icon: "pricing",
      title: "Pricing engine recalculates",
      detail: `Average recommended rate for ${eventDate} moves from $${Math.round(rateBefore)} to $${Math.round(rateAfter)}.`,
    },
  ];
  if (newUnderstaffed.length > 0) {
    steps.push({
      key: "staffing",
      icon: "staffing",
      title: "Staffing engine flags a gap",
      detail: `${newUnderstaffed.length} department-day(s) newly understaffed - schedules were drafted before this event existed.`,
    });
  }
  if (newReorders.length > 0) {
    steps.push({
      key: "inventory",
      icon: "inventory",
      title: "Inventory engine reprojects demand",
      detail: `${newReorders.length} item(s) now need reordering sooner because of the extra occupancy.`,
    });
  }
  steps.push({
    key: "summary",
    icon: "check",
    title: "Impact summary",
    detail: "Pricing, staffing, and inventory recommendations all update automatically - no manual recalculation.",
  });

  const kpis: ScenarioKpi[] = [
    {
      label: `Avg. recommended rate, ${eventDate}`,
      before: `$${Math.round(rateBefore)}`,
      after: `$${Math.round(rateAfter)}`,
      good: rateAfter >= rateBefore,
    },
    {
      label: "Understaffed shifts",
      before: `${staffingBefore.filter((s) => s.status === "Understaffed").length}`,
      after: `${understaffedAfterCount}`,
      good: understaffedAfterCount <= staffingBefore.filter((s) => s.status === "Understaffed").length,
    },
    {
      label: "Inventory reorder alerts",
      before: `${inventoryBefore.filter((i) => i.reorderNeeded).length}`,
      after: `${reorderAfterCount}`,
      good: reorderAfterCount <= inventoryBefore.filter((i) => i.reorderNeeded).length,
    },
  ];

  const alerts: ScenarioAlert[] = [
    {
      engine: "Revenue",
      variant: "good",
      text: `Rates for ${eventDate} raised to capture the surge - projected revenue lift now ${pricingAfter.projectedRevenueLift}% (was ${pricingBefore.projectedRevenueLift}%).`,
    },
    ...newUnderstaffed.slice(0, 3).map((s) => ({
      engine: "Staffing",
      variant: "warning" as const,
      text: `${s.departmentName} now understaffed on ${s.date} - ${s.scheduledStaff} scheduled vs ${s.requiredStaff} needed.`,
    })),
    ...newReorders.slice(0, 3).map((i) => ({
      engine: "Inventory",
      variant: "warning" as const,
      text: `${i.item.name} now needs reordering - only ${i.daysOfStockLeft.toFixed(1)} days of stock left.`,
    })),
  ];

  return { id: def.id, label: def.label, description: def.description, steps, kpis, alerts };
}

function runEquipmentFailureScenario(): ScenarioOutcome {
  const def = SCENARIOS[1];
  const targetId = "eq-2"; // Chiller Unit 2
  const injected: InjectedReview[] = [
    { aspect: "room comfort", text: "Our room was unbearably hot all night and the air conditioning wasn't working at all." },
    { aspect: "room comfort", text: "The cooling system failed and staff seemed overwhelmed trying to fix the issue." },
    { aspect: "room comfort", text: "Uncomfortable stay - the outdated AC unit couldn't keep the room cool and we couldn't sleep." },
    { aspect: "room comfort", text: "Air conditioning issues ruined our stay - nobody responded to our complaint for hours." },
  ];

  const maintenanceBefore = buildMaintenanceRisks();
  const sentimentBefore = buildSentimentSummary();

  const maintenanceAfter = buildMaintenanceRisks(targetId);
  const sentimentAfter = buildSentimentSummary(injected);

  const targetBefore = maintenanceBefore.find((m) => m.equipment.id === targetId)!;
  const targetAfter = maintenanceAfter.find((m) => m.equipment.id === targetId)!;
  const aspectBefore = sentimentBefore.byAspect.find((a) => a.aspect === "room comfort")!;
  const aspectAfter = sentimentAfter.byAspect.find((a) => a.aspect === "room comfort")!;

  const steps: ScenarioStep[] = [
    {
      key: "trigger",
      icon: "zap",
      title: def.label,
      detail: `${targetBefore.equipment.name} (${targetBefore.equipment.location}) compressor failure takes 15 Deluxe Ocean rooms offline.`,
    },
    {
      key: "pricing",
      icon: "pricing",
      title: "Revenue engine adapts to capacity constraint",
      detail: "Operational rooms drop from 150 to 135. Dynamic pricing automatically activates scarcity multipliers on remaining Deluxe Ocean inventory.",
    },
    {
      key: "inventory",
      icon: "inventory",
      title: "Spare parts depleted & burn rate accelerates",
      detail: "Emergency repairs consume 15 HVAC filters and 8 cylinders of refrigerant. 3.0x accelerated burn rate triggers critical reorder alerts.",
    },
    {
      key: "sentiment",
      icon: "sentiment",
      title: "Sentiment plunge & automated service recovery",
      detail: 'AC complaints arrive overnight. Room comfort sentiment plunges; system queues 15x $75 resort credits and complimentary spa passes.',
    },
    {
      key: "summary",
      icon: "check",
      title: "End-to-end resort-wide ripple complete",
      detail: "Every engine (Maintenance, Inventory, Revenue, and Guest Experience) automatically coordinated responses across departments.",
    },
  ];

  const kpis: ScenarioKpi[] = [
    {
      label: "Operational room capacity",
      before: "150 / 150 (100%)",
      after: "135 / 150 (90%)",
      good: false,
    },
    {
      label: `${targetBefore.equipment.name} risk score`,
      before: `${targetBefore.riskScore} (${targetBefore.riskLevel})`,
      after: `${targetAfter.riskScore} (${targetAfter.riskLevel})`,
      good: false,
    },
    {
      label: "Deluxe Ocean avg rate",
      before: "$246",
      after: "$306 (Scarcity)",
      good: true,
    },
    {
      label: "Critical maintenance inventory",
      before: "Healthy (45 pcs / 14 cyl)",
      after: "Critical (30 pcs / 6 cyl)",
      good: false,
    },
    {
      label: "Room comfort sentiment",
      before: aspectBefore.avgScore.toFixed(2),
      after: aspectAfter.avgScore.toFixed(2),
      good: aspectAfter.avgScore >= aspectBefore.avgScore,
    },
  ];

  const newestIssue = sentimentAfter.topIssues.find((i) => i.aspect === "room comfort");

  const alerts: ScenarioAlert[] = [
    { engine: "Revenue", variant: "critical", text: "15 Deluxe Ocean rooms offline: Available capacity down 10%; scarcity rate adjustments active." },
    { engine: "Maintenance", variant: "critical", text: targetAfter.recommendation },
    { engine: "Inventory", variant: "critical", text: "Chiller Refrigerant (6 cyl) and HVAC Filters (30 pcs) in Critical shortage: Immediate replenishment required." },
    { engine: "Guest Experience", variant: "serious", text: "Automated service recovery: $75 resort credit + spa day pass dispatched to 15 affected guests." },
    ...(newestIssue
      ? [{ engine: "Guest Experience", variant: "serious" as const, text: `Active review alert: "${newestIssue.quote}"` }]
      : []),
  ];

  return { id: def.id, label: def.label, description: def.description, steps, kpis, alerts };
}

function runGroupCancelScenario(): ScenarioOutcome {
  const def = SCENARIOS[2];
  const eventDate = isoDate(addDays(TODAY, 3));
  const event: DemandEvent = { date: eventDate, label: def.label, demandBoost: -0.5, roomTypeId: "family-suite" };
  const injected: InjectedReview[] = [
    { aspect: "value", text: "Way overpriced for what you actually get - felt like a poor value compared to nearby resorts." },
    { aspect: "value", text: "Staff seemed dismissive when we asked about pricing - overpriced and disappointing." },
    { aspect: "value", text: "Poor value for the price, and the front desk staff were rude about it when we asked for a discount." },
    { aspect: "value", text: "Front desk couldn't explain the pricing and just apologized - a poor value experience overall." },
    { aspect: "value", text: "Overpriced for a family suite that felt cramped and outdated." },
  ];

  const pricingBefore = buildPricingRecommendations();
  const sentimentBefore = buildSentimentSummary();

  const pricingAfter = buildPricingRecommendations([event]);
  const sentimentAfter = buildSentimentSummary(injected);

  const rateBefore = pricingBefore.recommendations.find((r) => r.roomTypeId === "family-suite" && r.date === eventDate)!;
  const rateAfter = pricingAfter.recommendations.find((r) => r.roomTypeId === "family-suite" && r.date === eventDate)!;
  const valueBefore = sentimentBefore.byAspect.find((a) => a.aspect === "value")!;
  const valueAfter = sentimentAfter.byAspect.find((a) => a.aspect === "value")!;

  const discountPct = Math.round(((rateAfter.recommendedRate - rateBefore.recommendedRate) / rateBefore.recommendedRate) * 100);
  const newestIssue = sentimentAfter.topIssues.find((i) => i.aspect === "value");

  const steps: ScenarioStep[] = [
    {
      key: "trigger",
      icon: "zap",
      title: def.label,
      detail: `A multi-room family-suite booking cancels for ${eventDate}, right as negative "value" reviews start coming in.`,
    },
    {
      key: "pricing",
      icon: "pricing",
      title: "Pricing engine reacts to the gap",
      detail: `Family Suite rate for ${eventDate} moves from $${rateBefore.recommendedRate} to $${rateAfter.recommendedRate} to stimulate rebooking.`,
    },
    {
      key: "sentiment",
      icon: "sentiment",
      title: "Sentiment engine flags a value problem",
      detail: `"Value" sentiment drops from ${valueBefore.avgScore.toFixed(2)} to ${valueAfter.avgScore.toFixed(2)} - compounding the demand problem.`,
    },
    {
      key: "summary",
      icon: "check",
      title: "Impact summary",
      detail: "Revenue and guest-experience signals point to the same root cause at the same time.",
    },
  ];

  const kpis: ScenarioKpi[] = [
    {
      label: `Family Suite rate, ${eventDate}`,
      before: `$${rateBefore.recommendedRate}`,
      after: `$${rateAfter.recommendedRate}`,
      good: rateAfter.recommendedRate >= rateBefore.recommendedRate,
    },
    {
      label: "Value sentiment",
      before: valueBefore.avgScore.toFixed(2),
      after: valueAfter.avgScore.toFixed(2),
      good: valueAfter.avgScore >= valueBefore.avgScore,
    },
  ];

  const alerts: ScenarioAlert[] = [
    {
      engine: "Revenue",
      variant: "warning",
      text: `Family Suite discounted ${Math.abs(discountPct)}% for ${eventDate} to fill the gap left by the cancellation.`,
    },
    ...(newestIssue
      ? [{ engine: "Guest Experience", variant: "serious" as const, text: `New guest complaint: "${newestIssue.quote}"` }]
      : []),
  ];

  return { id: def.id, label: def.label, description: def.description, steps, kpis, alerts };
}

function runGuestComplaintScenario(): ScenarioOutcome {
  const def = SCENARIOS.find((s) => s.id === "guest-complaint") ?? {
    id: "guest-complaint",
    label: "Guest Complaint Traced to Root Cause",
    description: "A VIP guest complaint about lukewarm spa water triggers automated root-cause diagnostics, maintenance work orders, and service recovery.",
    icon: "trending-down" as const,
  };

  const steps: ScenarioStep[] = [
    {
      key: "trigger",
      icon: "sentiment",
      title: "1. VIP Guest Complaint Received",
      detail: "Elena Rostova (Platinum VIP, Room 209) files 1-star incident: Spa Jacuzzi water lukewarm, jet pressure cut out mid-session, burning odor from pump room.",
    },
    {
      key: "sentiment",
      icon: "sentiment",
      title: "2. Sentiment Plunges",
      detail: "\"Spa\" aspect score drops from +0.68 to -0.45 (-1.13 pts). Incident escalated to top priority in Guest Experience feed.",
    },
    {
      key: "maintenance",
      icon: "maintenance",
      title: "3. Root Cause Identified via Telemetry",
      detail: "Automated correlation identifies Spa Jacuzzi Heater (eq-6) anomaly score (88%) and tripped thermal heating element (96% diagnostic confidence).",
    },
    {
      key: "ops",
      icon: "staffing",
      title: "4. Maintenance Alert & Work Order Dispatched",
      detail: "Emergency Work Order WO-4182 dispatched to Facilities & Thermal Systems (Priority: Critical, ETA: 2 hours).",
    },
    {
      key: "area",
      icon: "inventory",
      title: "5. Affected Area Flagged",
      detail: "Spa Hydrotherapy Wing flagged as CLOSED FOR REPAIR; 12 scheduled private sessions paused.",
    },
    {
      key: "recovery",
      icon: "check",
      title: "6. Revenue & Service Recovery Executed",
      detail: "$75 resort credit + 5,000 loyalty points + treatment refund dispatched to guest. -$1,400 daily ancillary revenue protected/paused.",
    },
  ];

  const kpis: ScenarioKpi[] = [
    {
      label: "Spa Aspect Sentiment",
      before: "+0.68",
      after: "-0.45",
      good: false,
    },
    {
      label: "Root Cause Correlation",
      before: "Undetected",
      after: "Spa Jacuzzi Heater (eq-6)",
      good: true,
    },
    {
      label: "Hydrotherapy Wing Status",
      before: "OPERATIONAL",
      after: "CLOSED FOR REPAIR",
      good: false,
    },
    {
      label: "Service Recovery Comp",
      before: "$0",
      after: "$75 Credit + 5k pts",
      good: true,
    },
    {
      label: "Daily Ancillary Yield Impact",
      before: "$0",
      after: "-$1,400",
      good: false,
    },
  ];

  const alerts: ScenarioAlert[] = [
    {
      engine: "Guest Experience",
      variant: "critical",
      text: "VIP Incident: Elena Rostova complaint on Spa Hydrotherapy; sentiment dropped to -0.45.",
    },
    {
      engine: "Maintenance",
      variant: "critical",
      text: "Emergency Work Order WO-4182 dispatched for Spa Jacuzzi Heater (eq-6) heating element replacement.",
    },
    {
      engine: "Operations",
      variant: "warning",
      text: "Spa Hydrotherapy Wing flagged CLOSED FOR REPAIR — 12 guest sessions paused.",
    },
    {
      engine: "Overview",
      variant: "critical",
      text: "Executive Alert: Guest complaint correlated to equipment root cause; facilities dispatched and service recovery issued.",
    },
  ];

  return { id: def.id, label: def.label, description: def.description, steps, kpis, alerts };
}

export function runScenario(id: string, boost?: number): ScenarioOutcome {
  switch (id) {
    case "festival":
      return runFestivalScenario(boost);
    case "equipment-failure":
    case "chiller":
      return runEquipmentFailureScenario();
    case "guest-complaint":
      return runGuestComplaintScenario();
    case "group-cancel":
      return runGroupCancelScenario();
    default:
      throw new Error(`Unknown scenario: ${id}`);
  }
}
