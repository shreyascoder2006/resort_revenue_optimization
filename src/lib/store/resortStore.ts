import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  ROOM_TYPES,
  DEMAND_EVENTS,
  TODAY,
  type RoomType,
  type DemandEvent,
  type Room,
  generateRooms,
  syncRoomTypesWithRooms,
} from "../data/rooms";
import {
  generateOccupancyHistory,
  generateDemandForecast,
  type DailyOccupancy,
  type DemandForecastDay,
} from "../data/bookings";
import { DEPARTMENTS, generateStaffSchedule, type Department, type ScheduledStaffDay } from "../data/staff";
import { generateInventory, type InventoryItem, getEquipmentPartsConsumption } from "../data/inventory";
import { generateEquipment, type Equipment, getEquipmentAffectedRooms } from "../data/equipment";
import { generateReviews, type Review, type InjectedReview } from "../data/reviews";
import { GUEST_PROFILES, RESORT_SERVICES, type GuestProfile } from "../data/guests";
import { DEFAULT_SPA_COMPLAINT } from "../data/complaints";
import { addDays, isoDate } from "../data/random";

export interface AppliedResortEvent {
  id: string;
  type: string;
  label: string;
  appliedAt: string;
  details: Record<string, unknown>;
}

export interface ResortState {
  // Core domain data
  occupancyHistory: DailyOccupancy[];
  demandForecast: DemandForecastDay[];
  rooms: RoomType[];
  individualRooms: Room[];
  demandEvents: DemandEvent[];
  departments: Department[];
  staffSchedule: ScheduledStaffDay[];
  inventory: InventoryItem[];
  equipment: Equipment[];
  reviews: Review[];
  guests: GuestProfile[];
  resortServices: typeof RESORT_SERVICES;

  // Active simulated events & overrides
  activeEvents: AppliedResortEvent[];
  pricingOverrides: Record<string, number>; // date-roomTypeId -> rate OR roomTypeId -> rate
  currency?: "INR" | "USD";
  lastUpdated: number;
}

export type ResortEvent =
  | {
      type: "DEMAND_SURGE";
      demandBoost: number; // e.g. 0.10, 0.20, 0.30
      reason: string;
      durationDays?: number;
      startDateOffset?: number;
    }
  | {
      type: "EQUIPMENT_FAILURE";
      equipmentId: string;
      reason?: string;
    }
  | {
      type: "EQUIPMENT_RECOVERY";
      equipmentId: string;
    }
  | {
      type: "GUEST_COMPLAINT";
      complaintId?: string;
      aspect?: string;
      guestName?: string;
      roomNumber?: string;
      complaintText?: string;
      facilityArea?: string;
      targetEquipmentId?: string;
      targetEquipmentName?: string;
      severity?: "moderate" | "severe" | "critical";
    }
  | {
      type: "COMPLAINT_RESOLVED";
      complaintId?: string;
    }
  | {
      type: "PRICING_OVERRIDE";
      roomTypeId: string;
      date?: string;
      overrideRate: number;
      overridePrice?: number;
      originalRate?: number;
      originalPrice?: number;
      reason?: string;
    }
  | {
      type: "CLEAR_PRICING_OVERRIDE";
      roomTypeId?: string;
      date?: string;
    }
  | {
      type: "SET_CURRENCY";
      currency: "INR" | "USD";
    }
  | {
      type: "RESET_STATE";
    };

/**
 * Creates the clean initial state using the synthetic generators once.
 */
export function createInitialResortState(): ResortState {
  const individualRooms = generateRooms();
  const rooms = syncRoomTypesWithRooms([...ROOM_TYPES], individualRooms);
  const demandEvents = [...DEMAND_EVENTS];
  const occupancyHistory = generateOccupancyHistory();
  const demandForecast = generateDemandForecast(99, []);
  const departments = [...DEPARTMENTS];
  const staffSchedule = generateStaffSchedule();
  const inventory = generateInventory();
  const equipment = generateEquipment();
  const reviews = generateReviews();
  const guests = [...GUEST_PROFILES];

  return {
    occupancyHistory,
    demandForecast,
    rooms,
    individualRooms,
    demandEvents,
    departments,
    staffSchedule,
    inventory,
    equipment,
    reviews,
    guests,
    resortServices: RESORT_SERVICES,
    activeEvents: [],
    pricingOverrides: {},
    currency: "INR",
    lastUpdated: Date.now(),
  };
}

/**
 * Returns an unmutated, baseline resort state without any active events or outages.
 */
export function getBaselineResortState(): ResortState {
  return createInitialResortState();
}

interface ResortStore {
  state: ResortState;
  dispatch: (event: ResortEvent) => void;
  reset: () => void;
}

export const useResortStore = create<ResortStore>()(
  persist(
    (set, get) => ({
      state: createInitialResortState(),

      dispatch: (event: ResortEvent) => {
        const current = get().state;

        switch (event.type) {
          case "RESET_STATE": {
            set({ state: createInitialResortState() });
            break;
          }

          case "DEMAND_SURGE": {
            const offset = event.startDateOffset ?? 2;
            const duration = event.durationDays ?? 2;
            const boost = event.demandBoost;

            // Generate demand events for the affected period
            const newDemandEvents: DemandEvent[] = [];
            for (let d = 0; d < duration; d++) {
              const dateIso = isoDate(addDays(TODAY, offset + d));
              const dayMultiplier = d === 0 ? 1 : 0.85; // slight decay on subsequent days
              newDemandEvents.push({
                date: dateIso,
                label: d === 0 ? event.reason : `${event.reason} (Day ${d + 1})`,
                demandBoost: Math.round(boost * dayMultiplier * 100) / 100,
              });
            }

            // Remove previous surge events for this reason to allow switching between +10%, +20%, +30% cleanly
            const baseDemandEvents = current.demandEvents.filter(
              (e) => !e.label.includes(event.reason)
            );
            const updatedDemandEvents = [...baseDemandEvents, ...newDemandEvents];

            // Recalculate demand forecast using all active extra demand events
            const extraEventsOnly = updatedDemandEvents.filter(
              (e) => !DEMAND_EVENTS.some((base) => base.date === e.date && base.label === e.label)
            );
            const updatedForecast = generateDemandForecast(99, extraEventsOnly);

            const appliedEvent: AppliedResortEvent = {
              id: `surge-${Date.now()}`,
              type: "DEMAND_SURGE",
              label: `${event.reason} (+${Math.round(boost * 100)}%)`,
              appliedAt: new Date().toISOString(),
              details: {
                demandBoost: boost,
                reason: event.reason,
                durationDays: duration,
                startDate: isoDate(addDays(TODAY, offset)),
                events: newDemandEvents,
              },
            };

            // Replace existing demand surge event if any
            const nonSurgeEvents = current.activeEvents.filter((e) => e.type !== "DEMAND_SURGE");

            set({
              state: {
                ...current,
                demandEvents: updatedDemandEvents,
                demandForecast: updatedForecast,
                activeEvents: [...nonSurgeEvents, appliedEvent],
                lastUpdated: Date.now(),
              },
            });
            break;
          }

          case "EQUIPMENT_FAILURE": {
            const targetId = event.equipmentId;
            const targetEq = current.equipment.find((eq) => eq.id === targetId);

            if (!targetEq) {
              console.warn(`Equipment with id ${targetId} not found.`);
              break;
            }

            // 1. Mark equipment as failed using existing properties: sensor readings spike and service overdue
            const updatedEquipment = current.equipment.map((eq) => {
              if (eq.id === targetId) {
                return {
                  ...eq,
                  daysSinceService: Math.round(eq.serviceIntervalDays * 2.2),
                  sensorAnomalyScore: 0.96,
                };
              }
              return eq;
            });

            // 2. Identify affected rooms from deterministic mapping and mark them OUT_OF_ORDER
            const impact = getEquipmentAffectedRooms(targetId);
            const affectedSet = new Set(impact ? impact.affectedRoomIds : []);

            const currentRooms = current.individualRooms ?? generateRooms();
            const updatedIndividualRooms = currentRooms.map((room) => {
              if (affectedSet.has(room.id)) {
                return {
                  ...room,
                  status: "OUT_OF_ORDER" as const,
                  affectedByEquipmentId: targetId,
                  outOfOrderReason: event.reason ?? `${targetEq.name} Failure`,
                };
              }
              return room;
            });

            // 3. Update room types availability count immutably
            const updatedRooms = syncRoomTypesWithRooms(current.rooms, updatedIndividualRooms);

            // 4. Emergency maintenance spare parts drawdown
            const partsImpact = getEquipmentPartsConsumption(targetId);
            const updatedInventory = partsImpact
              ? current.inventory.map((item) => {
                  const partReq = partsImpact.parts.find((p) => p.itemName === item.name);
                  if (partReq) {
                    return {
                      ...item,
                      currentStock: Math.max(0, item.currentStock - partReq.quantityConsumed),
                    };
                  }
                  return item;
                })
              : current.inventory;

            // 5. Remove any previous failure event for this specific equipment to avoid duplicates
            const otherActiveEvents = current.activeEvents.filter(
              (e) => !(e.type === "EQUIPMENT_FAILURE" && e.details?.equipmentId === targetId)
            );

            const appliedEvent: AppliedResortEvent = {
              id: `failure-${targetId}-${Date.now()}`,
              type: "EQUIPMENT_FAILURE",
              label: `${targetEq.name} Failure (CRITICAL)`,
              appliedAt: new Date().toISOString(),
              details: {
                equipmentId: targetId,
                equipmentName: targetEq.name,
                category: targetEq.category,
                location: targetEq.location,
                severity: "CRITICAL",
                reason: event.reason ?? "Sudden overnight sensor anomaly spike and failure",
                affectedRoomTypeId: impact?.roomTypeId,
                affectedRoomCount: impact?.affectedRoomCount ?? 0,
                affectedRoomIds: impact?.affectedRoomIds ?? [],
                consumedParts: partsImpact?.parts ?? [],
              },
            };

            set({
              state: {
                ...current,
                equipment: updatedEquipment,
                individualRooms: updatedIndividualRooms,
                rooms: updatedRooms,
                inventory: updatedInventory,
                activeEvents: [...otherActiveEvents, appliedEvent],
                lastUpdated: Date.now(),
              },
            });
            break;
          }

          case "EQUIPMENT_RECOVERY": {
            const targetId = event.equipmentId;
            const baselineList = generateEquipment();
            const baselineEq = baselineList.find((eq) => eq.id === targetId);

            // 1. Restore equipment to baseline operational state
            const updatedEquipment = current.equipment.map((eq) => {
              if (eq.id === targetId) {
                return baselineEq
                  ? { ...baselineEq }
                  : {
                      ...eq,
                      daysSinceService: Math.round(eq.serviceIntervalDays * 0.4),
                      sensorAnomalyScore: 0.15,
                    };
              }
              return eq;
            });

            // 2. Only restore rooms that were placed out of order by THIS equipment failure
            const currentRooms = current.individualRooms ?? generateRooms();
            const updatedIndividualRooms = currentRooms.map((room) => {
              if (room.affectedByEquipmentId === targetId) {
                return {
                  ...room,
                  status: "AVAILABLE" as const,
                  affectedByEquipmentId: undefined,
                  outOfOrderReason: undefined,
                };
              }
              return room;
            });

            // 3. Update room types availability count immutably
            const updatedRooms = syncRoomTypesWithRooms(current.rooms, updatedIndividualRooms);

            // 4. Remove this equipment failure from activeEvents, preserving unrelated events
            const remainingActiveEvents = current.activeEvents.filter(
              (e) => !(e.type === "EQUIPMENT_FAILURE" && e.details?.equipmentId === targetId)
            );

            set({
              state: {
                ...current,
                equipment: updatedEquipment,
                individualRooms: updatedIndividualRooms,
                rooms: updatedRooms,
                activeEvents: remainingActiveEvents,
                lastUpdated: Date.now(),
              },
            });
            break;
          }

          case "GUEST_COMPLAINT": {
            const complaintId = event.complaintId ?? DEFAULT_SPA_COMPLAINT.id;
            const guestName = event.guestName ?? DEFAULT_SPA_COMPLAINT.guestName;
            const roomNumber = event.roomNumber ?? DEFAULT_SPA_COMPLAINT.roomNumber;
            const aspect = event.aspect ?? DEFAULT_SPA_COMPLAINT.aspect;
            const facilityArea = event.facilityArea ?? DEFAULT_SPA_COMPLAINT.facilityArea;
            const complaintText = event.complaintText ?? DEFAULT_SPA_COMPLAINT.text;
            const targetEquipmentId = event.targetEquipmentId ?? DEFAULT_SPA_COMPLAINT.targetEquipmentId;
            const targetEquipmentName = event.targetEquipmentName ?? DEFAULT_SPA_COMPLAINT.targetEquipmentName;
            const severity = event.severity ?? DEFAULT_SPA_COMPLAINT.severity;

            // Reflect anomaly on target equipment in telemetry
            const updatedEquipment = current.equipment.map((eq) => {
              if (eq.id === targetEquipmentId) {
                return {
                  ...eq,
                  sensorAnomalyScore: 0.88,
                  daysSinceService: Math.max(eq.daysSinceService, Math.round(eq.serviceIntervalDays * 1.6)),
                };
              }
              return eq;
            });

            // Filter out existing complaint event with same ID
            const otherActiveEvents = current.activeEvents.filter(
              (e) => !(e.type === "GUEST_COMPLAINT" && e.details?.complaintId === complaintId)
            );

            const appliedEvent: AppliedResortEvent = {
              id: `complaint-${complaintId}-${Date.now()}`,
              type: "GUEST_COMPLAINT",
              label: `Guest Incident: ${facilityArea}`,
              appliedAt: new Date().toISOString(),
              details: {
                complaintId,
                guestName,
                roomNumber,
                aspect,
                facilityArea,
                complaintText,
                targetEquipmentId,
                targetEquipmentName,
                severity,
              },
            };

            set({
              state: {
                ...current,
                equipment: updatedEquipment,
                activeEvents: [...otherActiveEvents, appliedEvent],
                lastUpdated: Date.now(),
              },
            });
            break;
          }

          case "COMPLAINT_RESOLVED": {
            const complaintId = event.complaintId ?? DEFAULT_SPA_COMPLAINT.id;
            const activeComplaint = current.activeEvents.find(
              (e) => e.type === "GUEST_COMPLAINT" && e.details?.complaintId === complaintId
            );
            const targetEquipmentId = (activeComplaint?.details?.targetEquipmentId as string) ?? DEFAULT_SPA_COMPLAINT.targetEquipmentId;

            // Restore baseline telemetry for this equipment
            const baselineEquipment = generateEquipment();
            const baselineEq = baselineEquipment.find((eq) => eq.id === targetEquipmentId);

            const updatedEquipment = current.equipment.map((eq) => {
              if (eq.id === targetEquipmentId) {
                return baselineEq ? { ...baselineEq } : { ...eq, sensorAnomalyScore: 0.12 };
              }
              return eq;
            });

            const remainingActiveEvents = current.activeEvents.filter(
              (e) => !(e.type === "GUEST_COMPLAINT" && e.details?.complaintId === complaintId)
            );

            set({
              state: {
                ...current,
                equipment: updatedEquipment,
                activeEvents: remainingActiveEvents,
                lastUpdated: Date.now(),
              },
            });
            break;
          }

          case "PRICING_OVERRIDE": {
            const effectiveRate = event.overrideRate ?? event.overridePrice ?? 0;
            const key = event.date ? `${event.date}-${event.roomTypeId}` : event.roomTypeId;
            const updatedOverrides = {
              ...(current.pricingOverrides ?? {}),
              [key]: effectiveRate,
            };
            if (event.roomTypeId) {
              updatedOverrides[event.roomTypeId] = effectiveRate;
            }

            const otherOverrides = current.activeEvents.filter(
              (e) => !(e.type === "PRICING_OVERRIDE" && e.details?.roomTypeId === event.roomTypeId)
            );

            const roomTypeName =
              current.rooms.find((r) => r.id === event.roomTypeId)?.name ?? event.roomTypeId;

            const appliedEvent: AppliedResortEvent = {
              id: `pricing-override-${event.roomTypeId}-${Date.now()}`,
              type: "PRICING_OVERRIDE",
              label: `Pricing Override: ${roomTypeName} (${current.currency === "USD" ? "$" : "₹"}${effectiveRate.toLocaleString("en-IN")})`,
              appliedAt: new Date().toISOString(),
              details: {
                roomTypeId: event.roomTypeId,
                roomTypeName,
                overrideRate: effectiveRate,
                overridePrice: effectiveRate,
                originalRate: event.originalRate ?? event.originalPrice,
                originalPrice: event.originalRate ?? event.originalPrice,
                reason: event.reason ?? "Manager ADR Adjustment",
              },
            };

            set({
              state: {
                ...current,
                pricingOverrides: updatedOverrides,
                activeEvents: [...otherOverrides, appliedEvent],
                lastUpdated: Date.now(),
              },
            });
            break;
          }

          case "CLEAR_PRICING_OVERRIDE": {
            const targetRoomTypeId = event.roomTypeId;
            let updatedOverrides: Record<string, number> = {};

            if (targetRoomTypeId) {
              updatedOverrides = { ...(current.pricingOverrides ?? {}) };
              delete updatedOverrides[targetRoomTypeId];
              Object.keys(updatedOverrides).forEach((k) => {
                if (k.endsWith(`-${targetRoomTypeId}`)) {
                  delete updatedOverrides[k];
                }
              });
            }

            const remainingActiveEvents = current.activeEvents.filter(
              (e) =>
                !(
                  e.type === "PRICING_OVERRIDE" &&
                  (!targetRoomTypeId || e.details?.roomTypeId === targetRoomTypeId)
                )
            );

            set({
              state: {
                ...current,
                pricingOverrides: targetRoomTypeId ? updatedOverrides : {},
                activeEvents: remainingActiveEvents,
                lastUpdated: Date.now(),
              },
            });
            break;
          }

          case "SET_CURRENCY": {
            set({
              state: {
                ...current,
                currency: event.currency,
                lastUpdated: Date.now(),
              },
            });
            break;
          }

          default:
            console.warn("Unhandled resort event:", event);
        }
      },

      reset: () => {
        set({ state: createInitialResortState() });
      },
    }),
    {
      name: "smart-resort-360-state-v4",
      storage: createJSONStorage(() =>
        typeof window !== "undefined"
          ? window.localStorage
          : {
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {},
            }
      ),
    }
  )
);

/**
 * Direct dispatch function accessible outside of React components.
 */
export function dispatchResortEvent(event: ResortEvent) {
  useResortStore.getState().dispatch(event);
}

/**
 * Direct getter for current resort state.
 */
export function getResortState(): ResortState {
  return useResortStore.getState().state;
}
