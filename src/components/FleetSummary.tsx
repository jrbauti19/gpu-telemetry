import { Gauge, MemoryStick, Thermometer, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useFleetAggregate } from "@/hooks/useGpuTelemetry";
import type { TelemetryStore } from "@/telemetry/TelemetryStore";
import {
  severityFor,
  severityTextClass,
  THRESHOLDS,
} from "@/telemetry/thresholds";
import { cn } from "@/lib/utils";

interface StatProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  colorClass?: string;
}

function Stat({ icon, label, value, colorClass }: StatProps) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div className="rounded-md bg-secondary p-2 text-muted-foreground">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p
          className={cn(
            "font-mono text-xl font-semibold tabular-nums",
            colorClass
          )}
        >
          {value}
        </p>
      </div>
    </Card>
  );
}

/** Fleet-wide KPI strip. Reads the cached aggregate; updates per tick. */
export function FleetSummary({ store }: { store: TelemetryStore }) {
  const agg = useFleetAggregate(store);

  const tempSeverity = severityFor(
    agg.maxTemperature,
    THRESHOLDS.temperature.warning,
    THRESHOLDS.temperature.critical
  );

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Stat
        icon={<Gauge className="h-4 w-4" />}
        label="Avg Utilization"
        value={`${agg.avgUtilization.toFixed(0)}%`}
      />
      <Stat
        icon={<Thermometer className="h-4 w-4" />}
        label="Peak Temp"
        value={`${agg.maxTemperature.toFixed(0)}°C`}
        colorClass={severityTextClass[tempSeverity]}
      />
      <Stat
        icon={<Zap className="h-4 w-4" />}
        label="Total Power"
        value={`${(agg.totalPowerDraw / 1000).toFixed(2)} kW`}
      />
      <Stat
        icon={<MemoryStick className="h-4 w-4" />}
        label="VRAM In Use"
        value={`${agg.totalVramUsage.toFixed(0)}/${agg.totalVramCapacity} GB`}
      />
    </div>
  );
}
