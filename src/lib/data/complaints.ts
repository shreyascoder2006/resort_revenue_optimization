import type { Aspect } from "./reviews";
import { TODAY } from "./rooms";
import { isoDate } from "./random";

export interface GuestComplaint {
  id: string;
  guestName: string;
  roomNumber?: string;
  vipTier?: "Silver" | "Gold" | "Platinum";
  aspect: Aspect;
  facilityArea: string;
  text: string;
  starRating: number; // 1-5
  timestamp: string;
  severity: "moderate" | "severe" | "critical";
  targetEquipmentId: string;
  targetEquipmentName: string;
}

export interface ComplaintDiagnostic {
  complaint: GuestComplaint;
  rootCauseEquipmentId: string;
  rootCauseEquipmentName: string;
  rootCauseLocation: string;
  diagnosticFinding: string;
  diagnosticConfidence: number; // 0-100%
  sensorAnomalyDetected: boolean;
  workOrderNumber: string;
  workOrderPriority: "Critical" | "High" | "Medium";
  workOrderAssignedTo: string;
  workOrderEtaHours: number;
  affectedAreaName: string;
  affectedAreaStatus: "CLOSED FOR REPAIR" | "DEGRADED" | "OPERATIONAL";
  serviceRecoveryComp: {
    resortCreditAmount: number;
    complimentaryPerk: string;
    pointsAwarded: number;
    status: "DISPATCHED" | "PENDING";
  };
  ancillaryRevenueLoss: number; // USD/day
}

export const DEFAULT_SPA_COMPLAINT: GuestComplaint = {
  id: "cmp-spa-101",
  guestName: "Elena Rostova",
  roomNumber: "209",
  vipTier: "Platinum",
  aspect: "spa",
  facilityArea: "Spa Hydrotherapy Wing",
  text: "The Spa Jacuzzi water was lukewarm, jet pressure cut out completely mid-session, and there was a distinct electrical burning odor from the pump room. Completely ruined our booked private couples session!",
  starRating: 1,
  timestamp: `${isoDate(TODAY)} 10:15 AM`,
  severity: "critical",
  targetEquipmentId: "eq-6",
  targetEquipmentName: "Spa Jacuzzi Heater",
};
