import { generateInventory, type InventoryItem } from "../data/inventory";
import { generateDemandForecast } from "../data/bookings";
import { ROOM_TYPES, type DemandEvent } from "../data/rooms";
import type { ResortState } from "../store/resortStore";

export interface InventoryStatus {
  item: InventoryItem;
  projectedDailyConsumption: number;
  daysOfStockLeft: number;
  reorderNeeded: boolean;
  recommendedOrderQty: number;
  urgency: "Critical" | "Reorder Soon" | "Healthy";
  isEmergencyPart?: boolean;
  emergencyReason?: string;
}

const BASELINE_OCCUPANCY = 0.65;
const SAFETY_BUFFER_DAYS = 3;

function nearTermOccupancyRate(extraEvents: DemandEvent[]): number {
  const forecast = generateDemandForecast(99, extraEvents);
  const totalRooms = ROOM_TYPES.reduce((s, r) => s + r.count, 0);
  const nextWeek = forecast.filter((f) => f.leadDays < 7);
  const totalBooked = nextWeek.reduce((s, f) => s + f.bookedRooms, 0);
  const days = new Set(nextWeek.map((f) => f.date)).size || 1;
  return totalBooked / (totalRooms * days);
}

export function buildInventoryStatus(stateOrEvents?: ResortState | DemandEvent[]): InventoryStatus[] {
  const isState = stateOrEvents && !Array.isArray(stateOrEvents) && "inventory" in stateOrEvents;
  const items = isState ? stateOrEvents.inventory : generateInventory();

  let occupancyRate: number;
  if (isState) {
    const totalRooms = stateOrEvents.rooms.reduce((s, r) => s + r.count, 0);
    const nextWeek = stateOrEvents.demandForecast.filter((f) => f.leadDays < 7);
    const totalBooked = nextWeek.reduce((s, f) => s + f.bookedRooms, 0);
    const days = new Set(nextWeek.map((f) => f.date)).size || 1;
    occupancyRate = totalBooked / (totalRooms * days);
  } else {
    occupancyRate = nearTermOccupancyRate(Array.isArray(stateOrEvents) ? stateOrEvents : []);
  }

  // Check if an equipment failure is currently active
  const failureEvent = isState
    ? stateOrEvents.activeEvents.find((e) => e.type === "EQUIPMENT_FAILURE")
    : undefined;
  const hasEquipmentFailure = Boolean(failureEvent);
  const eqId = (failureEvent?.details?.equipmentId as string) ?? "";

  return items
    .map((item) => {
      const isPerishable = item.category === "Food & Beverage" || item.name.includes("Water") || item.name.includes("Toiletries");
      const demandScale = Math.max(
        0.2,
        isPerishable && occupancyRate > 0.85
          ? (occupancyRate / BASELINE_OCCUPANCY) * 1.5 // 2.2x burn rate for perishables during extreme surges
          : occupancyRate / BASELINE_OCCUPANCY
      );
      const isMaintFailurePart =
        hasEquipmentFailure &&
        item.category === "Maintenance" &&
        (eqId === "eq-11"
          ? item.name.includes("Generator") || item.name.includes("HVAC")
          : item.name.includes("HVAC") || item.name.includes("Refrigerant"));

      const maintScale = isMaintFailurePart ? 3.5 : 1.0;
      const projectedDailyConsumption = item.avgDailyConsumption * demandScale * maintScale;
      const daysOfStockLeft = projectedDailyConsumption > 0 ? item.currentStock / projectedDailyConsumption : 999;
      const reorderNeeded = daysOfStockLeft < item.leadTimeDays + SAFETY_BUFFER_DAYS;
      const targetStock = item.parLevel + projectedDailyConsumption * SAFETY_BUFFER_DAYS;
      const recommendedOrderQty = reorderNeeded ? Math.max(0, Math.round(targetStock - item.currentStock)) : 0;

      const urgency: InventoryStatus["urgency"] =
        daysOfStockLeft < item.leadTimeDays ? "Critical" : reorderNeeded ? "Reorder Soon" : "Healthy";

      return {
        item,
        projectedDailyConsumption: Math.round(projectedDailyConsumption * 10) / 10,
        daysOfStockLeft: Math.round(daysOfStockLeft * 10) / 10,
        reorderNeeded,
        recommendedOrderQty,
        urgency,
        isEmergencyPart: isMaintFailurePart,
        emergencyReason: isMaintFailurePart
          ? `Accelerated consumption due to ${failureEvent?.details?.equipmentName ?? (eqId === "eq-11" ? "Substation Generator" : "Chiller Unit 2")} emergency repairs`
          : undefined,
      };
    })
    .sort((a, b) => a.daysOfStockLeft - b.daysOfStockLeft);
}
