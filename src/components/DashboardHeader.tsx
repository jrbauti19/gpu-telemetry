import { Activity, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLastTimestamp } from "@/hooks/useGpuTelemetry";
import type { TelemetryStore } from "@/telemetry/TelemetryStore";
import type { ConnectionStatus } from "@/telemetry/types";

interface DashboardHeaderProps {
  status: ConnectionStatus;
  store: TelemetryStore;
}

const STATUS_META: Record<
  ConnectionStatus,
  { label: string; variant: "default" | "muted" | "warning" | "critical"; dot: string }
> = {
  idle: { label: "Idle", variant: "muted", dot: "bg-muted-foreground" },
  connecting: { label: "Connecting", variant: "warning", dot: "bg-amber-400" },
  connected: { label: "Live", variant: "default", dot: "bg-primary" },
  disconnected: { label: "Disconnected", variant: "critical", dot: "bg-red-400" },
};

function LastUpdate({ store }: { store: TelemetryStore }) {
  const ts = useLastTimestamp(store);
  if (!ts) return null;
  return (
    <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
      Last frame {new Date(ts).toLocaleTimeString()}
    </span>
  );
}

/**
 * Top bar with branding and connection state. The status badge only
 * re-renders on lifecycle changes, not on data ticks.
 */
export function DashboardHeader({ status, store }: DashboardHeaderProps) {
  const meta = STATUS_META[status];
  return (
    <header className="flex items-center justify-between gap-4 border-b border-border pb-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Activity className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            TensorWave <span className="text-muted-foreground">·</span> GPU
            Telemetry
          </h1>
          <p className="text-xs text-muted-foreground">
            Real-time cluster monitoring
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <LastUpdate store={store} />
        <Badge variant={meta.variant} className="gap-2 px-3 py-1">
          <Radio className="h-3 w-3" />
          <span
            className={`h-1.5 w-1.5 rounded-full ${meta.dot} ${
              status === "connected" ? "animate-pulse-glow" : ""
            }`}
          />
          {meta.label}
        </Badge>
      </div>
    </header>
  );
}
