import { memo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import type { HistoryPoint } from "@/store/telemetryStore";

interface TelemetryChartProps {
  data: HistoryPoint[];
  /** Which numeric field of HistoryPoint to plot. */
  metricKey: keyof Omit<HistoryPoint, "t">;
  /** Line/area accent color (hex). */
  color: string;
  /** Fixed Y domain, e.g. [0, 100]. */
  domain: [number, number];
  /** Short unit label shown in the tooltip, e.g. "%". */
  unit: string;
  /** Unique gradient id (must differ per rendered chart). */
  gradientId: string;
}

const timeFmt = (t: number): string =>
  new Date(t).toLocaleTimeString([], {
    minute: "2-digit",
    second: "2-digit",
  });

/** Enterprise-styled tooltip matching the dark dashboard theme. */
function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: TooltipProps<number, string> & { unit: string }) {
  if (!active || !payload?.length) return null;
  const value = payload[0].value as number;
  return (
    <div className="rounded-sm border border-border bg-card px-2.5 py-1.5 shadow-lg">
      <p className="font-mono text-[10px] text-muted-foreground">
        {timeFmt(label as number)}
      </p>
      <p className="mt-0.5 font-mono text-sm font-semibold text-foreground">
        {value.toLocaleString()}
        <span className="ml-0.5 text-muted-foreground">{unit}</span>
      </p>
    </div>
  );
}

/**
 * Smooth, real-time area chart for a single metric. Memoized so it
 * only re-renders when its GPU's history array reference changes.
 */
export const TelemetryChart = memo(function TelemetryChart({
  data,
  metricKey,
  color,
  domain,
  unit,
  gradientId,
}: TelemetryChartProps) {
  // While the pointer is over the chart, freeze the series to a snapshot so
  // the live ~20fps updates don't shift points under the cursor and make the
  // tooltip jitter. Resume live updates on mouse-leave.
  const dataRef = useRef(data);
  dataRef.current = data;
  const [frozen, setFrozen] = useState<HistoryPoint[] | null>(null);
  const chartData = frozen ?? data;

  return (
    <div
      className="h-full w-full"
      onMouseEnter={() => setFrozen(dataRef.current)}
      onMouseLeave={() => setFrozen(null)}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="t" hide />
          <YAxis domain={domain} hide />
          <Tooltip
            content={<ChartTooltip unit={unit} />}
            cursor={{
              stroke: color,
              strokeOpacity: 0.4,
              strokeDasharray: "3 3",
            }}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey={metricKey}
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0, fill: color }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
});
