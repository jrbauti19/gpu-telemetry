import { useState } from "react";
import {
  AlertTriangle,
  FlaskConical,
  Minus,
  Plus,
  Plug,
  PlugZap,
  X,
} from "lucide-react";
import {
  useDemoControls,
  useFaultedGpuIds,
  useGpuIds,
  useStatus,
} from "@/store/telemetryStore";
import { cn } from "@/lib/utils";

/**
 * Floating demo/testing panel. Lets a viewer inject synthetic faults,
 * grow/shrink the fleet, and simulate a network blip at runtime — a
 * live playground that exercises the severity thresholds, alert styling,
 * and reconnect handling without touching the code.
 */
export function DemoControlPanel() {
  const [open, setOpen] = useState(false);
  const gpuIds = useGpuIds();
  const faulted = useFaultedGpuIds();
  const status = useStatus();
  const { toggleFault, clearFaults, addNode, removeNode, toggleConnection } =
    useDemoControls();

  const connected = status === "connected" || status === "connecting";

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Open demo controls"
        className="fixed bottom-5 right-5 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-primary shadow-lg transition-colors hover:border-primary/60 hover:bg-accent"
      >
        <FlaskConical className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 w-72 rounded-lg border border-border bg-card/95 shadow-xl backdrop-blur">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Demo controls</span>
        </div>
        <button
          onClick={() => setOpen(false)}
          aria-label="Close demo controls"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4 p-4">
        {/* Connection */}
        <section className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Connection</p>
          <button
            onClick={toggleConnection}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
              connected
                ? "border-red-500/40 text-red-400 hover:bg-red-500/10"
                : "border-primary/40 text-primary hover:bg-primary/10"
            )}
          >
            {connected ? (
              <>
                <PlugZap className="h-4 w-4" />
                Drop connection
              </>
            ) : (
              <>
                <Plug className="h-4 w-4" />
                Restore connection
              </>
            )}
          </button>
        </section>

        {/* Fleet size */}
        <section className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Fleet ({gpuIds.length})
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={addNode}
              className="flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm transition-colors hover:border-primary/50 hover:text-primary"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
            <button
              onClick={() => removeNode()}
              disabled={gpuIds.length === 0}
              className="flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm transition-colors hover:border-border/80 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Minus className="h-4 w-4" />
              Remove
            </button>
          </div>
        </section>

        {/* Fault injection */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              Inject fault
            </p>
            {faulted.length > 0 && (
              <button
                onClick={clearFaults}
                className="text-[11px] text-primary transition-colors hover:underline"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {gpuIds.map((id) => {
              const isFaulted = faulted.includes(id);
              return (
                <button
                  key={id}
                  onClick={() => toggleFault(id)}
                  aria-pressed={isFaulted}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 font-mono text-xs transition-colors",
                    isFaulted
                      ? "border-red-500/50 bg-red-500/15 text-red-400"
                      : "border-border text-muted-foreground hover:border-amber-500/50 hover:text-amber-400"
                  )}
                >
                  {isFaulted && <AlertTriangle className="h-3 w-3" />}
                  {id.replace("gpu-", "GPU ")}
                </button>
              );
            })}
            {gpuIds.length === 0 && (
              <p className="col-span-2 text-xs text-muted-foreground">
                No nodes online.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
