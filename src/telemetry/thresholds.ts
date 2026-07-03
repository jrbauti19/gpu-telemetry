import type { MetricSeverity } from "./types";

/** Warning/critical cutoffs per metric, tuned for H100-class nodes. */
export const THRESHOLDS = {
  utilization: { warning: 85, critical: 95 },
  temperature: { warning: 75, critical: 83 },
  power: { warning: 550, critical: 650 },
  vramRatio: { warning: 0.85, critical: 0.95 },
} as const;

/** Classify a raw value against warning/critical cutoffs. */
export function severityFor(
  value: number,
  warning: number,
  critical: number
): MetricSeverity {
  if (value >= critical) return "critical";
  if (value >= warning) return "warning";
  return "nominal";
}

/** Tailwind text color token for a given severity. */
export const severityTextClass: Record<MetricSeverity, string> = {
  nominal: "text-foreground",
  warning: "text-amber-400",
  critical: "text-red-500",
};

/** Chart/accent stroke color (hex) for a given severity. */
export const severityStroke: Record<MetricSeverity, string> = {
  nominal: "#10b981",
  warning: "#f59e0b",
  critical: "#ef4444",
};
