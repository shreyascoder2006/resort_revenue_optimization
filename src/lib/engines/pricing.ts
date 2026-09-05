import { ROOM_TYPES, TODAY, type DemandEvent } from "../data/rooms";
import { generateOccupancyHistory, generateDemandForecast } from "../data/bookings";

export interface PriceRecommendation {
  date: string;
  roomTypeId: string;
  roomTypeName: string;
  baseRate: number;
  forecastOccupancyRate: number;
  recommendedRate: number;
  changePercent: number;
  leadDays: number;
  isEvent: boolean;
  eventLabel?: string;
  rationale: string[];
}

export interface PricingSummary {
  currentOccupancy: number;
  trailingAdr: number;
  trailingRevPar: number;
  projectedRevenueLift: number; // % vs flat-rate baseline over the forecast window
  recommendations: PriceRecommendation[];
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function buildPricingRecommendations(extraEvents: DemandEvent[] = []): PricingSummary {
  const history = generateOccupancyHistory();
  const forecast = generateDemandForecast(99, extraEvents);
  const roomById = new Map(ROOM_TYPES.map((r) => [r.id, r]));

  const recommendations: PriceRecommendation[] = forecast.map((f) => {
    const room = roomById.get(f.roomTypeId)!;
    const rationale: string[] = [];
    let multiplier = 1;

    if (f.forecastOccupancyRate > 0.85) {
      multiplier *= 1.25;
      rationale.push(`High forecast demand (${Math.round(f.forecastOccupancyRate * 100)}% occupancy) supports a premium rate`);
    } else if (f.forecastOccupancyRate > 0.7) {
      multiplier *= 1.12;
      rationale.push(`Above-average demand (${Math.round(f.forecastOccupancyRate * 100)}% occupancy)`);
    } else if (f.forecastOccupancyRate < 0.4) {
      multiplier *= 0.88;
      rationale.push(`Soft demand (${Math.round(f.forecastOccupancyRate * 100)}% occupancy) - discount to stimulate bookings`);
    } else if (f.forecastOccupancyRate < 0.55) {
      multiplier *= 0.95;
      rationale.push(`Below-average demand (${Math.round(f.forecastOccupancyRate * 100)}% occupancy)`);
    }

    if (f.leadDays <= 2) {
      if (f.forecastOccupancyRate > 0.6) {
        multiplier *= 1.08;
        rationale.push("Last-minute high-demand window - limited inventory left");
      } else {
        multiplier *= 0.93;
        rationale.push("Last-minute low pickup - discount to fill remaining rooms");
      }
    }

    if (f.isEvent && f.eventDemandBoost !== undefined) {
      if (f.eventDemandBoost > 0) {
        multiplier *= 1.1;
        rationale.push(`Local demand driver: ${f.eventLabel}`);
      } else if (f.eventDemandBoost < 0) {
        // Occupancy tier above already captures the softer demand - just surface the cause.
        rationale.push(`Demand disruption: ${f.eventLabel}`);
      }
    }

    multiplier = clamp(multiplier, 0.75, 1.65);
    const recommendedRate = Math.round((room.baseRate * multiplier) / 5) * 5;
    const changePercent = ((recommendedRate - room.baseRate) / room.baseRate) * 100;

    if (rationale.length === 0) rationale.push("Demand tracking in line with base rate");

    return {
      date: f.date,
      roomTypeId: f.roomTypeId,
      roomTypeName: room.name,
      baseRate: room.baseRate,
      forecastOccupancyRate: f.forecastOccupancyRate,
      recommendedRate,
      changePercent,
      leadDays: f.leadDays,
      isEvent: f.isEvent,
      eventLabel: f.eventLabel,
      rationale,
    };
  });

  // Trailing 30-day KPIs from history.
  const last30 = history.filter((h) => h.date >= dateOffsetIso(-30));
  const totalRoomsAllTypes = ROOM_TYPES.reduce((s, r) => s + r.count, 0);
  const daysIn30 = new Set(last30.map((h) => h.date)).size;
  const totalRoomNightsAvailable = totalRoomsAllTypes * daysIn30;
  const totalOccupiedNights = last30.reduce((s, h) => s + h.occupiedRooms, 0);
  const totalRevenue = last30.reduce((s, h) => s + h.revenue, 0);
  const trailingAdr = totalOccupiedNights > 0 ? totalRevenue / totalOccupiedNights : 0;
  const trailingRevPar = totalRoomNightsAvailable > 0 ? totalRevenue / totalRoomNightsAvailable : 0;

  const todayRows = history.filter((h) => h.date === mostRecentDate(history));
  const currentOccupancy =
    todayRows.reduce((s, h) => s + h.occupiedRooms, 0) / todayRows.reduce((s, h) => s + h.occupiedRooms + h.availableRooms, 0);

  const flatRevenue = recommendations.reduce((s, r) => {
    const room = roomById.get(r.roomTypeId)!;
    const bookedRooms = Math.round(r.forecastOccupancyRate * room.count);
    return s + bookedRooms * room.baseRate;
  }, 0);
  const dynamicRevenue = recommendations.reduce((s, r) => {
    const room = roomById.get(r.roomTypeId)!;
    const bookedRooms = Math.round(r.forecastOccupancyRate * room.count);
    return s + bookedRooms * r.recommendedRate;
  }, 0);
  const projectedRevenueLift = flatRevenue > 0 ? ((dynamicRevenue - flatRevenue) / flatRevenue) * 100 : 0;

  return {
    currentOccupancy,
    trailingAdr: Math.round(trailingAdr),
    trailingRevPar: Math.round(trailingRevPar),
    projectedRevenueLift: Math.round(projectedRevenueLift * 10) / 10,
    recommendations,
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
