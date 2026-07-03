import { ArrowDown } from "lucide-react";
import { Highlight, type PrismTheme } from "prism-react-renderer";
import type { ComponentType, ReactNode } from "react";

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

/** A titled, anchorable content block. */
export function Section({
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

/** A numbered step in the pipeline flow. */
export function Stage({
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

/** Down-arrow connector with an optional annotation between stages. */
export function Connector({ label }: { label?: string }) {
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

/** Small inline label pill. */
export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded border border-border bg-background/60 px-1.5 py-0.5 font-mono text-[10px] text-primary/80">
      {children}
    </span>
  );
}

/** Inline monospaced token. */
export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-background/60 px-1 py-0.5 font-mono text-[0.85em] text-primary/90">
      {children}
    </code>
  );
}

/** Syntax-highlighted code block. */
export function CodeBlock({
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
