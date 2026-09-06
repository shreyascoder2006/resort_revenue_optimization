import { dispatchResortEvent, getResortState } from "../src/lib/store/resortStore";
import { buildPricingRecommendations } from "../src/lib/engines/pricing";
import { buildGuestImpactSummary } from "../src/lib/engines/guestImpact";
import { buildComplaintDiagnosticSummary } from "../src/lib/engines/complaintDiagnostics";
import { formatCurrency } from "../src/lib/utils/currency";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

console.log("==================================================");
console.log("FEATURE #4 VERIFICATION: MANAGER PRICING OVERRIDE RIPPLE EFFECT");
console.log("==================================================");

// ================================================================
// STEP 1: BASELINE VERIFICATION
// ================================================================
console.log("\n--- TEST 1: BASELINE STATE (INR CURRENCY) ---");
dispatchResortEvent({ type: "RESET_STATE" });
const state1 = getResortState();
const pricing1 = buildPricingRecommendations(state1);

assert(state1.currency === "INR", `State currency is INR (got ${state1.currency})`);
assert(pricing1.currency === "INR", `Pricing summary currency is INR (got ${pricing1.currency})`);
assert(pricing1.hasPricingOverride === false, "No pricing overrides active in baseline");

const deluxeRecs1 = pricing1.recommendations.filter((r) => r.roomTypeId === "deluxe-ocean");
assert(deluxeRecs1.length > 0, "Deluxe Ocean recommendations exist");
const deluxeFirst1 = deluxeRecs1[0];

console.log(`Deluxe Ocean Baseline: baseRate=${deluxeFirst1.baseRate}, demand=${deluxeFirst1.demandLevel}, calculatedRate=${deluxeFirst1.calculatedRate}, recommendedRate=${deluxeFirst1.recommendedRate}`);

assert(deluxeFirst1.baseRate === 8200, `Deluxe Ocean base rate is ₹8,200 (got ₹${deluxeFirst1.baseRate})`);
assert(deluxeFirst1.demandLevel === "High", `Deluxe Ocean demand level is High (got ${deluxeFirst1.demandLevel})`);
assert(deluxeFirst1.calculatedRate === 9200, `Deluxe Ocean algorithm rate is ₹9,200 (got ₹${deluxeFirst1.calculatedRate})`);
assert(deluxeFirst1.recommendedRate === 9200, `Deluxe Ocean recommended rate is ₹9,200 (got ₹${deluxeFirst1.recommendedRate})`);
assert(deluxeFirst1.isOverridden === false, "Deluxe Ocean is not overridden in baseline");

const baselineAdr = pricing1.forecastAdr;
const baselineRevPar = pricing1.forecastRevPar;
const baselineRevenue = pricing1.next7ProjectedRevenue;
console.log(`Baseline Forecast: ADR=${formatCurrency(baselineAdr, "INR")}, RevPAR=${formatCurrency(baselineRevPar, "INR")}, 7d Rev=${formatCurrency(baselineRevenue, "INR")}`);

// ================================================================
// STEP 2: MANAGER CHANGES PRICE -> ₹10,000
// ================================================================
console.log("\n--- TEST 2: MANAGER DISPATCHES PRICING_OVERRIDE -> ₹10,000 ---");
dispatchResortEvent({
  type: "PRICING_OVERRIDE",
  roomTypeId: "deluxe-ocean",
  overrideRate: 10000,
  originalRate: 9200,
  reason: "Manager peak ADR adjustment",
});

const state2 = getResortState();
assert(state2.pricingOverrides?.["deluxe-ocean"] === 10000, `Store holds override for deluxe-ocean: ${state2.pricingOverrides?.["deluxe-ocean"]}`);
const overrideEvent = state2.activeEvents.find((e) => e.type === "PRICING_OVERRIDE");
assert(overrideEvent !== undefined, "AppliedResortEvent for PRICING_OVERRIDE exists in activeEvents");
assert(overrideEvent?.details?.overrideRate === 10000, `Override event details has overrideRate 10000 (got ${overrideEvent?.details?.overrideRate})`);

// ================================================================
// STEP 3: LIVE RESORT STATE RIPPLE EFFECT
// ================================================================
console.log("\n--- TEST 3: REVENUE ENGINE DYNAMIC RIPPLE EFFECT ---");
const pricing2 = buildPricingRecommendations(state2);

assert(pricing2.hasPricingOverride === true, "Pricing summary flags hasPricingOverride === true");

const deluxeRecs2 = pricing2.recommendations.filter((r) => r.roomTypeId === "deluxe-ocean");
const deluxeFirst2 = deluxeRecs2[0];

console.log(`Deluxe Ocean Post-Override: baseRate=${deluxeFirst2.baseRate}, recommendedRate=${deluxeFirst2.recommendedRate}, isOverridden=${deluxeFirst2.isOverridden}`);
assert(deluxeFirst2.recommendedRate === 10000, `Deluxe Ocean recommended rate is now ₹10,000 (got ₹${deluxeFirst2.recommendedRate})`);
assert(deluxeFirst2.calculatedRate === 9200, `Original algorithm recommendation preserved as ₹9,200 (got ₹${deluxeFirst2.calculatedRate})`);
assert(deluxeFirst2.isOverridden === true, "Deluxe Ocean flagged as isOverridden === true");

// Verify ADR, RevPAR, and Revenue increase
console.log(`Updated Forecast: ADR=${formatCurrency(pricing2.forecastAdr, "INR")}, RevPAR=${formatCurrency(pricing2.forecastRevPar, "INR")}, 7d Rev=${formatCurrency(pricing2.next7ProjectedRevenue, "INR")}`);
assert(pricing2.forecastAdr > baselineAdr, `Forecast ADR increased from ₹${baselineAdr} to ₹${pricing2.forecastAdr}`);
assert(pricing2.forecastRevPar > baselineRevPar, `Forecast RevPAR increased from ₹${baselineRevPar} to ₹${pricing2.forecastRevPar}`);
assert(pricing2.next7ProjectedRevenue > baselineRevenue, `7-day revenue increased from ₹${baselineRevenue} to ₹${pricing2.next7ProjectedRevenue}`);
assert(pricing2.revenueImpact > 0, `Revenue impact is positive (+₹${pricing2.revenueImpact})`);

// ================================================================
// STEP 4: REVERT PRICING OVERRIDE (RETURN TO ALGORITHM ₹9,200)
// ================================================================
console.log("\n--- TEST 4: REVERT PRICING OVERRIDE ---");
dispatchResortEvent({
  type: "CLEAR_PRICING_OVERRIDE",
  roomTypeId: "deluxe-ocean",
});

const state4 = getResortState();
const pricing4 = buildPricingRecommendations(state4);

assert(pricing4.hasPricingOverride === false, "Pricing override cleared");
const deluxeRecs4 = pricing4.recommendations.filter((r) => r.roomTypeId === "deluxe-ocean");
assert(deluxeRecs4[0].recommendedRate === 9200, `Deluxe Ocean rate reverted to ₹9,200 (got ₹${deluxeRecs4[0].recommendedRate})`);
assert(deluxeRecs4[0].isOverridden === false, "Deluxe Ocean isOverridden reverted to false");
assert(pricing4.forecastAdr === baselineAdr, `Forecast ADR restored to baseline ₹${baselineAdr}`);
assert(pricing4.forecastRevPar === baselineRevPar, `Forecast RevPAR restored to baseline ₹${baselineRevPar}`);

// ================================================================
// STEP 5: MULTI-EVENT COEXISTENCE (OVERRIDE + FAILURE + COMPLAINT)
// ================================================================
console.log("\n--- TEST 5: MULTI-EVENT COEXISTENCE ---");
// Re-apply override
dispatchResortEvent({
  type: "PRICING_OVERRIDE",
  roomTypeId: "deluxe-ocean",
  overrideRate: 10000,
});

dispatchResortEvent({
  type: "EQUIPMENT_FAILURE",
  equipmentId: "eq-2",
  reason: "Chiller 2 Failure",
});

dispatchResortEvent({
  type: "GUEST_COMPLAINT",
  complaintId: "cmp-spa-101",
  aspect: "spa",
  facilityArea: "Hydrotherapy Pool",
  targetEquipmentId: "eq-11",
  targetEquipmentName: "Pool Pump 2",
});

const state5 = getResortState();
const pricing5 = buildPricingRecommendations(state5);
const guestImpact5 = buildGuestImpactSummary(state5);
const diagnostics5 = buildComplaintDiagnosticSummary(state5);

assert(state5.activeEvents.length === 3, `All 3 events coexisting in activeEvents (got ${state5.activeEvents.length})`);
assert(pricing5.hasEquipmentFailure === true, "Equipment failure correctly detected in pricing");
assert(pricing5.hasPricingOverride === true, "Pricing override remains active during equipment failure");
assert(pricing5.recommendations.find(r => r.roomTypeId === "deluxe-ocean")?.recommendedRate === 10000, "Deluxe Ocean retains ₹10,000 override during failure");
assert(guestImpact5.hasEquipmentFailure === true, "Guest impact detected equipment failure");
assert(diagnostics5.hasActiveComplaint === true, "Complaint diagnostics detected active complaint");

// ================================================================
// STEP 6: RESET STATE CLEANUP
// ================================================================
console.log("\n--- TEST 6: RESET_STATE ---");
dispatchResortEvent({ type: "RESET_STATE" });
const state6 = getResortState();
assert(state6.activeEvents.length === 0, "All events cleared on RESET_STATE");
assert(Object.keys(state6.pricingOverrides ?? {}).length === 0, "Overrides map empty on RESET_STATE");

console.log("\n==================================================");
console.log("🎉 ALL FEATURE #4 VERIFICATION TESTS PASSED SUCCESSFULLY!");
console.log("==================================================");
