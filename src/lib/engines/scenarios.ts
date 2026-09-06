import { TODAY, type DemandEvent } from "../data/rooms";
import { addDays, isoDate } from "../data/random";
import type { InjectedReview } from "../data/reviews";
import { buildPricingRecommendations, type PriceRecommendation } from "./pricing";
import { buildStaffingPlan } from "./staffing";
import { buildInventoryStatus } from "./inventory";
import { buildMaintenanceRisks } from "./maintenance";
import { buildSentimentSummary } from "./sentiment";

export type ScenarioIcon = "zap" | "wrench" | "trending-down" | "cloud-rain" | "sparkles" | "alert-triangle";
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
    label: "Festival Demand Surge (+120%)",
    description: "Unplanned regional festival creates a massive booking wave. 95% peak occupancy, dynamic rate surge to ₹17,000+ ADR.",
    icon: "zap",
  },
  {
    id: "wedding-buyout",
    label: "VIP Royal Wedding Buyout",
    description: "Ultra-wealthy wedding party reserves 90% resort capacity with luxury buyout pricing surging to ₹26,000+ ADR.",
    icon: "sparkles",
  },
  {
    id: "monsoon-slump",
    label: "Monsoon Storm Slump (-70%)",
    description: "Severe cyclone weather warning causes mass cancellations; occupancy crashes to 12% triggering deep distress discounts.",
    icon: "cloud-rain",
  },
  {
    id: "equipment-failure",
    label: "Chiller Fails Overnight",
    description: "Chiller Unit 2 sensor spike overnight takes 15 Deluxe Ocean rooms offline with HVAC cooling lost.",
    icon: "wrench",
  },
  {
    id: "wing-blackout",
    label: "Major Wing Substation Blackout",
    description: "Catastrophic electrical failure takes 40 rooms offline across two wings, requiring emergency guest relocations.",
    icon: "alert-triangle",
  },
  {
    id: "guest-complaint",
    label: "Guest Complaint Traced to Root Cause",
    description: "VIP guest complaint about lukewarm spa water triggers automated root-cause diagnostics, maintenance, and service recovery.",
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
  const boost = customBoost ?? 1.20;
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

function runMonsoonSlumpScenario(): ScenarioOutcome {
  const def = SCENARIOS.find((s) => s.id === "monsoon-slump") ?? SCENARIOS[2];
  const eventDate = isoDate(addDays(TODAY, 1));
  const event: DemandEvent = { date: eventDate, label: "Monsoon Cyclonic Alert", demandBoost: -0.70 };

  const pricingBefore = buildPricingRecommendations();
  const staffingBefore = buildStaffingPlan();

  const pricingAfter = buildPricingRecommendations([event]);
  const staffingAfter = buildStaffingPlan([event]);

  const rateBefore = avgOnDate(pricingBefore.recommendations, eventDate, "recommendedRate");
  const rateAfter = avgOnDate(pricingAfter.recommendations, eventDate, "recommendedRate");

  const overstaffedAfterCount = staffingAfter.filter((s) => s.status === "Overstaffed").length;

  const steps: ScenarioStep[] = [
    {
      key: "trigger",
      icon: "zap",
      title: "Severe Monsoon Storm Alert",
      detail: `Heavy cyclone and flight disruptions trigger mass cancellations for ${eventDate}. Demand collapses by 70%.`,
    },
    {
      key: "pricing",
      icon: "pricing",
      title: "Revenue engine implements clearance stimulus",
      detail: `Average recommended rate plummets from ₹${Math.round(rateBefore).toLocaleString()} down to ₹${Math.round(rateAfter).toLocaleString()} (-43% distress discount) to salvage occupancy.`,
    },
    {
      key: "staffing",
      icon: "staffing",
      title: "Staffing engine flags surplus labor",
      detail: `${overstaffedAfterCount} department shifts now overstaffed as occupancy drops to 12%. Reassigned labor to deep cleaning and preventive maintenance.`,
    },
    {
      key: "summary",
      icon: "check",
      title: "Demand slump response coordinated",
      detail: "Pricing discount activated immediately while operations shifted surplus staff to facility improvement projects.",
    },
  ];

  const kpis: ScenarioKpi[] = [
    {
      label: `Forecast Occupancy, ${eventDate}`,
      before: `${Math.round(pricingBefore.forecastOccupancy * 100)}%`,
      after: "12%",
      good: false,
    },
    {
      label: `Avg. recommended rate, ${eventDate}`,
      before: `₹${Math.round(rateBefore).toLocaleString()}`,
      after: `₹${Math.round(rateAfter).toLocaleString()}`,
      good: false,
    },
    {
      label: "Overstaffed labor shifts",
      before: `${staffingBefore.filter((s) => s.status === "Overstaffed").length}`,
      after: `${overstaffedAfterCount}`,
      good: false,
    },
  ];

  const alerts: ScenarioAlert[] = [
    {
      engine: "Pricing",
      variant: "warning",
      text: `Distress clearance pricing active for ${eventDate}: Base rates discounted by up to 45% to stimulate local drive-in demand.`,
    },
    {
      engine: "Staffing",
      variant: "warning",
      text: `${overstaffedAfterCount} staff shifts identified for operational reassignment to preventive property maintenance.`,
    },
  ];

  return { id: def.id, label: def.label, description: def.description, steps, kpis, alerts };
}

function runWeddingBuyoutScenario(): ScenarioOutcome {
  const def = SCENARIOS.find((s) => s.id === "wedding-buyout") ?? SCENARIOS[1];
  const eventDate = isoDate(addDays(TODAY, 2));
  const event: DemandEvent = { date: eventDate, label: "VIP Royal Wedding Buyout", demandBoost: 1.50 };

  const pricingBefore = buildPricingRecommendations();
  const staffingBefore = buildStaffingPlan();

  const pricingAfter = buildPricingRecommendations([event]);
  const staffingAfter = buildStaffingPlan([event]);

  const rateBefore = avgOnDate(pricingBefore.recommendations, eventDate, "recommendedRate");
  const rateAfter = avgOnDate(pricingAfter.recommendations, eventDate, "recommendedRate");

  const understaffedAfterCount = staffingAfter.filter((s) => s.status === "Understaffed").length;

  const steps: ScenarioStep[] = [
    {
      key: "trigger",
      icon: "zap",
      title: "Exclusive Multi-Wing Buyout Signed",
      detail: `High-net-worth destination wedding reserves 90% of resort inventory for ${eventDate} including all oceanfront suites.`,
    },
    {
      key: "pricing",
      icon: "pricing",
      title: "Ultra-luxury buyout yield unlocked",
      detail: `Average recommended rate surges from ₹${Math.round(rateBefore).toLocaleString()} to ₹${Math.round(rateAfter).toLocaleString()} (+254% luxury yield).`,
    },
    {
      key: "staffing",
      icon: "staffing",
      title: "VIP banquet & butler staffing surge",
      detail: `Staffing engine identifies ${understaffedAfterCount} shifts requiring supplementary banquet and concierge personnel.`,
    },
    {
      key: "summary",
      icon: "check",
      title: "Record revenue windfall projected",
      detail: "7-day dynamic revenue projected to reach ₹1.44+ Crore with premium private event margins.",
    },
  ];

  const kpis: ScenarioKpi[] = [
    {
      label: `Forecast Occupancy, ${eventDate}`,
      before: `${Math.round(pricingBefore.forecastOccupancy * 100)}%`,
      after: "90%",
      good: true,
    },
    {
      label: `Avg. recommended rate, ${eventDate}`,
      before: `₹${Math.round(rateBefore).toLocaleString()}`,
      after: `₹${Math.round(rateAfter).toLocaleString()}`,
      good: true,
    },
    {
      label: "Projected 7d Revenue",
      before: `₹${Math.round(pricingBefore.next7ProjectedRevenue).toLocaleString()}`,
      after: "₹1,44,50,000",
      good: true,
    },
  ];

  const alerts: ScenarioAlert[] = [
    {
      engine: "Pricing",
      variant: "good",
      text: `Record Yield Alert: VIP Wedding Buyout active at ₹26,400+ ADR. Projected revenue lift exceeding +320%.`,
    },
    {
      engine: "Staffing",
      variant: "warning",
      text: `Front Desk & Food & Beverage: Mobilize ${understaffedAfterCount} supplementary event shifts for banquet catering.`,
    },
  ];

  return { id: def.id, label: def.label, description: def.description, steps, kpis, alerts };
}

function runWingBlackoutScenario(): ScenarioOutcome {
  const def = SCENARIOS.find((s) => s.id === "wing-blackout") ?? SCENARIOS[4];
  const targetId = "eq-11"; // Main Substation / Generator

  const maintenanceBefore = buildMaintenanceRisks();
  const maintenanceAfter = buildMaintenanceRisks(targetId);
  const targetBefore = maintenanceBefore.find((m) => m.equipment.id === targetId) ?? maintenanceBefore[0];

  const steps: ScenarioStep[] = [
    {
      key: "trigger",
      icon: "zap",
      title: "Main Electrical Substation Fire & Failure",
      detail: "Substation short circuit trips utility yard transformer, knocking out power, HVAC, and keycards to 40 rooms across Deluxe Ocean & Lagoon Villa wings.",
    },
    {
      key: "pricing",
      icon: "pricing",
      title: "Capacity collapses from 150 to 110 operable rooms",
      detail: "27% of resort inventory immediately offline. Revenue engine halts booking of impacted categories and recalibrates inventory constraints.",
    },
    {
      key: "sentiment",
      icon: "sentiment",
      title: "Emergency guest relocations required",
      detail: "35+ guests requiring immediate off-site transfer to partner resort properties. Automated $150 compensation credits queued.",
    },
    {
      key: "summary",
      icon: "check",
      title: "Disaster protocol active",
      detail: "Emergency generators deployed for life-safety systems; partner hotel transfer coordination underway.",
    },
  ];

  const kpis: ScenarioKpi[] = [
    {
      label: "Operational room capacity",
      before: "150 / 150 (100%)",
      after: "110 / 150 (73%)",
      good: false,
    },
    {
      label: "Out of order rooms",
      before: "0 rooms",
      after: "40 rooms",
      good: false,
    },
    {
      label: "Estimated 7d Revenue Impact",
      before: "₹0",
      after: "-₹28,50,000",
      good: false,
    },
  ];

  const alerts: ScenarioAlert[] = [
    {
      engine: "Maintenance",
      variant: "critical",
      text: "CATASTROPHIC OUTAGE: Utility Substation offline. 40 rooms non-operable across Deluxe Ocean and Lagoon Villa wings.",
    },
    {
      engine: "Guest Experience",
      variant: "critical",
      text: "Emergency Protocol: Execute room transfers and compensation for 35 displaced in-house and arriving guests.",
    },
  ];

  return { id: def.id, label: def.label, description: def.description, steps, kpis, alerts };
}

export function runScenario(id: string, boost?: number): ScenarioOutcome {
  switch (id) {
    case "festival":
      return runFestivalScenario(boost);
    case "wedding-buyout":
      return runWeddingBuyoutScenario();
    case "monsoon-slump":
      return runMonsoonSlumpScenario();
    case "equipment-failure":
    case "chiller":
      return runEquipmentFailureScenario();
    case "wing-blackout":
      return runWingBlackoutScenario();
    case "guest-complaint":
      return runGuestComplaintScenario();
    default:
      return runFestivalScenario(boost);
  }
}
