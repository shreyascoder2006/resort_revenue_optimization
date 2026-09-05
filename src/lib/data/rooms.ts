export const TODAY = new Date("2026-09-05T00:00:00Z");

export interface RoomType {
  id: string;
  name: string;
  count: number;
  baseRate: number; // USD/night
  maxOccupancy: number;
}

export const ROOM_TYPES: RoomType[] = [
  { id: "standard", name: "Standard King", count: 60, baseRate: 180, maxOccupancy: 2 },
  { id: "deluxe-ocean", name: "Deluxe Ocean View", count: 40, baseRate: 260, maxOccupancy: 3 },
  { id: "family-suite", name: "Family Suite", count: 25, baseRate: 340, maxOccupancy: 5 },
  { id: "garden-bungalow", name: "Garden Bungalow", count: 20, baseRate: 300, maxOccupancy: 3 },
  { id: "presidential-villa", name: "Presidential Villa", count: 5, baseRate: 850, maxOccupancy: 6 },
];

export const TOTAL_ROOMS = ROOM_TYPES.reduce((sum, r) => sum + r.count, 0);

// A few upcoming local demand drivers used by the pricing + staffing engines.
export interface DemandEvent {
  date: string; // ISO date
  label: string;
  demandBoost: number; // multiplicative boost to base demand, e.g. 0.25 = +25%
}

export const DEMAND_EVENTS: DemandEvent[] = [
  { date: "2026-09-12", label: "Regional Food & Wine Festival", demandBoost: 0.28 },
  { date: "2026-09-13", label: "Regional Food & Wine Festival (day 2)", demandBoost: 0.22 },
  { date: "2026-09-19", label: "Long weekend (national holiday)", demandBoost: 0.35 },
  { date: "2026-09-20", label: "Long weekend (national holiday)", demandBoost: 0.3 },
];
