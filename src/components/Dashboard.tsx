import { DashboardHeader } from "@/components/DashboardHeader";
import { DemoControlPanel } from "@/components/DemoControlPanel";
import { FleetSummary } from "@/components/FleetSummary";
import { GpuNodeCard } from "@/components/GpuNodeCard";
import { useGpuIds, useTelemetryConnection } from "@/store/telemetryStore";

/**
 * Top-level dashboard. Opens the telemetry connection and lays out the
 * header, fleet KPIs, and the grid of GPU node cards. Each child reads
 * its own slice from the Zustand store, so a data tick only re-renders
 * the leaves whose data changed.
 */
export function Dashboard() {
  useTelemetryConnection();
  const gpuIds = useGpuIds();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10">
      <DashboardHeader />

      <div className="mt-2 space-y-8">
        <FleetSummary />

        <section>
          <div className="mb-4 flex items-baseline justify-between border-b border-border pb-2">
            <h2 className="text-sm font-medium">Nodes</h2>
            <span className="font-mono text-xs text-muted-foreground">
              {gpuIds.length} online
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {gpuIds.map((id, i) => (
              <div
                key={id}
                className="animate-fade-in"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <GpuNodeCard gpuId={id} />
              </div>
            ))}
            {gpuIds.length === 0 && (
              <p className="col-span-full py-16 text-center font-mono text-sm text-muted-foreground">
                waiting for telemetry stream…
              </p>
            )}
          </div>
        </section>
      </div>

      <footer className="mt-10 flex flex-col gap-1 border-t border-border pt-4 font-mono text-[11px] text-muted-foreground sm:flex-row sm:justify-between">
        <span>Rack A · 4× AMD Instinct MI300X · sampling every 2.5s</span>
        <span>
          source <code className="text-foreground/70">MockTelemetryStream</code> —
          point at a WebSocket URL to go live
        </span>
      </footer>

      <DemoControlPanel />
    </div>
  );
}
