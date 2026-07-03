import { Section } from "./primitives";

/** The connection status state machine. */
export function Lifecycle() {
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
