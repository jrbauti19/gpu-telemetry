import { Database, Gauge, LayoutGrid, Radio, Share2, Sigma } from "lucide-react";
import { Code, CodeBlock, Connector, Section, Stage } from "./primitives";

/** The main data-flow: one frame from the wire to the screen. */
export function Pipeline() {
  return (
    <Section
      id="pipeline"
      title="The data pipeline"
      hint="Follow one frame from the wire to the screen."
    >
      <div>
        <Stage
          step={1}
          icon={Radio}
          title="Transport Layer"
          chip="MockTelemetryStream : TelemetryStream"
        >
          A swappable stream emits a frame on each tick. Today it's a
          simulator; pointing at a real WebSocket is a one-line factory swap —
          the store and UI never know the difference.
          <CodeBlock>{`interface TelemetryStream {
  connect(): void;
  onMessage(cb: (f: TelemetryFrame) => void): () => void;
  onStatusChange(cb: (s: Status) => void): () => void;
}`}</CodeBlock>
        </Stage>

        <Connector label="onMessage(frame)  ·  ~60 fps" />

        <Stage
          step={2}
          icon={Gauge}
          title="Render Throttle"
          chip="requestAnimationFrame · ~20 fps"
        >
          Frames arrive ~60×/sec, but we buffer only the{" "}
          <em className="text-foreground/80">latest</em> one and flush to React
          at most once per 50 ms, coalesced onto an animation frame.
          Intermediate frames are dropped — data stays live, the main thread
          stays free for smooth scrolling.
          <CodeBlock>{`onMessage((frame) => {
  pendingFrame = frame; // keep newest only
  scheduleFlush();      // rAF-coalesced
});`}</CodeBlock>
        </Stage>

        <Connector label="latest frame → reduceFrame()" />

        <Stage
          step={3}
          icon={Sigma}
          title="Pure Reducer"
          chip="frame → Partial<State>"
        >
          A pure function folds the frame into state: an immutable snapshot per
          GPU, an append to each rolling 60s history window, and one recomputed
          fleet aggregate. Pure ⇒ trivially testable, no side effects.
        </Stage>

        <Connector label="set(partial)" />

        <Stage
          step={4}
          icon={Database}
          title="Zustand Store"
          chip="single source of truth"
        >
          One global store holds <Code>status</Code>, <Code>gpuIds</Code>,{" "}
          <Code>snapshots</Code> (keyed by id) and the <Code>aggregate</Code>.
          Zustand is built on <Code>useSyncExternalStore</Code>, so it plugs
          straight into React's rendering model.
          <CodeBlock>{`{
  status, gpuIds,
  snapshots: Record<string, GpuSnapshot>,
  aggregate: FleetAggregate,
}`}</CodeBlock>
        </Stage>

        <Connector label="selector subscriptions" />

        <Stage
          step={5}
          icon={Share2}
          title="Selector Hooks"
          chip="useGpuSnapshot(id) · useFleetAggregate()"
        >
          Each component subscribes to just the slice it reads. A card watches
          only its own GPU, so a tick re-renders the changed leaves — not the
          tree.
          <CodeBlock>{`const snap = useGpuSnapshot(gpuId);
// re-renders ONLY when snapshots[gpuId] changes`}</CodeBlock>
        </Stage>

        <Connector label="live slice" />

        <Stage
          step={6}
          icon={LayoutGrid}
          title="Components"
          chip="Header · FleetSummary · GpuNodeCard × N"
        >
          A virtualized, paginated grid mounts only the ~dozen visible cards.
          Each renders its readouts and Recharts sparklines straight from its
          snapshot's history.
        </Stage>
      </div>
    </Section>
  );
}
