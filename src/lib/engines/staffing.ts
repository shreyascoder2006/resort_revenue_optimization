import { generateDemandForecast } from "../data/bookings";
import { DEPARTMENTS, generateStaffSchedule, type Department } from "../data/staff";
import type { DemandEvent } from "../data/rooms";
import type { ResortState } from "../store/resortStore";

export interface StaffingDay {
  date: string;
  departmentId: string;
  departmentName: string;
  forecastOccupiedRooms: number;
  requiredStaff: number;
  scheduledStaff: number;
  gap: number; // scheduled - required (negative = understaffed)
  status: "Understaffed" | "Overstaffed" | "Balanced";
}

export function buildStaffingPlan(stateOrEvents?: ResortState | DemandEvent[]): StaffingDay[] {
  const isState = stateOrEvents && !Array.isArray(stateOrEvents) && "staffSchedule" in stateOrEvents;
  const forecast = isState
    ? stateOrEvents.demandForecast
    : generateDemandForecast(99, Array.isArray(stateOrEvents) ? stateOrEvents : []);
  const schedule = isState ? stateOrEvents.staffSchedule : generateStaffSchedule();
  const departments: Department[] = isState ? stateOrEvents.departments : DEPARTMENTS;

  const occupiedByDate = new Map<string, number>();
  for (const f of forecast) {
    occupiedByDate.set(f.date, (occupiedByDate.get(f.date) ?? 0) + f.bookedRooms);
  }

  const scheduleByKey = new Map(schedule.map((s) => [`${s.date}|${s.departmentId}`, s.scheduledStaff]));

  const rows: StaffingDay[] = [];
  for (const [date, occupiedRooms] of Array.from(occupiedByDate.entries()).sort()) {
    for (const dept of departments) {
      const scheduledStaff = scheduleByKey.get(`${date}|${dept.id}`);
      if (scheduledStaff === undefined) continue; // outside scheduled window
      const requiredStaff = Math.max(dept.minStaff, Math.ceil(occupiedRooms / dept.roomsPerStaff));
      const gap = scheduledStaff - requiredStaff;
      rows.push({
        date,
        departmentId: dept.id,
        departmentName: dept.name,
        forecastOccupiedRooms: occupiedRooms,
        requiredStaff,
        scheduledStaff,
        gap,
        status: gap < 0 ? "Understaffed" : gap > 3 ? "Overstaffed" : "Balanced",
      });
    }
  }
  return rows;
}
