import { makeRng, addDays, isoDate } from "./random";
import { ROOM_TYPES, TODAY, DEMAND_EVENTS, type RoomType } from "./rooms";

export interface DailyOccupancy {
  date: string;
  roomTypeId: string;
  occupiedRooms: number;
  availableRooms: number;
  occupancyRate: number;
  adr: number;
  revenue: number;
}

export interface DemandForecastDay {
  date: string;
  roomTypeId: string;
  bookedRooms: number;
  leadDays: number;
  forecastOccupancyRate: number;
  isEvent: boolean;
  eventLabel?: string;
}

const HISTORY_DAYS = 90;
const FORECAST_DAYS = 21;

function seasonalFactor(dayIndex: number): number {
  // Slow seasonal wave (~ +/-8%) plus a gentle upward trend as summer season ramps.
  return 1 + 0.08 * Math.sin((dayIndex / HISTORY_DAYS) * Math.PI * 1.3) + dayIndex * 0.0009;
}

function weekdayFactor(date: Date): number {
  const day = date.getUTCDay(); // 0 Sun ... 6 Sat
  // Resort skews toward weekend leisure travel.
  const map = [0.9, 0.72, 0.7, 0.74, 0.85, 1.15, 1.2];
  return map[day];
}

function eventFor(dateIso: string) {
  return DEMAND_EVENTS.find((e) => e.date === dateIso);
}

export function generateOccupancyHistory(seed = 42): DailyOccupancy[] {
  const rng = makeRng(seed);
  const rows: DailyOccupancy[] = [];

  for (const room of ROOM_TYPES) {
    // Each room type has a mild base-demand personality.
    const roomPersonality = rng.range(0.85, 1.1);
    for (let i = HISTORY_DAYS; i >= 1; i--) {
      const date = addDays(TODAY, -i);
      const dateIso = isoDate(date);
      const base = 0.62 * roomPersonality;
      const rate = clamp01(
        base * seasonalFactor(HISTORY_DAYS - i) * weekdayFactor(date) * rng.range(0.92, 1.08)
      );
      const occupiedRooms = Math.round(rate * room.count);
      const adr = dynamicHistoricalAdr(room, rate, rng);
      rows.push({
        date: dateIso,
        roomTypeId: room.id,
        occupiedRooms,
        availableRooms: room.count - occupiedRooms,
        occupancyRate: occupiedRooms / room.count,
        adr,
        revenue: Math.round(occupiedRooms * adr),
      });
    }
  }
  return rows;
}

function dynamicHistoricalAdr(room: RoomType, occupancyRate: number, rng: ReturnType<typeof makeRng>) {
  const demandAdj = occupancyRate > 0.8 ? 1.15 : occupancyRate < 0.45 ? 0.9 : 1.0;
  return Math.round(room.baseRate * demandAdj * rng.range(0.96, 1.04));
}

function clamp01(n: number) {
  return Math.min(0.98, Math.max(0.12, n));
}

export function generateDemandForecast(seed = 99): DemandForecastDay[] {
  const rng = makeRng(seed);
  const rows: DemandForecastDay[] = [];

  for (const room of ROOM_TYPES) {
    const roomPersonality = rng.range(0.85, 1.1);
    for (let i = 0; i < FORECAST_DAYS; i++) {
      const date = addDays(TODAY, i);
      const dateIso = isoDate(date);
      const event = eventFor(dateIso);
      const base = 0.6 * roomPersonality;
      let finalRate = clamp01(base * weekdayFactor(date) * rng.range(0.95, 1.05));
      if (event) finalRate = clamp01(finalRate * (1 + event.demandBoost));

      // Pickup curve: rooms already booked "on the books" shrink as lead time grows.
      const pickupShare = clamp01(1 - i / (FORECAST_DAYS + 6) - rng.range(0, 0.05));
      const bookedRooms = Math.round(finalRate * room.count * pickupShare);

      rows.push({
        date: dateIso,
        roomTypeId: room.id,
        bookedRooms,
        leadDays: i,
        forecastOccupancyRate: finalRate,
        isEvent: Boolean(event),
        eventLabel: event?.label,
      });
    }
  }
  return rows;
}
