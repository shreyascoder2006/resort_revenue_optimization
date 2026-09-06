import type { ResortState } from "../store/resortStore";
import type { GuestProfile } from "../data/guests";

export interface AffectedGuestInfo {
  guest: GuestProfile;
  roomNumber: string;
  roomTypeId: string;
  category: "IN_HOUSE" | "ARRIVING_TODAY" | "UPCOMING";
  urgency: "Immediate Relocation" | "Reassignment Before Check-In" | "Advance Notice";
  suggestedAlternativeRoomType: string;
}

export interface RelocationAlert {
  id: string;
  severity: "Critical" | "Warning" | "critical" | "warning";
  title: string;
  message: string;
  affectedRoomCount: number;
  affectedGuestCount: number;
  roomCount: number;
  guestCount: number;
  reason: string;
  actionRequired: string;
}

export interface GuestImpactSummary {
  hasEquipmentFailure: boolean;
  equipmentId?: string;
  equipmentName?: string;
  activeEquipmentName?: string;
  failureReason?: string;
  affectedRoomCount: number;
  affectedRoomIds: string[];
  affectedCurrentCount: number; // in-house guests currently in disrupted rooms
  affectedArrivingCount: number; // guests arriving today assigned to disrupted rooms
  affectedUpcomingCount: number; // upcoming reservations assigned to disrupted rooms
  totalAffectedGuests: number;
  affectedGuests: AffectedGuestInfo[];
  serviceRiskLevel: "Normal" | "Elevated" | "High";
  serviceRiskDetail?: string;
  relocationRequired: boolean;
  relocationAlert?: RelocationAlert;
  availableAlternativeRooms: number;
}

/**
 * Pure intelligence function that derives guest impact and service risk
 * from the shared ResortState (rooms, equipment events, and guest roster).
 *
 * Architecture:
 * ResortState -> buildGuestImpactSummary(state) -> UI Components
 */
export function buildGuestImpactSummary(state: ResortState): GuestImpactSummary {
  const failureEvent = state.activeEvents.find((e) => e.type === "EQUIPMENT_FAILURE");
  const surgeEvent = state.activeEvents.find((e) => e.type === "DEMAND_SURGE");
  const hasEquipmentFailure = Boolean(failureEvent);

  const equipmentId = (failureEvent?.details?.equipmentId as string) ?? undefined;
  const equipmentName = (failureEvent?.details?.equipmentName as string) ?? (hasEquipmentFailure ? "Chiller Unit 2" : undefined);
  const failureReason = (failureEvent?.details?.reason as string) ?? undefined;

  // 1. Identify out of order rooms
  const outOfOrderRooms = state.individualRooms.filter((r) => r.status === "OUT_OF_ORDER");
  const affectedRoomIds = outOfOrderRooms.map((r) => r.id);
  const affectedRoomSet = new Set(affectedRoomIds);
  const affectedRoomCount = outOfOrderRooms.length;

  // 2. Identify guests assigned to affected rooms
  const affectedGuests: AffectedGuestInfo[] = [];

  if (hasEquipmentFailure && affectedRoomCount > 0) {
    for (const guest of state.guests) {
      if (guest.assignedRoomId && affectedRoomSet.has(guest.assignedRoomId)) {
        const room = outOfOrderRooms.find((r) => r.id === guest.assignedRoomId);
        const roomNumber = guest.roomNumber ?? room?.roomNumber ?? guest.assignedRoomId.split("-").pop() ?? "";
        
        let category: AffectedGuestInfo["category"] = "IN_HOUSE";
        if (guest.status === "ARRIVING_TODAY" || guest.checkIn === "2026-09-05") {
          category = "ARRIVING_TODAY";
        } else if (guest.status === "UPCOMING" || guest.checkIn > "2026-09-05") {
          category = "UPCOMING";
        }

        const urgency: AffectedGuestInfo["urgency"] =
          category === "IN_HOUSE"
            ? "Immediate Relocation"
            : category === "ARRIVING_TODAY"
            ? "Reassignment Before Check-In"
            : "Advance Notice";

        const suggestedAlternativeRoomType =
          guest.loyaltyTier === "Platinum"
            ? "Presidential Villa / Suite Upgrade"
            : "Deluxe Ocean (Operable Wing) / Suite Upgrade";

        affectedGuests.push({
          guest,
          roomNumber,
          roomTypeId: guest.roomTypeId,
          category,
          urgency,
          suggestedAlternativeRoomType,
        });
      }
    }
  }

  // Sort by urgency: In-house first, then arriving today, then upcoming
  affectedGuests.sort((a, b) => {
    const order = { IN_HOUSE: 0, ARRIVING_TODAY: 1, UPCOMING: 2 };
    return order[a.category] - order[b.category];
  });

  const affectedCurrentCount = affectedGuests.filter((g) => g.category === "IN_HOUSE").length;
  const affectedArrivingCount = affectedGuests.filter((g) => g.category === "ARRIVING_TODAY").length;
  const affectedUpcomingCount = affectedGuests.filter((g) => g.category === "UPCOMING").length;
  const totalAffectedGuests = affectedGuests.length;
  const relocationRequired = affectedCurrentCount > 0 || affectedArrivingCount > 0;

  // 3. Calculate Service Risk deterministically
  let serviceRiskLevel: "Normal" | "Elevated" | "High" = "Normal";
  let serviceRiskDetail: string | undefined;

  if (hasEquipmentFailure) {
    if (relocationRequired) {
      serviceRiskLevel = "High";
    } else if (affectedRoomCount > 0) {
      serviceRiskLevel = "Elevated";
    }

    if (surgeEvent) {
      serviceRiskDetail = `CRITICAL COMPOUND RISK: ${equipmentName} failure offline during ${surgeEvent.label}. ${affectedRoomCount} rooms offline, ${totalAffectedGuests} guests disrupted (${affectedCurrentCount} in-house, ${affectedArrivingCount} arriving today). Relocation required while check-in and dining queues peak.`;
    } else {
      serviceRiskDetail = `ACTIVE DISRUPTION: ${equipmentName} failure disabled cooling across ${affectedRoomCount} rooms. ${totalAffectedGuests} guests impacted (${affectedCurrentCount} in-house, ${affectedArrivingCount} arriving today). Immediate guest relocation required.`;
    }
  } else if (surgeEvent) {
    const boost = (surgeEvent.details?.demandBoost as number) ?? 0.2;
    serviceRiskLevel = boost >= 0.25 ? "High" : "Elevated";
    serviceRiskDetail = `Upcoming ${surgeEvent.label} is forecasted to exceed standard staffing thresholds, creating elevated risk for front desk queues, dining wait times, and housekeeping backlogs.`;
  }

  // 4. Generate derived relocation alert
  let relocationAlert: RelocationAlert | undefined;
  if (relocationRequired) {
    relocationAlert = {
      id: `relocation-${equipmentId ?? "equipment"}`,
      severity: "Critical",
      title: "Guest Relocation Required",
      message: `${equipmentName ?? "Equipment"} failure has taken ${affectedRoomCount} rooms offline. ${affectedCurrentCount} in-house guest(s) require immediate room transfer; ${affectedArrivingCount} arriving guest(s) require pre-arrival reassignment.`,
      affectedRoomCount,
      affectedGuestCount: totalAffectedGuests,
      roomCount: affectedRoomCount,
      guestCount: totalAffectedGuests,
      reason: failureReason ?? `${equipmentName ?? "Equipment"} compressor breakdown`,
      actionRequired: "Front Desk & Concierge: Execute room transfers to operable inventory and issue service recovery compensation.",
    };
  }

  const availableAlternativeRooms = state.individualRooms.filter((r) => r.status === "AVAILABLE").length;

  return {
    hasEquipmentFailure,
    equipmentId,
    equipmentName,
    activeEquipmentName: equipmentName,
    failureReason,
    affectedRoomCount,
    affectedRoomIds,
    affectedCurrentCount,
    affectedArrivingCount,
    affectedUpcomingCount,
    totalAffectedGuests,
    affectedGuests,
    serviceRiskLevel,
    serviceRiskDetail,
    relocationRequired,
    relocationAlert,
    availableAlternativeRooms,
  };
}
