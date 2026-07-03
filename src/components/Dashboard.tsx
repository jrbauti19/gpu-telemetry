import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { DashboardHeader } from "@/components/DashboardHeader";
import { DemoControlPanel } from "@/components/DemoControlPanel";
import { FleetSummary } from "@/components/FleetSummary";
import { NodeGrid } from "@/components/NodeGrid";
import { useStatus, useTelemetryConnection } from "@/store/telemetryStore";

/**
 * Fire a success toast when the stream comes back — but only after a
 * genuine drop, so the initial idle -> connecting -> connected boot
 * sequence stays quiet.
 */
function useReconnectToast() {
  const status = useStatus();
  const droppedRef = useRef(false);

  useEffect(() => {
    if (status === "disconnected") {
      droppedRef.current = true;
    } else if (status === "connected" && droppedRef.current) {
      droppedRef.current = false;
      toast.success("Reconnected", {
        description: "Telemetry stream restored.",
      });
    }
  }, [status]);
}

/**
 * Top-level dashboard. Opens the telemetry connection and lays out the
 * header, fleet KPIs, and the grid of GPU node cards. Each child reads
 * its own slice from the Zustand store, so a data tick only re-renders
 * the leaves whose data changed.
 */
export function Dashboard() {
  useTelemetryConnection();
  useReconnectToast();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10">
      <DashboardHeader />

      <div className="mt-2 space-y-8">
        <FleetSummary />
        <NodeGrid />
      </div>

      <footer className="mt-10 flex flex-col gap-1 border-t border-border pt-4 font-mono text-[11px] text-muted-foreground sm:flex-row sm:justify-between">
        <span>Rack A · AMD Instinct MI300X cluster · streaming at ~60 fps</span>
        <span>
          source <code className="text-foreground/70">MockTelemetryStream</code> —
          point at a WebSocket URL to go live
        </span>
      </footer>

      <DemoControlPanel />
    </div>
  );
}
