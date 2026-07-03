import { DashboardHeader } from "@/components/DashboardHeader";
import { FleetSummary } from "@/components/FleetSummary";
import { GpuNodeCard } from "@/components/GpuNodeCard";
import { useGpuTelemetry } from "@/hooks/useGpuTelemetry";

/**
 * Top-level dashboard. Owns the telemetry store lifecycle and lays out
 * the header, fleet KPIs, and the grid of GPU node cards. Each card
 * subscribes to its own slice, so a data tick never re-renders this
 * component tree — only the leaves whose data changed.
 */
export function Dashboard() {
  const { store, status, gpuIds } = useGpuTelemetry();

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <DashboardHeader status={status} store={store} />

      <FleetSummary store={store} />

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          GPU Nodes
          <span className="ml-2 font-mono text-xs">({gpuIds.length})</span>
        </h2>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-2">
          {gpuIds.map((id) => (
            <div key={id} className="animate-fade-in">
              <GpuNodeCard store={store} gpuId={id} />
            </div>
          ))}
          {gpuIds.length === 0 && (
            <p className="col-span-full py-16 text-center text-sm text-muted-foreground">
              Awaiting telemetry stream…
            </p>
          )}
        </div>
      </section>

      <footer className="border-t border-border pt-4 text-center text-xs text-muted-foreground">
        Client-side simulation via <code>MockTelemetryStream</code> · swap for a
        WebSocket URL to go live.
      </footer>
    </div>
  );
}
