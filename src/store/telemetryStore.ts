import { useEffect } from "react";
import { create } from "zustand";
import { MockTelemetryStream } from "@/telemetry/MockTelemetryStream";
import {
  supportsControls,
  type ConnectionStatus,
  type GpuMetric,
  type TelemetryFrame,
  type TelemetryStream,
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
  /** Ids the user has forced into a synthetic critical fault. */
  faultedGpuIds: string[];
  /** Open the transport and begin ingesting frames. Idempotent. */
  connect: () => void;
  /** Tear down the transport and its subscriptions. */
  disconnect: () => void;
  /** Demo: flip a GPU in/out of an injected critical fault. */
  toggleFault: (gpuId: string) => void;
  /** Demo: clear every injected fault. */
  clearFaults: () => void;
  /** Demo: append a new simulated GPU node. */
  addNode: () => void;
  /** Demo: remove a node (defaults to the most recently added). */
  removeNode: (gpuId?: string) => void;
  /** Demo: scale the fleet to exactly `count` nodes. */
  scaleCluster: (count: number) => void;
  /** Demo: simulate a network blip without discarding the stream. */
  toggleConnection: () => void;
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

// Render throttle. The stream may emit at ~60fps, but re-rendering every
// visible card (and its charts) that often saturates the main thread and
// makes scrolling stutter. We buffer the latest frame and flush it to React
// at most once per RENDER_INTERVAL_MS — dropping intermediate frames —
// coalesced onto the browser's animation frame. Data stays live; the UI just
// stops repainting faster than the eye can see.
const RENDER_INTERVAL_MS = 50; // ~20fps UI refresh
let pendingFrame: TelemetryFrame | null = null;
let flushRaf: number | null = null;
let lastFlush = 0;

/**
 * Global telemetry store. Zustand is itself built on
 * `useSyncExternalStore`, so component selectors still re-render only
 * when the slice they read actually changes (the status header ignores
 * data ticks; each card watches just its own GPU).
 */
export const useTelemetryStore = create<TelemetryState>((set, get) => {
  const applyFrame = (frame: TelemetryFrame) =>
    set(reduceFrame(get(), frame));

  // Apply the buffered frame right now. Used by control actions that need
  // gpuIds to be fresh immediately after mutating the fleet.
  const flushNow = () => {
    if (flushRaf !== null) {
      cancelAnimationFrame(flushRaf);
      flushRaf = null;
    }
    if (pendingFrame) {
      const frame = pendingFrame;
      pendingFrame = null;
      lastFlush = performance.now();
      applyFrame(frame);
    }
  };

  // Coalesced, rate-limited flush of the latest buffered frame.
  const scheduleFlush = () => {
    if (flushRaf !== null) return;
    const run = () => {
      flushRaf = null;
      if (performance.now() - lastFlush < RENDER_INTERVAL_MS) {
        flushRaf = requestAnimationFrame(run); // too soon; retry next frame
        return;
      }
      if (pendingFrame) {
        const frame = pendingFrame;
        pendingFrame = null;
        lastFlush = performance.now();
        applyFrame(frame);
      }
    };
    flushRaf = requestAnimationFrame(run);
  };

  const stopFlush = () => {
    if (flushRaf !== null) cancelAnimationFrame(flushRaf);
    flushRaf = null;
    pendingFrame = null;
  };

  return {
    status: "idle",
    gpuIds: [],
    snapshots: {},
    aggregate: EMPTY_AGGREGATE,
    lastTimestamp: 0,
    faultedGpuIds: [],

    connect: () => {
      if (stream) return; // already connected
      stream = streamFactory();
      unsubStatus = stream.onStatusChange((status) => set({ status }));
      unsubMessage = stream.onMessage((frame) => {
        pendingFrame = frame;
        scheduleFlush();
      });
      stream.connect();
    },

    disconnect: () => {
      unsubMessage?.();
      unsubStatus?.();
      unsubMessage = null;
      unsubStatus = null;
      stopFlush();
      stream?.disconnect();
      stream = null;
      set({ faultedGpuIds: [] });
    },

    toggleFault: (gpuId) => {
      if (!stream || !supportsControls(stream)) return;
      const faulted = get().faultedGpuIds.includes(gpuId);
      stream.setFault(gpuId, !faulted);
      set({
        faultedGpuIds: faulted
          ? get().faultedGpuIds.filter((id) => id !== gpuId)
          : [...get().faultedGpuIds, gpuId],
      });
    },

    clearFaults: () => {
      if (stream && supportsControls(stream)) stream.clearFaults();
      set({ faultedGpuIds: [] });
    },

    addNode: () => {
      if (!stream || !supportsControls(stream)) return;
      stream.addNode();
      flushNow(); // surface the new node immediately
    },

    removeNode: (gpuId) => {
      if (!stream || !supportsControls(stream)) return;
      stream.removeNode(gpuId);
      // Apply the freshly-emitted frame now so gpuIds is current, then drop
      // any fault ids that no longer correspond to a live node.
      flushNow();
      const live = new Set(get().gpuIds);
      set({ faultedGpuIds: get().faultedGpuIds.filter((id) => live.has(id)) });
    },

    scaleCluster: (count) => {
      if (!stream || !supportsControls(stream)) return;
      stream.setNodeCount(count);
      flushNow();
      const live = new Set(get().gpuIds);
      set({ faultedGpuIds: get().faultedGpuIds.filter((id) => live.has(id)) });
    },

    toggleConnection: () => {
      if (!stream) return;
      const s = get().status;
      if (s === "connected" || s === "connecting") stream.disconnect();
      else stream.connect();
    },
  };
});

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

export const useFaultedGpuIds = (): string[] =>
  useTelemetryStore((s) => s.faultedGpuIds);

export const useScaleCluster = (): ((count: number) => void) =>
  useTelemetryStore((s) => s.scaleCluster);

/** Bundle of demo actions for the failure-injection panel. */
export function useDemoControls() {
  return {
    toggleFault: useTelemetryStore((s) => s.toggleFault),
    clearFaults: useTelemetryStore((s) => s.clearFaults),
    addNode: useTelemetryStore((s) => s.addNode),
    removeNode: useTelemetryStore((s) => s.removeNode),
    toggleConnection: useTelemetryStore((s) => s.toggleConnection),
  };
}
