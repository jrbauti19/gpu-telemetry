import { memo } from "react";
import { Cpu, Gauge, Thermometer, Zap } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TelemetryChart } from "@/components/TelemetryChart";
import { useGpuSnapshot } from "@/hooks/useGpuTelemetry";
import type { TelemetryStore } from "@/telemetry/TelemetryStore";
import {
  severityFor,
  severityStroke,
  severityTextClass,
  THRESHOLDS,
} from "@/telemetry/thresholds";
import { cn } from "@/lib/utils";

interface GpuNodeCardProps {
  store: TelemetryStore;
  gpuId: string;
}

interface ReadoutProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  colorClass: string;
}

function Readout({ icon, label, value, colorClass }: ReadoutProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </span>
      <span
        className={cn(
          "font-mono text-lg font-semibold tabular-nums transition-colors duration-300",
          colorClass
        )}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * A single interactive GPU node card. Subscribes to just its own
 * telemetry slice and is memoized, so sibling cards updating in the
 * same tick don't force it to re-render unnecessarily.
 */
export const GpuNodeCard = memo(function GpuNodeCard({
  store,
  gpuId,
}: GpuNodeCardProps) {
  const snapshot = useGpuSnapshot(store, gpuId);

  if (!snapshot) {
    return (
      <Card className="h-[320px] animate-pulse opacity-60">
        <CardHeader>
          <div className="h-4 w-24 rounded bg-secondary" />
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
        "overflow-hidden transition-shadow duration-500 hover:border-primary/40",
        isCritical &&
          "border-red-500/50 shadow-[0_0_0_1px_rgba(239,68,68,0.25),0_0_28px_-8px_rgba(239,68,68,0.5)]"
      )}
    >
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div className="flex items-center gap-2.5">
          <div className="rounded-md bg-primary/10 p-2 text-primary">
            <Cpu className="h-4 w-4" />
          </div>
          <div>
            <p className="font-mono text-sm font-semibold">
              {gpuId.toUpperCase()}
            </p>
            <p className="text-xs text-muted-foreground">{metric.model}</p>
          </div>
        </div>
        {isCritical ? (
          <Badge variant="critical" className="animate-pulse-glow">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
            CRITICAL
          </Badge>
        ) : (
          <Badge variant="default">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-glow" />
            ACTIVE
          </Badge>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Readout
            icon={<Gauge className="h-3 w-3" />}
            label="Utilization"
            value={`${metric.utilization.toFixed(0)}%`}
            colorClass={severityTextClass[utilSeverity]}
          />
          <Readout
            icon={<Thermometer className="h-3 w-3" />}
            label="Temp"
            value={`${metric.temperature.toFixed(0)}°C`}
            colorClass={severityTextClass[tempSeverity]}
          />
          <Readout
            icon={<Zap className="h-3 w-3" />}
            label="Power"
            value={`${metric.powerDraw.toFixed(0)}W`}
            colorClass={severityTextClass[powerSeverity]}
          />
          <div className="flex flex-col gap-1">
            <span className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
              VRAM
              <span className="font-mono normal-case tracking-normal text-foreground">
                {metric.vramUsage.toFixed(0)}/{metric.vramTotal}GB
              </span>
            </span>
            <Progress
              className="mt-2"
              value={vramRatio * 100}
              indicatorClassName={vramBar}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              Utilization · 60s
            </p>
            <div className="h-20">
              <TelemetryChart
                data={history}
                metricKey="utilization"
                domain={[0, 100]}
                unit="%"
                color={severityStroke[utilSeverity]}
                gradientId={`util-${gpuId}`}
              />
            </div>
          </div>
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              Temperature · 60s
            </p>
            <div className="h-20">
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
        </div>
      </CardContent>
    </Card>
  );
});
