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

export function generateEquipment(seed = 33): Equipment[] {
  const rng = makeRng(seed);
  return EQUIPMENT_TEMPLATES.map((t, idx) => {
    // Some assets are overdue on purpose to create realistic alerts.
    const overdueBias = idx % 3 === 0 ? rng.range(1.1, 1.9) : rng.range(0.2, 1.0);
    const daysSinceService = Math.round(t.serviceIntervalDays * overdueBias);
    const ageRatio = t.installedYearsAgo / t.ratedLifeYears;
    const anomalyBase = ageRatio * 0.35 + (daysSinceService / t.serviceIntervalDays) * 0.25;
    const sensorAnomalyScore = Math.min(0.98, Math.max(0.02, anomalyBase + rng.range(-0.1, 0.15)));

    return {
      id: `eq-${idx + 1}`,
      ...t,
      daysSinceService,
      sensorAnomalyScore,
    };
  });
}
