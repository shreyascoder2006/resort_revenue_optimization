import { makeRng } from "./random";

export interface InventoryItem {
  id: string;
  name: string;
  category: "Housekeeping" | "Food & Beverage" | "Guest Amenities" | "Maintenance";
  unit: string;
  currentStock: number;
  parLevel: number; // target stock level
  avgDailyConsumption: number; // at ~65% occupancy baseline
  leadTimeDays: number;
  unitCost: number;
}

const ITEM_TEMPLATES: Array<Omit<InventoryItem, "id" | "currentStock">> = [
  { name: "Bath Towels", category: "Housekeeping", unit: "pcs", parLevel: 900, avgDailyConsumption: 220, leadTimeDays: 7, unitCost: 6.5 },
  { name: "Bed Linen Sets", category: "Housekeeping", unit: "sets", parLevel: 400, avgDailyConsumption: 60, leadTimeDays: 10, unitCost: 22 },
  { name: "Travel-size Toiletries", category: "Guest Amenities", unit: "kits", parLevel: 1200, avgDailyConsumption: 180, leadTimeDays: 14, unitCost: 1.8 },
  { name: "All-purpose Cleaner", category: "Housekeeping", unit: "L", parLevel: 300, avgDailyConsumption: 25, leadTimeDays: 5, unitCost: 4.2 },
  { name: "Fresh Seafood", category: "Food & Beverage", unit: "kg", parLevel: 150, avgDailyConsumption: 40, leadTimeDays: 2, unitCost: 14 },
  { name: "Coffee Beans", category: "Food & Beverage", unit: "kg", parLevel: 80, avgDailyConsumption: 9, leadTimeDays: 6, unitCost: 11 },
  { name: "Fresh Produce", category: "Food & Beverage", unit: "kg", parLevel: 200, avgDailyConsumption: 55, leadTimeDays: 2, unitCost: 3.5 },
  { name: "Bottled Water (Guest Rooms)", category: "Guest Amenities", unit: "bottles", parLevel: 2000, avgDailyConsumption: 310, leadTimeDays: 5, unitCost: 0.4 },
  { name: "Pool Chlorine Tablets", category: "Maintenance", unit: "kg", parLevel: 120, avgDailyConsumption: 6, leadTimeDays: 9, unitCost: 5.6 },
  { name: "HVAC Air Filters", category: "Maintenance", unit: "pcs", parLevel: 60, avgDailyConsumption: 1.5, leadTimeDays: 12, unitCost: 18 },
  { name: "Chiller Refrigerant (R-410A)", category: "Maintenance", unit: "cylinders", parLevel: 18, avgDailyConsumption: 0.6, leadTimeDays: 8, unitCost: 110 },
];

export interface EquipmentPartsRequirement {
  equipmentId: string;
  parts: Array<{
    itemName: string;
    quantityConsumed: number;
    reason: string;
  }>;
}

export const EQUIPMENT_PARTS_CONSUMPTION: Record<string, EquipmentPartsRequirement> = {
  "eq-2": {
    equipmentId: "eq-2",
    parts: [
      { itemName: "Chiller Refrigerant (R-410A)", quantityConsumed: 8, reason: "Refrigerant loop recharge & compressor leak repair" },
      { itemName: "HVAC Air Filters", quantityConsumed: 15, reason: "Emergency air filter replacements across offline Deluxe Ocean wing" },
    ],
  },
};

export function getEquipmentPartsConsumption(equipmentId: string): EquipmentPartsRequirement | undefined {
  return EQUIPMENT_PARTS_CONSUMPTION[equipmentId];
}

export function generateInventory(seed = 51): InventoryItem[] {
  const rng = makeRng(seed);
  return ITEM_TEMPLATES.map((t, idx) => {
    // Bias some items toward being low on stock right now to create real reorder alerts.
    // Ensure maintenance spare parts start in a healthy operational stock range at baseline.
    const isMaintenancePart = t.name.includes("HVAC") || t.name.includes("Refrigerant");
    const stockBias = isMaintenancePart
      ? 0.75 // Healthy baseline stock (e.g. 45 filters out of 60, 14 cylinders out of 18)
      : idx % 4 === 0
      ? rng.range(0.15, 0.35)
      : rng.range(0.45, 1.05);
    return {
      id: `inv-${idx + 1}`,
      ...t,
      currentStock: Math.round(t.parLevel * stockBias),
    };
  });
}
