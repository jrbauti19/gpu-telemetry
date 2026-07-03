import {
  ArrowDown,
  Cpu,
  Database,
  Gauge,
  LayoutGrid,
  Radio,
  Share2,
  Sigma,
  Zap,
} from "lucide-react";
import { Highlight, type PrismTheme } from "prism-react-renderer";
import { useEffect, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Prism theme tuned to the app's cyan-on-graphite palette. */
const codeTheme: PrismTheme = {
  plain: { color: "hsl(195 20% 78%)", backgroundColor: "transparent" },
  styles: [
    {
      types: ["comment", "prolog", "doctype", "cdata"],
      style: { color: "hsl(200 12% 45%)", fontStyle: "italic" },
    },
    { types: ["punctuation"], style: { color: "hsl(195 15% 55%)" } },
    {
      types: ["keyword", "operator", "atrule", "tag"],
      style: { color: "hsl(187 95% 55%)" },
    },
    {
      types: ["string", "char", "inserted", "attr-value"],
      style: { color: "hsl(150 52% 66%)" },
    },
    {
      types: ["number", "boolean", "constant", "symbol"],
      style: { color: "hsl(38 92% 62%)" },
    },
    { types: ["function", "method"], style: { color: "hsl(205 90% 74%)" } },
    {
      types: ["class-name", "builtin", "maybe-class-name"],
      style: { color: "hsl(190 70% 72%)" },
    },
    { types: ["deleted"], style: { color: "hsl(0 70% 66%)" } },
  ],
};

/**
 * A static, illustrated walkthrough of how a telemetry frame travels from
 * the transport layer all the way to an individual GPU card. No live state
 * here — it reads the architecture, it doesn't run it.
 */
export function ArchitectureTab() {
  return (
    <div className="mt-2 grid grid-cols-1 gap-10 pb-4 lg:grid-cols-[minmax(0,1fr)_13rem]">
      <div className="min-w-0 max-w-3xl space-y-12">
        <Intro />
        <Pipeline />
        <FanOut />
        <Lifecycle />
        <Decisions />
      </div>
      <TableOfContents />
    </div>
  );
}

/* ---- Table of contents (scroll-spy) --------------------------------------- */

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "pipeline", label: "The data pipeline" },
  { id: "fan-out", label: "Independent subscriptions" },
  { id: "lifecycle", label: "Connection lifecycle" },
  { id: "decisions", label: "Design decisions" },
];

function TableOfContents() {
  const [active, setActive] = useState<string>(SECTIONS[0].id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "0px 0px -65% 0px", threshold: 0 }
    );
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActive(id);
  };

  return (
    <aside className="hidden lg:block">
      <div className="sticky top-8">
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          On this page
        </p>
        <nav className="flex flex-col border-l border-border">
          {SECTIONS.map(({ id, label }) => {
            const isActive = active === id;
            return (
              <a
                key={id}
                href={`#${id}`}
                onClick={(e) => {
                  e.preventDefault();
                  scrollTo(id);
                }}
                className={cn(
                  "-ml-px border-l-2 py-1.5 pl-3 text-xs transition-colors",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </a>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

/* -------------------------------------------------------------------------- */

function Intro() {
  return (
    <section id="overview" className="scroll-mt-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-primary">
        how it works
      </p>
      <h2 className="mt-2 text-lg font-semibold tracking-tight">
        One stream in, many independent cards out
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        A single data stream pushes a full{" "}
        <Code>TelemetryFrame</Code> on every tick. That frame is throttled,
        reduced into an immutable state slice, and stored once — then each
        component subscribes to exactly the sliver it needs. The result: at
        1,000+ GPUs a data tick only re-renders the handful of cards whose
        numbers actually changed.
      </p>
    </section>
  );
}

/* ---- The main pipeline ---------------------------------------------------- */

function Pipeline() {
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
          A pure function folds the frame into state: an immutable snapshot
          per GPU, an append to each rolling 60s history window, and one
          recomputed fleet aggregate. Pure ⇒ trivially testable, no side
          effects.
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

/* ---- Fan-out visualization ------------------------------------------------ */

function FanOut() {
  const ids = ["GPU-000001", "GPU-000002", "GPU-000003"];
  return (
    <Section
      id="fan-out"
      title="Why it stays fast: independent subscriptions"
      hint="The store fans out to cards through per-id selectors."
    >
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="mx-auto flex w-full max-w-xs items-center justify-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-4 py-3 text-primary">
          <Database className="h-4 w-4" />
          <span className="font-mono text-xs">Zustand store · snapshots</span>
        </div>

        <div className="flex justify-center">
          <div className="h-6 w-px bg-border" />
        </div>
        <p className="text-center font-mono text-[11px] text-muted-foreground">
          fan-out via <Code>useGpuSnapshot(id)</Code>
        </p>
        <div className="flex justify-center">
          <div className="h-6 w-px bg-border" />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {ids.map((id) => (
            <div
              key={id}
              className="rounded-md border border-border bg-background/50 p-3"
            >
              <div className="flex items-center gap-2">
                <Cpu className="h-3.5 w-3.5 text-primary" />
                <span className="font-mono text-xs">{id}</span>
              </div>
              <p className="mt-1.5 font-mono text-[10px] text-muted-foreground">
                subscribes to snapshots['{id.toLowerCase()}']
              </p>
            </div>
          ))}
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          A change to one GPU wakes only that card. The other{" "}
          <span className="text-foreground/80">N − 1</span> cards stay put.
        </p>
      </div>
    </Section>
  );
}

/* ---- Connection lifecycle ------------------------------------------------- */

function Lifecycle() {
  const states = [
    { label: "idle", tone: "text-muted-foreground" },
    { label: "connecting", tone: "text-amber-400" },
    { label: "connected", tone: "text-primary" },
    { label: "disconnected", tone: "text-red-400" },
  ];
  return (
    <Section
      id="lifecycle"
      title="Connection lifecycle"
      hint="Status is its own store slice, so the header updates without touching card data."
    >
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-5">
        {states.map((s, i) => (
          <div key={s.label} className="flex items-center gap-2">
            <span
              className={`rounded border border-border bg-background/60 px-2.5 py-1 font-mono text-xs ${s.tone}`}
            >
              {s.label}
            </span>
            {i < states.length - 1 && (
              <span className="font-mono text-xs text-border">→</span>
            )}
          </div>
        ))}
        <span className="ml-1 font-mono text-xs text-muted-foreground">
          ↺ auto-reconnect → toast
        </span>
      </div>
    </Section>
  );
}

/* ---- Design decisions ----------------------------------------------------- */

function Decisions() {
  const items: { icon: ComponentType<{ className?: string }>; title: string; body: string }[] = [
    {
      icon: Radio,
      title: "Swappable transport",
      body: "UI depends on a TelemetryStream interface, not a WebSocket. Mock today, live tomorrow — zero UI changes.",
    },
    {
      icon: Gauge,
      title: "Render decoupled from data",
      body: "Ingest at 60 fps, repaint at ~20 fps. The eye can't tell; the CPU can.",
    },
    {
      icon: LayoutGrid,
      title: "Virtualized + paginated",
      body: "Only the visible rows mount, so 10,000 GPUs cost about the same as 10 to render.",
    },
    {
      icon: Zap,
      title: "Fixed-height + CSS containment",
      body: "No per-row measurement and localized repaints keep scrolling smooth under a live stream.",
    },
  ];
  return (
    <Section id="decisions" title="Key design decisions">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="rounded-lg border border-border bg-card p-4"
          >
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">{title}</h3>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              {body}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ---- Small building blocks ------------------------------------------------ */

function Section({
  id,
  title,
  hint,
  children,
}: {
  id?: string;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6">
      <div className="mb-4">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Stage({
  step,
  icon: Icon,
  title,
  chip,
  children,
}: {
  step: number;
  icon: ComponentType<{ className?: string }>;
  title: string;
  chip?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-4 rounded-lg border border-border bg-card p-5">
      <div className="flex flex-col items-center">
        <span className="flex h-9 w-9 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <span className="mt-2 font-mono text-[10px] text-muted-foreground">
          {step}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">{title}</h3>
          {chip && <Chip>{chip}</Chip>}
        </div>
        <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {children}
        </div>
      </div>
    </div>
  );
}

function Connector({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-1.5 pl-[38px]">
      <ArrowDown className="h-4 w-4 shrink-0 text-primary/60" />
      {label && (
        <span className="font-mono text-[11px] text-muted-foreground">
          {label}
        </span>
      )}
    </div>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded border border-border bg-background/60 px-1.5 py-0.5 font-mono text-[10px] text-primary/80">
      {children}
    </span>
  );
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-background/60 px-1 py-0.5 font-mono text-[0.85em] text-primary/90">
      {children}
    </code>
  );
}

function CodeBlock({
  children,
  language = "tsx",
}: {
  children: string;
  language?: string;
}) {
  return (
    <Highlight code={children.trim()} language={language} theme={codeTheme}>
      {({ tokens, getLineProps, getTokenProps }) => (
        <pre className="mt-3 overflow-x-auto rounded-md border border-border bg-background/60 p-3 font-mono text-[11px] leading-relaxed">
          {tokens.map((line, i) => (
            <div key={i} {...getLineProps({ line })}>
              {line.map((token, key) => (
                <span key={key} {...getTokenProps({ token })} />
              ))}
            </div>
          ))}
        </pre>
      )}
    </Highlight>
  );
}
