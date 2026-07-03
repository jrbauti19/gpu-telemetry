import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Layers,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { GpuNodeCard } from "@/components/GpuNodeCard";
import { useGpuIds, useScaleCluster } from "@/store/telemetryStore";

/** Cluster sizes the "Scale GPU cluster" button cycles through. */
const PRESETS = [8, 100, 1000, 10000];
/** Min card width used to derive a responsive column count. */
const CARD_MIN_WIDTH = 340;
/** Never render more than two columns, regardless of width. */
const MAX_COLUMNS = 2;
/** GPUs shown per page. */
const PAGE_SIZE = 50;
const GAP = 16;
/**
 * Fixed card + row height. Kept fixed (rather than measured per-row) so the
 * virtualizer never has to measure elements during scroll — that measurement
 * is a common cause of scroll jank. Cards are shorter than CARD_HEIGHT, so
 * they never overlap.
 */
const CARD_HEIGHT = 324;
const ROW_HEIGHT = CARD_HEIGHT + GAP;

/**
 * Virtualized, searchable grid of GPU node cards. Only the rows within
 * (and just outside) the viewport are mounted, so the DOM stays small
 * and fluid even at 1,000+ GPUs. Column count adapts to the container
 * width; the "Scale GPU cluster" button ramps the fleet through presets.
 */
export function NodeGrid() {
  const gpuIds = useGpuIds();
  const scaleCluster = useScaleCluster();
  const [query, setQuery] = useState("");
  const sectionRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(MAX_COLUMNS);
  const [scrollMargin, setScrollMargin] = useState(0);
  const [page, setPage] = useState(1);
  const didMount = useRef(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? gpuIds.filter((id) => id.toLowerCase().includes(q)) : gpuIds;
  }, [gpuIds, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageIds = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  // Responsive columns + document offset, recomputed on resize.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const width = el.clientWidth;
      setCols(
        Math.min(
          MAX_COLUMNS,
          Math.max(1, Math.floor((width + GAP) / (CARD_MIN_WIDTH + GAP)))
        )
      );
      setScrollMargin(el.getBoundingClientRect().top + window.scrollY);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // Reset to the first page on a new search; clamp it if the fleet shrinks.
  useEffect(() => setPage(1), [query]);
  useEffect(() => setPage((p) => Math.min(p, pageCount)), [pageCount]);

  // Scroll the grid back into view when the page changes (skip first mount).
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    const el = sectionRef.current;
    if (el) {
      window.scrollTo({
        top: el.getBoundingClientRect().top + window.scrollY - 8,
        behavior: "smooth",
      });
    }
  }, [page]);

  const rowCount = Math.ceil(pageIds.length / cols);
  const virtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => ROW_HEIGHT,
    overscan: 3,
    scrollMargin,
  });

  const handleScale = () => {
    const next = PRESETS.find((p) => p > gpuIds.length) ?? PRESETS[0];
    scaleCluster(next);
    toast.success(`Scaled cluster to ${next.toLocaleString()} GPUs`, {
      description: "Rendering is virtualized — only visible nodes are mounted.",
    });
  };

  return (
    <section ref={sectionRef}>
      <div className="sticky top-0 z-20 -mx-4 mb-4 border-b border-border bg-background/90 px-4 pb-3 pt-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-baseline gap-3">
          <h2 className="text-sm font-medium">Nodes</h2>
          <span className="font-mono text-xs text-muted-foreground">
            {filtered.length.toLocaleString()}
            {query && ` / ${gpuIds.length.toLocaleString()}`} online
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search GPU id…"
              className="h-9 w-48 rounded-md border border-border bg-card pl-8 pr-7 font-mono text-xs outline-none transition-colors focus:border-primary/60"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <button
            onClick={handleScale}
            className="flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow-[0_0_0_1px] shadow-primary/30 transition-all hover:bg-primary/90 hover:shadow-primary/50"
          >
            <Layers className="h-4 w-4" />
            Scale GPU cluster
          </button>
        </div>
        </div>

        {pageCount > 1 && (
          <div className="mt-3 flex items-center justify-between">
            <span className="font-mono text-xs text-muted-foreground">
              {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filtered.length)}{" "}
              of {filtered.length.toLocaleString()}
            </span>
            <PaginationControls
              page={page}
              pageCount={pageCount}
              setPage={setPage}
            />
          </div>
        )}
      </div>

      <div ref={containerRef}>
        {filtered.length === 0 ? (
          <p className="py-16 text-center font-mono text-sm text-muted-foreground">
            {gpuIds.length === 0
              ? "waiting for telemetry stream…"
              : "no GPUs match your search."}
          </p>
        ) : (
          <div
            style={{ height: virtualizer.getTotalSize(), position: "relative" }}
          >
            {virtualizer.getVirtualItems().map((row) => {
              const start = row.index * cols;
              const rowIds = pageIds.slice(start, start + cols);
              return (
                <div
                  key={row.key}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${row.start - virtualizer.options.scrollMargin}px)`,
                  }}
                >
                  <div
                    className="grid gap-4 pb-4"
                    style={{
                      gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                    }}
                  >
                    {rowIds.map((id) => (
                      <div key={id} className="[contain:layout_paint]">
                        <GpuNodeCard gpuId={id} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </section>
  );
}

function PaginationControls({
  page,
  pageCount,
  setPage,
}: {
  page: number;
  pageCount: number;
  setPage: Dispatch<SetStateAction<number>>;
}) {
  return (
    <div className="flex items-center gap-1">
      <PageButton
        onClick={() => setPage(1)}
        disabled={page === 1}
        label="First page"
      >
        <ChevronsLeft className="h-4 w-4" />
      </PageButton>
      <PageButton
        onClick={() => setPage((p) => Math.max(1, p - 1))}
        disabled={page === 1}
        label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </PageButton>
      <span className="px-2 font-mono text-xs text-muted-foreground">
        Page {page} / {pageCount}
      </span>
      <PageButton
        onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
        disabled={page === pageCount}
        label="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </PageButton>
      <PageButton
        onClick={() => setPage(pageCount)}
        disabled={page === pageCount}
        label="Last page"
      >
        <ChevronsRight className="h-4 w-4" />
      </PageButton>
    </div>
  );
}

function PageButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-border disabled:hover:text-muted-foreground"
    >
      {children}
    </button>
  );
}
