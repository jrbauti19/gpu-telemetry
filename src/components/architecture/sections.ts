/** A single table-of-contents entry, matched to a section `id`. */
export interface TocEntry {
  id: string;
  label: string;
}

/** Ordered sections shown in the tab and its table of contents. */
export const SECTIONS: TocEntry[] = [
  { id: "overview", label: "Overview" },
  { id: "pipeline", label: "The data pipeline" },
  { id: "fan-out", label: "Independent subscriptions" },
  { id: "lifecycle", label: "Connection lifecycle" },
  { id: "decisions", label: "Design decisions" },
];
