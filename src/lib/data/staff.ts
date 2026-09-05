import { makeRng, addDays, isoDate } from "./random";
import { TODAY } from "./rooms";

export interface Department {
  id: string;
  name: string;
  roomsPerStaff: number; // occupied rooms one staff member can cover per shift
  minStaff: number;
}

export const DEPARTMENTS: Department[] = [
  { id: "housekeeping", name: "Housekeeping", roomsPerStaff: 12, minStaff: 4 },
  { id: "front-desk", name: "Front Desk", roomsPerStaff: 60, minStaff: 2 },
  { id: "fnb", name: "Food & Beverage", roomsPerStaff: 22, minStaff: 4 },
  { id: "maintenance", name: "Maintenance", roomsPerStaff: 150, minStaff: 2 },
  { id: "spa", name: "Spa & Wellness", roomsPerStaff: 40, minStaff: 2 },
];

export interface ScheduledStaffDay {
  date: string;
  departmentId: string;
  scheduledStaff: number;
}

const SCHEDULE_DAYS = 10;

// Schedules are drafted ~2 weeks ahead from historical averages, so they lag
// sudden demand spikes (e.g. the festival/holiday events) on purpose -
// that lag is exactly what the staffing engine should catch.
export function generateStaffSchedule(seed = 15): ScheduledStaffDay[] {
  const rng = makeRng(seed);
  const rows: ScheduledStaffDay[] = [];

  for (const dept of DEPARTMENTS) {
    const baseline = Math.max(dept.minStaff, Math.round((150 / dept.roomsPerStaff) * 0.58));
    for (let i = 0; i < SCHEDULE_DAYS; i++) {
      const date = isoDate(addDays(TODAY, i));
      const weekendBump = [0, 6].includes(addDays(TODAY, i).getUTCDay()) ? 1 : 0;
      const scheduledStaff = Math.max(
        dept.minStaff,
        baseline + weekendBump + rng.int(-1, 0)
      );
      rows.push({ date, departmentId: dept.id, scheduledStaff });
    }
  }
  return rows;
}
