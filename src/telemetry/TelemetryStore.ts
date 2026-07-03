import type {
  ConnectionStatus,
  GpuMetric,
  TelemetryFrame,
  TelemetryStream,
} from "./types";

/** One sampled point retained in the rolling time-series window. */
export interface HistoryPoint {
  /** Epoch milliseconds. */
  t: number;
  utilization: number;
  temperature: number;
  vramUsage: number;
  powerDraw: number;
}

/** Immutable per-GPU slice handed to a subscribed card. */
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

const EMPTY_AGGREGATE: FleetAggregate = {
  gpuCount: 0,
  avgUtilization: 0,
  maxTemperature: 0,
  totalPowerDraw: 0,
  totalVramUsage: 0,
  totalVramCapacity: 0,
};

/** Seconds of history retained for live charting. */
export const WINDOW_SECONDS = 60;

type Listener = () => void;

/**
 * Framework-agnostic store that sits between a {@link TelemetryStream}
 * and React. It keeps a rolling {@link WINDOW_SECONDS} window per GPU
 * and exposes granular, referentially-stable snapshots so that
 * `useSyncExternalStore` re-renders only the components whose slice
 * actually changed (e.g. the status header never re-renders on data
 * ticks — only on connection changes).
 */
export class TelemetryStore {
  private readonly listeners = new Set<Listener>();

  private status: ConnectionStatus = "idle";
  private gpuIds: string[] = [];
  private snapshots = new Map<string, GpuSnapshot>();
  private aggregate: FleetAggregate = EMPTY_AGGREGATE;
  private lastTimestamp = 0;

  private unsubMessage: (() => void) | null = null;
  private unsubStatus: (() => void) | null = null;

  constructor(private readonly stream: TelemetryStream) {}

  /** Begin consuming the underlying stream. */
  start(): void {
    this.unsubStatus = this.stream.onStatusChange((s) => {
      this.status = s;
      this.emit();
    });
    this.unsubMessage = this.stream.onMessage((frame) => this.ingest(frame));
    this.stream.connect();
  }

  /** Tear down subscriptions and disconnect the stream. */
  stop(): void {
    this.unsubMessage?.();
    this.unsubStatus?.();
    this.unsubMessage = null;
    this.unsubStatus = null;
    this.stream.disconnect();
  }

  // ---- React subscription surface -------------------------------------

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getStatus = (): ConnectionStatus => this.status;

  getGpuIds = (): string[] => this.gpuIds;

  getGpuSnapshot = (gpuId: string): GpuSnapshot | undefined =>
    this.snapshots.get(gpuId);

  getAggregate = (): FleetAggregate => this.aggregate;

  getLastTimestamp = (): number => this.lastTimestamp;

  // ---- Internals ------------------------------------------------------

  private ingest(frame: TelemetryFrame): void {
    const cutoff = frame.timestamp - WINDOW_SECONDS * 1000;
    this.lastTimestamp = frame.timestamp;

    let idsChanged = this.gpuIds.length !== frame.gpus.length;
    const nextIds: string[] = [];

    for (const metric of frame.gpus) {
      nextIds.push(metric.gpuId);
      if (!this.gpuIds.includes(metric.gpuId)) idsChanged = true;

      const prev = this.snapshots.get(metric.gpuId);
      const point: HistoryPoint = {
        t: frame.timestamp,
        utilization: metric.utilization,
        temperature: metric.temperature,
        vramUsage: metric.vramUsage,
        powerDraw: metric.powerDraw,
      };

      // Append, then drop points that have aged out of the window.
      const history = (prev ? prev.history : []).concat(point);
      while (history.length && history[0].t < cutoff) history.shift();

      // Fresh object refs => subscribed card sees a new snapshot.
      this.snapshots.set(metric.gpuId, { metric, history });
    }

    if (idsChanged) this.gpuIds = nextIds;

    // Recompute the fleet rollup once per frame so subscribers get a
    // fresh, stable reference without scanning the map on every render.
    const gpus = frame.gpus;
    this.aggregate = {
      gpuCount: gpus.length,
      avgUtilization:
        gpus.reduce((sum, g) => sum + g.utilization, 0) / (gpus.length || 1),
      maxTemperature: gpus.reduce((max, g) => Math.max(max, g.temperature), 0),
      totalPowerDraw: gpus.reduce((sum, g) => sum + g.powerDraw, 0),
      totalVramUsage: gpus.reduce((sum, g) => sum + g.vramUsage, 0),
      totalVramCapacity: gpus.reduce((sum, g) => sum + g.vramTotal, 0),
    };

    this.emit();
  }

  private emit(): void {
    this.listeners.forEach((l) => l());
  }
}
