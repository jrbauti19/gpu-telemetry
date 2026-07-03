import { useLastTimestamp } from "@/hooks/useGpuTelemetry";
import type { TelemetryStore } from "@/telemetry/TelemetryStore";
import type { ConnectionStatus } from "@/telemetry/types";
import { cn } from "@/lib/utils";

interface DashboardHeaderProps {
  status: ConnectionStatus;
  store: TelemetryStore;
}

const STATUS_META: Record<
  ConnectionStatus,
  { label: string; dot: string; text: string }
> = {
  idle: { label: "STANDBY", dot: "bg-muted-foreground", text: "text-muted-foreground" },
  connecting: { label: "LINKING", dot: "bg-amber-400", text: "text-amber-400" },
  connected: { label: "ONLINE", dot: "bg-primary", text: "text-primary" },
  disconnected: { label: "OFFLINE", dot: "bg-red-500", text: "text-red-400" },
};

function LastUpdate({ store }: { store: TelemetryStore }) {
  const ts = useLastTimestamp(store);
  return (
    <span className="font-mono text-[11px] text-muted-foreground">
      last frame&nbsp;
      <span className="text-foreground/80">
        {ts ? new Date(ts).toLocaleTimeString([], { hour12: false }) : "--:--:--"}
      </span>
    </span>
  );
}

/**
 * Top bar with branding and connection state. The status readout only
 * re-renders on lifecycle changes, not on data ticks.
 */
export function DashboardHeader({ status, store }: DashboardHeaderProps) {
  const meta = STATUS_META[status];
  return (
    <header className="flex flex-col gap-4 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-end gap-3">
        <span
          aria-hidden
          className="mb-1 h-8 w-1.5 shrink-0 rounded-full bg-primary"
        />
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-muted-foreground">
            by Josh B.
          </p>
          <h1 className="mt-1 text-2xl font-semibold leading-none tracking-tight">
            Telemetritize
            <span className="text-primary">.</span>
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-4 sm:flex-col sm:items-end sm:gap-1.5">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              meta.dot,
              status === "connected" && "animate-blink"
            )}
          />
          <span className={cn("font-mono text-xs font-medium tracking-wide", meta.text)}>
            {meta.label}
          </span>
          <span className="text-border">/</span>
          <span className="font-mono text-xs text-muted-foreground">RACK-A</span>
        </div>
        <LastUpdate store={store} />
      </div>
    </header>
  );
}
