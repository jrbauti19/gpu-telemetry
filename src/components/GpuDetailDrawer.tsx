import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { TelemetryChart } from "@/components/TelemetryChart";
import {
  useGpuSnapshot,
  type GpuSnapshot,
  type HistoryPoint,
} from "@/store/telemetryStore";
import { useSelectGpu, useSelectedGpuId } from "@/store/uiStore";
import {
  severityFor,
  severityStroke,
  severityTextClass,
  THRESHOLDS,
} from "@/telemetry/thresholds";
import type { MetricSeverity } from "@/telemetry/types";
import { cn } from "@/lib/utils";

type MetricKey = keyof Omit<HistoryPoint, "t">;

/**
 * Slide-over panel with an expanded view of a single GPU: severity-aware
 * stat tiles and four full-width history charts. Selection lives in the UI
 * store, so opening it never re-renders the grid.
 */
export function GpuDetailDrawer() {
  const selectedId = useSelectedGpuId();
  const selectGpu = useSelectGpu();
  const open = selectedId !== null;

  // Retain the last id through the close animation so content doesn't vanish
  // before the panel finishes sliding out.
  const [renderId, setRenderId] = useState<string | null>(selectedId);
  useEffect(() => {
    if (selectedId) setRenderId(selectedId);
  }, [selectedId]);

  // Close on Escape while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") selectGpu(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, selectGpu]);

  return (
    <>
      <div
        aria-hidden
        onClick={() => selectGpu(null)}
        className={cn(
          "fixed inset-0 z-40 bg-background/70 backdrop-blur-sm transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="GPU details"
        onTransitionEnd={() => {
          if (!open) setRenderId(null);
        }}
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-card shadow-2xl transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {renderId && (
          <DrawerBody gpuId={renderId} onClose={() => selectGpu(null)} />
        )}
      </aside>
    </>
  );
}

/* -------------------------------------------------------------------------- */

function DrawerBody({
  gpuId,
  onClose,
}: {
  gpuId: string;
  onClose: () => void;
}) {
  const snapshot = useGpuSnapshot(gpuId);

  return (
    <>
      <header className="flex items-start justify-between border-b border-border p-5">
        <div className="min-w-0">
          <p className="font-mono text-lg font-semibold tracking-tight">
            {gpuId}
          </p>
          <p className="font-mono text-xs text-muted-foreground">
            {snapshot?.metric.model ?? "—"}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close details"
          className="rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {snapshot ? (
        <DrawerContent gpuId={gpuId} snapshot={snapshot} />
      ) : (
        <div className="flex flex-1 items-center justify-center p-8 text-center">
          <p className="font-mono text-sm text-muted-foreground">
            This GPU is no longer in the fleet.
          </p>
        </div>
      )}
    </>
  );
}

function DrawerContent({
  gpuId,
  snapshot,
}: {
  gpuId: string;
  snapshot: GpuSnapshot;
}) {
  const { metric, history } = snapshot;
  const vramRatio = metric.vramUsage / metric.vramTotal;

  const utilSeverity = severityFor(
    metric.utilization,
    THRESHOLDS.utilization.warning,
    THRESHOLDS.utilization.critical
  );
  const tempSeverity = severityFor(
    metric.temperature,
    THRESHOLDS.temperature.warning,
    THRESHOLDS.temperature.critical
  );
  const powerSeverity = severityFor(
    metric.powerDraw,
    THRESHOLDS.power.warning,
    THRESHOLDS.power.critical
  );
  const vramSeverity = severityFor(
    vramRatio,
    THRESHOLDS.vramRatio.warning,
    THRESHOLDS.vramRatio.critical
  );

  return (
    <div className="flex-1 space-y-6 overflow-y-auto p-5">
      <div className="grid grid-cols-2 gap-3">
        <StatTile
          label="Utilization"
          history={history}
          metricKey="utilization"
          unit="%"
          severity={utilSeverity}
          decimals={0}
        />
        <StatTile
          label="Temperature"
          history={history}
          metricKey="temperature"
          unit="°C"
          severity={tempSeverity}
          decimals={0}
        />
        <StatTile
          label="Power draw"
          history={history}
          metricKey="powerDraw"
          unit="W"
          severity={powerSeverity}
          decimals={0}
        />
        <StatTile
          label="VRAM"
          history={history}
          metricKey="vramUsage"
          unit={` / ${metric.vramTotal} GB`}
          severity={vramSeverity}
          decimals={0}
        />
      </div>

      <div className="space-y-5">
        <ChartBlock
          title="Utilization"
          history={history}
          metricKey="utilization"
          domain={[0, 100]}
          unit="%"
          severity={utilSeverity}
          gpuId={gpuId}
        />
        <ChartBlock
          title="Temperature"
          history={history}
          metricKey="temperature"
          domain={[30, 90]}
          unit="°C"
          severity={tempSeverity}
          gpuId={gpuId}
        />
        <ChartBlock
          title="Power draw"
          history={history}
          metricKey="powerDraw"
          domain={[0, 750]}
          unit="W"
          severity={powerSeverity}
          gpuId={gpuId}
        />
        <ChartBlock
          title="VRAM usage"
          history={history}
          metricKey="vramUsage"
          domain={[0, metric.vramTotal]}
          unit="GB"
          severity={vramSeverity}
          gpuId={gpuId}
        />
      </div>

      <p className="border-t border-border pt-4 text-center font-mono text-[10px] text-muted-foreground">
        rolling 60s window · {history.length} samples
      </p>
    </div>
  );
}

/* ---- Building blocks ------------------------------------------------------ */

function StatTile({
  label,
  history,
  metricKey,
  unit,
  severity,
  decimals,
}: {
  label: string;
  history: HistoryPoint[];
  metricKey: MetricKey;
  unit: string;
  severity: MetricSeverity;
  decimals: number;
}) {
  const { cur, min, max, avg } = summarize(history, metricKey);
  return (
    <div className="rounded-lg border border-border bg-background/50 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 flex items-baseline gap-0.5">
        <span
          className={cn(
            "font-mono text-2xl font-semibold tabular-nums",
            severityTextClass[severity]
          )}
        >
          {cur.toFixed(decimals)}
        </span>
        <span className="font-mono text-xs text-muted-foreground">{unit}</span>
      </p>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-muted-foreground">
        <span>min {min.toFixed(decimals)}</span>
        <span>avg {avg.toFixed(decimals)}</span>
        <span>max {max.toFixed(decimals)}</span>
      </div>
    </div>
  );
}

function ChartBlock({
  title,
  history,
  metricKey,
  domain,
  unit,
  severity,
  gpuId,
}: {
  title: string;
  history: HistoryPoint[];
  metricKey: MetricKey;
  domain: [number, number];
  unit: string;
  severity: MetricSeverity;
  gpuId: string;
}) {
  return (
    <div>
      <p className="mb-1.5 font-mono text-[11px] text-muted-foreground">
        {title} / 60s
      </p>
      <div className="h-32">
        <TelemetryChart
          data={history}
          metricKey={metricKey}
          domain={domain}
          unit={unit}
          color={severityStroke[severity]}
          gradientId={`drawer-${metricKey}-${gpuId}`}
        />
      </div>
    </div>
  );
}

/** Current, min, max and average of one metric across the history window. */
function summarize(history: HistoryPoint[], key: MetricKey) {
  if (history.length === 0) return { cur: 0, min: 0, max: 0, avg: 0 };
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  for (const point of history) {
    const v = point[key];
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }
  return {
    cur: history[history.length - 1][key],
    min,
    max,
    avg: sum / history.length,
  };
}
