import { useFleetAggregate } from "@/store/telemetryStore";
import {
  severityFor,
  severityTextClass,
  THRESHOLDS,
} from "@/telemetry/thresholds";
import { cn } from "@/lib/utils";

interface StatProps {
  label: string;
  value: string;
  unit?: string;
  colorClass?: string;
}

function Stat({ label, value, unit, colorClass }: StatProps) {
  return (
    <div className="px-5 py-4 first:pl-6 last:pr-6">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1.5 flex items-baseline gap-1">
        <span
          className={cn(
            "font-mono text-2xl font-semibold tabular-nums leading-none",
            colorClass ?? "text-foreground"
          )}
        >
          {value}
        </span>
        {unit && (
          <span className="font-mono text-xs text-muted-foreground">{unit}</span>
        )}
      </p>
    </div>
  );
}

/** Fleet-wide readout rail. Reads the cached aggregate; updates per tick. */
export function FleetSummary() {
  const agg = useFleetAggregate();

  const tempSeverity = severityFor(
    agg.maxTemperature,
    THRESHOLDS.temperature.warning,
    THRESHOLDS.temperature.critical
  );

  return (
    <div className="grid grid-cols-2 divide-x divide-y divide-border overflow-hidden rounded-md border border-border bg-card/60 sm:grid-cols-4 sm:divide-y-0">
      <Stat
        label="Avg utilization"
        value={agg.avgUtilization.toFixed(0)}
        unit="%"
      />
      <Stat
        label="Peak temp"
        value={agg.maxTemperature.toFixed(0)}
        unit="°C"
        colorClass={severityTextClass[tempSeverity]}
      />
      <Stat
        label="Draw"
        value={(agg.totalPowerDraw / 1000).toFixed(2)}
        unit="kW"
      />
      <Stat
        label="VRAM"
        value={`${agg.totalVramUsage.toFixed(0)}/${agg.totalVramCapacity}`}
        unit="GB"
      />
    </div>
  );
}
