import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { SECTIONS } from "./sections";

/**
 * Sticky, scroll-spying table of contents. Highlights the section closest
 * to the top of the viewport and smooth-scrolls to a section on click.
 */
export function TableOfContents() {
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
