import { Code } from "./primitives";

export function Intro() {
  return (
    <section id="overview" className="scroll-mt-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-primary">
        how it works
      </p>
      <h2 className="mt-2 text-lg font-semibold tracking-tight">
        One stream in, many independent cards out
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        A single data stream pushes a full <Code>TelemetryFrame</Code> on every
        tick. That frame is throttled, reduced into an immutable state slice,
        and stored once — then each component subscribes to exactly the sliver
        it needs. The result: at 1,000+ GPUs a data tick only re-renders the
        handful of cards whose numbers actually changed.
      </p>
    </section>
  );
}
