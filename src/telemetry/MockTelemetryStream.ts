import type {
  ConnectionStatus,
  GpuMetric,
  MessageHandler,
  StatusHandler,
  TelemetryControls,
  TelemetryFrame,
  TelemetryStream,
} from "./types";

/** Tunable bounds for a single metric's random walk. */
interface MetricRange {
  min: number;
  max: number;
  /** Max change per tick as a fraction of the full range. */
  volatility: number;
}

/** Static hardware description for a simulated GPU node. */
interface GpuProfile {
  gpuId: string;
  model: string;
  vramTotal: number;
}

/**
 * Internal mutable simulation state for one GPU. We keep the raw
 * "true" values plus a phase offset so each card drifts on its own
 * sine curve — no two GPUs move in lockstep.
 */
interface GpuSimState {
  profile: GpuProfile;
  utilization: number;
  temperature: number;
  vramUsage: number;
  powerDraw: number;
  phase: number;
  /** When true, the node is driven hard into a critical state. */
  fault: boolean;
}

const TICK_MS = 2500;
const CONNECT_LATENCY_MS = 450;

/** Four MI300X-class nodes, matching a typical single-server tray. */
const GPU_PROFILES: GpuProfile[] = [
  { gpuId: "gpu-0", model: "AMD Instinct MI300X", vramTotal: 192 },
  { gpuId: "gpu-1", model: "AMD Instinct MI300X", vramTotal: 192 },
  { gpuId: "gpu-2", model: "AMD Instinct MI300X", vramTotal: 192 },
  { gpuId: "gpu-3", model: "AMD Instinct MI300X", vramTotal: 192 },
];

const RANGES = {
  utilization: { min: 0, max: 100, volatility: 0.08 } as MetricRange,
  temperature: { min: 30, max: 90, volatility: 0.04 } as MetricRange,
  vramUsage: { min: 4, max: 192, volatility: 0.05 } as MetricRange,
  powerDraw: { min: 100, max: 700, volatility: 0.07 } as MetricRange,
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/**
 * Advance a value along a bounded random walk. Combines a small
 * random impulse with a gentle pull toward the range midpoint so the
 * signal wanders realistically without sticking to the rails.
 */
function randomWalk(current: number, range: MetricRange): number {
  const span = range.max - range.min;
  const impulse = (Math.random() - 0.5) * 2 * range.volatility * span;
  const midpoint = (range.min + range.max) / 2;
  const meanReversion = (midpoint - current) * 0.02;
  return clamp(current + impulse + meanReversion, range.min, range.max);
}

/**
 * A drop-in mock of a real telemetry WebSocket. It reproduces the
 * full connection lifecycle (connecting -> connected -> disconnected)
 * and pushes a fresh {@link TelemetryFrame} to `onMessage` listeners
 * every {@link TICK_MS} milliseconds.
 *
 * Swapping to production is a one-file change: implement the same
 * {@link TelemetryStream} contract against a real `WebSocket` URL.
 */
export class MockTelemetryStream implements TelemetryStream, TelemetryControls {
  private status: ConnectionStatus = "idle";
  private readonly messageHandlers = new Set<MessageHandler>();
  private readonly statusHandlers = new Set<StatusHandler>();
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private state: GpuSimState[];
  /** Monotonic counter so re-added nodes never reuse an id. */
  private nextId: number;

  constructor(profiles: GpuProfile[] = GPU_PROFILES) {
    this.state = profiles.map((profile, i) => this.seedNode(profile, i));
    this.nextId = profiles.length;
  }

  /** Build the initial sim state for one node at a plausible operating point. */
  private seedNode(profile: GpuProfile, index: number): GpuSimState {
    return {
      profile,
      utilization: 40 + Math.random() * 40,
      temperature: 55 + Math.random() * 15,
      vramUsage: 30 + Math.random() * 30,
      powerDraw: 300 + Math.random() * 200,
      phase: (index / Math.max(1, this.state?.length ?? 4)) * Math.PI * 2,
      fault: false,
    };
  }

  connect(): void {
    if (this.status === "connected" || this.status === "connecting") return;
    this.setStatus("connecting");

    // Simulate network handshake latency before data starts flowing.
    this.connectTimer = setTimeout(() => {
      this.setStatus("connected");
      // Emit an immediate frame so the UI is populated at t=0.
      this.emitFrame();
      this.tickTimer = setInterval(() => this.emitFrame(), TICK_MS);
    }, CONNECT_LATENCY_MS);
  }

  disconnect(): void {
    if (this.connectTimer) clearTimeout(this.connectTimer);
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.connectTimer = null;
    this.tickTimer = null;
    if (this.status !== "idle") this.setStatus("disconnected");
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onStatusChange(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    // Push current status immediately so late subscribers stay in sync.
    handler(this.status);
    return () => this.statusHandlers.delete(handler);
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  private setStatus(next: ConnectionStatus): void {
    this.status = next;
    this.statusHandlers.forEach((h) => h(next));
  }

  // ---- Demo controls (TelemetryControls) ------------------------------

  setFault(gpuId: string, faulted: boolean): void {
    const node = this.state.find((s) => s.profile.gpuId === gpuId);
    if (node) node.fault = faulted;
  }

  clearFaults(): void {
    this.state.forEach((s) => (s.fault = false));
  }

  addNode(): string {
    const gpuId = `gpu-${this.nextId++}`;
    const profile: GpuProfile = {
      gpuId,
      model: "AMD Instinct MI300X",
      vramTotal: 192,
    };
    this.state.push(this.seedNode(profile, this.state.length));
    // Surface the new node immediately if we're already streaming.
    if (this.status === "connected") this.emitFrame();
    return gpuId;
  }

  removeNode(gpuId?: string): void {
    if (this.state.length === 0) return;
    const index = gpuId
      ? this.state.findIndex((s) => s.profile.gpuId === gpuId)
      : this.state.length - 1;
    if (index >= 0) this.state.splice(index, 1);
    if (this.status === "connected") this.emitFrame();
  }

  /** Advance the simulation one step and broadcast the frame. */
  private emitFrame(): void {
    const timestamp = Date.now();

    const gpus: GpuMetric[] = this.state.map((s) => {
      // Utilization drives the system: a slow sine "workload wave"
      // blended with a random walk gives believable bursty load.
      s.phase += 0.05;
      const workloadWave = (Math.sin(s.phase) + 1) / 2; // 0..1
      const walked = randomWalk(s.utilization, RANGES.utilization);
      s.utilization = clamp(
        walked * 0.7 + workloadWave * 100 * 0.3,
        RANGES.utilization.min,
        RANGES.utilization.max
      );

      // Temperature and power lag and correlate with utilization,
      // just like real thermals: hotter/thirstier under heavy load.
      const loadFactor = s.utilization / 100;
      const tempTarget =
        RANGES.temperature.min +
        loadFactor * (RANGES.temperature.max - RANGES.temperature.min - 5);
      s.temperature = clamp(
        s.temperature + (tempTarget - s.temperature) * 0.1 + (Math.random() - 0.5),
        RANGES.temperature.min,
        RANGES.temperature.max
      );

      const powerTarget =
        RANGES.powerDraw.min +
        loadFactor * (RANGES.powerDraw.max - RANGES.powerDraw.min);
      s.powerDraw = clamp(
        s.powerDraw + (powerTarget - s.powerDraw) * 0.15 + (Math.random() - 0.5) * 10,
        RANGES.powerDraw.min,
        RANGES.powerDraw.max
      );

      // VRAM drifts more slowly and independently (model/batch size).
      s.vramUsage = randomWalk(s.vramUsage, {
        ...RANGES.vramUsage,
        max: s.profile.vramTotal,
      });

      // Injected fault: ramp hard toward a sustained critical state so
      // the UI thresholds and alert styling light up on the next ticks.
      if (s.fault) {
        s.utilization = clamp(s.utilization + (100 - s.utilization) * 0.5, 0, 100);
        s.temperature = clamp(s.temperature + (89 - s.temperature) * 0.4, 30, 90);
        s.powerDraw = clamp(s.powerDraw + (690 - s.powerDraw) * 0.4, 100, 700);
        s.vramUsage = clamp(
          s.vramUsage + (s.profile.vramTotal - s.vramUsage) * 0.4,
          0,
          s.profile.vramTotal
        );
      }

      return {
        gpuId: s.profile.gpuId,
        model: s.profile.model,
        utilization: round(s.utilization, 1),
        temperature: round(s.temperature, 1),
        vramUsage: round(s.vramUsage, 1),
        vramTotal: s.profile.vramTotal,
        powerDraw: round(s.powerDraw, 0),
      };
    });

    const frame: TelemetryFrame = { timestamp, gpus };
    this.messageHandlers.forEach((h) => h(frame));
  }
}

const round = (value: number, decimals: number): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};
