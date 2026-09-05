import { generateDemandForecast } from "../data/bookings";
import { DEPARTMENTS, generateStaffSchedule } from "../data/staff";

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

export function buildStaffingPlan(): StaffingDay[] {
  const forecast = generateDemandForecast();
  const schedule = generateStaffSchedule();

  const occupiedByDate = new Map<string, number>();
  for (const f of forecast) {
    occupiedByDate.set(f.date, (occupiedByDate.get(f.date) ?? 0) + f.bookedRooms);
  }

  const scheduleByKey = new Map(schedule.map((s) => [`${s.date}|${s.departmentId}`, s.scheduledStaff]));

  const rows: StaffingDay[] = [];
  for (const [date, occupiedRooms] of Array.from(occupiedByDate.entries()).sort()) {
    for (const dept of DEPARTMENTS) {
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
