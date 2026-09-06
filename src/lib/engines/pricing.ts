import { ROOM_TYPES, TODAY, type DemandEvent, type RoomType } from "../data/rooms";
import { generateOccupancyHistory, generateDemandForecast } from "../data/bookings";
import { getBaselineResortState, type ResortState } from "../store/resortStore";
import { formatCurrency, CURRENCY_CONFIGS, type Currency } from "../utils/currency";

export interface PriceRecommendation {
  date: string;
  roomTypeId: string;
  roomTypeName: string;
  baseRate: number;
  forecastOccupancyRate: number;
  demandLevel: "Low" | "Moderate" | "High" | "Peak";
  recommendedRate: number;
  calculatedRate: number;
  isOverridden: boolean;
  changePercent: number;
  leadDays: number;
  isEvent: boolean;
  eventLabel?: string;
  eventDemandBoost?: number;
  rationale: string[];
}

export interface PricingSummary {
  currency: Currency;
  currencySymbol: string;
  currentOccupancy: number;
  trailingAdr: number;
  trailingRevPar: number;
  forecastOccupancy: number; // next 7 days average occupancy
  forecastAdr: number; // next 7 days recommended ADR
  forecastRevPar: number; // next 7 days recommended RevPAR
  hasSurge: boolean; // whether an event/demand surge falls within the next 7 days
  projectedRevenueLift: number; // % vs flat-rate baseline over the forecast window
  recommendations: PriceRecommendation[];

  // Room capacity and operational metrics
  totalPhysicalRooms: number; // total physical rooms (150)
  totalAvailableRooms: number; // currently operable rooms (e.g. 135)
  totalOutOfOrderRooms: number; // out of order rooms (e.g. 15)
  next7ProjectedRevenue: number; // projected dynamic revenue for next 7 days
  baselineProjectedRevenue: number; // baseline projected revenue without disruptions
  revenueImpact: number; // current live revenue - baseline revenue
  hasEquipmentFailure: boolean; // whether an equipment failure is active
  activeEquipmentFailureName?: string; // name of failed equipment
  activeOutOfOrderCount?: number; // count of rooms placed out of order

  // Pricing override indicators
  hasPricingOverride: boolean;
  activePricingOverrides: Record<string, number>;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function buildPricingRecommendations(
  stateOrEvents?: ResortState | DemandEvent[],
  options?: { skipBaselineCalculation?: boolean }
): PricingSummary {
  const isState = stateOrEvents && !Array.isArray(stateOrEvents) && "occupancyHistory" in stateOrEvents;
  const currency: Currency = (isState && stateOrEvents.currency) ? stateOrEvents.currency : "INR";
  const currencySymbol = CURRENCY_CONFIGS[currency]?.symbol ?? "₹";
  const history = isState ? stateOrEvents.occupancyHistory : generateOccupancyHistory();
  const rooms = isState ? stateOrEvents.rooms : ROOM_TYPES;
  const forecast = isState
    ? stateOrEvents.demandForecast
    : generateDemandForecast(99, Array.isArray(stateOrEvents) ? stateOrEvents : []);
  const pricingOverrides = (isState ? stateOrEvents.pricingOverrides : {}) ?? {};
  const roomById = new Map(rooms.map((r) => [r.id, r]));

  const totalPhysicalRooms = rooms.reduce((s, r) => s + r.count, 0);
  const totalAvailableRooms = rooms.reduce(
    (s, r) => s + Math.max(0, r.availableCount ?? (r.count - (r.outOfOrderCount ?? 0))),
    0
  );
  const totalOutOfOrderRooms = rooms.reduce((s, r) => s + (r.outOfOrderCount ?? 0), 0);

  const recommendations: PriceRecommendation[] = forecast.map((f) => {
    const room: RoomType = roomById.get(f.roomTypeId) ?? {
      id: f.roomTypeId,
      name: f.roomTypeId,
      baseRate: 200,
      count: 20,
      maxOccupancy: 2,
    };
    const operableRooms = Math.max(0, room.availableCount ?? (room.count - (room.outOfOrderCount ?? 0)));
    const outOfOrderRooms = room.outOfOrderCount ?? Math.max(0, room.count - operableRooms);
    const capacityRatio = room.count > 0 ? operableRooms / room.count : 1;

    // Room base rate according to active currency
    const baseRateConfig = CURRENCY_CONFIGS[currency]?.baseRates[f.roomTypeId];
    const roomBaseRate = baseRateConfig ?? (currency === "INR" ? Math.round(room.baseRate * 33) : room.baseRate);

    // Effective occupancy: unconstrained booking demand evaluated against OPERABLE capacity
    const demandedRooms = Math.round(f.forecastOccupancyRate * room.count);
    const effectiveOccupancyRate = operableRooms > 0 ? demandedRooms / operableRooms : 1.0;

    const rationale: string[] = [];
    let multiplier = 1;
    let demandLevel: "Low" | "Moderate" | "High" | "Peak" = "Moderate";

    if (effectiveOccupancyRate > 0.85) {
      demandLevel = "Peak";
      multiplier *= 1.25;
      rationale.push(
        outOfOrderRooms > 0
          ? `High occupancy pressure (${Math.round(effectiveOccupancyRate * 100)}% of operable inventory) supports premium pricing`
          : `Peak forecast demand (${Math.round(f.forecastOccupancyRate * 100)}% occupancy) supports a premium rate`
      );
    } else if (effectiveOccupancyRate >= 0.65) {
      demandLevel = "High";
      multiplier *= 1.12;
      rationale.push(
        outOfOrderRooms > 0
          ? `Elevated demand on reduced capacity (${Math.round(effectiveOccupancyRate * 100)}% of operable inventory)`
          : `High forecast demand (${Math.round(f.forecastOccupancyRate * 100)}% occupancy)`
      );
    } else if (effectiveOccupancyRate < 0.4) {
      demandLevel = "Low";
      multiplier *= 0.88;
      rationale.push(`Soft demand (${Math.round(effectiveOccupancyRate * 100)}% occupancy) - discount to stimulate bookings`);
    } else if (effectiveOccupancyRate < 0.55) {
      demandLevel = "Moderate";
      multiplier *= 0.95;
      rationale.push(`Below-average demand (${Math.round(effectiveOccupancyRate * 100)}% occupancy)`);
    }

    // Scarcity adjustment: as available inventory tightens, pricing power increases
    if (outOfOrderRooms > 0) {
      const scarcityWeight = (1 - capacityRatio) * Math.min(1.1, effectiveOccupancyRate);
      const scarcityMultiplier = clamp(1 + scarcityWeight * 0.16, 1.0, 1.14);
      if (scarcityMultiplier > 1.01) {
        multiplier *= scarcityMultiplier;
        rationale.push(
          `Inventory constrained: ${outOfOrderRooms} rooms offline (${operableRooms}/${room.count} operable)`
        );
      }
    }

    if (f.leadDays <= 2) {
      if (effectiveOccupancyRate > 0.8) {
        multiplier *= 1.08;
        rationale.push("Last-minute high-demand window - limited inventory left");
      } else if (effectiveOccupancyRate < 0.5) {
        multiplier *= 0.93;
        rationale.push("Last-minute low pickup - discount to fill remaining rooms");
      }
    }

    if (f.isEvent && f.eventDemandBoost !== undefined) {
      if (f.eventDemandBoost > 0) {
        multiplier *= 1.1;
        rationale.push(`Local demand driver: ${f.eventLabel}`);
      } else if (f.eventDemandBoost < 0) {
        rationale.push(`Demand disruption: ${f.eventLabel}`);
      }
    }

    multiplier = clamp(multiplier, 0.75, 1.65);
    const calculatedRate =
      currency === "INR"
        ? Math.round((roomBaseRate * multiplier) / 100) * 100
        : Math.round((roomBaseRate * multiplier) / 5) * 5;

    const overrideKey = `${f.date}-${f.roomTypeId}`;
    const isOverridden =
      pricingOverrides[overrideKey] !== undefined ||
      pricingOverrides[f.roomTypeId] !== undefined;

    const recommendedRate = isOverridden
      ? (pricingOverrides[overrideKey] ?? pricingOverrides[f.roomTypeId]!)
      : calculatedRate;

    const changePercent = ((recommendedRate - roomBaseRate) / roomBaseRate) * 100;

    if (rationale.length === 0) rationale.push("Demand tracking in line with base rate");

    return {
      date: f.date,
      roomTypeId: f.roomTypeId,
      roomTypeName: room.name,
      baseRate: roomBaseRate,
      forecastOccupancyRate: f.forecastOccupancyRate,
      demandLevel,
      recommendedRate,
      calculatedRate,
      isOverridden,
      changePercent,
      leadDays: f.leadDays,
      isEvent: f.isEvent,
      eventLabel: f.eventLabel,
      eventDemandBoost: f.eventDemandBoost,
      rationale,
    };
  });

  // Trailing 30-day KPIs from history
  const currencyMultiplier = currency === "INR" ? 33 : 1;
  const last30 = history.filter((h) => h.date >= dateOffsetIso(-30));
  const daysIn30 = new Set(last30.map((h) => h.date)).size;
  const totalRoomNightsAvailable = totalPhysicalRooms * daysIn30;
  const totalOccupiedNights = last30.reduce((s, h) => s + h.occupiedRooms, 0);
  const totalRevenue = last30.reduce((s, h) => s + h.revenue, 0) * currencyMultiplier;
  const trailingAdr = totalOccupiedNights > 0 ? totalRevenue / totalOccupiedNights : 0;
  const trailingRevPar = totalRoomNightsAvailable > 0 ? totalRevenue / totalRoomNightsAvailable : 0;

  const todayRows = history.filter((h) => h.date === mostRecentDate(history));
  const currentOccupancy =
    todayRows.reduce((s, h) => s + h.occupiedRooms, 0) /
    todayRows.reduce((s, h) => s + h.occupiedRooms + h.availableRooms, 0);

  // Near-term (next 7 days) forward-looking metrics: responds to live room availability, overrides, and surge
  const next7Recs = recommendations.filter((r) => r.leadDays < 7);
  const next7Booked = next7Recs.reduce((s, r) => {
    const room = roomById.get(r.roomTypeId)!;
    const operable = Math.max(0, room.availableCount ?? (room.count - (room.outOfOrderCount ?? 0)));
    const demanded = Math.round(r.forecastOccupancyRate * room.count);
    return s + Math.min(operable, demanded);
  }, 0);

  const next7Available = next7Recs.reduce((s, r) => {
    const room = roomById.get(r.roomTypeId)!;
    const operable = Math.max(0, room.availableCount ?? (room.count - (room.outOfOrderCount ?? 0)));
    return s + operable;
  }, 0);

  const next7Revenue = next7Recs.reduce((s, r) => {
    const room = roomById.get(r.roomTypeId)!;
    const operable = Math.max(0, room.availableCount ?? (room.count - (room.outOfOrderCount ?? 0)));
    const booked = Math.min(operable, Math.round(r.forecastOccupancyRate * room.count));
    return s + booked * r.recommendedRate;
  }, 0);

  const forecastOccupancy = next7Available > 0 ? next7Booked / next7Available : 0;
  const forecastAdr = next7Booked > 0 ? next7Revenue / next7Booked : 0;
  const forecastRevPar = next7Available > 0 ? next7Revenue / next7Available : 0;
  const hasSurge = next7Recs.some((r) => r.isEvent && (r.eventDemandBoost ?? 0) > 0);

  const flatRevenue = recommendations.reduce((s, r) => {
    const room = roomById.get(r.roomTypeId)!;
    const operable = Math.max(0, room.availableCount ?? (room.count - (room.outOfOrderCount ?? 0)));
    const booked = Math.min(operable, Math.round(r.forecastOccupancyRate * room.count));
    return s + booked * r.baseRate;
  }, 0);

  const dynamicRevenue = recommendations.reduce((s, r) => {
    const room = roomById.get(r.roomTypeId)!;
    const operable = Math.max(0, room.availableCount ?? (room.count - (room.outOfOrderCount ?? 0)));
    const booked = Math.min(operable, Math.round(r.forecastOccupancyRate * room.count));
    return s + booked * r.recommendedRate;
  }, 0);

  const projectedRevenueLift = flatRevenue > 0 ? ((dynamicRevenue - flatRevenue) / flatRevenue) * 100 : 0;

  // Baseline vs Current Live State comparison
  let baselineProjectedRevenue = next7Revenue;
  if (!options?.skipBaselineCalculation && isState) {
    const baselineState = getBaselineResortState();
    const baselineSummary = buildPricingRecommendations(baselineState, { skipBaselineCalculation: true });
    baselineProjectedRevenue = baselineSummary.next7ProjectedRevenue;
  }
  const revenueImpact = next7Revenue - baselineProjectedRevenue;

  // Equipment failure active indicator details
  const equipmentFailureEvent = isState
    ? stateOrEvents.activeEvents.find((e) => e.type === "EQUIPMENT_FAILURE")
    : undefined;
  const hasEquipmentFailure = Boolean(equipmentFailureEvent) || totalOutOfOrderRooms > 0;
  const activeEquipmentFailureName =
    (equipmentFailureEvent?.details?.equipmentName as string | undefined) ??
    (totalOutOfOrderRooms > 0 ? "Chiller Unit 2" : undefined);
  const activeOutOfOrderCount = totalOutOfOrderRooms;

  const hasPricingOverride = Object.keys(pricingOverrides).length > 0;
  const activePricingOverrides = pricingOverrides;

  return {
    currency,
    currencySymbol,
    currentOccupancy,
    trailingAdr: Math.round(trailingAdr),
    trailingRevPar: Math.round(trailingRevPar),
    forecastOccupancy: Math.round(forecastOccupancy * 1000) / 1000,
    forecastAdr: Math.round(forecastAdr),
    forecastRevPar: Math.round(forecastRevPar),
    hasSurge,
    projectedRevenueLift: Math.round(projectedRevenueLift * 10) / 10,
    recommendations,

    // Step 3 metrics
    totalPhysicalRooms,
    totalAvailableRooms,
    totalOutOfOrderRooms,
    next7ProjectedRevenue: Math.round(next7Revenue),
    baselineProjectedRevenue: Math.round(baselineProjectedRevenue),
    revenueImpact: Math.round(revenueImpact),
    hasEquipmentFailure,
    activeEquipmentFailureName,
    activeOutOfOrderCount,

    // Step 4 pricing override metrics
    hasPricingOverride,
    activePricingOverrides,
  };
}

function mostRecentDate(history: ReturnType<typeof generateOccupancyHistory>): string {
  return history.reduce((max, h) => (h.date > max ? h.date : max), history[0].date);
}

function dateOffsetIso(offsetDays: number): string {
  const d = new Date(TODAY.getTime());
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}
