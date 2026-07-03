import { Gauge, LayoutGrid, Radio, Zap } from "lucide-react";
import type { ComponentType } from "react";
import { Section } from "./primitives";

/** Grid of the headline architectural trade-offs. */
export function Decisions() {
  const items: {
    icon: ComponentType<{ className?: string }>;
    title: string;
    body: string;
  }[] = [
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
