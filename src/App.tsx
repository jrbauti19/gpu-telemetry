import { useEffect, useRef, useState } from "react";
import { Toaster, toast } from "sonner";
import { ArchitectureTab } from "@/components/ArchitectureTab";
import { Dashboard } from "@/components/Dashboard";
import { DashboardHeader } from "@/components/DashboardHeader";
import { DemoControlPanel } from "@/components/DemoControlPanel";
import { TabNav, type TabKey } from "@/components/TabNav";
import { useStatus, useTelemetryConnection } from "@/store/telemetryStore";

/**
 * Fire a success toast when the stream comes back — but only after a
 * genuine drop, so the initial idle -> connecting -> connected boot
 * sequence stays quiet.
 */
function useReconnectToast() {
  const status = useStatus();
  const droppedRef = useRef(false);

  useEffect(() => {
    if (status === "disconnected") {
      droppedRef.current = true;
    } else if (status === "connected" && droppedRef.current) {
      droppedRef.current = false;
      toast.success("Reconnected", {
        description: "Telemetry stream restored.",
      });
    }
  }, [status]);
}

export default function App() {
  // Owning the connection here keeps the stream alive across tab switches,
  // so returning to the dashboard shows uninterrupted, live history.
  useTelemetryConnection();
  useReconnectToast();

  const [tab, setTab] = useState<TabKey>("dashboard");

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10">
        <DashboardHeader />
        <TabNav value={tab} onChange={setTab} />

        {tab === "dashboard" ? <Dashboard /> : <ArchitectureTab />}

        <footer className="mt-10 flex flex-col gap-1 border-t border-border pt-4 font-mono text-[11px] text-muted-foreground sm:flex-row sm:justify-between">
          <span>Rack A · AMD Instinct MI300X cluster · streaming at ~60 fps</span>
          <span>
            source{" "}
            <code className="text-foreground/70">MockTelemetryStream</code> —
            point at a WebSocket URL to go live
          </span>
        </footer>
      </div>

      {tab === "dashboard" && <DemoControlPanel />}

      <Toaster
        theme="dark"
        position="bottom-center"
        toastOptions={{
          style: {
            background: "hsl(200 24% 7%)",
            border: "1px solid hsl(200 16% 15%)",
            color: "hsl(195 20% 95%)",
          },
        }}
      />
    </div>
  );
}
