import { generateInventory, type InventoryItem } from "../data/inventory";
import { generateDemandForecast } from "../data/bookings";
import { ROOM_TYPES } from "../data/rooms";

export interface InventoryStatus {
  item: InventoryItem;
  projectedDailyConsumption: number;
  daysOfStockLeft: number;
  reorderNeeded: boolean;
  recommendedOrderQty: number;
  urgency: "Critical" | "Reorder Soon" | "Healthy";
}

const BASELINE_OCCUPANCY = 0.65;
const SAFETY_BUFFER_DAYS = 3;

function nearTermOccupancyRate(): number {
  const forecast = generateDemandForecast();
  const totalRooms = ROOM_TYPES.reduce((s, r) => s + r.count, 0);
  const nextWeek = forecast.filter((f) => f.leadDays < 7);
  const totalBooked = nextWeek.reduce((s, f) => s + f.bookedRooms, 0);
  const days = new Set(nextWeek.map((f) => f.date)).size || 1;
  return totalBooked / (totalRooms * days);
}

export function buildInventoryStatus(): InventoryStatus[] {
  const items = generateInventory();
  const occupancyRate = nearTermOccupancyRate();
  const demandScale = Math.max(0.5, occupancyRate / BASELINE_OCCUPANCY);

  return items
    .map((item) => {
      const projectedDailyConsumption = item.avgDailyConsumption * demandScale;
      const daysOfStockLeft = item.currentStock / projectedDailyConsumption;
      const reorderNeeded = daysOfStockLeft < item.leadTimeDays + SAFETY_BUFFER_DAYS;
      const targetStock = item.parLevel + projectedDailyConsumption * SAFETY_BUFFER_DAYS;
      const recommendedOrderQty = reorderNeeded ? Math.max(0, Math.round(targetStock - item.currentStock)) : 0;

      const urgency: InventoryStatus["urgency"] =
        daysOfStockLeft < item.leadTimeDays ? "Critical" : reorderNeeded ? "Reorder Soon" : "Healthy";

      return { item, projectedDailyConsumption, daysOfStockLeft, reorderNeeded, recommendedOrderQty, urgency };
    })
    .sort((a, b) => a.daysOfStockLeft - b.daysOfStockLeft);
}
