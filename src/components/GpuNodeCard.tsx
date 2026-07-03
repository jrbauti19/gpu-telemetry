import { memo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TelemetryChart } from "@/components/TelemetryChart";
import { useGpuSnapshot } from "@/store/telemetryStore";
import {
  severityFor,
  severityStroke,
  severityTextClass,
  THRESHOLDS,
} from "@/telemetry/thresholds";
import { cn } from "@/lib/utils";

interface GpuNodeCardProps {
  gpuId: string;
}

interface ReadoutProps {
  label: string;
  value: string;
  unit: string;
  colorClass: string;
}

function Readout({ label, value, unit, colorClass }: ReadoutProps) {
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className="mt-0.5 flex items-baseline gap-0.5">
        <span
          className={cn(
            "font-mono text-lg font-semibold tabular-nums transition-colors duration-300",
            colorClass
          )}
        >
          {value}
        </span>
        <span className="font-mono text-xs text-muted-foreground">{unit}</span>
      </p>
    </div>
  );
}

/**
 * A single interactive GPU node card. Subscribes to just its own
 * telemetry slice and is memoized, so sibling cards updating in the
 * same tick don't force it to re-render unnecessarily.
 */
export const GpuNodeCard = memo(function GpuNodeCard({
  gpuId,
}: GpuNodeCardProps) {
  const snapshot = useGpuSnapshot(gpuId);

  if (!snapshot) {
    return (
      <Card className="h-[320px] animate-pulse opacity-60">
        <CardHeader>
          <div className="h-4 w-24 rounded-sm bg-secondary" />
        </CardHeader>
      </Card>
    );
  }

  const { metric, history } = snapshot;
  const vramRatio = metric.vramUsage / metric.vramTotal;

  const tempSeverity = severityFor(
    metric.temperature,
    THRESHOLDS.temperature.warning,
    THRESHOLDS.temperature.critical
  );
  const utilSeverity = severityFor(
    metric.utilization,
    THRESHOLDS.utilization.warning,
    THRESHOLDS.utilization.critical
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

  const isCritical = tempSeverity === "critical" || utilSeverity === "critical";

  const vramBar =
    vramSeverity === "critical"
      ? "bg-red-500"
      : vramSeverity === "warning"
        ? "bg-amber-400"
        : "bg-primary";

  return (
    <Card
      className={cn(
        "overflow-hidden transition-colors duration-300 hover:border-border/80",
        isCritical && "border-red-500/60"
      )}
    >
      <div
        className={cn(
          "h-px w-full",
          isCritical ? "bg-red-500" : "bg-primary/50"
        )}
      />
      <CardHeader className="flex-row items-baseline justify-between space-y-0 pb-4">
        <div className="flex items-baseline gap-2.5">
          <p className="font-mono text-base font-semibold tracking-tight">
            {gpuId.replace("gpu-", "GPU ")}
          </p>
          <p className="font-mono text-xs text-muted-foreground">{metric.model}</p>
        </div>
        <span
          className={cn(
            "font-mono text-[11px] font-medium tracking-wide",
            isCritical ? "text-red-400" : "text-muted-foreground"
          )}
        >
          {isCritical ? "● CRITICAL" : "○ nominal"}
        </span>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid grid-cols-3 gap-4">
          <Readout
            label="Util"
            value={metric.utilization.toFixed(0)}
            unit="%"
            colorClass={severityTextClass[utilSeverity]}
          />
          <Readout
            label="Temp"
            value={metric.temperature.toFixed(0)}
            unit="°C"
            colorClass={severityTextClass[tempSeverity]}
          />
          <Readout
            label="Power"
            value={metric.powerDraw.toFixed(0)}
            unit="W"
            colorClass={severityTextClass[powerSeverity]}
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-xs text-muted-foreground">VRAM</span>
            <span className="font-mono text-xs text-foreground">
              {metric.vramUsage.toFixed(0)}<span className="text-muted-foreground">/{metric.vramTotal} GB</span>
            </span>
          </div>
          <Progress value={vramRatio * 100} indicatorClassName={vramBar} />
        </div>

        <div className="grid grid-cols-2 gap-x-5 gap-y-1.5">
          <p className="font-mono text-[11px] text-muted-foreground">util / 60s</p>
          <p className="font-mono text-[11px] text-muted-foreground">temp / 60s</p>
          <div className="h-16">
            <TelemetryChart
              data={history}
              metricKey="utilization"
              domain={[0, 100]}
              unit="%"
              color={severityStroke[utilSeverity]}
              gradientId={`util-${gpuId}`}
            />
          </div>
          <div className="h-16">
            <TelemetryChart
              data={history}
              metricKey="temperature"
              domain={[30, 90]}
              unit="°C"
              color={severityStroke[tempSeverity]}
              gradientId={`temp-${gpuId}`}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
