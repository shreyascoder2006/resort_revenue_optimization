import type { ResortState } from "../store/resortStore";
import { DEFAULT_SPA_COMPLAINT, type GuestComplaint } from "../data/complaints";
import type { Aspect } from "../data/reviews";

export interface SentimentPlunge {
  aspect: Aspect;
  baselineScore: number;
  impactedScore: number;
  delta: number;
  description: string;
}

export interface RootCauseDiagnosis {
  equipmentId: string;
  equipmentName: string;
  location: string;
  confidence: number; // 0-100%
  finding: string;
  telemetryEvidence: string;
}

export interface MaintenanceTicket {
  workOrderNumber: string;
  priority: "Critical" | "High" | "Medium";
  title: string;
  assignedTeam: string;
  etaHours: number;
  actionPlan: string;
}

export interface AffectedAreaFlag {
  name: string;
  status: "CLOSED FOR REPAIR" | "DEGRADED" | "OPERATIONAL";
  guestNotice: string;
  impactedBookingsCount: number;
}

export interface ServiceRecoveryComp {
  guestName: string;
  roomNumber: string;
  creditAmount: number;
  complimentaryPerk: string;
  pointsAwarded: number;
  recoveryStatus: "DISPATCHED" | "PENDING";
}

export interface AncillaryRevenueImpact {
  dailyAncillaryLoss: number;
  reason: string;
}

export interface ComplaintDiagnosticSummary {
  hasActiveComplaint: boolean;
  complaint?: GuestComplaint;
  sentimentPlunge: SentimentPlunge;
  rootCause: RootCauseDiagnosis;
  maintenanceAlert: MaintenanceTicket;
  affectedArea: AffectedAreaFlag;
  serviceRecovery: ServiceRecoveryComp;
  revenueImpact: AncillaryRevenueImpact;
  overviewAlert?: {
    category: "Root Cause Correlated";
    variant: "critical" | "warning";
    title: string;
    text: string;
  };
}

/**
 * Pure intelligence function that derives the complete reverse ripple effect:
 * Guest Complaint -> Sentiment Drop -> Root Cause Identification -> Maintenance Alert ->
 * Affected Area Flag -> Revenue/Guest Experience Impact -> Executive Overview Alert
 */
export function buildComplaintDiagnosticSummary(state: ResortState): ComplaintDiagnosticSummary {
  const complaintEvent = state.activeEvents.find((e) => e.type === "GUEST_COMPLAINT");

  if (!complaintEvent) {
    return {
      hasActiveComplaint: false,
      sentimentPlunge: {
        aspect: "spa",
        baselineScore: 0.68,
        impactedScore: 0.68,
        delta: 0,
        description: "All aspect sentiments operating within normal historical thresholds.",
      },
      rootCause: {
        equipmentId: "eq-6",
        equipmentName: "Spa Jacuzzi Heater",
        location: "Spa Wing",
        confidence: 0,
        finding: "No active anomaly correlated to guest feedback.",
        telemetryEvidence: "Normal telemetry parameters.",
      },
      maintenanceAlert: {
        workOrderNumber: "WO-0000",
        priority: "Medium",
        title: "Standard Preventive Cycle",
        assignedTeam: "Facilities Maintenance",
        etaHours: 24,
        actionPlan: "Standard inspection cycle.",
      },
      affectedArea: {
        name: "Spa Hydrotherapy Wing",
        status: "OPERATIONAL",
        guestNotice: "All resort amenities and spa facilities fully operational.",
        impactedBookingsCount: 0,
      },
      serviceRecovery: {
        guestName: "None",
        roomNumber: "N/A",
        creditAmount: 0,
        complimentaryPerk: "None",
        pointsAwarded: 0,
        recoveryStatus: "PENDING",
      },
      revenueImpact: {
        dailyAncillaryLoss: 0,
        reason: "Full ancillary yield capacity operational.",
      },
    };
  }

  const details = (complaintEvent.details ?? {}) as Record<string, unknown>;
  const complaint: GuestComplaint = {
    id: (details.complaintId as string) ?? DEFAULT_SPA_COMPLAINT.id,
    guestName: (details.guestName as string) ?? DEFAULT_SPA_COMPLAINT.guestName,
    roomNumber: (details.roomNumber as string) ?? DEFAULT_SPA_COMPLAINT.roomNumber,
    vipTier: DEFAULT_SPA_COMPLAINT.vipTier,
    aspect: (details.aspect as Aspect) ?? DEFAULT_SPA_COMPLAINT.aspect,
    facilityArea: (details.facilityArea as string) ?? DEFAULT_SPA_COMPLAINT.facilityArea,
    text: (details.complaintText as string) ?? DEFAULT_SPA_COMPLAINT.text,
    starRating: 1,
    timestamp: complaintEvent.appliedAt.slice(0, 16).replace("T", " "),
    severity: (details.severity as "moderate" | "severe" | "critical") ?? "critical",
    targetEquipmentId: (details.targetEquipmentId as string) ?? DEFAULT_SPA_COMPLAINT.targetEquipmentId,
    targetEquipmentName: (details.targetEquipmentName as string) ?? DEFAULT_SPA_COMPLAINT.targetEquipmentName,
  };

  // Correlate with physical equipment telemetry in state
  const targetEq = state.equipment.find((eq) => eq.id === complaint.targetEquipmentId);
  const anomalyScore = targetEq ? Math.round(targetEq.sensorAnomalyScore * 100) : 88;
  const isOverdue = targetEq ? targetEq.daysSinceService > targetEq.serviceIntervalDays : true;

  const baselineScore = 0.68;
  const impactedScore = -0.45;
  const delta = Math.round((impactedScore - baselineScore) * 100) / 100;

  return {
    hasActiveComplaint: true,
    complaint,
    sentimentPlunge: {
      aspect: complaint.aspect,
      baselineScore,
      impactedScore,
      delta,
      description: `"${complaint.aspect}" sentiment plunged by ${Math.abs(delta)} pts (${baselineScore > 0 ? "+" : ""}${baselineScore} -> ${impactedScore}) following 1-star incident report.`,
    },
    rootCause: {
      equipmentId: complaint.targetEquipmentId,
      equipmentName: complaint.targetEquipmentName,
      location: targetEq?.location ?? "Spa Wing",
      confidence: 96,
      finding: `${complaint.targetEquipmentName} heating coil burned out with secondary thermal regulator breaker trip.`,
      telemetryEvidence: `Sensor anomaly spiked to ${anomalyScore}%. Telemetry confirms water temperature output dropped to 72°F (target 104°F) while power draw surged. Overdue service status: ${isOverdue ? "OVERDUE" : "NORMAL"}.`,
    },
    maintenanceAlert: {
      workOrderNumber: "WO-4182",
      priority: "Critical",
      title: `Emergency Repair: ${complaint.targetEquipmentName}`,
      assignedTeam: "Facilities & Thermal Systems",
      etaHours: 2,
      actionPlan: "Replace burned out 12kW heating element, test contactor, and perform temperature recalibration.",
    },
    affectedArea: {
      name: complaint.facilityArea,
      status: "CLOSED FOR REPAIR",
      guestNotice: "Spa Hydrotherapy Wing & Jacuzzi #2 temporarily offline for emergency heating maintenance. Reopening ETA: 2 hours.",
      impactedBookingsCount: 12,
    },
    serviceRecovery: {
      guestName: complaint.guestName,
      roomNumber: complaint.roomNumber ?? "209",
      creditAmount: 75,
      complimentaryPerk: "Complimentary 60-min signature deep-tissue massage + full session refund",
      pointsAwarded: 5000,
      recoveryStatus: "DISPATCHED",
    },
    revenueImpact: {
      dailyAncillaryLoss: 1400,
      reason: "Suspended 12 scheduled private hydrotherapy sessions & walk-in day pass sales during 2-hour maintenance window.",
    },
    overviewAlert: {
      category: "Root Cause Correlated",
      variant: "critical",
      title: "Guest Complaint Traced to Equipment Root Cause",
      text: `${complaint.guestName} (${complaint.roomNumber ? `Room ${complaint.roomNumber}` : "Guest"}) complaint regarding ${complaint.facilityArea} traced to ${complaint.targetEquipmentName} (${complaint.targetEquipmentId}) heating coil burnout. ${complaint.facilityArea} closed for emergency repair; $75 service recovery & 5k points dispatched.`,
    },
  };
}
