import { Cpu, Database } from "lucide-react";
import { Code, Section } from "./primitives";

/** Visualizes the store fanning out to independent per-id subscriptions. */
export function FanOut() {
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
