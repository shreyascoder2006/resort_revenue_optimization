import { makeRng } from "./random";

export interface Equipment {
  id: string;
  name: string;
  category: "HVAC" | "Pool & Spa" | "Kitchen" | "Elevator" | "Power" | "Laundry";
  location: string;
  installedYearsAgo: number;
  ratedLifeYears: number;
  daysSinceService: number;
  serviceIntervalDays: number;
  runtimeHoursPerDay: number;
  sensorAnomalyScore: number; // 0-1, higher = more abnormal vibration/temp/current readings
}

const EQUIPMENT_TEMPLATES: Array<Omit<Equipment, "id" | "daysSinceService" | "sensorAnomalyScore">> = [
  { name: "Chiller Unit 1", category: "HVAC", location: "Central Plant", installedYearsAgo: 7, ratedLifeYears: 15, serviceIntervalDays: 90, runtimeHoursPerDay: 20 },
  { name: "Chiller Unit 2", category: "HVAC", location: "Central Plant", installedYearsAgo: 3, ratedLifeYears: 15, serviceIntervalDays: 90, runtimeHoursPerDay: 20 },
  { name: "Rooftop AHU - East Wing", category: "HVAC", location: "East Wing Roof", installedYearsAgo: 9, ratedLifeYears: 12, serviceIntervalDays: 60, runtimeHoursPerDay: 18 },
  { name: "Rooftop AHU - West Wing", category: "HVAC", location: "West Wing Roof", installedYearsAgo: 4, ratedLifeYears: 12, serviceIntervalDays: 60, runtimeHoursPerDay: 18 },
  { name: "Main Pool Filtration Pump", category: "Pool & Spa", location: "Main Pool", installedYearsAgo: 5, ratedLifeYears: 10, serviceIntervalDays: 45, runtimeHoursPerDay: 24 },
  { name: "Spa Jacuzzi Heater", category: "Pool & Spa", location: "Spa Wing", installedYearsAgo: 6, ratedLifeYears: 8, serviceIntervalDays: 45, runtimeHoursPerDay: 10 },
  { name: "Walk-in Freezer Compressor", category: "Kitchen", location: "Main Kitchen", installedYearsAgo: 8, ratedLifeYears: 10, serviceIntervalDays: 60, runtimeHoursPerDay: 24 },
  { name: "Commercial Dishwasher", category: "Kitchen", location: "Main Kitchen", installedYearsAgo: 2, ratedLifeYears: 8, serviceIntervalDays: 30, runtimeHoursPerDay: 12 },
  { name: "Guest Elevator 1", category: "Elevator", location: "Main Lobby", installedYearsAgo: 11, ratedLifeYears: 20, serviceIntervalDays: 30, runtimeHoursPerDay: 16 },
  { name: "Guest Elevator 2", category: "Elevator", location: "East Wing", installedYearsAgo: 5, ratedLifeYears: 20, serviceIntervalDays: 30, runtimeHoursPerDay: 16 },
  { name: "Backup Generator", category: "Power", location: "Utility Yard", installedYearsAgo: 10, ratedLifeYears: 18, serviceIntervalDays: 90, runtimeHoursPerDay: 1 },
  { name: "Industrial Laundry Dryer", category: "Laundry", location: "Laundry Facility", installedYearsAgo: 6, ratedLifeYears: 9, serviceIntervalDays: 45, runtimeHoursPerDay: 14 },
];

export function generateEquipment(seed = 33, forceFailureId?: string): Equipment[] {
  const rng = makeRng(seed);
  return EQUIPMENT_TEMPLATES.map((t, idx) => {
    const id = `eq-${idx + 1}`;
    // Some assets are overdue on purpose to create realistic alerts.
    const overdueBias = idx % 3 === 0 ? rng.range(1.1, 1.9) : rng.range(0.2, 1.0);
    let daysSinceService = Math.round(t.serviceIntervalDays * overdueBias);
    const ageRatio = t.installedYearsAgo / t.ratedLifeYears;
    let sensorAnomalyScore = Math.min(
      0.98,
      Math.max(0.02, ageRatio * 0.35 + (daysSinceService / t.serviceIntervalDays) * 0.25 + rng.range(-0.1, 0.15))
    );

    if (id === forceFailureId) {
      // Simulates a sudden overnight failure: sensor readings spike and service is now badly overdue.
      daysSinceService = Math.round(t.serviceIntervalDays * 2.2);
      sensorAnomalyScore = 0.96;
    }

    return {
      id,
      ...t,
      daysSinceService,
      sensorAnomalyScore,
    };
  });
}

export interface EquipmentRoomImpact {
  equipmentId: string;
  roomTypeId: string;
  affectedRoomCount: number;
  affectedRoomIds: string[]; // Deterministic list of specific room IDs
  description: string;
}

export const EQUIPMENT_ROOM_MAPPINGS: Record<string, EquipmentRoomImpact> = {
  "eq-2": {
    equipmentId: "eq-2",
    roomTypeId: "deluxe-ocean",
    affectedRoomCount: 15,
    affectedRoomIds: Array.from({ length: 15 }, (_, i) => `deluxe-ocean-${201 + i}`),
    description: "Chiller Unit 2 failure takes 15 Deluxe Ocean View rooms offline due to loss of HVAC cooling.",
  },
  "eq-11": {
    equipmentId: "eq-11",
    roomTypeId: "deluxe-ocean",
    affectedRoomCount: 40,
    affectedRoomIds: [
      ...Array.from({ length: 25 }, (_, i) => `deluxe-ocean-${201 + i}`),
      ...Array.from({ length: 15 }, (_, i) => `lagoon-villa-${301 + i}`),
    ],
    description: "Main Power Substation & Generator failure takes 40 rooms offline across Deluxe Ocean and Lagoon Villa wings.",
  },
};

export function getEquipmentAffectedRooms(equipmentId: string): EquipmentRoomImpact | undefined {
  return EQUIPMENT_ROOM_MAPPINGS[equipmentId];
}
