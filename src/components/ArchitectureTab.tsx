import { Decisions } from "./architecture/Decisions";
import { FanOut } from "./architecture/FanOut";
import { Intro } from "./architecture/Intro";
import { Lifecycle } from "./architecture/Lifecycle";
import { Pipeline } from "./architecture/Pipeline";
import { TableOfContents } from "./architecture/TableOfContents";

/**
 * A static, illustrated walkthrough of how a telemetry frame travels from
 * the transport layer all the way to an individual GPU card. Each section
 * lives in its own file under ./architecture; this is just the layout.
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
