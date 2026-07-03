import { FleetSummary } from "@/components/FleetSummary";
import { NodeGrid } from "@/components/NodeGrid";

/**
 * The live dashboard body: fleet KPIs and the virtualized grid of GPU
 * cards. Connection lifecycle and chrome (header, footer, tabs) live one
 * level up in App, so switching tabs never drops the telemetry stream.
 * Each child reads its own slice from the Zustand store, so a data tick
 * only re-renders the leaves whose data changed.
 */
export function Dashboard() {
  return (
    <div className="space-y-8">
      <FleetSummary />
      <NodeGrid />
    </div>
  );
}
