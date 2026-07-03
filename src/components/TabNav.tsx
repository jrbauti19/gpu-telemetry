import { LayoutDashboard, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";

export type TabKey = "dashboard" | "architecture";

const TABS: {
  key: TabKey;
  label: string;
  icon: typeof LayoutDashboard;
}[] = [
  { key: "dashboard", label: "Live Dashboard", icon: LayoutDashboard },
  { key: "architecture", label: "Architecture", icon: Workflow },
];

/**
 * Minimal underline tab bar. Purely presentational — the active tab and
 * change handler are owned by the parent so it can swap the page body.
 */
export function TabNav({
  value,
  onChange,
}: {
  value: TabKey;
  onChange: (key: TabKey) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Views"
      className="mb-6 flex items-center gap-1 border-b border-border"
    >
      {TABS.map(({ key, label, icon: Icon }) => {
        const active = value === key;
        return (
          <button
            key={key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(key)}
            className={cn(
              "relative -mb-px flex items-center gap-2 px-4 py-2.5 font-mono text-xs tracking-wide transition-colors",
              active
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
            {active && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />
            )}
          </button>
        );
      })}
    </div>
  );
}
