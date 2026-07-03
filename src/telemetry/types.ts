/**
 * Strict type definitions for the GPU telemetry domain.
 * These interfaces are the single source of truth shared by the
 * simulation layer, the state hook, and every UI component.
 */

/** A single GPU's instantaneous metric reading. */
export interface GpuMetric {
  /** Stable unique identifier, e.g. "gpu-0". */
  gpuId: string;
  /** Human-friendly label, e.g. "AMD Instinct MI300X". */
  model: string;
  /** Compute utilization, 0–100 (%). */
  utilization: number;
  /** Core temperature, ~30–90 (°C). */
  temperature: number;
  /** VRAM in use, 0–80 (GB). */
  vramUsage: number;
  /** Total VRAM capacity in GB (constant per GPU). */
  vramTotal: number;
  /** Board power draw, ~100–700 (W). */
  powerDraw: number;
}

/**
 * A complete frame emitted by the stream on each tick.
 * Mirrors the shape a real WebSocket server would push.
 */
export interface TelemetryFrame {
  /** Epoch milliseconds when the frame was produced. */
  timestamp: number;
  /** One metric entry per GPU node. */
  gpus: GpuMetric[];
}

/** Lifecycle status of the telemetry connection. */
export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected";

/** Listener signatures mirroring the WebSocket event model. */
export type MessageHandler = (frame: TelemetryFrame) => void;
export type StatusHandler = (status: ConnectionStatus) => void;

/**
 * Minimal contract the UI depends on. Implemented by
 * `MockTelemetryStream` today and swappable for a real
 * WebSocket-backed client tomorrow without UI changes.
 */
export interface TelemetryStream {
  connect(): void;
  disconnect(): void;
  onMessage(handler: MessageHandler): () => void;
  onStatusChange(handler: StatusHandler): () => void;
  getStatus(): ConnectionStatus;
}

/** A metric threshold band for color-coded UI indicators. */
export type MetricSeverity = "nominal" | "warning" | "critical";
