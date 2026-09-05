import { PageHeader } from "@/components/ui";
import ScenarioSimulator from "@/components/ScenarioSimulator";

export default function SimulatorPage() {
  return (
    <div>
      <PageHeader
        title="Scenario Simulator"
        description="Trigger a disruption and watch the pricing, staffing, inventory, maintenance, and sentiment engines react to it live."
      />
      <ScenarioSimulator />
    </div>
  );
}
