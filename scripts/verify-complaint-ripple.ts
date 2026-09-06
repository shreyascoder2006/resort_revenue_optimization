import { dispatchResortEvent, getResortState } from "../src/lib/store/resortStore";
import { buildPricingRecommendations } from "../src/lib/engines/pricing";
import { buildGuestImpactSummary } from "../src/lib/engines/guestImpact";
import { buildComplaintDiagnosticSummary } from "../src/lib/engines/complaintDiagnostics";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

console.log("==================================================");
console.log("FEATURE #3 VERIFICATION: GUEST COMPLAINT -> ROOT CAUSE RIPPLE");
console.log("==================================================");

// ================================================================
// A. BASELINE VERIFICATION
// ================================================================
console.log("\n--- TEST A: BASELINE ---");
dispatchResortEvent({ type: "RESET_STATE" });
const stateA = getResortState();
const diagnosticsA = buildComplaintDiagnosticSummary(stateA);

assert(stateA.activeEvents.length === 0, "No active events in baseline");
assert(diagnosticsA.hasActiveComplaint === false, "No active complaint in baseline");
assert(diagnosticsA.sentimentPlunge.delta === 0, "Sentiment delta is 0 in baseline");
assert(diagnosticsA.affectedArea.status === "OPERATIONAL", `Affected area status is OPERATIONAL (got ${diagnosticsA.affectedArea.status})`);
assert(diagnosticsA.serviceRecovery.recoveryStatus === "PENDING", "No active service recovery in baseline");
assert(diagnosticsA.revenueImpact.dailyAncillaryLoss === 0, "Ancillary revenue loss is 0 in baseline");
assert(diagnosticsA.overviewAlert === undefined, "No overview alert in baseline");

// ================================================================
// B. GUEST_COMPLAINT DISPATCHED
// ================================================================
console.log("\n--- TEST B: GUEST_COMPLAINT DISPATCHED ---");
dispatchResortEvent({
  type: "GUEST_COMPLAINT",
  complaintId: "cmp-spa-101",
  aspect: "spa",
  guestName: "Elena Rostova",
  roomNumber: "209",
  facilityArea: "Spa Hydrotherapy Wing",
  complaintText: "The Spa Jacuzzi water was lukewarm, jet pressure cut out completely mid-session, and there was a distinct electrical burning odor from the pump room.",
  targetEquipmentId: "eq-6",
  targetEquipmentName: "Spa Jacuzzi Heater",
  severity: "critical",
});

const stateB = getResortState();
const diagnosticsB = buildComplaintDiagnosticSummary(stateB);

assert(stateB.activeEvents.length === 1, `1 active event in store (got ${stateB.activeEvents.length})`);
assert(stateB.activeEvents[0].type === "GUEST_COMPLAINT", "Active event is GUEST_COMPLAINT");
assert(diagnosticsB.hasActiveComplaint === true, "Diagnostics detects active guest complaint");

// 1. Sentiment Drops
assert(diagnosticsB.sentimentPlunge.aspect === "spa", `Sentiment aspect evaluated is spa (got ${diagnosticsB.sentimentPlunge.aspect})`);
assert(diagnosticsB.sentimentPlunge.impactedScore < 0, `Impacted sentiment score plunged negative (got ${diagnosticsB.sentimentPlunge.impactedScore})`);
assert(diagnosticsB.sentimentPlunge.delta < -1.0, `Sentiment dropped by over 1.0 full point (got ${diagnosticsB.sentimentPlunge.delta})`);

// 2. Root Cause Identified
assert(diagnosticsB.rootCause.equipmentId === "eq-6", `Root cause equipment identified as eq-6 (got ${diagnosticsB.rootCause.equipmentId})`);
assert(diagnosticsB.rootCause.equipmentName === "Spa Jacuzzi Heater", `Equipment name is Spa Jacuzzi Heater (got ${diagnosticsB.rootCause.equipmentName})`);
assert(diagnosticsB.rootCause.confidence >= 90, `Diagnostic confidence is high (got ${diagnosticsB.rootCause.confidence}%)`);
assert(diagnosticsB.rootCause.finding.includes("heating coil"), "Finding identifies heating coil burnout");

// 3. Maintenance / Operations Alert
assert(diagnosticsB.maintenanceAlert.workOrderNumber === "WO-4182", `Emergency Work Order WO-4182 generated (got ${diagnosticsB.maintenanceAlert.workOrderNumber})`);
assert(diagnosticsB.maintenanceAlert.priority === "Critical", "Work order priority is Critical");
assert(diagnosticsB.maintenanceAlert.etaHours === 2, `Work order ETA is 2 hours (got ${diagnosticsB.maintenanceAlert.etaHours})`);

// 4. Affected Area Flagged
assert(diagnosticsB.affectedArea.name === "Spa Hydrotherapy Wing", `Affected area is Spa Hydrotherapy Wing (got ${diagnosticsB.affectedArea.name})`);
assert(diagnosticsB.affectedArea.status === "CLOSED FOR REPAIR", `Affected area status is CLOSED FOR REPAIR (got ${diagnosticsB.affectedArea.status})`);
assert(diagnosticsB.affectedArea.impactedBookingsCount === 12, `12 scheduled sessions flagged as paused (got ${diagnosticsB.affectedArea.impactedBookingsCount})`);

// 5. Revenue / Guest Experience Impact
assert(diagnosticsB.serviceRecovery.guestName === "Elena Rostova", `Service recovery dispatched to Elena Rostova (got ${diagnosticsB.serviceRecovery.guestName})`);
assert(diagnosticsB.serviceRecovery.creditAmount === 75, `Resort credit of $75 issued (got $${diagnosticsB.serviceRecovery.creditAmount})`);
assert(diagnosticsB.serviceRecovery.pointsAwarded === 5000, `5,000 points awarded (got ${diagnosticsB.serviceRecovery.pointsAwarded})`);
assert(diagnosticsB.serviceRecovery.recoveryStatus === "DISPATCHED", "Service recovery status is DISPATCHED");
assert(diagnosticsB.revenueImpact.dailyAncillaryLoss === 1400, `Daily ancillary revenue loss calculated as $1,400 (got $${diagnosticsB.revenueImpact.dailyAncillaryLoss})`);

// 6. Executive Overview Alert
assert(diagnosticsB.overviewAlert !== undefined, "Executive Overview alert generated");
assert(diagnosticsB.overviewAlert?.category === "Root Cause Correlated", `Alert category is Root Cause Correlated (got ${diagnosticsB.overviewAlert?.category})`);
assert(diagnosticsB.overviewAlert?.variant === "critical", "Alert variant is critical");
assert(Boolean(diagnosticsB.overviewAlert?.text.includes("Elena Rostova")), "Alert mentions affected guest name");
assert(Boolean(diagnosticsB.overviewAlert?.text.includes("Spa Jacuzzi Heater")), "Alert mentions root cause asset");

console.log(`Incident Summary: Guest=${diagnosticsB.complaint?.guestName}, Aspect=${diagnosticsB.sentimentPlunge.aspect}, ScoreDrop=${diagnosticsB.sentimentPlunge.delta}, RootCause=${diagnosticsB.rootCause.equipmentName} (${diagnosticsB.rootCause.confidence}%), WO=${diagnosticsB.maintenanceAlert.workOrderNumber}, Area=${diagnosticsB.affectedArea.name} [${diagnosticsB.affectedArea.status}], Comp=$${diagnosticsB.serviceRecovery.creditAmount}, YieldLoss=$${diagnosticsB.revenueImpact.dailyAncillaryLoss}`);

// ================================================================
// C. COMPLAINT_RESOLVED
// ================================================================
console.log("\n--- TEST C: COMPLAINT_RESOLVED ---");
dispatchResortEvent({
  type: "COMPLAINT_RESOLVED",
  complaintId: "cmp-spa-101",
});

const stateC = getResortState();
const diagnosticsC = buildComplaintDiagnosticSummary(stateC);

assert(stateC.activeEvents.length === 0, "activeEvents cleared on complaint resolution");
assert(diagnosticsC.hasActiveComplaint === false, "Complaint flag cleared after resolution");
assert(diagnosticsC.affectedArea.status === "OPERATIONAL", "Affected area restored to OPERATIONAL");
assert(diagnosticsC.sentimentPlunge.delta === 0, "Sentiment delta restored to 0");
assert(diagnosticsC.revenueImpact.dailyAncillaryLoss === 0, "Revenue loss cleared to 0");
assert(diagnosticsC.overviewAlert === undefined, "Overview alert cleared");

// ================================================================
// D. MULTI-EVENT COEXISTENCE (SURGE + FAILURE + COMPLAINT)
// ================================================================
console.log("\n--- TEST D: MULTI-EVENT COEXISTENCE ---");
dispatchResortEvent({
  type: "DEMAND_SURGE",
  demandBoost: 0.2,
  reason: "Surprise Festival",
});
dispatchResortEvent({
  type: "EQUIPMENT_FAILURE",
  equipmentId: "eq-2",
  reason: "Chiller Unit 2 failure",
});
dispatchResortEvent({
  type: "GUEST_COMPLAINT",
  complaintId: "cmp-spa-101",
  aspect: "spa",
  guestName: "Elena Rostova",
  roomNumber: "209",
  facilityArea: "Spa Hydrotherapy Wing",
  complaintText: "Lukewarm jacuzzi water.",
  targetEquipmentId: "eq-6",
  targetEquipmentName: "Spa Jacuzzi Heater",
});

const stateD = getResortState();
const pricingD = buildPricingRecommendations(stateD);
const guestImpactD = buildGuestImpactSummary(stateD);
const diagnosticsD = buildComplaintDiagnosticSummary(stateD);

assert(stateD.activeEvents.length === 3, `All 3 distinct events active simultaneously (got ${stateD.activeEvents.length})`);
assert(pricingD.hasSurge === true, "Demand surge active in pricing engine");
assert(pricingD.hasEquipmentFailure === true, "Equipment failure active in pricing engine");
assert(pricingD.totalOutOfOrderRooms === 15, "15 Deluxe Ocean rooms offline");
assert(guestImpactD.totalAffectedGuests === 8, "8 guests disrupted by room outage");
assert(diagnosticsD.hasActiveComplaint === true, "Guest complaint diagnostics active in spa");
assert(diagnosticsD.affectedArea.status === "CLOSED FOR REPAIR", "Spa Hydrotherapy Wing closed for repair during multi-event");

// ================================================================
// E. SELECTIVE EVENT RESOLUTION
// ================================================================
console.log("\n--- TEST E: SELECTIVE EVENT RESOLUTION ---");
// 1. Resolve Complaint
dispatchResortEvent({
  type: "COMPLAINT_RESOLVED",
  complaintId: "cmp-spa-101",
});
const stateE1 = getResortState();
const diagnosticsE1 = buildComplaintDiagnosticSummary(stateE1);
const pricingE1 = buildPricingRecommendations(stateE1);

assert(stateE1.activeEvents.length === 2, `2 events remain active after complaint resolved (got ${stateE1.activeEvents.length})`);
assert(diagnosticsE1.hasActiveComplaint === false, "Complaint cleared");
assert(pricingE1.hasSurge === true, "Surge remains intact");
assert(pricingE1.hasEquipmentFailure === true, "Equipment failure remains intact");

// 2. Recover Equipment
dispatchResortEvent({
  type: "EQUIPMENT_RECOVERY",
  equipmentId: "eq-2",
});
const stateE2 = getResortState();
const pricingE2 = buildPricingRecommendations(stateE2);

assert(stateE2.activeEvents.length === 1, `1 event remains active (got ${stateE2.activeEvents.length})`);
assert(pricingE2.hasSurge === true, "Surge still active");
assert(pricingE2.hasEquipmentFailure === false, "Equipment failure cleared");
assert(pricingE2.totalAvailableRooms === 150, "All 150 rooms restored to available");

// 3. Reset State
dispatchResortEvent({ type: "RESET_STATE" });
const stateE3 = getResortState();
const diagnosticsE3 = buildComplaintDiagnosticSummary(stateE3);
const pricingE3 = buildPricingRecommendations(stateE3);

assert(stateE3.activeEvents.length === 0, "All active events cleared on RESET_STATE");
assert(pricingE3.totalAvailableRooms === 150, "150 rooms available");
assert(diagnosticsE3.hasActiveComplaint === false, "No active complaint on reset");
assert(diagnosticsE3.affectedArea.status === "OPERATIONAL", "All areas operational on reset");

console.log("\n🎉 ALL FEATURE #3 COMPLAINT RIPPLE CHECKS (A through E) PASSED WITH 100% SUCCESS!");
