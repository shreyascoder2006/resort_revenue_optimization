import { generateEquipment, type Equipment } from "../data/equipment";

export type RiskLevel = "Low" | "Medium" | "High" | "Critical";

export interface MaintenanceRisk {
  equipment: Equipment;
  riskScore: number; // 0-100
  riskLevel: RiskLevel;
  estimatedDaysToAction: number;
  recommendation: string;
}

function riskLevelFor(score: number): RiskLevel {
  if (score >= 75) return "Critical";
  if (score >= 55) return "High";
  if (score >= 32) return "Medium";
  return "Low";
}

export function buildMaintenanceRisks(forceFailureId?: string): MaintenanceRisk[] {
  const equipment = generateEquipment(33, forceFailureId);

  return equipment
    .map((eq) => {
      const ageRatio = eq.installedYearsAgo / eq.ratedLifeYears;
      const serviceOverdueRatio = eq.daysSinceService / eq.serviceIntervalDays;
      const runtimeStress = eq.runtimeHoursPerDay / 24;

      const score =
        ageRatio * 30 + Math.min(serviceOverdueRatio, 2.2) * 25 + eq.sensorAnomalyScore * 35 + runtimeStress * 10;
      const riskScore = Math.round(Math.min(100, Math.max(2, score)));
      const riskLevel = riskLevelFor(riskScore);

      const estimatedDaysToAction =
        riskLevel === "Critical" ? Math.max(1, Math.round(7 - riskScore / 20)) :
        riskLevel === "High" ? Math.round(14 - riskScore / 10) :
        riskLevel === "Medium" ? Math.round(30 - riskScore / 5) : 60;

      const recommendation =
        riskLevel === "Critical"
          ? `Schedule emergency inspection within ${estimatedDaysToAction} day(s) - anomaly readings and overdue service compound risk of failure.`
          : riskLevel === "High"
          ? `Prioritize preventive maintenance within ${estimatedDaysToAction} days before next high-occupancy period.`
          : riskLevel === "Medium"
          ? `Add to next scheduled maintenance round (within ${estimatedDaysToAction} days).`
          : "No action needed - operating within normal parameters.";

      return { equipment: eq, riskScore, riskLevel, estimatedDaysToAction, recommendation };
    })
    .sort((a, b) => b.riskScore - a.riskScore);
}
