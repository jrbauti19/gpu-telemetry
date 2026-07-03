import { useEffect } from "react";
import { create } from "zustand";
import { MockTelemetryStream } from "@/telemetry/MockTelemetryStream";
import type {
  ConnectionStatus,
  GpuMetric,
  TelemetryFrame,
  TelemetryStream,
} from "@/telemetry/types";

/** One sampled point retained in the rolling time-series window. */
export interface HistoryPoint {
  /** Epoch milliseconds. */
  t: number;
  utilization: number;
  temperature: number;
  vramUsage: number;
  powerDraw: number;
}

/** Immutable per-GPU slice consumed by a single card. */
export interface GpuSnapshot {
  metric: GpuMetric;
  history: HistoryPoint[];
}

/** Cached fleet-wide rollup, recomputed once per frame. */
export interface FleetAggregate {
  gpuCount: number;
  avgUtilization: number;
  maxTemperature: number;
  totalPowerDraw: number;
  totalVramUsage: number;
  totalVramCapacity: number;
}

/** Seconds of history retained for live charting. */
export const WINDOW_SECONDS = 60;

const EMPTY_AGGREGATE: FleetAggregate = {
  gpuCount: 0,
  avgUtilization: 0,
  maxTemperature: 0,
  totalPowerDraw: 0,
  totalVramUsage: 0,
  totalVramCapacity: 0,
};

/**
 * Swap this factory for a WebSocket-backed stream to go live — the
 * store and every component stay exactly the same.
 */
const streamFactory = (): TelemetryStream => new MockTelemetryStream();

interface TelemetryState {
  status: ConnectionStatus;
  gpuIds: string[];
  snapshots: Record<string, GpuSnapshot>;
  aggregate: FleetAggregate;
  lastTimestamp: number;
  /** Open the transport and begin ingesting frames. Idempotent. */
  connect: () => void;
  /** Tear down the transport and its subscriptions. */
  disconnect: () => void;
}

/**
 * Reduce a raw telemetry frame into the slice of state it changes.
 * Kept pure so the store action is a one-liner and the logic is easy
 * to test in isolation. Only `gpuIds` is omitted when unchanged, so
 * its reference stays stable across ordinary data ticks.
 */
function reduceFrame(
  state: TelemetryState,
  frame: TelemetryFrame
): Partial<TelemetryState> {
  const cutoff = frame.timestamp - WINDOW_SECONDS * 1000;
  const snapshots: Record<string, GpuSnapshot> = {};
  const nextIds: string[] = [];

  for (const metric of frame.gpus) {
    nextIds.push(metric.gpuId);
    const prev = state.snapshots[metric.gpuId];
    const point: HistoryPoint = {
      t: frame.timestamp,
      utilization: metric.utilization,
      temperature: metric.temperature,
      vramUsage: metric.vramUsage,
      powerDraw: metric.powerDraw,
    };
    const history = (prev ? prev.history : []).concat(point);
    while (history.length && history[0].t < cutoff) history.shift();
    snapshots[metric.gpuId] = { metric, history };
  }

  const idsChanged =
    nextIds.length !== state.gpuIds.length ||
    nextIds.some((id, i) => state.gpuIds[i] !== id);

  const gpus = frame.gpus;
  const aggregate: FleetAggregate = {
    gpuCount: gpus.length,
    avgUtilization:
      gpus.reduce((sum, g) => sum + g.utilization, 0) / (gpus.length || 1),
    maxTemperature: gpus.reduce((max, g) => Math.max(max, g.temperature), 0),
    totalPowerDraw: gpus.reduce((sum, g) => sum + g.powerDraw, 0),
    totalVramUsage: gpus.reduce((sum, g) => sum + g.vramUsage, 0),
    totalVramCapacity: gpus.reduce((sum, g) => sum + g.vramTotal, 0),
  };

  return {
    snapshots,
    aggregate,
    lastTimestamp: frame.timestamp,
    ...(idsChanged ? { gpuIds: nextIds } : {}),
  };
}

// Transport handles live outside the reactive state — they are plumbing,
// not data the UI renders.
let stream: TelemetryStream | null = null;
let unsubMessage: (() => void) | null = null;
let unsubStatus: (() => void) | null = null;

/**
 * Global telemetry store. Zustand is itself built on
 * `useSyncExternalStore`, so component selectors still re-render only
 * when the slice they read actually changes (the status header ignores
 * data ticks; each card watches just its own GPU).
 */
export const useTelemetryStore = create<TelemetryState>((set, get) => ({
  status: "idle",
  gpuIds: [],
  snapshots: {},
  aggregate: EMPTY_AGGREGATE,
  lastTimestamp: 0,

  connect: () => {
    if (stream) return; // already connected
    stream = streamFactory();
    unsubStatus = stream.onStatusChange((status) => set({ status }));
    unsubMessage = stream.onMessage((frame) => set(reduceFrame(get(), frame)));
    stream.connect();
  },

  disconnect: () => {
    unsubMessage?.();
    unsubStatus?.();
    unsubMessage = null;
    unsubStatus = null;
    stream?.disconnect();
    stream = null;
  },
}));

// ---- Selector hooks -------------------------------------------------------
// One hook per concern. Each subscribes to exactly one slice.

/** Drives the telemetry connection for the lifetime of the caller. */
export function useTelemetryConnection(): void {
  const connect = useTelemetryStore((s) => s.connect);
  const disconnect = useTelemetryStore((s) => s.disconnect);
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);
}

export const useStatus = (): ConnectionStatus =>
  useTelemetryStore((s) => s.status);

export const useGpuIds = (): string[] => useTelemetryStore((s) => s.gpuIds);

export const useGpuSnapshot = (gpuId: string): GpuSnapshot | undefined =>
  useTelemetryStore((s) => s.snapshots[gpuId]);

export const useFleetAggregate = (): FleetAggregate =>
  useTelemetryStore((s) => s.aggregate);

export const useLastTimestamp = (): number =>
  useTelemetryStore((s) => s.lastTimestamp);
